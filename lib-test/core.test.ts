import {
  BN,
  Program,
  SplToken,
  utils,
  Wallet,
  web3,
} from '@project-serum/anchor'
import { program } from '@project-serum/anchor/dist/cjs/spl/token'
import InterDAO, { DEFAULT_INTERDAO_PROGRAM_ID } from '../app'
import { initializeAccount, initializeMint } from './pretest'

const PRIV_KEY_FOR_TEST_ONLY = Buffer.from([
  2, 178, 226, 192, 204, 173, 232, 36, 247, 215, 203, 12, 177, 251, 254, 243,
  92, 38, 237, 60, 38, 248, 213, 19, 73, 180, 31, 164, 63, 210, 172, 90, 85,
  215, 166, 105, 84, 194, 133, 92, 34, 27, 39, 2, 158, 57, 64, 226, 198, 222,
  25, 127, 150, 87, 141, 234, 34, 239, 139, 107, 155, 32, 47, 199,
])
const CIRCULATED_SUPPLY = new BN(100)

describe('@project-kylan/core', function () {
  const wallet = new Wallet(web3.Keypair.fromSecretKey(PRIV_KEY_FOR_TEST_ONLY))
  let interDAO: InterDAO,
    connection: web3.Connection,
    splProgram: Program<SplToken>,
    daoAddress: string,
    proposalAddress: string,
    receiptAddress: string,
    tokenAddress: string,
    associatedTokenAddress: string,
    taxmanAuthorityAddress: string =
      web3.Keypair.generate().publicKey.toBase58()
  before(async () => {
    const {
      program: { provider },
    } = new InterDAO(wallet)
    splProgram = program(provider)
    // Init a token
    const token = web3.Keypair.generate()
    tokenAddress = token.publicKey.toBase58()
    await initializeMint(6, token, splProgram)
    associatedTokenAddress = (
      await utils.token.associatedAddress({
        owner: provider.wallet.publicKey,
        mint: new web3.PublicKey(tokenAddress),
      })
    ).toBase58()
    // Mint secure tokens
    await initializeAccount(associatedTokenAddress, tokenAddress, splProgram)
    await splProgram.rpc.mintTo(new BN(1_000_000_000), {
      accounts: {
        mint: new web3.PublicKey(tokenAddress),
        to: new web3.PublicKey(associatedTokenAddress),
        authority: provider.wallet.publicKey,
      },
    })
    // Check data
    const { amount } = await splProgram.account.token.fetch(
      new web3.PublicKey(associatedTokenAddress),
    )
    console.log('\tToken:', tokenAddress)
    console.log('\tAmount:', amount.toNumber())
  })

  it('constructor', async () => {
    interDAO = new InterDAO(wallet)
    if (interDAO.program.programId.toBase58() !== DEFAULT_INTERDAO_PROGRAM_ID)
      throw new Error('Cannot contruct an interDAO instance')
    // Setup test supporters
    connection = interDAO.program.provider.connection
    // Airdrop to wallet
    const lamports = await connection.getBalance(wallet.publicKey)
    if (lamports < 10 * web3.LAMPORTS_PER_SOL)
      await connection.requestAirdrop(wallet.publicKey, web3.LAMPORTS_PER_SOL)
  })

  it('initialize a dao', async () => {
    const { daoAddress: _daoAddress } = await interDAO.initializeDao(
      tokenAddress,
      CIRCULATED_SUPPLY,
    )
    daoAddress = _daoAddress
  })

  it('get dao data', async () => {
    const data = await interDAO.getDaoData(daoAddress)
    console.log(data)
  })

  it('transfer authority', async () => {
    const newAuthorityAddress = web3.Keypair.generate().publicKey.toBase58()
    await interDAO.transferAuthority(newAuthorityAddress, daoAddress)
    const { authority } = await interDAO.getDaoData(daoAddress)
    if (authority.toBase58() !== newAuthorityAddress)
      throw new Error('Cannot update new authority')
  })
})
