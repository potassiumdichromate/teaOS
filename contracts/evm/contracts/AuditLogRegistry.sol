// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./AnchorRegistryBase.sol";

/// @notice A worker periodically Merkle-roots a batch of new AuditLog rows
/// (Postgres) and anchors the root here — individual rows stay off-chain and
/// searchable, but the batch's integrity is independently checkable against
/// this event log. See docs/DATABASE.md and docs/AUDIT_LOGS.md.
contract AuditLogRegistry is AnchorRegistryBase {
    uint256 public nextBatchId;

    event BatchAnchored(uint256 indexed batchId, bytes32 merkleRoot, uint64 blockTimestamp);

    constructor(address admin) AnchorRegistryBase(admin) {}

    function anchorBatch(bytes32 merkleRoot) external onlyRole(ANCHOR_ROLE) returns (uint256 batchId) {
        batchId = nextBatchId++;
        emit BatchAnchored(batchId, merkleRoot, uint64(block.timestamp));
    }
}
