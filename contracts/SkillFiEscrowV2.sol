// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract SkillFiEscrowV2 is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    IERC20 public immutable token;
    address public treasury;
    uint256 public platformFeeBps;
    uint256 public matchTimeout = 30 minutes;

    enum MatchStatus {
        NONE,
        WAITING_FOR_PLAYERS,
        READY,
        IN_PROGRESS,
        RESOLVED,
        DISPUTED,
        CANCELLED,
        EXPIRED
    }

    struct Match {
        address player1;
        address player2;
        uint256 entryFee;
        uint256 createdAt;
        bool player1Deposited;
        bool player2Deposited;
        MatchStatus status;
    }

    mapping(uint256 => Match) public matches;

    event MatchCreated(uint256 indexed matchId, address indexed player1, uint256 entryFee);
    event PlayerJoined(uint256 indexed matchId, address indexed player);
    event MatchReady(uint256 indexed matchId);
    event MatchStarted(uint256 indexed matchId);
    event MatchResolved(uint256 indexed matchId, address indexed winner, uint256 prize);
    event MatchDisputed(uint256 indexed matchId);
    event MatchCancelled(uint256 indexed matchId);
    event MatchExpired(uint256 indexed matchId);
    event MatchRefunded(uint256 indexed matchId, address indexed player, uint256 amount);
    event TreasuryUpdated(address treasury);

    constructor(address _token, address _operator, address _arbiter, address _treasury, uint256 _feeBps) {
        require(_token != address(0), "invalid token");
        require(_treasury != address(0), "invalid treasury");
        require(_feeBps <= 1000, "max fee 10%");
        token = IERC20(_token);
        treasury = _treasury;
        platformFeeBps = _feeBps;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, _operator);
        _grantRole(ARBITER_ROLE, _arbiter);
    }

    function createMatch(uint256 matchId, uint256 entryFee, address player1)
        external onlyRole(OPERATOR_ROLE) whenNotPaused
    {
        require(matches[matchId].status == MatchStatus.NONE, "exists");
        require(entryFee > 0, "invalid fee");
        require(player1 != address(0), "invalid player1");
        matches[matchId] = Match({
            player1: player1,
            player2: address(0),
            entryFee: entryFee,
            createdAt: block.timestamp,
            player1Deposited: false,
            player2Deposited: false,
            status: MatchStatus.WAITING_FOR_PLAYERS
        });
        emit MatchCreated(matchId, player1, entryFee);
    }

    function joinMatch(uint256 matchId) external nonReentrant whenNotPaused {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.WAITING_FOR_PLAYERS, "invalid state");

        if (!m.player1Deposited) {
            require(msg.sender == m.player1, "reserved for player1");
            require(token.transferFrom(msg.sender, address(this), m.entryFee), "transfer failed");
            m.player1Deposited = true;
        } else {
            require(m.player2 == address(0), "full");
            require(msg.sender != m.player1, "already joined");
            require(token.transferFrom(msg.sender, address(this), m.entryFee), "transfer failed");
            m.player2 = msg.sender;
            m.player2Deposited = true;
            m.status = MatchStatus.READY;
            emit MatchReady(matchId);
        }

        emit PlayerJoined(matchId, msg.sender);
    }

    function startMatch(uint256 matchId) external onlyRole(OPERATOR_ROLE) {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.READY, "not ready");
        m.status = MatchStatus.IN_PROGRESS;
        emit MatchStarted(matchId);
    }

    function resolveMatch(uint256 matchId, address winner)
        external onlyRole(OPERATOR_ROLE) nonReentrant
    {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.IN_PROGRESS, "invalid state");
        require(winner == m.player1 || winner == m.player2, "invalid winner");
        m.status = MatchStatus.RESOLVED;
        uint256 totalPrize = m.entryFee * 2;
        uint256 fee = (totalPrize * platformFeeBps) / 10000;
        uint256 payout = totalPrize - fee;
        require(token.transfer(winner, payout), "payout failed");
        if (fee > 0) require(token.transfer(treasury, fee), "fee failed");
        emit MatchResolved(matchId, winner, payout);
    }

    function disputeMatch(uint256 matchId) external whenNotPaused {
        Match storage m = matches[matchId];
        require(msg.sender == m.player1 || msg.sender == m.player2, "not participant");
        require(m.status == MatchStatus.IN_PROGRESS, "invalid state");
        m.status = MatchStatus.DISPUTED;
        emit MatchDisputed(matchId);
    }

    function resolveDispute(uint256 matchId, address winner) external onlyRole(ARBITER_ROLE) {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.DISPUTED, "not disputed");
        require(winner == m.player1 || winner == m.player2, "invalid winner");
        uint256 totalPrize = m.entryFee * 2;
        uint256 fee = (totalPrize * platformFeeBps) / 10000;
        uint256 payout = totalPrize - fee;
        m.status = MatchStatus.RESOLVED;
        require(token.transfer(winner, payout), "transfer failed");
        if (fee > 0) require(token.transfer(treasury, fee), "fee failed");
        emit MatchResolved(matchId, winner, payout);
    }

    function cancelMatch(uint256 matchId) external onlyRole(OPERATOR_ROLE) nonReentrant {
        Match storage m = matches[matchId];
        require(m.status != MatchStatus.RESOLVED, "resolved");
        _refund(matchId);
        m.status = MatchStatus.CANCELLED;
        emit MatchCancelled(matchId);
    }

    function refundExpiredMatch(uint256 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.WAITING_FOR_PLAYERS, "invalid state");
        require(block.timestamp > m.createdAt + matchTimeout, "not expired");
        _refund(matchId);
        m.status = MatchStatus.EXPIRED;
        emit MatchExpired(matchId);
    }

    function _refund(uint256 matchId) internal {
        Match storage m = matches[matchId];
        if (m.player1Deposited) {
            require(token.transfer(m.player1, m.entryFee), "refund1 failed");
            emit MatchRefunded(matchId, m.player1, m.entryFee);
        }
        if (m.player2Deposited) {
            require(token.transfer(m.player2, m.entryFee), "refund2 failed");
            emit MatchRefunded(matchId, m.player2, m.entryFee);
        }
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "invalid");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setFee(uint256 _feeBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_feeBps <= 1000, "max 10%");
        platformFeeBps = _feeBps;
    }

    function setTimeout(uint256 _timeout) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_timeout >= 5 minutes, "too low");
        matchTimeout = _timeout;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
