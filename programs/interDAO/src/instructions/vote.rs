use crate::errors::ErrorCode;
use crate::schema::{dao::*, proposal::*};
use crate::{Age, Consensus};
use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};
use num_traits::ToPrimitive;

#[derive(Accounts)]
pub struct Vote<'info> {
  #[account(mut)]
  pub voter: Signer<'info>,
  #[account(mut, has_one = mint)]
  pub src: Box<Account<'info, token::TokenAccount>>,
  #[account(seeds = [b"treasurer".as_ref(), &proposal.key().to_bytes()], bump)]
  /// CHECK: Just a pure account
  pub treasurer: AccountInfo<'info>,
  pub mint: Box<Account<'info, token::Mint>>,
  #[account(
    init_if_needed,
    payer = voter,
    associated_token::mint = mint,
    associated_token::authority = treasurer
  )]
  pub treasury: Box<Account<'info, token::TokenAccount>>,
  #[account(
    mut,
    seeds = [
      b"proposal".as_ref(),
      &dao.key().to_bytes(),
      &proposal.index.to_le_bytes()
    ],
    bump,
    has_one = dao
  )]
  pub proposal: Account<'info, Proposal>,
  #[account(has_one = mint)]
  pub dao: Account<'info, Dao>,
  pub token_program: Program<'info, token::Token>,
  pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(ctx: Context<Vote>, amount: u64) -> Result<()> {
  let proposal = &mut ctx.accounts.proposal;
  // Validate permission & consensus
  if proposal.is_executed() {
    return err!(ErrorCode::ExecutedProposal);
  }
  if !proposal.is_started() {
    return err!(ErrorCode::NotStartedProposal);
  }
  if proposal.is_ended() {
    return err!(ErrorCode::EndedProposal);
  }
  // Lock tokens into the treasury
  let transfer_ctx = CpiContext::new(
    ctx.accounts.token_program.to_account_info(),
    token::Transfer {
      from: ctx.accounts.src.to_account_info(),
      to: ctx.accounts.treasury.to_account_info(),
      authority: ctx.accounts.voter.to_account_info(),
    },
  );
  token::transfer(transfer_ctx, amount)?;
  // Count the votes
  let power = amount.to_u128().ok_or(ErrorCode::Overflow)?;
  proposal.vote(power);
  Ok(())
}
