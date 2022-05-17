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

declare_id!("2TkBpvZFqAkQZCHgQ5KbHup7SPPk5gkjPVXDnF19d1DW");

#[program]
pub mod inter_dao {
  use super::*;

  pub fn initialize_dao(
    ctx: Context<InitializeDAO>,
    regime: DaoRegime,
    supply: u64,
    metadata: [u8; 32],
    is_nft: bool,
  ) -> Result<()> {
    initialize_dao::exec(ctx, regime, supply, metadata, is_nft)
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
    metadata: [u8; 32],
    tax: u64,
    revenue: u64,
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
      metadata,
      tax,
      revenue,
    )
  }

  pub fn vote_for(
    ctx: Context<VoteFor>,
    index: u64,
    amount: u64,
    tax: u64,
    revenue: u64,
  ) -> Result<()> {
    vote_for::exec(ctx, index, amount, tax, revenue)
  }

  pub fn vote_nft_for(ctx: Context<VoteNftFor>, index: u64, tax: u64, revenue: u64) -> Result<()> {
    vote_nft_for::exec(ctx, index, tax, revenue)
  }

  pub fn vote_against(
    ctx: Context<VoteAgainst>,
    index: u64,
    amount: u64,
    tax: u64,
    revenue: u64,
  ) -> Result<()> {
    vote_against::exec(ctx, index, amount, tax, revenue)
  }

  pub fn vote_nft_against(
    ctx: Context<VoteNftAgainst>,
    index: u64,
    tax: u64,
    revenue: u64,
  ) -> Result<()> {
    vote_nft_against::exec(ctx, index, tax, revenue)
  }

  pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
    execute_proposal::exec(ctx)
  }

  pub fn close(ctx: Context<Close>) -> Result<()> {
    close::exec(ctx)
  }

  pub fn close_nft_voting(ctx: Context<CloseNftVoting>) -> Result<()> {
    close_nft_voting::exec(ctx)
  }

  pub fn update_dao_regime(ctx: Context<UpdateDaoRegime>, regime: DaoRegime) -> Result<()> {
    update_dao_regime::exec(ctx, regime)
  }

  pub fn update_dao_metadata(ctx: Context<UpdateDaoMetadata>, metadata: [u8; 32]) -> Result<()> {
    update_dao_metadata::exec(ctx, metadata)
  }

  pub fn update_supply(ctx: Context<UpdateSupply>, supply: u64) -> Result<()> {
    update_supply::exec(ctx, supply)
  }

  pub fn transfer_authority(ctx: Context<TransferAuthority>) -> Result<()> {
    transfer_authority::exec(ctx)
  }
}
