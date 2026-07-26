// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./AnchorRegistryBase.sol";

contract PaperRegistry is AnchorRegistryBase {
    struct Anchor {
        bytes32 masterPaperHash;
        bytes32 blueprintHash;
        uint64 blockTimestamp;
    }

    mapping(bytes32 => Anchor) public anchors;

    event PaperAnchored(bytes32 indexed paperId, bytes32 masterPaperHash, bytes32 blueprintHash);

    constructor(address admin) AnchorRegistryBase(admin) {}

    function anchorPaper(bytes32 paperId, bytes32 masterPaperHash, bytes32 blueprintHash)
        external
        onlyRole(ANCHOR_ROLE)
    {
        require(anchors[paperId].blockTimestamp == 0, "already anchored");
        anchors[paperId] = Anchor(masterPaperHash, blueprintHash, uint64(block.timestamp));
        emit PaperAnchored(paperId, masterPaperHash, blueprintHash);
    }
}
