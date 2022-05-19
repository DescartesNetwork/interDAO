// @ts-ignore
import * as soproxABI from 'soprox-abi'
import {
  web3,
  Spl,
  utils,
  AnchorProvider,
  Program,
  SplToken,
} from '@project-serum/anchor'

const splProgram = Spl.token()
const TOKEN_METADATA_PROGRAM_ID = new web3.PublicKey(
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
)
export const INTERDAO_PROGRAM_ID =
  '2TkBpvZFqAkQZCHgQ5KbHup7SPPk5gkjPVXDnF19d1DW'
export const DEFAULT_COMMITMENT = 'confirmed'
export const DEFAULT_CLUSTER = 'https://api.devnet.solana.com'

export const initializeMint = async (
  decimals: number,
  token: web3.Keypair,
  provider: AnchorProvider,
  splProgram: Program<SplToken>,
) => {
  const ix = await (splProgram.account as any).mint.createInstruction(token)
  const tx = new web3.Transaction().add(ix)
  await provider.sendAndConfirm(tx, [token])
  return await splProgram.rpc.initializeMint(
    decimals,
    provider.wallet.publicKey,
    provider.wallet.publicKey,
    {
      accounts: {
        mint: token.publicKey,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
      signers: [],
    },
  )
}

export const initializeAccount = async (
  associatedTokenAccount: web3.PublicKey,
  token: web3.PublicKey,
  authority: web3.PublicKey,
  provider: AnchorProvider,
) => {
  const ix = new web3.TransactionInstruction({
    keys: [
      {
        pubkey: provider.wallet.publicKey,
        isSigner: true,
        isWritable: true,
      },
      {
        pubkey: associatedTokenAccount,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: authority,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: token,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: utils.token.TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      },
      {
        pubkey: web3.SYSVAR_RENT_PUBKEY,
        isSigner: false,
        isWritable: false,
      },
    ],
    programId: utils.token.ASSOCIATED_PROGRAM_ID,
    data: Buffer.from([]),
  })
  const tx = new web3.Transaction().add(ix)
  return await provider.sendAndConfirm(tx)
}

export const getMetadataPDA = async (
  mint: web3.PublicKey,
): Promise<web3.PublicKey> => {
  return (
    await web3.PublicKey.findProgramAddress(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID,
    )
  )[0]
}

export const getCurrentUnixTimestamp = async (provider): Promise<number> => {
  const { data: buf } =
    (await provider.connection.getAccountInfo(web3.SYSVAR_CLOCK_PUBKEY)) || {}
  const layout = new soproxABI.struct([
    { key: 'slot', type: 'u64' },
    { key: 'epoch_start_timestamp', type: 'i64' },
    { key: 'epoch', type: 'u64' },
    { key: 'leader_schedule_epoch', type: 'u64' },
    { key: 'unix_timestamp', type: 'i64' },
  ])
  layout.fromBuffer(buf)
  const { unix_timestamp } = layout.value
  return Number(unix_timestamp)
}
