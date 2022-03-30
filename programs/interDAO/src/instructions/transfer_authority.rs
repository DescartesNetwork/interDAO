use crate::schema::dao::*;
use anchor_lang::prelude::*;

#[event]
pub struct TransferAuthorityEvent {
  pub authority: Pubkey,
  pub new_authority: Pubkey,
  pub dao: Pubkey,
}

#[derive(Accounts)]
pub struct TransferAuthority<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  /// CHECK: Just a pure account
  pub new_authority: AccountInfo<'info>,
  #[account(mut, has_one = authority)]
  pub dao: Account<'info, Dao>,
}

pub fn exec(ctx: Context<TransferAuthority>) -> Result<()> {
  let dao = &mut ctx.accounts.dao;
  dao.authority = ctx.accounts.new_authority.key();

  emit!(TransferAuthorityEvent {
    authority: ctx.accounts.authority.key(),
    new_authority: dao.authority,
    dao: dao.key()
  });

  Ok(())
}
