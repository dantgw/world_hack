//SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "../interfaces/IWorldID.sol";

/**
 * @title MockWorldID
 * @dev Mock implementation of World ID for testing purposes
 */
contract MockWorldID is IWorldID {
    /// @notice Mock implementation that always passes verification
    function verifyProof(
        uint256, // root
        uint256, // groupId
        uint256, // signalHash
        uint256 nullifierHash, // nullifierHash
        uint256, // externalNullifierHash
        uint256[8] calldata // proof
    ) external view override {
        // Mock implementation - always passes verification
        // Note: In a real implementation, this would verify the proof
        // For testing, we rely on the TokenLaunchpad contract's nullifier tracking
    }
}
