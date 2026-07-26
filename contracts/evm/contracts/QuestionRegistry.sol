// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./AnchorRegistryBase.sol";

/// @notice Anchors a hash of each accepted question's encrypted content and
/// its AI validation report. Never stores plaintext or a decryption key —
/// see docs/SMART_CONTRACTS.md.
contract QuestionRegistry is AnchorRegistryBase {
    struct Anchor {
        bytes32 contentHash;
        bytes32 validationHash;
        uint64 blockTimestamp;
    }

    mapping(bytes32 => Anchor) public anchors;

    event QuestionAnchored(bytes32 indexed questionId, bytes32 contentHash, bytes32 validationHash);

    constructor(address admin) AnchorRegistryBase(admin) {}

    function anchorQuestion(bytes32 questionId, bytes32 contentHash, bytes32 validationHash)
        external
        onlyRole(ANCHOR_ROLE)
    {
        require(anchors[questionId].blockTimestamp == 0, "already anchored");
        anchors[questionId] = Anchor(contentHash, validationHash, uint64(block.timestamp));
        emit QuestionAnchored(questionId, contentHash, validationHash);
    }
}
