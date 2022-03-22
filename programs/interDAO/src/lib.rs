use anchor_lang::prelude::*;

pub mod constants;
pub use constants::*;
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

  pub fn initialize_proposal(ctx: Context<InitializeProposal>, data: Vec<u8>) -> Result<()> {
    initialize_proposal::exec(ctx, data)
  }
}
