use crate::errors::ErrorCode;
use crate::schema::{dao::*, proposal::*, receipt::*};
use crate::traits::{Age, Consensus};
use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};

#[derive(Accounts)]
pub struct Void<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(
    init_if_needed,
    payer = authority,
    associated_token::mint = mint,
    associated_token::authority = authority
  )]
  pub dst: Box<Account<'info, token::TokenAccount>>,
  #[account(seeds = [b"treasurer".as_ref(), &proposal.key().to_bytes()], bump)]
  /// CHECK: Just a pure account
  pub treasurer: AccountInfo<'info>,
  pub mint: Box<Account<'info, token::Mint>>,
  #[account(
    mut,
    associated_token::mint = mint,
    associated_token::authority = treasurer
  )]
  pub treasury: Account<'info, token::TokenAccount>,
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
  #[account(has_one = mint)]
  pub dao: Account<'info, Dao>,
  #[account(
    mut,
    seeds = [
      b"receipt".as_ref(),
      &receipt.index.to_le_bytes(),
      &proposal.key().to_bytes(),
      &authority.key().to_bytes()
    ],
    bump,
    has_one = authority,
    has_one = proposal
  )]
  pub receipt: Account<'info, Receipt>,
  pub token_program: Program<'info, token::Token>,
  pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(ctx: Context<Void>, amount: u64) -> Result<()> {
  let receipt = &mut ctx.accounts.receipt;
  let proposal = &mut ctx.accounts.proposal;
  // Validate permission & consensus
  if proposal.is_ended() {
    return err!(ErrorCode::EndedProposal);
  }
  // Discount the votes
  proposal.void(amount, receipt).ok_or(ErrorCode::Overflow)?;
  // Lock tokens into the treasury
  let seeds: &[&[&[u8]]] = &[&[
    b"treasurer".as_ref(),
    &proposal.key().to_bytes(),
    &[*ctx.bumps.get("treasurer").ok_or(ErrorCode::NoBump)?],
  ]];
  let transfer_ctx = CpiContext::new_with_signer(
    ctx.accounts.token_program.to_account_info(),
    token::Transfer {
      from: ctx.accounts.treasury.to_account_info(),
      to: ctx.accounts.dst.to_account_info(),
      authority: ctx.accounts.treasurer.to_account_info(),
    },
    seeds,
  );
  token::transfer(transfer_ctx, amount)?;
  Ok(())
}
