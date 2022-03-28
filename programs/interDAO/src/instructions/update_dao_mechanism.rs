use crate::schema::dao::*;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct UpdateDaoMechanism<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(mut, has_one = authority)]
  pub dao: Account<'info, Dao>,
}

pub fn exec(ctx: Context<UpdateDaoMechanism>, dao_mechanism: DaoMechanism) -> Result<()> {
  let dao = &mut ctx.accounts.dao;
  dao.mechanism = dao_mechanism;
  Ok(())
}
