use crate::constants::*;
use anchor_lang::prelude::*;

#[account]
pub struct Dao {
  pub master_key: Pubkey,
  pub authority: Pubkey,
  pub mint: Pubkey,
}

impl Dao {
  pub const LEN: usize = DISCRIMINATOR_SIZE + PUBKEY_SIZE + PUBKEY_SIZE + PUBKEY_SIZE;
}
