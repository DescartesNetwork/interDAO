use crate::schema::dao::*;
use anchor_lang::prelude::*;
use anchor_spl::token;

#[event]
pub struct InitializeDAOEvent {
  pub dao: Pubkey,
  pub authority: Pubkey,
  pub mint: Pubkey,
  pub mechanism: DaoMechanism,
  pub supply: u128,
}

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

pub fn exec(ctx: Context<InitializeDAO>, dao_mechanism: DaoMechanism, supply: u128) -> Result<()> {
  let dao = &mut ctx.accounts.dao;
  dao.authority = ctx.accounts.authority.key();
  dao.master_key = ctx.accounts.master_key.key();
  dao.mint = ctx.accounts.mint.key();
  dao.mechanism = dao_mechanism;
  dao.supply = supply;
  dao.nonce = 0;

  emit!(InitializeDAOEvent {
    dao: dao.key(),
    authority: dao.authority,
    mint: dao.mint,
    mechanism: dao.mechanism,
    supply: dao.supply
  });

  Ok(())
}
