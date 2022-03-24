use crate::constants::*;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub struct StoragedAccount {
  pub pubkey: Pubkey,
  pub prev_is_signer: bool,
  pub prev_is_writable: bool,
  pub next_is_signer: bool,
  pub next_is_writable: bool,
}

#[account]
pub struct Proposal {
  pub creator: Pubkey,
  pub dao: Pubkey,
  pub invoked_program: Pubkey,
  pub data_len: u64,
  pub data: Vec<u8>,
  pub accounts_len: u8,
  pub accounts: Vec<StoragedAccount>,
  pub executed: bool,
}

impl Proposal {
  pub const HEADER_LEN: usize =
    DISCRIMINATOR_SIZE + PUBKEY_SIZE + PUBKEY_SIZE + PUBKEY_SIZE + U64_SIZE + U8_SIZE + BOOL_SIZE; // And a variant data len and accounts len
}
