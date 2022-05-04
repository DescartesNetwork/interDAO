import bs58 from 'bs58'
import { BN, BorshAccountsCoder, web3 } from '@project-serum/anchor'

import { IDL } from '../target/types/inter_dao'
import { FeeOptions } from './types'

export const DEFAULT_RPC_ENDPOINT = 'https://api.devnet.solana.com'
export const DEFAULT_INTERDAO_PROGRAM_ID =
  '3ZWBFTzWoT2RaCVJGqvfqjhZsKP9ohxKtZQcjc7mVrpX'
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

export const FEE_OPTIONS: FeeOptions = {
  tax: new BN(0),
  taxmanAddress: new web3.Keypair().publicKey.toBase58(),
  revenue: new BN(0),
  revenuemanAddress: new web3.Keypair().publicKey.toBase58(),
}
