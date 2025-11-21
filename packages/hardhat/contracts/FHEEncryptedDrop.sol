// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/**
 * @title FHEEncryptedDrop
 * @dev Lightweight encrypted flag registry using FHE technology.
 *      Each address can register a single encrypted value (0 or 1).
 */
contract FHEEncryptedDrop is SepoliaConfig {
    
    /// @dev Stores encrypted flags for each user.
    mapping(address => euint32) private encryptedFlags;

    /// @dev Tracks whether an address has already registered.
    mapping(address => bool) private hasJoined;

    /// @dev Keeps a list of all senders who interacted with the contract.
    address[] private submitters;

    /**
     * @notice Store an encrypted flag associated with the sender.
     * @param payload Encrypted uint32 (expected 0 or 1).
     * @param proof ZK proof verifying encrypted data.
     */
    function registerFlag(externalEuint32 payload, bytes calldata proof) external {
        require(!hasJoined[msg.sender], "Already recorded");

        euint32 incoming = FHE.fromExternal(payload, proof);
        encryptedFlags[msg.sender] = incoming;

        // Allow the owner of the data and the contract to decrypt if needed
        FHE.allow(incoming, msg.sender);
        FHE.allowThis(incoming);

        hasJoined[msg.sender] = true;
        submitters.push(msg.sender);
    }

    /**
     * @notice Check whether an address has already provided data.
     * @param user Address to query.
     * @return Boolean indicating registration status.
     */
    function isRegistered(address user) external view returns (bool) {
        return hasJoined[user];
    }

    /**
     * @notice Retrieve encrypted flag for a specific address.
     * @param user Address whose encrypted value is requested.
     * @return Encrypted uint32 (0 or 1).
     */
    function readEncrypted(address user) external view returns (euint32) {
        return encryptedFlags[user];
    }

    /**
     * @notice Return a list of all addresses that have interacted with this contract.
     */
    function listSubmitters() external view returns (address[] memory) {
        return submitters;
    }
}
