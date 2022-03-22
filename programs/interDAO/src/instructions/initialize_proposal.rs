use crate::schema::{dao::*, proposal::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(data: Vec<u8>)]
pub struct InitializeProposal<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(
    init,
    payer = authority,
    space = Proposal::HEADER_LEN + data.len(),
    seeds = [
      b"proposal".as_ref(),
      &dao.key().to_bytes()
    ],
    bump
  )]
  pub proposal: Account<'info, Proposal>,
  #[account(mut, has_one = authority)]
  pub dao: Account<'info, DAO>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(ctx: Context<InitializeProposal>, data: Vec<u8>) -> Result<()> {
  let proposal = &mut ctx.accounts.proposal;
  proposal.creator = ctx.accounts.authority.key();
  proposal.dao = ctx.accounts.dao.key();
  proposal.data = data;
  Ok(())
}
