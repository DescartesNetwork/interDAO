use crate::errors::ErrorCode;
use crate::schema::{dao::*, proposal::*, receipt::*};
use crate::traits::{Age, Consensus};
use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};

#[derive(Accounts)]
#[instruction(_index: u32)]
pub struct Vote<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(mut, has_one = mint)]
  pub src: Box<Account<'info, token::TokenAccount>>,
  #[account(seeds = [b"treasurer".as_ref(), &proposal.key().to_bytes()], bump)]
  /// CHECK: Just a pure account
  pub treasurer: AccountInfo<'info>,
  pub mint: Box<Account<'info, token::Mint>>,
  #[account(
    init_if_needed,
    payer = authority,
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
  #[account(
    init,
    payer = authority,
    space = Receipt::LEN,
    seeds = [
      b"receipt".as_ref(),
      &_index.to_le_bytes(),
      &dao.key().to_bytes(),
      &proposal.key().to_bytes(),
      &authority.key().to_bytes()
    ],
    bump
  )]
  pub receipt: Account<'info, Receipt>,
  pub token_program: Program<'info, token::Token>,
  pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(ctx: Context<Vote>, _index: u32, amount: u64, unlocked_date: i64) -> Result<()> {
  let receipt = &mut ctx.accounts.receipt;
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
  // Init receipt data
  receipt.authority = ctx.accounts.authority.key();
  receipt.proposal = proposal.key();
  // Lock tokens into the treasury
  let transfer_ctx = CpiContext::new(
    ctx.accounts.token_program.to_account_info(),
    token::Transfer {
      from: ctx.accounts.src.to_account_info(),
      to: ctx.accounts.treasury.to_account_info(),
      authority: ctx.accounts.authority.to_account_info(),
    },
  );
  token::transfer(transfer_ctx, amount)?;
  // Count the votes
  proposal
    .vote(amount, unlocked_date, receipt)
    .ok_or(ErrorCode::Overflow)?;
  Ok(())
}
