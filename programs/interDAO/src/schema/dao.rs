use crate::constants::*;
use anchor_lang::prelude::*;

#[account]
pub struct DAO {
  pub master_key: Pubkey,
  pub authority: Pubkey,
  pub mint: Pubkey,
}

impl DAO {
  pub const LEN: usize = DISCRIMINATOR_SIZE + PUBKEY_SIZE + PUBKEY_SIZE + PUBKEY_SIZE;
}
