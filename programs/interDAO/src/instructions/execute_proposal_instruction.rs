use crate::errors::ErrorCode;
use crate::schema::{dao::*, proposal::*, proposal_instruction::*};
use crate::traits::{Age, Consensus, Permission};
use anchor_lang::{
  prelude::*,
  solana_program::{instruction::*, program::*},
};

#[event]
pub struct ExecuteProposalInstructionEvent {
  pub proposal: Pubkey,
  pub caller: Pubkey,
}

#[derive(Accounts)]
pub struct ExecuteProposalInstruction<'info> {
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
  #[account(
    mut,
    has_one = proposal
  )]
  pub proposal_instruction: Account<'info, ProposalInstruction>,

  pub dao: Account<'info, Dao>,
  #[account(
    seeds = [
      b"master".as_ref(),
      &dao.key().to_bytes()
    ],
    bump
  )]
  /// CHECK: Just a pure account
  pub master: AccountInfo<'info>,
  /// CHECK: Just a pure account
  pub invoked_program: AccountInfo<'info>,
}

pub fn exec(ctx: Context<ExecuteProposalInstruction>) -> Result<()> {
  let dao = &ctx.accounts.dao;
  let proposal = &mut ctx.accounts.proposal;
  let proposal_instruction = &mut ctx.accounts.proposal_instruction;
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
  // Validate proposal_instruction data
  if proposal_instruction.is_executed() {
    return err!(ErrorCode::ExecutedProposal);
  }
  if proposal_instruction.index != proposal.total_executed {
    return err!(ErrorCode::InvalidProposalIdx);
  }
  if proposal_instruction.accounts_len as usize != ctx.remaining_accounts.len() {
    return err!(ErrorCode::InvalidDataLength);
  }
  if proposal_instruction.invoked_program != ctx.accounts.invoked_program.key() {
    return err!(ErrorCode::InconsistentProposal);
  }
  for (i, acc) in proposal_instruction.accounts.iter().enumerate() {
    if acc.pubkey != ctx.remaining_accounts[i].key()
      || (acc.is_signer && !acc.is_master) != ctx.remaining_accounts[i].is_signer
      || acc.is_writable != ctx.remaining_accounts[i].is_writable
    {
      return err!(ErrorCode::InconsistentProposal);
    }
  }
  // Build cross program instruction
  let data = proposal_instruction.data.clone();
  let mut accounts = Vec::with_capacity(proposal_instruction.accounts_len as usize);
  for acc in proposal_instruction.accounts.iter() {
    accounts.push(if acc.is_writable {
      AccountMeta::new(acc.pubkey, acc.is_signer)
    } else {
      AccountMeta::new_readonly(acc.pubkey, acc.is_signer)
    })
  }
  let ix = Instruction {
    program_id: proposal_instruction.invoked_program,
    accounts,
    data,
  };
  let seeds: &[&[&[u8]]] = &[&[
    b"master".as_ref(),
    &ctx.accounts.dao.key().to_bytes(),
    &[*ctx.bumps.get("master").unwrap()],
  ]];
  invoke_signed(&ix, ctx.remaining_accounts, seeds)?;
  // Success
  proposal_instruction.executed = true;
  proposal.total_executed = proposal.total_executed + 1;
  // Check executed all instruction
  if proposal.total_executed == proposal.total_instruction {
    proposal.executed = true
  }

  emit!(ExecuteProposalInstructionEvent {
    proposal: proposal.key(),
    caller: ctx.accounts.caller.key()
  });

  Ok(())
}
