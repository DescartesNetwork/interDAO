use crate::constants::*;
use crate::traits::Permission;
use anchor_lang::prelude::*;

///
/// DAO mechanism
///
#[repr(u8)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum DaoRegime {
  Dictatorial, // Only Authority can create and approve proposals
  Democratic,  // Community can propose and Authority can approve
  Autonomous,  // Community can propose and consent on propasals (based on 51% rule)
}
impl Default for DaoRegime {
  fn default() -> Self {
    DaoRegime::Dictatorial
  }
}

#[account]
pub struct Dao {
  pub master: Pubkey,
  pub authority: Pubkey,
  pub mint: Pubkey,
  pub regime: DaoRegime,
  pub supply: u64,
  pub nonce: u64,
  pub metadata: [u8; 32],
  pub is_nft: bool,
}

impl Dao {
  pub const LEN: usize = DISCRIMINATOR_SIZE
    + PUBKEY_SIZE
    + PUBKEY_SIZE
    + PUBKEY_SIZE
    + U8_SIZE
    + U64_SIZE
    + U64_SIZE
    + U8_SIZE
    + U8_SIZE * 32;
}

impl Permission for Dao {
  fn is_authorized_to_propose(&self, caller: Pubkey) -> bool {
    match self.regime {
      DaoRegime::Dictatorial => return self.authority == caller,
      DaoRegime::Democratic => return true,
      DaoRegime::Autonomous => return true,
    }
  }
  fn is_authorized_to_execute(&self, caller: Pubkey) -> bool {
    match self.regime {
      DaoRegime::Dictatorial => return self.authority == caller,
      DaoRegime::Democratic => return self.authority == caller,
      DaoRegime::Autonomous => return true,
    }
  }
  fn is_valid_mint_nft(&self, collection: Pubkey) -> bool {
    //todo
    if self.mint == collection {
      return true;
    }
    return false;
  }
}
