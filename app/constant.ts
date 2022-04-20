import bs58 from 'bs58'
import { BorshAccountsCoder } from '@project-serum/anchor'

import { IDL } from '../target/types/inter_dao'

export const DEFAULT_RPC_ENDPOINT = 'https://api.devnet.solana.com'
export const DEFAULT_INTERDAO_PROGRAM_ID =
  'FBaHKV32ugTPy31SVrZuqDnZ6nTWepwkdSWUUY1r851q'
export const DEFAULT_INTERDAO_IDL = IDL

export const DAO_DISCRIMINATOR = bs58.encode(
  BorshAccountsCoder.accountDiscriminator('dao'),
)
export const PROPOSAL_DISCRIMINATOR = bs58.encode(
  BorshAccountsCoder.accountDiscriminator('proposal'),
)
export const RECEIPT_DISCRIMINATOR = bs58.encode(
  BorshAccountsCoder.accountDiscriminator('receipt'),
)
