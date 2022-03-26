use crate::constants::*;
use crate::traits::Permission;
use anchor_lang::prelude::*;

///
/// DAO mechanism
///
#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum DaoMechanism {
  Dictatorial, // Only Authority can create and approve proposals
  Democratic,  // Community can propose and Authority can approve
  Autonomous,  // Community can propose and consent on propasals (based on 51% rule)
}
impl Default for DaoMechanism {
  fn default() -> Self {
    DaoMechanism::Dictatorial
  }
}

#[account]
pub struct Dao {
  pub master_key: Pubkey,
  pub authority: Pubkey,
  pub mint: Pubkey,
  pub mechanism: DaoMechanism,
  pub total_power: u128,
  pub nonce: u64,
}

impl Dao {
  pub const LEN: usize =
    DISCRIMINATOR_SIZE + PUBKEY_SIZE + PUBKEY_SIZE + PUBKEY_SIZE + U8_SIZE + U128_SIZE + U64_SIZE;
}

impl Permission for Dao {
  fn is_authorized_to_propose(&self, caller: Pubkey) -> bool {
    match self.mechanism {
      DaoMechanism::Dictatorial => return self.authority == caller,
      DaoMechanism::Democratic => return true,
      DaoMechanism::Autonomous => return true,
    }
  }
  fn is_authorized_to_execute(&self, caller: Pubkey) -> bool {
    match self.mechanism {
      DaoMechanism::Dictatorial => return self.authority == caller,
      DaoMechanism::Democratic => return self.authority == caller,
      DaoMechanism::Autonomous => return true,
    }
  }
}
