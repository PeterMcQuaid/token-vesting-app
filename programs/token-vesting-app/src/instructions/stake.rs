use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::error::*;
use crate::event::*;
use crate::state::{ GlobalState, UserStake };

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,
    #[account(
        seeds = [b"global_state".as_ref()],
        bump,
    )]
    pub global_state: Account<'info, GlobalState>,
    #[account(
        init_if_needed,         // Allow user to stake multiple times
        payer = staker,
        space = ANCHOR_DISCRIMINATOR + 32 + 8,
        seeds = [staker.key().as_ref()],
        bump,
    )]
    pub user_stake: Account<'info, UserStake>,
    pub system_program: Program<'info, System>,
}

pub fn deposit_sol(ctx: Context<Stake>, amount: u64) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;
    require!(global_state.initialized == true, CustomError::NotInitialized);        // Can't stake if global state not initialized yet
    let user_stake = &mut ctx.accounts.user_stake;

    require!(amount > 0, CustomError::InvalidAmount);        // Amount must be positive
    require!(amount + user_stake.amount <= MAX_STAKE, CustomError::MaxStakeExceeded);     // Can't stake more than MAX_STAKE

    // Access control
    if user_stake.staker == Pubkey::default() {
        user_stake.staker = ctx.accounts.staker.key();
        user_stake.amount = 0;      // Sanity check
    } else {
        require_eq!(user_stake.staker, ctx.accounts.staker.key(), CustomError::NotStakeOwner);    //  Only owner can stake/unstake
    }

    // Update user stake balance
    let cpi_context = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.staker.to_account_info(),
            to: user_stake.to_account_info(),
        },
    );
    system_program::transfer(cpi_context, amount)?;
    user_stake.amount += amount;

    // Emit event
    emit!( StakeEvent {
        staker: ctx.accounts.staker.key(),
        amount: amount,
        total_staked: user_stake.amount,
    });

    Ok(())
}

pub fn withdraw_sol(ctx: Context<Stake>, amount: u64) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;
    require!(global_state.initialized == true, CustomError::NotInitialized);        // Can't stake if global state not initialized yet
    let user_stake = &mut ctx.accounts.user_stake;

    require!(amount > 0 
        && amount <= user_stake.amount
        && user_stake.amount - amount >= 0, // Sanity check for overflow
        CustomError::InvalidAmount);        // Amount must be positive

    // Access control
    if user_stake.staker == Pubkey::default() {
        return Err(error!(CustomError::AttemptedWithdrawBeforeStake));
    } else {
        require_eq!(user_stake.staker, ctx.accounts.staker.key(), CustomError::NotStakeOwner);    // Only owner can stake/unstake
    }

    // Update user stake balance
    **user_stake.to_account_info().try_borrow_mut_lamports()? = 
        user_stake.to_account_info().lamports()
        .checked_sub(amount)
        .ok_or(CustomError::InsufficientFunds)?;
    
    **ctx.accounts.staker.to_account_info().try_borrow_mut_lamports()? = 
        ctx.accounts.staker.to_account_info().lamports()
        .checked_add(amount)
        .ok_or(CustomError::CalculationOverflow)?;

    Ok(())
}

