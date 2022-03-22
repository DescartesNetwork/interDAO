use crate::constants::*;
use anchor_lang::prelude::*;

#[account]
pub struct Proposal {
  pub creator: Pubkey,
  pub dao: Pubkey,
  pub data_len: u64,
  pub data: Vec<u8>,
}

impl Proposal {
  pub const HEADER_LEN: usize = DISCRIMINATOR_SIZE + PUBKEY_SIZE + PUBKEY_SIZE + U64_SIZE; // And a variant data len
}
