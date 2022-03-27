use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
  #[msg("Operation overflowed")]
  Overflow,
  #[msg("Invalid accounts length")]
  InvalidDataLength,
  #[msg("Inconsistent proposal's accounts configuration")]
  InconsistentProposal,
  #[msg("The community don't consent on the proposal yet")]
  NotConsentedProposal,
  #[msg("The proposal isn't start yet")]
  NotStartedProposal,
  #[msg("The proposal had been ended")]
  EndedProposal,
  #[msg("The proposal had been executed")]
  ExecutedProposal,
  #[msg("No permission")]
  NoPermission,
  #[msg("Cannot derive the program address")]
  NoBump,
}
