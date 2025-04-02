use anchor_lang::prelude::*;

// An enum for custom error codes
#[error_code]
pub enum CustomError {
    #[msg("Only owner can call this function!")]
    NotOwner,
    #[msg("Global state already initialized!")]
    AlreadyInitialized,
    #[msg("Global state not initialized!")]
    NotInitialized,
    #[msg("User attempting to modify stake balance they do not control!")]
    NotStakeOwner,
    #[msg("Invalid amount!")]
    InvalidAmount,
    #[msg("Stake amount exceeds maximum allowed!")]
    MaxStakeExceeded,
    #[msg("User attempting to withdraw before they have staked")]
    AttemptedWithdrawBeforeStake,
    #[msg("Insufficient funds in user stake account to withdraw")]
    InsufficientFunds,
    #[msg("Overflow")]
    CalculationOverflow,
}