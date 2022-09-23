use crate::constants::*;
use crate::errors::ErrorCode;
use crate::schema::{dao::*, proposal::*, proposal_instruction::*};
use crate::traits::Age;
use crate::traits::Permission;
use anchor_lang::prelude::*;
use num_traits::ToPrimitive;

#[event]
pub struct InitializeProposalInstructionEvent {
  pub proposal: Pubkey,
  pub proposal_instruction: Pubkey,
  pub dao: Pubkey,
  pub caller: Pubkey,
  pub invoked_program: Pubkey,
  pub data: Vec<u8>,
  pub accounts: Vec<InvokedAccount>,
}

#[derive(Accounts)]
#[instruction(data: Vec<u8>, pubkeys: Vec<Pubkey>)]
pub struct InitializeProposalInstruction<'info> {
  #[account(mut)]
  pub caller: Signer<'info>,

  #[account(
    init,
    payer = caller,
    space = ProposalInstruction::HEADER_LEN + VECTOR_OVERHEAD_SIZE + data.len() + VECTOR_OVERHEAD_SIZE + pubkeys.len() * INVOKED_ACCOUNT_SIZE,
  )]
  pub proposal_instruction: Account<'info, ProposalInstruction>,
  /// CHECK: Just a pure account
  pub invoked_program: AccountInfo<'info>,

  #[account(mut)]
  pub proposal: Account<'info, Proposal>,
  #[account(mut)]
  pub dao: Account<'info, Dao>,

  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(
  ctx: Context<InitializeProposalInstruction>,
  data: Vec<u8>,
  pubkeys: Vec<Pubkey>,
  is_signers: Vec<bool>,
  is_writables: Vec<bool>,
  is_masters: Vec<bool>,
) -> Result<()> {
  let dao = &mut ctx.accounts.dao;
  let proposal = &mut ctx.accounts.proposal;
  let proposal_instruction = &mut ctx.accounts.proposal_instruction;
  // Validate permission
  if !dao.is_authorized_to_propose(ctx.accounts.caller.key()) {
    return err!(ErrorCode::NoPermission);
  }
  // Validate data
  if pubkeys.len() != is_signers.len()
    || pubkeys.len() != is_writables.len()
    || pubkeys.len() != is_masters.len()
  {
    return err!(ErrorCode::InvalidDataLength);
  }
  // Validate proposal state
  if proposal.is_started() {
    return err!(ErrorCode::StartedProposal);
  }

  let mut accounts = Vec::with_capacity(pubkeys.len());
  for i in 0..pubkeys.len() {
    accounts.push(InvokedAccount {
      pubkey: pubkeys[i],
      is_signer: is_signers[i],
      is_writable: is_writables[i],
      is_master: is_masters[i],
    });
  }

  proposal_instruction.proposal = proposal.key();
  proposal_instruction.index = proposal.total_instruction;
  proposal_instruction.executed = false;
  // Data for the inter action
  proposal_instruction.data_len = data.len().to_u64().ok_or(ErrorCode::Overflow)?;
  proposal_instruction.data = data.clone();
  // Accounts for the inter action
  proposal_instruction.accounts_len = accounts.len().to_u8().ok_or(ErrorCode::Overflow)?;
  proposal_instruction.accounts = accounts.clone();
  // Program to execute
  proposal_instruction.invoked_program = ctx.accounts.invoked_program.key();

  // Update proposal data
  proposal.total_instruction = proposal.total_instruction + 1;

  emit!(InitializeProposalInstructionEvent {
    proposal: proposal.key(),
    proposal_instruction: proposal_instruction.key(),
    dao: proposal.dao,
    caller: proposal.creator,
    invoked_program: proposal_instruction.invoked_program,
    data: proposal_instruction.data.clone(),
    accounts: proposal_instruction.accounts.clone(),
  });

  Ok(())
}
