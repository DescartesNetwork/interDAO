use crate::errors::ErrorCode;
use crate::schema::{dao::*, proposal::*};
use crate::traits::{Age, Consensus, Permission};
use anchor_lang::{
  prelude::*,
  solana_program::{instruction::*, program::*},
};

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
  #[account(mut)]
  pub caller: Signer<'info>,
  #[account(
    mut,
    seeds = [
      b"proposal".as_ref(),
      &proposal.index.to_le_bytes(),
      &dao.key().to_bytes()
    ],
    bump,
    has_one = dao
  )]
  pub proposal: Account<'info, Proposal>,
  pub dao: Account<'info, Dao>,
  #[account(
    seeds = [
      b"master_key".as_ref(),
      &dao.key().to_bytes()
    ],
    bump
  )]
  /// CHECK: Just a pure account
  pub master_key: AccountInfo<'info>,
  /// CHECK: Just a pure account
  pub invoked_program: AccountInfo<'info>,
}

pub fn exec(ctx: Context<ExecuteProposal>) -> Result<()> {
  let dao = &ctx.accounts.dao;
  let proposal = &mut ctx.accounts.proposal;
  // Validate permission & consensus
  if !dao.is_authorized_to_execute(ctx.accounts.caller.key()) {
    return err!(ErrorCode::NoPermission);
  }
  if proposal.is_executed() {
    return err!(ErrorCode::ExecutedProposal);
  }
  if !proposal.is_consented() || !proposal.is_ended() {
    return err!(ErrorCode::NotConsentedProposal);
  }
  // Validate data
  if proposal.accounts_len as usize != ctx.remaining_accounts.len() {
    return err!(ErrorCode::InvalidDataLength);
  }
  if proposal.invoked_program != ctx.accounts.invoked_program.key() {
    return err!(ErrorCode::InconsistentProposal);
  }
  for (i, acc) in proposal.accounts.iter().enumerate() {
    if acc.pubkey != ctx.remaining_accounts[i].key()
      || acc.prev_is_signer != ctx.remaining_accounts[i].is_signer
      || acc.prev_is_writable != ctx.remaining_accounts[i].is_writable
    {
      return err!(ErrorCode::InconsistentProposal);
    }
  }
  // Build cross program instruction
  let data = proposal.data.clone();
  let mut accounts = Vec::with_capacity(proposal.accounts_len as usize);
  for acc in proposal.accounts.iter() {
    accounts.push(if acc.next_is_writable {
      AccountMeta::new(acc.pubkey, acc.next_is_signer)
    } else {
      AccountMeta::new_readonly(acc.pubkey, acc.next_is_signer)
    })
  }
  let ix = Instruction {
    program_id: proposal.invoked_program,
    accounts,
    data,
  };
  let seeds: &[&[&[u8]]] = &[&[
    b"master_key".as_ref(),
    &ctx.accounts.dao.key().to_bytes(),
    &[*ctx.bumps.get("master_key").unwrap()],
  ]];
  invoke_signed(&ix, ctx.remaining_accounts, seeds)?;
  // Success
  proposal.executed = true;
  Ok(())
}
