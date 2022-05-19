use crate::errors::ErrorCode;
use crate::schema::dao::*;
use crate::traits::Permission;
use anchor_lang::prelude::*;
use anchor_spl::{associated_token, token};

#[derive(Accounts)]
pub struct NftMetadata<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  // NFT (collection)
  pub mint: Box<Account<'info, token::Mint>>,
  /// CHECK: Just a pure account
  pub mint_nft: Box<Account<'info, token::Mint>>,
  /// CHECK: Just a pure account'
  pub metadata: AccountInfo<'info>,

  #[account(has_one = mint)]
  pub dao: Account<'info, Dao>,
  /// CHECK: Just a pure account
  pub revenueman: AccountInfo<'info>,
  pub token_program: Program<'info, token::Token>,
  pub associated_token_program: Program<'info, associated_token::AssociatedToken>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(ctx: Context<NftMetadata>) -> Result<()> {
  let dao = &mut ctx.accounts.dao;
  if !dao.is_valid_mint_nft(
    ctx.accounts.mint.key(),
    ctx.accounts.mint_nft.key(),
    &ctx.accounts.metadata,
  ) {
    return err!(ErrorCode::InvalidNftCollection);
  }
  msg!("success check metadata");
  Ok(())
}
