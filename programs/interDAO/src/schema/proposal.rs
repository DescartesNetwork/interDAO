use crate::constants::*;
use crate::schema::dao::DaoMechanism;
use crate::traits::{Age, Consensus};
use crate::utils::current_timestamp;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub struct InvokedAccount {
  pub pubkey: Pubkey,
  pub prev_is_signer: bool,
  pub prev_is_writable: bool,
  pub next_is_signer: bool,
  pub next_is_writable: bool,
}

#[account]
pub struct Proposal {
  pub index: u64,
  pub creator: Pubkey,
  pub dao: Pubkey,
  pub invoked_program: Pubkey,
  pub data_len: u64,
  pub data: Vec<u8>,
  pub accounts_len: u8,
  pub accounts: Vec<InvokedAccount>,
  pub mechanism: DaoMechanism,
  pub executed: bool,
  pub voted_power: u128,
  pub total_power: u128,
  pub start_date: i64, // Immediately start by setting zero
  pub end_date: i64,   // No end date by setting zero
}

impl Proposal {
  pub const HEADER_LEN: usize = DISCRIMINATOR_SIZE
    + U64_SIZE
    + PUBKEY_SIZE
    + PUBKEY_SIZE
    + PUBKEY_SIZE
    + U64_SIZE
    + U8_SIZE
    + U8_SIZE
    + BOOL_SIZE
    + U128_SIZE
    + U128_SIZE
    + I64_SIZE
    + I64_SIZE; // And a variant data len and accounts len
}

impl Consensus for Proposal {
  fn vote(&mut self, power: u128) -> Option<u128> {
    self.voted_power = self.voted_power.checked_add(power)?;
    Some(self.voted_power)
  }
  fn is_more_than_half(&self) -> bool {
    if self.total_power <= self.voted_power {
      true
    } else if self.total_power - self.voted_power < self.voted_power {
      true
    } else {
      false
    }
  }
}

impl Age for Proposal {
  fn is_started(&self) -> bool {
    let now = current_timestamp().unwrap_or(0);
    now >= self.start_date
  }
  fn is_ended(&self) -> bool {
    let now = current_timestamp().unwrap_or(0);
    now > self.end_date
  }
  fn is_executed(&self) -> bool {
    self.executed
  }
}
