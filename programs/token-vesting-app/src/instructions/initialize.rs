use anchor_lang::prelude::*;
use crate::constants::*;
use crate::error::*;
use crate::event::*;
use crate::state::GlobalState;

pub fn check(ctx: &Context<Initialize>) -> Result<()> {
    // Check if signer === owner
    require_keys_eq!(
        ctx.accounts.signer.key(),
        OWNER,
        CustomError::NotOwner
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

pub fn initialize_global_state(ctx: Context<Initialize>, mint: Pubkey) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;
    require!(global_state.initialized == false, CustomError::AlreadyInitialized);
    global_state.initialized = true;
    global_state.mint = mint;
    global_state.authority = ctx.accounts.signer.key();
    emit!( InitializeEvent {
        message: "Initialized global state".to_string(),
        signer: ctx.accounts.signer.key(),
        mint: mint,
    });
    Ok(())
}
