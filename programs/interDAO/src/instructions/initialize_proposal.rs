use crate::constants::*;
use crate::errors::ErrorCode;
use crate::schema::{dao::*, proposal::*};
use crate::traits::Permission;
use crate::utils::current_timestamp;
use anchor_lang::{prelude::*, system_program};
use num_traits::ToPrimitive;

const ONE_MONTH: i64 = 2592000;

#[event]
pub struct InitializeProposalEvent {
  pub proposal: Pubkey,
  pub dao: Pubkey,
  pub caller: Pubkey,
  pub quorum: ConsensusQuorum,
  pub invoked_program: Pubkey,
  pub data: Vec<u8>,
  pub accounts: Vec<InvokedAccount>,
}

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
  #[account(mut)]
  /// CHECK: Just a pure account
  pub taxman: AccountInfo<'info>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(
  ctx: Context<InitializeProposal>,
  data: Vec<u8>,
  pubkeys: Vec<Pubkey>,
  is_signers: Vec<bool>,
  is_writables: Vec<bool>,
  is_masters: Vec<bool>,
  consensus_mechanism: ConsensusMechanism,
  consensus_quorum: ConsensusQuorum,
  start_date: i64,
  end_date: i64,
  fee: u64,
  metadata: [u8; 32],
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
    || end_date
      .checked_sub(start_date)
      .ok_or(ErrorCode::InvalidEndDate)?
      > ONE_MONTH
  {
    return err!(ErrorCode::InvalidEndDate);
  }
  if pubkeys.len() != is_signers.len()
    || pubkeys.len() != is_writables.len()
    || pubkeys.len() != is_masters.len()
  {
    return err!(ErrorCode::InvalidDataLength);
  }

  // Charge protocol fee
  let fee_ctx = CpiContext::new(
    ctx.accounts.system_program.to_account_info(),
    system_program::Transfer {
      from: ctx.accounts.caller.to_account_info(),
      to: ctx.accounts.taxman.to_account_info(),
    },
  );
  system_program::transfer(fee_ctx, fee)?;

  let mut accounts = Vec::with_capacity(pubkeys.len());
  for i in 0..pubkeys.len() {
    accounts.push(InvokedAccount {
      pubkey: pubkeys[i],
      is_signer: is_signers[i],
      is_writable: is_writables[i],
      is_master: is_masters[i],
    });
  }

  // Create proposal data
  proposal.index = dao.nonce;
  proposal.metadata = metadata;
  proposal.creator = ctx.accounts.caller.key();
  proposal.dao = dao.key();
  proposal.start_date = start_date;
  proposal.end_date = end_date;
  proposal.regime = dao.regime;
  proposal.consensus_mechanism = consensus_mechanism;
  proposal.consensus_quorum = consensus_quorum;
  proposal.executed = false;
  proposal.voting_for_power = 0;
  proposal.voting_against_power = 0;
  proposal.supply = dao.supply;
  // Data for the inter action
  proposal.data_len = data.len().to_u64().ok_or(ErrorCode::Overflow)?;
  proposal.data = data.clone();
  // Accounts for the inter action
  proposal.accounts_len = accounts.len().to_u8().ok_or(ErrorCode::Overflow)?;
  proposal.accounts = accounts.clone();
  // Program to execute
  proposal.invoked_program = ctx.accounts.invoked_program.key();

  // Update dao data
  dao.nonce = dao.nonce.checked_add(1).ok_or(ErrorCode::Overflow)?;

  emit!(InitializeProposalEvent {
    proposal: proposal.key(),
    dao: proposal.dao,
    caller: proposal.creator,
    quorum: proposal.consensus_quorum,
    invoked_program: proposal.invoked_program,
    data: proposal.data.clone(),
    accounts: proposal.accounts.clone(),
  });

  Ok(())
}
