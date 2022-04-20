use crate::schema::dao::*;
use anchor_lang::prelude::*;
use anchor_spl::token;

#[event]
pub struct InitializeDAOEvent {
  pub dao: Pubkey,
  pub authority: Pubkey,
  pub mint: Pubkey,
  pub regime: DaoRegime,
  pub supply: u64,
}

#[derive(Accounts)]
pub struct InitializeDAO<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(init, payer = authority, space = Dao::LEN)]
  pub dao: Account<'info, Dao>,
  #[account(
    seeds = [
      b"master".as_ref(),
      &dao.key().to_bytes()
    ],
    bump
  )]
  /// CHECK: Just a pure account
  pub master: AccountInfo<'info>,
  pub mint: Account<'info, token::Mint>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}

pub fn exec(
  ctx: Context<InitializeDAO>,
  regime: DaoRegime,
  supply: u64,
  metadata: [u8; 32],
) -> Result<()> {
  let dao = &mut ctx.accounts.dao;
  dao.authority = ctx.accounts.authority.key();
  dao.master = ctx.accounts.master.key();
  dao.mint = ctx.accounts.mint.key();
  dao.regime = regime;
  dao.supply = supply;
  dao.nonce = 0;
  dao.metadata = metadata;

  emit!(InitializeDAOEvent {
    dao: dao.key(),
    authority: dao.authority,
    mint: dao.mint,
    regime: dao.regime,
    supply: dao.supply
  });

  Ok(())
}
