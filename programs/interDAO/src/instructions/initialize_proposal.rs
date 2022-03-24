use crate::constants::*;
use crate::errors::ErrorCode;
use crate::schema::{dao::*, proposal::*};
use anchor_lang::prelude::*;
use num_traits::ToPrimitive;

#[derive(Accounts)]
#[instruction(data: Vec<u8>, accounts_len: u8)]
pub struct InitializeProposal<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(
    init,
    payer = authority,
    space = Proposal::HEADER_LEN + VECTOR_OVERHEAD_SIZE + data.len() + VECTOR_OVERHEAD_SIZE + accounts_len as usize * STORAGED_ACCOUNT_SIZE,
    seeds = [
      b"proposal".as_ref(),
      &dao.key().to_bytes()
    ],
    bump
  )]
  pub proposal: Account<'info, Proposal>,
  #[account(mut, has_one = authority)]
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
) -> Result<()> {
  if pubkeys.len() != prev_is_signers.len()
    || pubkeys.len() != prev_is_writables.len()
    || pubkeys.len() != next_is_signers.len()
    || pubkeys.len() != next_is_writables.len()
  {
    return err!(ErrorCode::InvalidAccountsLength);
  }

  let mut accounts = Vec::with_capacity(pubkeys.len());
  for i in 0..pubkeys.len() {
    accounts.push(StoragedAccount {
      pubkey: pubkeys[i],
      prev_is_signer: prev_is_signers[i],
      prev_is_writable: prev_is_writables[i],
      next_is_signer: next_is_signers[i],
      next_is_writable: next_is_writables[i],
    });
  }

  let proposal = &mut ctx.accounts.proposal;
  proposal.creator = ctx.accounts.authority.key();
  proposal.dao = ctx.accounts.dao.key();
  proposal.invoked_program = ctx.accounts.invoked_program.key();
  // Data for the inter action
  proposal.data_len = data.len().to_u64().ok_or(ErrorCode::Overflow)?;
  proposal.data = data;
  // Accounts for the inter action
  proposal.accounts_len = accounts.len().to_u8().ok_or(ErrorCode::Overflow)?;
  proposal.accounts = accounts;
  // Set flags
  proposal.executed = false;
  Ok(())
}
