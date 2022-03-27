use crate::constants::*;
use crate::schema::{dao::DaoMechanism, receipt::Receipt};
use crate::traits::{Age, Consensus};
use crate::utils::current_timestamp;
use anchor_lang::prelude::*;
use num_traits::ToPrimitive;
use std::cmp;

///
/// Consensus mechanism
///
/// Stake Token Counter
/// The voted power is counted by the number of staked tokens to the proposal.
/// Voters can unstake anytime, but the voted power will be excluded.
///
/// Locked Token Counter
/// The voted power is counted by multiplication of the locked time and the number of locked tokens to the proposal.
/// Voters can't unlock during the campaign.
///
#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum ConsensusMechanism {
  StakedTokenCounter,
  LockedTokenCounter,
}
impl Default for ConsensusMechanism {
  fn default() -> Self {
    ConsensusMechanism::StakedTokenCounter
  }
}

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
  pub dao_mechanism: DaoMechanism,
  pub consensus_mechanism: ConsensusMechanism,
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
    + U8_SIZE
    + BOOL_SIZE
    + U128_SIZE
    + U128_SIZE
    + I64_SIZE
    + I64_SIZE; // And a variant data len and accounts len
}

impl Consensus for Proposal {
  fn vote(
    &mut self,
    amount: u64,
    unlocked_date: i64,
    receipt: &mut Receipt,
  ) -> Option<(u128, u128)> {
    let safe_locked_date = current_timestamp()?;
    let safe_unlocked_date = cmp::min(self.end_date, unlocked_date);
    let power = match self.consensus_mechanism {
      ConsensusMechanism::StakedTokenCounter => {
        receipt.locked_date = safe_locked_date;
        receipt.unlocked_date = 0;
        amount.to_u128()?
      }
      ConsensusMechanism::LockedTokenCounter => {
        receipt.locked_date = safe_locked_date;
        receipt.unlocked_date = safe_unlocked_date;
        safe_unlocked_date
          .checked_sub(safe_locked_date)?
          .to_u128()?
          .checked_mul(amount.to_u128()?)?
      }
    };
    // Update receipt data
    receipt.amount = amount;
    receipt.power = power;
    // Update proposal data
    self.voted_power = self.voted_power.checked_add(power)?;
    Some((power, self.voted_power))
  }
  fn void(&mut self, amount: u64, receipt: &mut Receipt) -> Option<(u128, u128)> {
    let power = match self.consensus_mechanism {
      ConsensusMechanism::StakedTokenCounter => amount.to_u128()?,
      ConsensusMechanism::LockedTokenCounter => receipt
        .unlocked_date
        .checked_sub(receipt.locked_date)?
        .to_u128()?
        .checked_mul(amount.to_u128()?)?,
    };
    // Update proposal data
    self.voted_power = self.voted_power.checked_sub(power)?;
    // Update receipt data
    receipt.amount = receipt.amount.checked_sub(amount)?;
    receipt.power = receipt.power.checked_sub(power)?;
    Some((0, self.voted_power))
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
