use crate::schema::dao::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateSupply<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(mut, has_one = authority)]
  pub dao: Account<'info, Dao>,
}

pub fn exec(ctx: Context<UpdateSupply>, supply: u128) -> Result<()> {
  let dao = &mut ctx.accounts.dao;
  dao.supply = supply;
  Ok(())
}
