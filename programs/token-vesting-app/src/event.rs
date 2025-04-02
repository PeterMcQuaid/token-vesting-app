use anchor_lang::prelude::*;

#[event]
pub struct InitializeEvent {
    pub message: String,
    pub signer: Pubkey,
    pub mint: Pubkey,
}

#[event]
pub struct StakeEvent {
    pub staker: Pubkey,
    pub amount: u64,
    pub total_staked: u64,
}