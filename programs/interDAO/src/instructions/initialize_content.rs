use crate::schema::content::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(discriminator: [u8; 8])]
pub struct InitializeContent<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(
    init_if_needed, payer = authority, space = Content::LEN,
    seeds = [
      b"content".as_ref(),
      &discriminator,
      &authority.key().to_bytes()
    ],
    bump
  )]
  pub content: Account<'info, Content>,
  pub system_program: Program<'info, System>,
}

pub fn exec(
  ctx: Context<InitializeContent>,
  discriminator: [u8; 8],
  metadata: [u8; 32],
) -> Result<()> {
  let content = &mut ctx.accounts.content;
  content.authority = ctx.accounts.authority.key();
  content.discriminator = discriminator;
  content.metadata = metadata;
  Ok(())
}
