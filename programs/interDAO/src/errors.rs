use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
  #[msg("Operation overflowed")]
  Overflow,
  #[msg("Invalid accounts length")]
  InvalidAccountsLength,
  #[msg("Inconsistent proposal's accounts config")]
  InconsistentProposal,
  #[msg("Executed proposal")]
  ExecutedProposal,
}
