use crate::constants::*;
use anchor_lang::prelude::*;

#[account]
pub struct Receipt {
  pub authority: Pubkey,
  pub proposal: Pubkey,
  pub amount: u64,
  pub power: u128,
  pub locked_date: i64,
  pub unlocked_date: i64,
}

impl Receipt {
  pub const LEN: usize =
    DISCRIMINATOR_SIZE + PUBKEY_SIZE + PUBKEY_SIZE + U64_SIZE + U128_SIZE + I64_SIZE + I64_SIZE;
}
