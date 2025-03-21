use anchor_lang::prelude::*;

// An enum for custom error codes
#[error_code]
pub enum OnlyOwnerError {
    #[msg("Only owner can call this function!")]
    NotOwner,
}

#[error_code]
pub enum InitializeError {
    #[msg("Global state already initialized!")]
    AlreadyInitialized,
}