pub mod instructions;
pub mod state;
pub mod constants;
pub mod error;
pub mod event;

use anchor_lang::prelude::*;
use instructions::*;

declare_id!("4zRwFfdpJMVnS6GejDevW1ASbPBDjnfvXGWiQUNd5YVK");

#[program]
pub mod token_vesting_app {
    use super::*;

    #[access_control(check(&ctx))]
    pub fn initialize(ctx: Context<Initialize>, mint: Pubkey) -> Result<()> {
        instructions::initialize::initialize_global_state(ctx, mint)?;
        Ok(())
    }

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        instructions::stake::deposit_sol(ctx, amount)?;
        Ok(())
    }

    pub fn unstake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        instructions::stake::withdraw_sol(ctx, amount)?;
        Ok(())
    }
}