# SMART_CONTRACTS.md

Target: 0G Chain (EVM-compatible). Mainnet = Aristotle, chain ID `16661`, RPC `https://evmrpc.0g.ai`. Testnet = Galileo, chain ID `16602`, RPC `https://evmrpc-testnet.0g.ai`. Deploy via Hardhat (or Foundry `forge create --rpc-url <RPC> --private-key <KEY>`, both confirmed in `0g_context.md`). Solidity `^0.8.19`, OpenZeppelin `Ownable`/`AccessControl` for role gating (Admin service account only).

All contracts are **append-only registries** — they store hashes and emit events, never plaintext content, never a decryption key. This is deliberate: 0G Chain is our public, citizen-verifiable record, so nothing sensitive belongs in contract storage or logs.

## Common pattern

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";

abstract contract AnchorRegistryBase is AccessControl {
    bytes32 public constant ANCHOR_ROLE = keccak256("ANCHOR_ROLE");

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ANCHOR_ROLE, admin);
    }
}
```

`ANCHOR_ROLE` is held only by the backend's service wallet (`apps/api`'s configured signer), granted/revoked by the Admin multisig/EOA. This is the access-control boundary that makes "no administrator can casually rewrite history" true at the contract level, independent of anything the Postgres app enforces.

## 1. `QuestionRegistry`

```solidity
contract QuestionRegistry is AnchorRegistryBase {
    struct Anchor {
        bytes32 contentHash;
        bytes32 validationHash; // hash of the AIValidationReport payload
        uint64  blockTimestamp;
    }
    mapping(bytes32 => Anchor) public anchors; // key: questionId (keccak256 of the DB cuid)

    event QuestionAnchored(bytes32 indexed questionId, bytes32 contentHash, bytes32 validationHash);

    function anchorQuestion(bytes32 questionId, bytes32 contentHash, bytes32 validationHash)
        external onlyRole(ANCHOR_ROLE)
    {
        require(anchors[questionId].blockTimestamp == 0, "already anchored");
        anchors[questionId] = Anchor(contentHash, validationHash, uint64(block.timestamp));
        emit QuestionAnchored(questionId, contentHash, validationHash);
    }
}
```

## 2. `PaperRegistry`

```solidity
contract PaperRegistry is AnchorRegistryBase {
    struct Anchor {
        bytes32 masterPaperHash;
        bytes32 blueprintHash;
        uint64  blockTimestamp;
    }
    mapping(bytes32 => Anchor) public anchors; // key: paperId

    event PaperAnchored(bytes32 indexed paperId, bytes32 masterPaperHash, bytes32 blueprintHash);

    function anchorPaper(bytes32 paperId, bytes32 masterPaperHash, bytes32 blueprintHash)
        external onlyRole(ANCHOR_ROLE)
    {
        require(anchors[paperId].blockTimestamp == 0, "already anchored");
        anchors[paperId] = Anchor(masterPaperHash, blueprintHash, uint64(block.timestamp));
        emit PaperAnchored(paperId, masterPaperHash, blueprintHash);
    }
}
```

## 3. `SubmissionRegistry`

```solidity
contract SubmissionRegistry is AnchorRegistryBase {
    struct Anchor {
        bytes32 submissionHash;
        bytes32 paperId;
        uint64  blockTimestamp;
    }
    mapping(bytes32 => Anchor) public anchors; // key: sessionId

    event SubmissionAnchored(bytes32 indexed sessionId, bytes32 submissionHash, bytes32 paperId);

    function anchorSubmission(bytes32 sessionId, bytes32 submissionHash, bytes32 paperId)
        external onlyRole(ANCHOR_ROLE)
    {
        require(anchors[sessionId].blockTimestamp == 0, "already anchored");
        anchors[sessionId] = Anchor(submissionHash, paperId, uint64(block.timestamp));
        emit SubmissionAnchored(sessionId, submissionHash, paperId);
    }
}
```

## 4. `ResultRegistry`

```solidity
contract ResultRegistry is AnchorRegistryBase {
    struct Anchor {
        bytes32 resultHash;
        bytes32 sessionId;
        uint64  blockTimestamp;
    }
    mapping(bytes32 => Anchor) public anchors; // key: applicationId hash (so Student Verification can look up by applicationId+dob-derived key)

    event ResultAnchored(bytes32 indexed applicationKey, bytes32 resultHash, bytes32 sessionId);

    function anchorResult(bytes32 applicationKey, bytes32 resultHash, bytes32 sessionId)
        external onlyRole(ANCHOR_ROLE)
    {
        anchors[applicationKey] = Anchor(resultHash, sessionId, uint64(block.timestamp));
        emit ResultAnchored(applicationKey, resultHash, sessionId);
    }
}
```

`applicationKey = keccak256(abi.encodePacked(applicationId, dobSalted))` — never the raw applicationId/DOB, so the public chain doesn't leak a plaintext roster, but a student who knows their own applicationId+DOB can always recompute their own key and look themselves up. This is the exact mechanic `POST /verify` uses server-side (see API_REFERENCE.md).

## 5. `AuditLogRegistry`

```solidity
contract AuditLogRegistry is AnchorRegistryBase {
    event BatchAnchored(uint256 indexed batchId, bytes32 merkleRoot, uint64 blockTimestamp);
    uint256 public nextBatchId;

    function anchorBatch(bytes32 merkleRoot) external onlyRole(ANCHOR_ROLE) returns (uint256 batchId) {
        batchId = nextBatchId++;
        emit BatchAnchored(batchId, merkleRoot, uint64(block.timestamp));
    }
}
```

A worker periodically Merkle-roots a batch of new `AuditLog` rows and anchors the root — the individual rows stay in Postgres (searchable), but the batch's integrity is independently checkable against this event log.

## Deployment

```bash
# Testnet
npx hardhat run scripts/deploy.ts --network zg_testnet
# Mainnet
npx hardhat run scripts/deploy.ts --network zg_mainnet
```

`hardhat.config.ts` networks block (per confirmed RPCs above):
```ts
networks: {
  zg_testnet: { url: "https://evmrpc-testnet.0g.ai", chainId: 16602, accounts: [process.env.DEPLOYER_KEY!] },
  zg_mainnet: { url: "https://evmrpc.0g.ai", chainId: 16661, accounts: [process.env.DEPLOYER_KEY!] },
}
```

Contract addresses, once deployed, are recorded in `docs/MAINNET_DEPLOYMENT.md` / `.env` — never hardcoded in app code.
