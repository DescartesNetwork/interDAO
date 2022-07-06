use crate::constants::*;
use anchor_lang::prelude::*;

#[account]
pub struct Ipfsol {
  pub authority: Pubkey,
  pub discriminator: [u8; 8],
  pub cid: [u8; 32],
}

impl Ipfsol {
  pub const LEN: usize = DISCRIMINATOR_SIZE + PUBKEY_SIZE + U8_SIZE * 8 + U8_SIZE * 32;
}
