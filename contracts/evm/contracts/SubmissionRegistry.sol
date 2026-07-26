// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./AnchorRegistryBase.sol";

contract SubmissionRegistry is AnchorRegistryBase {
    struct Anchor {
        bytes32 submissionHash;
        bytes32 paperId;
        uint64 blockTimestamp;
    }

    mapping(bytes32 => Anchor) public anchors;

    event SubmissionAnchored(bytes32 indexed sessionId, bytes32 submissionHash, bytes32 paperId);

    constructor(address admin) AnchorRegistryBase(admin) {}

    function anchorSubmission(bytes32 sessionId, bytes32 submissionHash, bytes32 paperId)
        external
        onlyRole(ANCHOR_ROLE)
    {
        require(anchors[sessionId].blockTimestamp == 0, "already anchored");
        anchors[sessionId] = Anchor(submissionHash, paperId, uint64(block.timestamp));
        emit SubmissionAnchored(sessionId, submissionHash, paperId);
    }
}
