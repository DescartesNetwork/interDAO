use crate::schema::dao::*;
use anchor_lang::prelude::*;
use anchor_spl::token;

#[derive(Accounts)]
pub struct InitializeDAO<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(init, payer = authority, space = Dao::LEN)]
  pub dao: Account<'info, Dao>,
  #[account(
    seeds = [
      b"master_key".as_ref(),
      &dao.key().to_bytes()
    ],
    bump
  )]
  /// CHECK: Just a pure account
  pub master_key: AccountInfo<'info>,
  pub mint: Account<'info, token::Mint>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(ctx: Context<InitializeDAO>, mechanism: DaoMechanism, total_power: u128) -> Result<()> {
  let dao = &mut ctx.accounts.dao;
  dao.authority = ctx.accounts.authority.key();
  dao.master_key = ctx.accounts.master_key.key();
  dao.mint = ctx.accounts.mint.key();
  dao.mechanism = mechanism;
  dao.total_power = total_power;
  dao.nonce = 0;
  Ok(())
}
