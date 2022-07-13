use crate::constants::*;
use anchor_lang::prelude::*;

#[account]
pub struct Content {
  pub authority: Pubkey,
  pub discriminator: [u8; 8],
  pub metadata: [u8; 32],
}

impl Content {
  pub const LEN: usize = DISCRIMINATOR_SIZE + PUBKEY_SIZE + U8_SIZE * 8 + U8_SIZE * 32;
}
