use crate::constants::*;
use crate::schema::{dao::DaoRegime, receipt::Receipt, receipt::ReceiptAction};
use crate::traits::{Age, Consensus};
use crate::utils::current_timestamp;
use anchor_lang::prelude::*;
use num_traits::ToPrimitive;

///
/// Consensus mechanism
///
/// Staked Token Counter
/// The voted power is counted by the number of staked tokens to the proposal.
/// Voters can unstake anytime, but the voted power will be excluded.
///
/// Locked Token Counter
/// The voted power is counted by multiplication of the committed time and the number of locked tokens to the proposal.
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

///
/// DAO quorum
///
#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum ConsensusQuorum {
  OneThird, // The porposal's voting power must be greater 1/3 total power to be passed
  Half,     // The porposal's voting power must be greater 1/2 total power to be passed
  TwoThird, // The porposal's voting power must be greater 2/3 total power to be passed
}
impl Default for ConsensusQuorum {
  fn default() -> Self {
    ConsensusQuorum::Half
  }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub struct InvokedAccount {
  pub pubkey: Pubkey,
  pub is_signer: bool,
  pub is_writable: bool,
  pub is_master: bool,
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
  pub regime: DaoRegime,
  pub consensus_mechanism: ConsensusMechanism,
  pub consensus_quorum: ConsensusQuorum,
  pub executed: bool,
  pub voting_for_power: u128,
  pub voting_against_power: u128,
  pub supply: u64,
  pub start_date: i64,
  pub end_date: i64,
  pub metadata: [u8; 32],
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
    + U8_SIZE
    + BOOL_SIZE
    + U128_SIZE
    + U128_SIZE
    + U64_SIZE
    + I64_SIZE
    + I64_SIZE
    + U8_SIZE * 32; // And a variant data len and accounts len

  pub fn total_power(&self) -> Option<u128> {
    let total_power = match self.consensus_mechanism {
      ConsensusMechanism::StakedTokenCounter => self.supply.to_u128()?,
      ConsensusMechanism::LockedTokenCounter => self
        .end_date
        .checked_sub(self.start_date)?
        .to_u128()?
        .checked_mul(self.supply.to_u128()?)?,
    };

    Some(total_power)
  }

  pub fn voting_power(&self) -> u128 {
    self
      .voting_for_power
      .checked_sub(self.voting_against_power)
      .unwrap_or(0)
  }

  pub fn is_more_than_one_third(&self) -> Option<bool> {
    let total_power = self.total_power()?;
    let threshold = total_power.checked_div(3)?;
    let voting_power = self.voting_power();
    if voting_power > threshold {
      Some(true)
    } else {
      Some(false)
    }
  }

  pub fn is_more_than_half(&self) -> Option<bool> {
    let total_power = self.total_power()?;
    let threshold = total_power.checked_div(2)?;
    let voting_power = self.voting_power();
    if voting_power > threshold {
      Some(true)
    } else {
      Some(false)
    }
  }

  pub fn is_more_than_two_third(&self) -> Option<bool> {
    let total_power = self.total_power()?;
    let threshold = total_power.checked_mul(2)?.checked_div(3)?;
    let voting_power = self.voting_power();
    if voting_power > threshold {
      Some(true)
    } else {
      Some(false)
    }
  }
}

impl Consensus for Proposal {
  fn calculate_my_power(&self, amount: u64, receipt: &mut Receipt) -> Option<u128> {
    let locked_date = current_timestamp()?;
    receipt.locked_date = locked_date;
    let power = match self.consensus_mechanism {
      ConsensusMechanism::StakedTokenCounter => amount.to_u128()?,
      ConsensusMechanism::LockedTokenCounter => self
        .end_date
        .checked_sub(locked_date)?
        .to_u128()?
        .checked_mul(amount.to_u128()?)?,
    };
    Some(power)
  }
  fn vote_for(&mut self, amount: u64, receipt: &mut Receipt) -> Option<(u128, u128)> {
    let power = (&*self).calculate_my_power(amount, receipt)?;
    // Update receipt data
    receipt.amount = amount;
    receipt.power = power;
    receipt.action = ReceiptAction::VoteFor;
    // Update proposal data
    self.voting_for_power = self.voting_for_power.checked_add(power)?;
    Some((power, self.voting_for_power))
  }
  fn vote_against(&mut self, amount: u64, receipt: &mut Receipt) -> Option<(u128, u128)> {
    let power = (&*self).calculate_my_power(amount, receipt)?;
    // Update receipt data
    receipt.amount = amount;
    receipt.power = power;
    receipt.action = ReceiptAction::VoteAgainst;
    // Update proposal data
    self.voting_against_power = self.voting_against_power.checked_add(power)?;
    Some((power, self.voting_against_power))
  }
  fn is_consented(&self) -> bool {
    match self.consensus_quorum {
      ConsensusQuorum::OneThird => self.is_more_than_one_third().unwrap_or(false),
      ConsensusQuorum::Half => self.is_more_than_half().unwrap_or(false),
      ConsensusQuorum::TwoThird => self.is_more_than_two_third().unwrap_or(false),
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
