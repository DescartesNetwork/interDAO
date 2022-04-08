use crate::schema::dao::*;
use anchor_lang::prelude::*;

#[event]
pub struct UpdateDaoRegimeEvent {
  pub dao: Pubkey,
  pub regime: DaoRegime,
}

#[derive(Accounts)]
pub struct UpdateDaoRegime<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(mut, has_one = authority)]
  pub dao: Account<'info, Dao>,
}

pub fn exec(ctx: Context<UpdateDaoRegime>, regime: DaoRegime) -> Result<()> {
  let dao = &mut ctx.accounts.dao;
  dao.regime = regime;

  emit!(UpdateDaoRegimeEvent {
    dao: dao.key(),
    regime: dao.regime
  });

  Ok(())
}
