use crate::errors::ErrorCode;
use crate::schema::{dao::*, proposal::*, receipt::*};
use crate::traits::{Age, Consensus, Permission};
use anchor_lang::{prelude::*, system_program};
use anchor_spl::{associated_token, token};

#[event]
pub struct VoteAgainstEvent {
  pub authority: Pubkey,
  pub dao: Pubkey,
  pub proposal: Pubkey,
  pub receipt: Pubkey,
  pub amount: u64,
}

#[derive(Accounts)]
#[instruction(index: u64)]
pub struct VoteNftAgainst<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(
    mut,
    associated_token::mint = mint_nft,
    associated_token::authority = authority
  )]
  pub src: Box<Account<'info, token::TokenAccount>>,
  #[account(seeds = [b"treasurer".as_ref(), &proposal.key().to_bytes()], bump)]
  /// CHECK: Just a pure account
  pub treasurer: AccountInfo<'info>,
  // NFT (collection)
  pub mint: Box<Account<'info, token::Mint>>,
  // NFT mint
  pub mint_nft: Box<Account<'info, token::Mint>>,
  #[account(
    init_if_needed,
    payer = authority,
    associated_token::mint = mint_nft,
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
  #[account(has_one = mint)]
  pub dao: Account<'info, Dao>,
  #[account(
    init,
    payer = authority,
    space = Receipt::LEN,
    seeds = [
      b"receipt".as_ref(),
      &index.to_le_bytes(),
      &proposal.key().to_bytes(),
      &authority.key().to_bytes()
    ],
    bump
  )]
  pub receipt: Account<'info, Receipt>,
  #[account(mut)]
  /// CHECK: Just a pure account
  pub taxman: AccountInfo<'info>,
  #[account(mut)]
  /// CHECK: Just a pure account
  pub revenueman: AccountInfo<'info>,
  pub token_program: Program<'info, token::Token>,
  pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(ctx: Context<VoteNftAgainst>, index: u64, tax: u64, revenue: u64) -> Result<()> {
  let receipt = &mut ctx.accounts.receipt;
  let proposal = &mut ctx.accounts.proposal;
  let dao = &mut ctx.accounts.dao;
  let amount = 1;

  // Validate mint_nft belongs to collection
  if !dao.is_valid_mint_nft(ctx.accounts.mint.key()) {
    return err!(ErrorCode::InvalidNftCollection);
  }
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

  // Charge protocol tax
  if tax > 0 {
    let tax_ctx = CpiContext::new(
      ctx.accounts.system_program.to_account_info(),
      system_program::Transfer {
        from: ctx.accounts.authority.to_account_info(),
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
        from: ctx.accounts.authority.to_account_info(),
        to: ctx.accounts.revenueman.to_account_info(),
      },
    );
    system_program::transfer(revenue_ctx, revenue)?;
  }

  // Init receipt data
  receipt.index = index;
  receipt.authority = ctx.accounts.authority.key();
  receipt.proposal = proposal.key();
  receipt.mint = ctx.accounts.mint_nft.key();
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
    .vote_against(amount, receipt)
    .ok_or(ErrorCode::Overflow)?;

  emit!(VoteAgainstEvent {
    authority: receipt.authority,
    dao: ctx.accounts.dao.key(),
    proposal: receipt.proposal,
    receipt: receipt.key(),
    amount
  });

  Ok(())
}
