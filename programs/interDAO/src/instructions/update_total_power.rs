use crate::schema::dao::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateTotalPower<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(mut, has_one = authority)]
  pub dao: Account<'info, Dao>,
}

pub fn exec(ctx: Context<UpdateTotalPower>, total_power: u128) -> Result<()> {
  let dao = &mut ctx.accounts.dao;
  dao.total_power = total_power;
  Ok(())
}
