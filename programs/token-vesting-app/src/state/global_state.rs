use anchor_lang::prelude::*;

#[account]
pub struct GlobalState {
    pub initialized: bool,
    pub mint: Pubkey,
    pub authority: Pubkey,
}