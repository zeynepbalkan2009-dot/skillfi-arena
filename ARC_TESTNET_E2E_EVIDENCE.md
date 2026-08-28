# SkillFi Arena — Arc Testnet End-to-End Settlement Evidence

Completed: 28 August 2026

## Deployment

- Network: Arc Testnet
- Chain ID: `5042002`
- Escrow: [`0x263c8Eed47F11b7cd7E292139Afb5F774F033BFc`](https://testnet.arcscan.app/address/0x263c8Eed47F11b7cd7E292139Afb5F774F033BFc)
- Canonical USDC interface: `0x3600000000000000000000000000000000000000`
- Match ID: `109979475502916595324302803443184956461`
- Entry per player: `1 USDC` (`1000000` ERC-20 base units)
- Player 1 / winner: `0xC86938446034FDC114e8422bC13dd18b9ED2F99F`
- Player 2: `0x50244D00F0Ae8d4e799c1f81b0e2B29B695F2aDE`

## Transaction trail

1. [Fund application operator](https://testnet.arcscan.app/tx/0x2d16a422d7e6b10bc1e0cd307fa33caca6abfc1a515e68a350e5447ed4036c3c)
2. [Fund second player](https://testnet.arcscan.app/tx/0x1c9fd95ea9312daccd912a58268bbb6f8d4bada4f1a3e1da3fcdc360a5f6ea7e)
3. [Create match](https://testnet.arcscan.app/tx/0xe61af76d28336df5e967b74a81c5465da3240e3bd89af0155a9d8e9f48447bca)
4. [Player 1 approval](https://testnet.arcscan.app/tx/0xcacbe141a3c4fdc08a6d7c6472bd0afbe5449318056e55c539e38a4dbdd2c4a6)
5. [Player 1 deposit](https://testnet.arcscan.app/tx/0x1ab3e82df1b9ed8b4b1893bf3c9f536864b88b15acfd9a14ee82e7305253ecbc)
6. [Player 2 approval](https://testnet.arcscan.app/tx/0x42227362450eea41551ac7201c31941c7b8eec8f774c2bc4b414f5d1ad35ca16)
7. [Player 2 deposit](https://testnet.arcscan.app/tx/0xc887de2d21b6c9eb70359f68a619305b68e750221c4180464b9b98ef9f6371b2)
8. [Start match](https://testnet.arcscan.app/tx/0xad159cf6a0acfc887afb5e0948a69ad052a0a24e0020a055a0a6be554e9bb4fe)
9. [Resolve and pay winner](https://testnet.arcscan.app/tx/0xbcbeb0fb24fc0ec50b242f71a118b934df84820266e27adae228125a5173bdf1)

## Automated checks

- Resolved terminal state: passed
- Player 1 address: passed
- Player 2 address: passed
- Both deposits recorded: passed
- Canonical USDC escrow balance returned to zero: passed
- Winner balance increased: passed
- Losing player paid the entry amount: passed

## Safety-path evidence

An additional Arc Testnet run exercised cancellation/refunds and participant dispute/arbiter resolution with two funded players.

### Cancellation and refunds

- Match ID: `146097978572185191063593824584197378965`
- [Create match](https://testnet.arcscan.app/tx/0x26aa1513ca41f25d7a5bfaf71936e76992e23da90ea97f4653231315e874d70f)
- [Player 1 deposit](https://testnet.arcscan.app/tx/0x034d2c8f5b09c7655e9f6ac879ddbb0dfa4e19f1f8ac0a10dcefbd5a04144e34)
- [Player 2 deposit](https://testnet.arcscan.app/tx/0xb79c74dbf6f4c4aeb71b06cca302bc40fcbb8c3d0293d5c91e8e1505108b664c)
- [Cancel and refund both players](https://testnet.arcscan.app/tx/0x4b2ad25aca38f23c99c8a12cb568de71506389d0aecdf0079ca11d571242bdff)
- Cancelled terminal state: passed
- Escrow balance returned to zero: passed
- Duplicate cancellation rejected: passed

### Dispute and arbitration

- Match ID: `31424333707703933506582802449549484110`
- [Create match](https://testnet.arcscan.app/tx/0x5bee7227c26199b6f493ff0d56eee481fc5a70f59cfabc9b05059a07b944e473)
- [Start match](https://testnet.arcscan.app/tx/0xc562999bf1367539a78827d7e65c4b0d4caed7a22fcb13c8d2151f52c08416a2)
- [Participant opens dispute](https://testnet.arcscan.app/tx/0x7a8f4bc399a64d4d607877e3ad128c4a1d19587b0044612fd5c9266fb530aaa6)
- [Arbiter resolves dispute and pays participant](https://testnet.arcscan.app/tx/0x507ebe3f9c37bc5ea4deee77cbc6cf80a524c3471c2082937253717eb6fe7153)
- Disputed state observed before resolution: passed
- Winner verified as a participant: passed
- Escrow balance returned to zero: passed
- Duplicate arbitration rejected: passed

## Scope

This is public testnet evidence, not production usage or user traction. Testnet USDC has no promised monetary value. The runs validate success, cancellation/refund, and dispute/arbitration lifecycles; they do not replace a security audit, legal review, or controlled user pilot.
