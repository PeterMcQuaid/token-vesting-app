pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod event;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;
pub use error::*;
pub use event::*;

declare_id!("4zRwFfdpJMVnS6GejDevW1ASbPBDjnfvXGWiQUNd5YVK");

#[program]
pub mod token_vesting_app {
    use super::*;

    #[access_control(check(&ctx))]
    pub fn initialize(ctx: Context<Initialize>, mint: Pubkey) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        global_state.initialized = true;
        global_state.mint = mint;
        global_state.authority = ctx.accounts.signer.key();
        emit!( InitializeEvent {
            message: "Initialized global state".to_string(),
            signer: ctx.accounts.signer.key(),
        });
        Ok(())
    }
}

fn check(ctx: &Context<Initialize>) -> Result<()> {
    // Check if signer === owner
    require_keys_eq!(
        ctx.accounts.signer.key(),
        OWNER,
        OnlyOwnerError::NotOwner
    );
    Ok(())
}


#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        init,
        payer = signer,
        space = ANCHOR_DISCRIMINATOR + 8 + 32 + 32,
        seeds = [b"global_state".as_ref()],
        bump,
    )]
    pub global_state: Account<'info, GlobalState>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct GlobalState {
    pub initialized: bool,
    pub mint: Pubkey,
    pub authority: Pubkey,
}


