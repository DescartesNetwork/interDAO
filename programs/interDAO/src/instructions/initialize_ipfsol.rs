use crate::schema::ipfsol::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(discriminator: [u8; 8])]
pub struct InitializeIpfsol<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(
    init_if_needed, payer = authority, space = Ipfsol::LEN,
    seeds = [
      b"ipfsol".as_ref(),
      &discriminator,
      &authority.key().to_bytes()
    ],
    bump
  )]
  pub ipfsol: Account<'info, Ipfsol>,
  pub system_program: Program<'info, System>,
}

pub fn exec(ctx: Context<InitializeIpfsol>, discriminator: [u8; 8], cid: [u8; 32]) -> Result<()> {
  let ipfsol = &mut ctx.accounts.ipfsol;
  ipfsol.authority = ctx.accounts.authority.key();
  ipfsol.discriminator = discriminator;
  ipfsol.cid = cid;
  Ok(())
}
