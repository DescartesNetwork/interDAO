use crate::constants::*;
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub struct InvokedAccount {
  pub pubkey: Pubkey,
  pub is_signer: bool,
  pub is_writable: bool,
  pub is_master: bool,
}

#[account]
pub struct ProposalInstruction {
  pub proposal: Pubkey,
  pub index: u8,
  // Send all transaction
  pub tx_index: u8,
  pub executed: bool,
  // Data for the inter action
  pub data_len: u64,
  pub data: Vec<u8>,
  // Accounts for the inter action
  pub accounts_len: u8,
  pub accounts: Vec<InvokedAccount>,
  // Program to execute
  pub invoked_program: Pubkey,
}

impl ProposalInstruction {
  pub const HEADER_LEN: usize =
    DISCRIMINATOR_SIZE + U8_SIZE * 2 + PUBKEY_SIZE + PUBKEY_SIZE + U64_SIZE + U8_SIZE + BOOL_SIZE;

  pub fn is_executed(&self) -> bool {
    self.executed
  }
}
