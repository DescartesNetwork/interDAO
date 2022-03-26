use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod schema;
pub mod traits;
pub mod utils;

pub use constants::*;
pub use errors::*;
pub use instructions::*;
pub use schema::*;
pub use traits::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod inter_dao {
  use super::*;

  pub fn initialize_dao(
    ctx: Context<InitializeDAO>,
    mechanism: DaoMechanism,
    total_power: u128,
  ) -> Result<()> {
    initialize_dao::exec(ctx, mechanism, total_power)
  }

  pub fn initialize_proposal(
    ctx: Context<InitializeProposal>,
    data: Vec<u8>,
    pubkeys: Vec<Pubkey>,
    prev_is_signers: Vec<bool>,
    prev_is_writables: Vec<bool>,
    next_is_signers: Vec<bool>,
    next_is_writables: Vec<bool>,
    start_date: i64,
    end_date: i64,
  ) -> Result<()> {
    initialize_proposal::exec(
      ctx,
      data,
      pubkeys,
      prev_is_signers,
      prev_is_writables,
      next_is_signers,
      next_is_writables,
      start_date,
      end_date,
    )
  }

  pub fn vote(ctx: Context<Vote>, amount: u64) -> Result<()> {
    vote::exec(ctx, amount)
  }

  pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
    execute_proposal::exec(ctx)
  }
}
