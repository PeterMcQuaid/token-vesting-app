use anchor_lang::prelude::*;

#[constant]
pub const OWNER: Pubkey = pubkey!("J6pjqSZXcppQeYWK1D8fL5uTJgeksSA14nEAdYjuTQpj");
pub const ANCHOR_DISCRIMINATOR: usize = 8;
pub const MAX_STAKE: u64 = 1_000_000_000;   // 1 SOL