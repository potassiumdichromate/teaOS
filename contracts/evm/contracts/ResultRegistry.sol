// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./AnchorRegistryBase.sol";

/// @notice Keyed by keccak256(applicationId, saltedDob) rather than a raw
/// application ID, so the public chain never leaks a plaintext roster — a
/// student who knows their own applicationId+DOB can always recompute their
/// own key. See docs/SMART_CONTRACTS.md and the /verify endpoint.
contract ResultRegistry is AnchorRegistryBase {
    struct Anchor {
        bytes32 resultHash;
        bytes32 sessionId;
        uint64 blockTimestamp;
    }

    mapping(bytes32 => Anchor) public anchors;

    event ResultAnchored(bytes32 indexed applicationKey, bytes32 resultHash, bytes32 sessionId);

    constructor(address admin) AnchorRegistryBase(admin) {}

    function anchorResult(bytes32 applicationKey, bytes32 resultHash, bytes32 sessionId)
        external
        onlyRole(ANCHOR_ROLE)
    {
        anchors[applicationKey] = Anchor(resultHash, sessionId, uint64(block.timestamp));
        emit ResultAnchored(applicationKey, resultHash, sessionId);
    }
}
