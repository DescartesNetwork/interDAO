use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
  #[msg("Operation overflowed")]
  Overflow,
  #[msg("Invalid accounts length")]
  InvalidDataLength,
  #[msg("Inconsistent proposal's accounts configuration")]
  InconsistentProposal,
  #[msg("The community isn't consenting on the proposal yet")]
  NotConsentedProposal,
  #[msg("The proposal isn't started yet")]
  NotStartedProposal,
  #[msg("The proposal isn't ended yet")]
  NotEndedProposal,
  #[msg("The proposal had been ended")]
  EndedProposal,
  #[msg("The proposal had been executed")]
  ExecutedProposal,
  #[msg("No permission")]
  NoPermission,
  #[msg("Cannot derive the program address")]
  NoBump,
  #[msg("Cannot get current date")]
  InvalidCurrentDate,
  #[msg("Start date need to be greater than or equal to zero")]
  InvalidStartDate,
  #[msg("End date need to be greater than start date and current date")]
  InvalidEndDate,
}
