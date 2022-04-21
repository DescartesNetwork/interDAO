use crate::schema::dao::*;
use anchor_lang::prelude::*;

#[event]
pub struct UpdateDaoMetadataEvent {
  pub dao: Pubkey,
  pub metadata: [u8; 32],
}

#[derive(Accounts)]
pub struct UpdateDaoMetadata<'info> {
  #[account(mut)]
  pub authority: Signer<'info>,
  #[account(mut, has_one = authority)]
  pub dao: Account<'info, Dao>,
}

pub fn exec(ctx: Context<UpdateDaoMetadata>, metadata: [u8; 32]) -> Result<()> {
  let dao = &mut ctx.accounts.dao;
  dao.metadata = metadata;

  emit!(UpdateDaoMetadataEvent {
    dao: dao.key(),
    metadata: dao.metadata
  });

  Ok(())
}
