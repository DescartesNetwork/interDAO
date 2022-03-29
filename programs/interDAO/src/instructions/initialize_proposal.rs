use crate::constants::*;
use crate::errors::ErrorCode;
use crate::schema::{dao::*, proposal::*};
use crate::traits::Permission;
use crate::utils::current_timestamp;
use anchor_lang::prelude::*;
use num_traits::ToPrimitive;

#[derive(Accounts)]
#[instruction(data: Vec<u8>, pubkeys: Vec<Pubkey>)]
pub struct InitializeProposal<'info> {
  #[account(mut)]
  pub caller: Signer<'info>,
  #[account(
    init,
    payer = caller,
    space = Proposal::HEADER_LEN + VECTOR_OVERHEAD_SIZE + data.len() + VECTOR_OVERHEAD_SIZE + pubkeys.len() * INVOKED_ACCOUNT_SIZE,
    seeds = [
      b"proposal".as_ref(),
      &dao.nonce.to_le_bytes(),
      &dao.key().to_bytes()
    ],
    bump
  )]
  pub proposal: Account<'info, Proposal>,
  #[account(mut)]
  pub dao: Account<'info, Dao>,
  /// CHECK: Just a pure account
  pub invoked_program: AccountInfo<'info>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(
  ctx: Context<InitializeProposal>,
  data: Vec<u8>,
  pubkeys: Vec<Pubkey>,
  prev_is_signers: Vec<bool>,
  prev_is_writables: Vec<bool>,
  next_is_signers: Vec<bool>,
  next_is_writables: Vec<bool>,
  consensus_mechanism: ConsensusMechanism,
  start_date: i64,
  end_date: i64,
) -> Result<()> {
  let dao = &mut ctx.accounts.dao;
  let proposal = &mut ctx.accounts.proposal;
  // Validate permission
  if !dao.is_authorized_to_propose(ctx.accounts.caller.key()) {
    return err!(ErrorCode::NoPermission);
  }
  // Validate data
  if start_date < current_timestamp().ok_or(ErrorCode::InvalidCurrentDate)? {
    return err!(ErrorCode::InvalidStartDate);
  }
  if end_date <= start_date
    || end_date <= current_timestamp().ok_or(ErrorCode::InvalidCurrentDate)?
  {
    return err!(ErrorCode::InvalidEndDate);
  }
  if pubkeys.len() != prev_is_signers.len()
    || pubkeys.len() != prev_is_writables.len()
    || pubkeys.len() != next_is_signers.len()
    || pubkeys.len() != next_is_writables.len()
  {
    return err!(ErrorCode::InvalidDataLength);
  }

  let mut accounts = Vec::with_capacity(pubkeys.len());
  for i in 0..pubkeys.len() {
    accounts.push(InvokedAccount {
      pubkey: pubkeys[i],
      prev_is_signer: prev_is_signers[i],
      prev_is_writable: prev_is_writables[i],
      next_is_signer: next_is_signers[i],
      next_is_writable: next_is_writables[i],
    });
  }

  // Create proposal data
  proposal.index = dao.nonce;
  proposal.creator = ctx.accounts.caller.key();
  proposal.dao = dao.key();
  proposal.start_date = start_date;
  proposal.end_date = end_date;
  proposal.dao_mechanism = dao.mechanism;
  proposal.consensus_mechanism = consensus_mechanism;
  proposal.executed = false;
  proposal.voted_power = 0;
  proposal.supply = dao.supply;
  // Data for the inter action
  proposal.data_len = data.len().to_u64().ok_or(ErrorCode::Overflow)?;
  proposal.data = data;
  // Accounts for the inter action
  proposal.accounts_len = accounts.len().to_u8().ok_or(ErrorCode::Overflow)?;
  proposal.accounts = accounts;
  // Program to execute
  proposal.invoked_program = ctx.accounts.invoked_program.key();

  // Update dao data
  dao.nonce = dao.nonce.checked_add(1).ok_or(ErrorCode::Overflow)?;

  Ok(())
}
