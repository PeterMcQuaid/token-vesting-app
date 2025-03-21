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
}