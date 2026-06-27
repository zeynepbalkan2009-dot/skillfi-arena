/**
 * Hand-trimmed ABI fragment matching SkillFiEscrow.sol exactly.
 *
 * Only includes what this frontend actually calls:
 *  - createMatch (the write the CreateChallengeModal performs)
 *  - matches (the public mapping getter, used for on-chain status checks)
 *  - MatchCreated (decoded server-side to verify a claimed deposit)
 *
 * If you add UI for joinMatch/settleMatch/cancelMatch later, extend this
 * array rather than maintaining a second ABI file.
 */
export const skillFiEscrowAbi = [
  {
    type: "function",
    name: "createMatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_matchId", type: "bytes32" },
      { name: "_entryFee", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "matches",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [
      { name: "playerA", type: "address" },
      { name: "status", type: "uint8" },
      { name: "createdAt", type: "uint40" },
      { name: "playerB", type: "address" },
      { name: "winner", type: "address" },
      { name: "entryFee", type: "uint256" },
      { name: "matchId", type: "bytes32" },
    ],
  },
  {
    type: "event",
    name: "MatchCreated",
    inputs: [
      { name: "matchId", type: "bytes32", indexed: true },
      { name: "playerA", type: "address", indexed: true },
      { name: "entryFee", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
