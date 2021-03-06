use crate::errors::ErrorCode;
use crate::schema::{dao::*, proposal::*, receipt::*};
use crate::traits::{Age, Permission};
use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};

#[event]
pub struct CloseEvent {
  pub authority: Pubkey,
  pub receipt: Pubkey,
  pub mint: Pubkey,
  pub amount: u64,
}

#[derive(Accounts)]
pub struct CloseNftVoting<'info> {
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
  /// NFT mint
  pub mint: Box<Account<'info, token::Mint>>,
  /// CHECK: NFT metadata
  pub metadata: AccountInfo<'info>,
  #[account(
    mut,
    associated_token::mint = mint,
    associated_token::authority = treasurer
  )]
  pub treasury: Box<Account<'info, token::TokenAccount>>,
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
  #[account(mut)]
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
    has_one = proposal,
  )]
  pub receipt: Account<'info, Receipt>,
  pub token_program: Program<'info, token::Token>,
  pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(ctx: Context<CloseNftVoting>) -> Result<()> {
  let receipt = &mut ctx.accounts.receipt;
  let proposal = &ctx.accounts.proposal;
  let dao = &mut ctx.accounts.dao;
  // Validate mint_nft belongs to collection
  if !dao.is_valid_mint_nft(ctx.accounts.mint.key(), &ctx.accounts.metadata) {
    return err!(ErrorCode::InvalidNftCollection);
  }
  // Validate permission & consensus
  if !proposal.is_ended() {
    return err!(ErrorCode::NotEndedProposal);
  }

  let amount = receipt.amount;
  receipt.amount = 0;

  // Unlock tokens out of the treasury
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

  emit!(CloseEvent {
    authority: receipt.authority,
    receipt: receipt.key(),
    mint: ctx.accounts.mint.key(),
    amount: amount
  });

  Ok(())
}
