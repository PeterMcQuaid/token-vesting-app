use anchor_lang::prelude::*;

// An enum for custom error codes
#[error_code]
pub enum CustomError {
    #[msg("Only owner can call this function!")]
    NotOwner,
    #[msg("Global state already initialized!")]
    AlreadyInitialized,
}