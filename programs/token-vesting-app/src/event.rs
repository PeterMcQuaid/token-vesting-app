use anchor_lang::prelude::*;

#[event]
pub struct InitializeEvent {
    pub message: String,
    pub signer: Pubkey,
}