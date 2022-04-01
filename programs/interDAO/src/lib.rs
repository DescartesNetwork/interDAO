use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod schema;
pub mod traits;
pub mod utils;

pub use errors::*;
pub use instructions::*;
pub use schema::*;

declare_id!("Bivu7zHQj6QP8E9nHV3Vt9tXmyqKe5hRQ5zKNoAASRhn");

#[program]
pub mod inter_dao {
  use super::*;

  pub fn initialize_dao(
    ctx: Context<InitializeDAO>,
    dao_mechanism: DaoMechanism,
    supply: u64,
  ) -> Result<()> {
    initialize_dao::exec(ctx, dao_mechanism, supply)
  }

  pub fn initialize_proposal(
    ctx: Context<InitializeProposal>,
    data: Vec<u8>,
    pubkeys: Vec<Pubkey>,
    prev_is_signers: Vec<bool>,
    prev_is_writables: Vec<bool>,
    next_is_signers: Vec<bool>,
    next_is_writables: Vec<bool>,
    consensus_mechanism: ConsensusMechanism,
    consesus_quorum: ConsensusQuorum,
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
      consensus_mechanism,
      consesus_quorum,
      start_date,
      end_date,
    )
  }

  pub fn vote_for(ctx: Context<VoteFor>, index: u64, amount: u64) -> Result<()> {
    vote_for::exec(ctx, index, amount)
  }

  pub fn vote_against(ctx: Context<VoteAgainst>, index: u64, amount: u64) -> Result<()> {
    vote_against::exec(ctx, index, amount)
  }

  pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
    execute_proposal::exec(ctx)
  }

  pub fn close(ctx: Context<Close>) -> Result<()> {
    close::exec(ctx)
  }

  pub fn update_dao_mechanism(
    ctx: Context<UpdateDaoMechanism>,
    dao_mechanism: DaoMechanism,
  ) -> Result<()> {
    update_dao_mechanism::exec(ctx, dao_mechanism)
  }

  pub fn update_supply(ctx: Context<UpdateSupply>, supply: u64) -> Result<()> {
    update_supply::exec(ctx, supply)
  }

  pub fn transfer_authority(ctx: Context<TransferAuthority>) -> Result<()> {
    transfer_authority::exec(ctx)
  }
}
