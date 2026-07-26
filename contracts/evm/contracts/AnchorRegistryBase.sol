// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Shared access-control base for every NVEI registry contract.
/// ANCHOR_ROLE is held only by the backend's service wallet (apps/api's
/// configured signer) — this is the on-chain enforcement of "no administrator
/// can casually rewrite the public record," independent of anything the
/// Postgres app enforces. See docs/SMART_CONTRACTS.md.
abstract contract AnchorRegistryBase is AccessControl {
    bytes32 public constant ANCHOR_ROLE = keccak256("ANCHOR_ROLE");

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ANCHOR_ROLE, admin);
    }
}
