use crate::schema::receipt::Receipt;
use anchor_lang::prelude::*;

///
/// Permission for dao
///
pub trait Permission {
  fn is_authorized_to_propose(&self, caller: Pubkey) -> bool;
  fn is_authorized_to_execute(&self, caller: Pubkey) -> bool;
}

///
/// Consensus for proposal
///
pub trait Consensus {
  fn vote(
    &mut self,
    amount: u64,
    unlocked_date: i64,
    receipt: &mut Receipt,
  ) -> Option<(u128, u128)>;
  fn void(&mut self, amount: u64, receipt: &mut Receipt) -> Option<(u128, u128)>;
  fn is_consented(&self) -> bool;
}

///
/// Age for proposal
///
pub trait Age {
  fn is_started(&self) -> bool;
  fn is_ended(&self) -> bool;
  fn is_executed(&self) -> bool;
}
