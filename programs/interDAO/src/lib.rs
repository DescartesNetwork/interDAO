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

declare_id!("7BxgcaPHKcowjbjA2LjsMNNUaWB3dPFQ9Zn1nChNcm5C");

#[program]
pub mod inter_dao {
  use super::*;

  pub fn initialize_dao(ctx: Context<InitializeDAO>, regime: DaoRegime, supply: u64) -> Result<()> {
    initialize_dao::exec(ctx, regime, supply)
  }

  pub fn initialize_proposal(
    ctx: Context<InitializeProposal>,
    data: Vec<u8>,
    pubkeys: Vec<Pubkey>,
    is_signers: Vec<bool>,
    is_writables: Vec<bool>,
    is_masters: Vec<bool>,
    consensus_mechanism: ConsensusMechanism,
    consesus_quorum: ConsensusQuorum,
    start_date: i64,
    end_date: i64,
    fee: u64,
  ) -> Result<()> {
    initialize_proposal::exec(
      ctx,
      data,
      pubkeys,
      is_signers,
      is_writables,
      is_masters,
      consensus_mechanism,
      consesus_quorum,
      start_date,
      end_date,
      fee,
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

  pub fn update_dao_regime(ctx: Context<UpdateDaoRegime>, regime: DaoRegime) -> Result<()> {
    update_dao_regime::exec(ctx, regime)
  }

  pub fn update_supply(ctx: Context<UpdateSupply>, supply: u64) -> Result<()> {
    update_supply::exec(ctx, supply)
  }

  pub fn transfer_authority(ctx: Context<TransferAuthority>) -> Result<()> {
    transfer_authority::exec(ctx)
  }
}
