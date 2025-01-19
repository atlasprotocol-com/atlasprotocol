// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract atBTC is ERC20, ERC20Burnable, ERC20Pausable, Ownable {
    constructor() ERC20("Atlas Bitcoin", "atBTC") Ownable(msg.sender) {}    

    // Event to log mints and burns details
    event MintDeposit(address indexed wallet, string btcTxnHash, uint256 amount);
    event MintBridge(address indexed wallet, string originChainId, string originChainAddress, uint256 amount, string originTxnHash);
    event BurnRedeem(address indexed wallet, string btcAddress, uint256 amount);
    event BurnBridge(address indexed wallet, string destChainId, string destChainAddress, uint256 amount);

    // Override decimals to return 8
    function decimals() public view virtual override returns (uint8) {
        return 8;
    }

    // Function to pause the contract
    function pause() public onlyOwner {
        _pause();
    }

    // Function to unpause the contract
    function unpause() public onlyOwner {
        _unpause();
    }

    // Prevents renouncing ownership to ensure the contract always has an owner
    function renounceOwnership() public view override onlyOwner {
        revert("Renouncing ownership is blocked");
    }

    // Mint function for deposit bitcoin, only accessible to the owner when the contract is not paused
    function mintDeposit(address to, uint256 amount, string memory btcTxnHash) public onlyOwner whenNotPaused {
        _mint(to, amount); // Internal mint function
        emit MintDeposit(to, btcTxnHash, amount);
    }

    // Mint function for bridging atlas bitcoin, only accessible to the owner when the contract is not paused
    function mintBridge(address to, uint256 amount, string memory originChainId, string memory originChainAddress, string memory originTxnHash) public onlyOwner whenNotPaused {
        _mint(to, amount); // Internal mint function
        emit MintBridge(to, originChainId, originChainAddress, amount, originTxnHash);
    }

    // Custom burn function that logs the btcAddress for the redemption process
    function burnRedeem(uint256 amount, string memory btcAddress) public whenNotPaused {
        _burn(msg.sender, amount);
        emit BurnRedeem(msg.sender, btcAddress, amount);
    }

    // Custom burn function that logs the destination chainId and address for the bridging process
    function burnBridge(uint256 amount, string memory destChainId, string memory destChainAddress) public whenNotPaused {
        _burn(msg.sender, amount);
        emit BurnBridge(msg.sender, destChainId, destChainAddress, amount);
    }

    // Override _update to resolve the conflict between ERC20 and ERC20Pausable
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) whenNotPaused {
        super._update(from, to, value);
    }
}
