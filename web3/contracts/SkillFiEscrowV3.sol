// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract SkillFiEscrowV3 is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ARBITER_ROLE = keccak256("ARBITER_ROLE");

    IERC20 public immutable token;
    address public treasury;
    uint256 public platformFeeBps;

    // Defaults for newly-created matches. Every economic/liveness rule is
    // snapshotted at creation, before any player deposit, so governance changes
    // can affect only future matches.
    uint256 public matchTimeout = 30 minutes;
    uint256 public readyMatchGrace = 10 minutes;
    uint256 public activeMatchTimeout = 30 minutes;
    uint256 public disputeTimeout = 7 days;

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
        uint256 startedAt;
        address winner;
        uint256 feeBpsAtCreation;
        uint256 waitingTimeoutAtCreation;
        uint256 readyGraceAtCreation;
        uint256 activeTimeoutAtCreation;
        address treasuryAtCreation;
        uint256 disputedAt;
        uint256 disputeTimeoutAtCreation;
    }

    mapping(uint256 => Match) public matches;

    event MatchCreated(uint256 indexed matchId, uint256 entryFee);
    event PlayerJoined(uint256 indexed matchId, address indexed player);
    event MatchReady(uint256 indexed matchId);
    event MatchStarted(uint256 indexed matchId);
    event MatchResolved(uint256 indexed matchId, address indexed winner, uint256 prize);
    event MatchDisputed(uint256 indexed matchId);
    event MatchCancelled(uint256 indexed matchId);
    event MatchExpired(uint256 indexed matchId);
    event MatchRefunded(uint256 indexed matchId, address indexed player, uint256 amount);
    event TreasuryUpdated(address treasury);
    event WaitingTimeoutUpdated(uint256 timeoutSeconds);
    event ReadyGraceUpdated(uint256 graceSeconds);
    event ActiveTimeoutUpdated(uint256 timeoutSeconds);
    event DisputeTimeoutUpdated(uint256 timeoutSeconds);

    constructor(
        address _token,
        address _admin,
        address _operator,
        address _arbiter,
        address _treasury,
        uint256 _feeBps
    ) {
        require(_token != address(0), "invalid token");
        require(_admin != address(0), "invalid admin");
        require(_operator != address(0), "invalid operator");
        require(_arbiter != address(0), "invalid arbiter");
        require(_treasury != address(0), "invalid treasury");
        require(_feeBps <= 1000, "max fee 10%");
        require(
            _admin != _operator &&
                _admin != _arbiter &&
                _admin != _treasury &&
                _operator != _arbiter &&
                _operator != _treasury &&
                _arbiter != _treasury,
            "role overlap"
        );

        token = IERC20(_token);
        treasury = _treasury;
        platformFeeBps = _feeBps;

        // The deployment key receives no persistent control role. A dedicated
        // admin (ideally a multisig for value-bearing releases) owns governance.
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _operator);
        _grantRole(ARBITER_ROLE, _arbiter);
    }

    // Role separation is a contract invariant, not just a deployment-script
    // convention. Admin/operator/arbiter/treasury identities cannot be merged
    // later through AccessControl grants.
    function grantRole(bytes32 role, address account) public override {
        _requireRoleSeparation(role, account);
        super.grantRole(role, account);
    }

    function _requireRoleSeparation(bytes32 role, address account) internal view {
        require(account != address(0), "invalid role account");
        if (role == OPERATOR_ROLE) {
            require(
                !hasRole(ARBITER_ROLE, account) &&
                    !hasRole(DEFAULT_ADMIN_ROLE, account) &&
                    account != treasury,
                "role overlap"
            );
        } else if (role == ARBITER_ROLE) {
            require(
                !hasRole(OPERATOR_ROLE, account) &&
                    !hasRole(DEFAULT_ADMIN_ROLE, account) &&
                    account != treasury,
                "role overlap"
            );
        } else if (role == DEFAULT_ADMIN_ROLE) {
            require(
                !hasRole(OPERATOR_ROLE, account) &&
                    !hasRole(ARBITER_ROLE, account) &&
                    account != treasury,
                "role overlap"
            );
        }
    }

    function createMatch(uint256 matchId, uint256 entryFee, address expectedPlayer1)
        external
        onlyRole(OPERATOR_ROLE)
        whenNotPaused
    {
        require(matches[matchId].status == MatchStatus.NONE, "exists");
        require(entryFee > 0, "invalid fee");
        require(expectedPlayer1 != address(0), "invalid player1");

        matches[matchId] = Match({
            player1: expectedPlayer1,
            player2: address(0),
            entryFee: entryFee,
            createdAt: block.timestamp,
            player1Deposited: false,
            player2Deposited: false,
            status: MatchStatus.WAITING_FOR_PLAYERS,
            startedAt: 0,
            winner: address(0),
            feeBpsAtCreation: platformFeeBps,
            waitingTimeoutAtCreation: matchTimeout,
            readyGraceAtCreation: readyMatchGrace,
            activeTimeoutAtCreation: activeMatchTimeout,
            treasuryAtCreation: treasury,
            disputedAt: 0,
            disputeTimeoutAtCreation: disputeTimeout
        });

        emit MatchCreated(matchId, entryFee);
    }

    function joinMatch(uint256 matchId) external nonReentrant whenNotPaused {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.WAITING_FOR_PLAYERS, "invalid state");
        require(block.timestamp <= m.createdAt + m.waitingTimeoutAtCreation, "match expired");

        if (!m.player1Deposited) {
            require(msg.sender == m.player1, "not creator");
            token.safeTransferFrom(msg.sender, address(this), m.entryFee);
            m.player1Deposited = true;
            emit PlayerJoined(matchId, msg.sender);
            return;
        }

        require(m.player2 == address(0), "full");
        require(msg.sender != m.player1, "already joined");
        token.safeTransferFrom(msg.sender, address(this), m.entryFee);
        m.player2 = msg.sender;
        m.player2Deposited = true;
        m.status = MatchStatus.READY;
        emit MatchReady(matchId);
        emit PlayerJoined(matchId, msg.sender);
    }

    function startMatch(uint256 matchId) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.READY, "not ready");
        require(
            block.timestamp <= m.createdAt + m.waitingTimeoutAtCreation + m.readyGraceAtCreation,
            "ready match expired"
        );
        m.status = MatchStatus.IN_PROGRESS;
        m.startedAt = block.timestamp;
        emit MatchStarted(matchId);
    }

    function resolveMatch(uint256 matchId, address winner)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
        whenNotPaused
    {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.IN_PROGRESS, "invalid state");
        require(m.startedAt != 0, "not started");
        require(block.timestamp <= m.startedAt + m.activeTimeoutAtCreation, "match expired");
        require(winner == m.player1 || winner == m.player2, "invalid winner");
        m.status = MatchStatus.RESOLVED;
        m.winner = winner;
        _payoutWinner(matchId, m, winner);
    }

    function disputeMatch(uint256 matchId) external whenNotPaused {
        Match storage m = matches[matchId];
        require(msg.sender == m.player1 || msg.sender == m.player2, "not participant");
        require(m.status == MatchStatus.IN_PROGRESS, "invalid state");
        require(m.startedAt != 0, "not started");
        require(block.timestamp <= m.startedAt + m.activeTimeoutAtCreation, "match expired");
        m.status = MatchStatus.DISPUTED;
        m.disputedAt = block.timestamp;
        emit MatchDisputed(matchId);
    }

    // Dispute resolution remains available while paused so an emergency pause
    // cannot strand already-disputed player funds. Once the locked dispute
    // deadline passes, only reclaimDisputedMatch may unwind the funds.
    function resolveDispute(uint256 matchId, address winner)
        external
        onlyRole(ARBITER_ROLE)
        nonReentrant
    {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.DISPUTED, "not disputed");
        require(m.disputedAt != 0, "not disputed");
        require(block.timestamp <= m.disputedAt + m.disputeTimeoutAtCreation, "dispute expired");
        require(winner == m.player1 || winner == m.player2, "invalid winner");
        m.status = MatchStatus.RESOLVED;
        m.winner = winner;
        _payoutWinner(matchId, m, winner);
    }

    function cancelMatch(uint256 matchId) external onlyRole(OPERATOR_ROLE) nonReentrant {
        Match storage m = matches[matchId];
        require(
            m.status == MatchStatus.WAITING_FOR_PLAYERS || m.status == MatchStatus.READY,
            "invalid state"
        );
        m.status = MatchStatus.CANCELLED;
        _refund(matchId);
        emit MatchCancelled(matchId);
    }

    function refundExpiredMatch(uint256 matchId) external nonReentrant { _expireWaitingMatch(matchId); }
    function reclaimExpiredMatch(uint256 matchId) external nonReentrant { _expireWaitingMatch(matchId); }

    function reclaimReadyMatch(uint256 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.READY, "invalid state");
        require(block.timestamp > m.createdAt + m.waitingTimeoutAtCreation + m.readyGraceAtCreation, "not expired");
        m.status = MatchStatus.EXPIRED;
        _refund(matchId);
        emit MatchExpired(matchId);
    }

    function reclaimActiveMatch(uint256 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.IN_PROGRESS, "invalid state");
        require(m.startedAt != 0, "not started");
        require(m.activeTimeoutAtCreation >= 5 minutes, "invalid timeout");
        require(block.timestamp > m.startedAt + m.activeTimeoutAtCreation, "not expired");
        m.status = MatchStatus.EXPIRED;
        _refund(matchId);
        emit MatchExpired(matchId);
    }

    function reclaimDisputedMatch(uint256 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.DISPUTED, "invalid state");
        require(m.disputedAt != 0, "not disputed");
        require(m.disputeTimeoutAtCreation >= 1 days, "invalid timeout");
        require(block.timestamp > m.disputedAt + m.disputeTimeoutAtCreation, "not expired");
        m.status = MatchStatus.EXPIRED;
        _refund(matchId);
        emit MatchExpired(matchId);
    }

    function _expireWaitingMatch(uint256 matchId) internal {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.WAITING_FOR_PLAYERS, "invalid state");
        require(block.timestamp > m.createdAt + m.waitingTimeoutAtCreation, "not expired");
        m.status = MatchStatus.EXPIRED;
        _refund(matchId);
        emit MatchExpired(matchId);
    }

    function _payoutWinner(uint256 matchId, Match storage m, address winner) internal {
        uint256 totalPrize = m.entryFee * 2;
        uint256 fee = (totalPrize * m.feeBpsAtCreation) / 10000;
        uint256 payout = totalPrize - fee;
        token.safeTransfer(winner, payout);
        if (fee > 0) token.safeTransfer(m.treasuryAtCreation, fee);
        emit MatchResolved(matchId, winner, payout);
    }

    function _refund(uint256 matchId) internal {
        Match storage m = matches[matchId];
        if (m.player1Deposited) {
            m.player1Deposited = false;
            token.safeTransfer(m.player1, m.entryFee);
            emit MatchRefunded(matchId, m.player1, m.entryFee);
        }
        if (m.player2Deposited) {
            m.player2Deposited = false;
            token.safeTransfer(m.player2, m.entryFee);
            emit MatchRefunded(matchId, m.player2, m.entryFee);
        }
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "invalid");
        require(
            !hasRole(DEFAULT_ADMIN_ROLE, _treasury) &&
                !hasRole(OPERATOR_ROLE, _treasury) &&
                !hasRole(ARBITER_ROLE, _treasury),
            "role overlap"
        );
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
        emit WaitingTimeoutUpdated(_timeout);
    }
    function setReadyGrace(uint256 _grace) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_grace >= 1 minutes, "too low");
        require(_grace <= 1 hours, "too high");
        readyMatchGrace = _grace;
        emit ReadyGraceUpdated(_grace);
    }
    function setActiveTimeout(uint256 _timeout) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_timeout >= 5 minutes, "too low");
        activeMatchTimeout = _timeout;
        emit ActiveTimeoutUpdated(_timeout);
    }
    function setDisputeTimeout(uint256 _timeout) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_timeout >= 1 days, "too low");
        require(_timeout <= 30 days, "too high");
        disputeTimeout = _timeout;
        emit DisputeTimeoutUpdated(_timeout);
    }
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
