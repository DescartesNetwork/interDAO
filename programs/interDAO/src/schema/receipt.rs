use crate::constants::*;
use anchor_lang::prelude::*;

///
/// Receipt action
///
#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum ReceiptAction {
  VoteFor,
  VoteAgainst,
}
impl Default for ReceiptAction {
  fn default() -> Self {
    ReceiptAction::VoteFor
  }
}

#[account]
pub struct Receipt {
  pub index: u64,
  pub authority: Pubkey,
  pub proposal: Pubkey,
  pub mint_nft: Pubkey,
  pub amount: u64,
  pub power: u128,
  pub locked_date: i64,
  pub unlocked_date: i64,
  pub action: ReceiptAction,
}

impl Receipt {
  pub const LEN: usize = DISCRIMINATOR_SIZE
    + U64_SIZE
    + PUBKEY_SIZE
    + PUBKEY_SIZE
    + PUBKEY_SIZE
    + U64_SIZE
    + U128_SIZE
    + I64_SIZE
    + I64_SIZE
    + U8_SIZE;
}
