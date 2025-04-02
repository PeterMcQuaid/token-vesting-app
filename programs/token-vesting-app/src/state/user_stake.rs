use anchor_lang::prelude::*;

#[account]
pub struct UserStake {
    pub staker: Pubkey,
    pub amount: u64,
}