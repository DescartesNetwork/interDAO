use anchor_lang::prelude::*;

pub fn current_timestamp() -> Result<i64> {
  let clock = Clock::get()?;
  Ok(clock.unix_timestamp)
}
