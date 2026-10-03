// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/// @notice Test double for PathUSD: like the TIP-20 precompile it REVERTS on failure (insufficient
///         balance / allowance) instead of returning false. `returnFalse` lets a test check that
///         Sworn also refuses a token that returns false without reverting.
contract MockTIP20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    bool public returnFalse;

    error InsufficientBalance();
    error InsufficientAllowance();

    function setReturnFalse(bool v) external {
        returnFalse = v;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (returnFalse) return false;
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (returnFalse) return false;
        if (allowance[from][msg.sender] < amount) revert InsufficientAllowance();
        allowance[from][msg.sender] -= amount;
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) private {
        if (balanceOf[from] < amount) revert InsufficientBalance();
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}
