use anchor_lang::prelude::*;

pub mod constants;
pub use constants::*;
pub mod errors;
pub use errors::*;
pub mod schema;
pub use schema::*;
pub mod instructions;
pub use instructions::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod inter_dao {
  use super::*;

  pub fn initialize_dao(ctx: Context<InitializeDAO>) -> Result<()> {
    initialize_dao::exec(ctx)
  }

  pub fn initialize_proposal(
    ctx: Context<InitializeProposal>,
    data: Vec<u8>,
    pubkeys: Vec<Pubkey>,
    prev_is_signers: Vec<bool>,
    prev_is_writables: Vec<bool>,
    next_is_signers: Vec<bool>,
    next_is_writables: Vec<bool>,
  ) -> Result<()> {
    initialize_proposal::exec(
      ctx,
      data,
      pubkeys,
      prev_is_signers,
      prev_is_writables,
      next_is_signers,
      next_is_writables,
    )
  }

  pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
    execute_proposal::exec(ctx)
  }
}
