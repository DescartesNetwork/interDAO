use crate::errors::ErrorCode;
use crate::schema::{dao::*, proposal::*};
use crate::traits::Permission;
use crate::utils::current_timestamp;
use anchor_lang::{prelude::*, system_program};

const ONE_DAY: i64 = 1; // 86400
const ONE_QUATER: i64 = 7776000;

#[event]
pub struct InitializeProposalEvent {
  pub proposal: Pubkey,
  pub dao: Pubkey,
  pub caller: Pubkey,
  pub quorum: ConsensusQuorum,
}

#[derive(Accounts)]
pub struct InitializeProposal<'info> {
  #[account(mut)]
  pub caller: Signer<'info>,
  #[account(
    init,
    payer = caller,
    space = Proposal::LEN,
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
  #[account(mut)]
  /// CHECK: Just a pure account
  pub revenueman: AccountInfo<'info>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(
  ctx: Context<InitializeProposal>,
  consensus_mechanism: ConsensusMechanism,
  consensus_quorum: ConsensusQuorum,
  start_date: i64,
  end_date: i64,
  metadata: [u8; 32],
  tax: u64,
  revenue: u64,
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
      < ONE_DAY
    || end_date
      .checked_sub(start_date)
      .ok_or(ErrorCode::InvalidEndDate)?
      > ONE_QUATER
  {
    return err!(ErrorCode::InvalidEndDate);
  }

  // Charge protocol tax
  if tax > 0 {
    let tax_ctx = CpiContext::new(
      ctx.accounts.system_program.to_account_info(),
      system_program::Transfer {
        from: ctx.accounts.caller.to_account_info(),
        to: ctx.accounts.taxman.to_account_info(),
      },
    );
    system_program::transfer(tax_ctx, tax)?;
  }
  // Charge DAO revenue
  if revenue > 0 {
    let revenue_ctx = CpiContext::new(
      ctx.accounts.system_program.to_account_info(),
      system_program::Transfer {
        from: ctx.accounts.caller.to_account_info(),
        to: ctx.accounts.revenueman.to_account_info(),
      },
    );
    system_program::transfer(revenue_ctx, revenue)?;
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

  // Update dao data
  dao.nonce = dao.nonce.checked_add(1).ok_or(ErrorCode::Overflow)?;

  emit!(InitializeProposalEvent {
    proposal: proposal.key(),
    dao: proposal.dao,
    caller: proposal.creator,
    quorum: proposal.consensus_quorum,
  });

  Ok(())
}
