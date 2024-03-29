import {
  AnchorProvider,
  BN,
  Program,
  SplToken,
  utils,
  Wallet,
  web3,
} from '@project-serum/anchor'
import { program as getSplProgram } from '@project-serum/anchor/dist/cjs/spl/token'
import { expect } from 'chai'
// @ts-ignore
import * as soproxABI from 'soprox-abi'

import InterDAO, {
  ConsensusMechanisms,
  ConsensusQuorums,
  DaoRegimes,
  DEFAULT_INTERDAO_PROGRAM_ID,
} from '../app'
import { asyncWait, initializeAccount, initializeMint } from './pretest'

const PRIV_KEY_FOR_TEST_ONLY = Buffer.from([
  2, 178, 226, 192, 204, 173, 232, 36, 247, 215, 203, 12, 177, 251, 254, 243,
  92, 38, 237, 60, 38, 248, 213, 19, 73, 180, 31, 164, 63, 210, 172, 90, 85,
  215, 166, 105, 84, 194, 133, 92, 34, 27, 39, 2, 158, 57, 64, 226, 198, 222,
  25, 127, 150, 87, 141, 234, 34, 239, 139, 107, 155, 32, 47, 199,
])
const SUPPLY = new BN(1_000_000_000)
const TRANSFERRED_AMOUNT = new BN(1000)
const CIRCULATED_SUPPLY = new BN(100)
const VOTE_FOR = new BN(100)
const VOTE_AGAINST = new BN(10)
const PRIMARY_DUMMY_METADATA = Buffer.from(
  'b2b68b298b9bfa2dd2931cd879e5c9997837209476d25319514b46f7b7911d31',
  'hex',
)
const SECONDARY_DUMMY_METADATA = Buffer.from(
  'b2b68b298b9bfa2dd2931cd879e5c9997837209476d25319514b46f7b7911d32',
  'hex',
)

describe('@interdao/core', function () {
  const wallet = new Wallet(web3.Keypair.fromSecretKey(PRIV_KEY_FOR_TEST_ONLY))
  let interDAO: InterDAO,
    connection: web3.Connection,
    splProgram: Program<SplToken>,
    daoAddress: string,
    proposalAddress: string,
    voteForReceiptAddress: string,
    voteAgainstReceiptAddress: string,
    tokenAddress: string,
    associatedTokenAddress: string,
    currentTime: number

  const proposalIx = web3.Keypair.generate()

  before(async () => {
    const { program } = new InterDAO(wallet)
    const provider = program.provider as AnchorProvider
    splProgram = getSplProgram(provider)
    // Init a token
    const token = web3.Keypair.generate()
    tokenAddress = token.publicKey.toBase58()
    await initializeMint(6, token, splProgram)
    associatedTokenAddress = (
      await utils.token.associatedAddress({
        owner: wallet.publicKey,
        mint: new web3.PublicKey(tokenAddress),
      })
    ).toBase58()
    // Mint secure tokens
    await initializeAccount(
      associatedTokenAddress,
      tokenAddress,
      wallet.publicKey,
      provider,
    )
    await splProgram.rpc.mintTo(SUPPLY, {
      accounts: {
        mint: new web3.PublicKey(tokenAddress),
        to: new web3.PublicKey(associatedTokenAddress),
        authority: wallet.publicKey,
      },
    })
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
    // Current Unix Timestamp
    currentTime = await interDAO.getCurrentUnixTimestamp()
  })

  it('initialize a dao', async () => {
    const { daoAddress: _daoAddress } = await interDAO.initializeDao(
      tokenAddress,
      CIRCULATED_SUPPLY,
      PRIMARY_DUMMY_METADATA,
    )
    daoAddress = _daoAddress
  })

  it('seed tokens to the dao', async () => {
    const masterAddress = await interDAO.deriveMasterAddress(daoAddress)
    const masterPublicKey = new web3.PublicKey(masterAddress)
    const vaultPublicKey = await utils.token.associatedAddress({
      mint: new web3.PublicKey(tokenAddress),
      owner: masterPublicKey,
    })
    await initializeAccount(
      vaultPublicKey.toBase58(),
      tokenAddress,
      masterPublicKey,
      interDAO.program.provider as AnchorProvider,
    )
    await splProgram.rpc.mintTo(SUPPLY, {
      accounts: {
        mint: new web3.PublicKey(tokenAddress),
        to: vaultPublicKey,
        authority: wallet.publicKey,
      },
    })
    const { amount } = (await splProgram.account.token.fetch(
      vaultPublicKey,
    )) as any
    expect(SUPPLY.eq(amount)).true
  })

  it('get dao data', async () => {
    const { authority } = await interDAO.getDaoData(daoAddress)
    expect(authority.toBase58()).to.equal(wallet.publicKey.toBase58())
  })

  it('initialize a proposal', async () => {
    // Init
    const { proposalAddress: _proposalAddress } =
      await interDAO.initializeProposal({
        daoAddress,
        startDate: currentTime + 10,
        endDate: currentTime + 20,
        metadata: PRIMARY_DUMMY_METADATA,
        consensusMechanism: ConsensusMechanisms.LockedTokenCounter,
        consensusQuorum: ConsensusQuorums.Half,
        feeOptions: {
          tax: new BN(10 ** 6),
          taxmanAddress: wallet.publicKey.toBase58(),
        },
      })
    proposalAddress = _proposalAddress
  })

  it('initialize a proposal instruction', async () => {
    // Proposal data
    const buf = new soproxABI.struct(
      [
        { key: 'code', type: 'u8' },
        { key: 'amount', type: 'u64' },
      ],
      { code: 3, amount: BigInt(TRANSFERRED_AMOUNT.toNumber()) },
    )
    const masterAddress = await interDAO.deriveMasterAddress(daoAddress)
    const daoTreasuryPublicKey = await utils.token.associatedAddress({
      mint: new web3.PublicKey(tokenAddress),
      owner: new web3.PublicKey(masterAddress),
    })
    const pubkeys = [
      daoTreasuryPublicKey,
      new web3.PublicKey(associatedTokenAddress),
      new web3.PublicKey(masterAddress),
    ]
    const isSigners = [false, false, true]
    const isWritables = [true, true, true]
    const isMasters = [false, false, true]
    // Init
    await interDAO.initializeProposalInstruction({
      proposal: proposalAddress,
      data: buf.toBuffer(),
      invokedProgramAddress: utils.token.TOKEN_PROGRAM_ID.toBase58(),
      isMasters,
      isSigners,
      isWritables,
      pubkeys,
      proposalInstruction: proposalIx,
    })
  })

  it('get proposal data', async () => {
    const { dao } = await interDAO.getProposalData(proposalAddress)
    expect(dao.toBase58()).to.equal(daoAddress)
  })

  it('vote for', async () => {
    await asyncWait(30000) // Wait for 20s
    const { receiptAddress } = await interDAO.voteFor(
      proposalAddress,
      VOTE_FOR,
      {
        tax: new BN(10 ** 6),
        taxmanAddress: wallet.publicKey.toBase58(),
        revenue: new BN(10 ** 6),
        revenuemanAddress: wallet.publicKey.toBase58(),
      },
    )
    voteForReceiptAddress = receiptAddress
  })

  it('get receipt data after vote', async () => {
    const nextIndex = await interDAO.findAvailableReceiptIndex(
      proposalAddress,
      wallet.publicKey.toBase58(),
    )
    const expectedReceiptAddress = await interDAO.deriveReceiptAddress(
      nextIndex.sub(new BN(1)),
      proposalAddress,
      true,
    )
    expect(voteForReceiptAddress).to.equal(expectedReceiptAddress)
    const { amount } = await interDAO.getReceiptData(voteForReceiptAddress)
    expect(amount.eq(VOTE_FOR)).true
  })

  it('vote against', async () => {
    const { receiptAddress } = await interDAO.voteAgainst(
      proposalAddress,
      VOTE_AGAINST,
      {
        tax: new BN(10 ** 6),
        taxmanAddress: wallet.publicKey.toBase58(),
        revenue: new BN(10 ** 6),
        revenuemanAddress: wallet.publicKey.toBase58(),
      },
    )
    voteAgainstReceiptAddress = receiptAddress
  })

  it('get receipt data after vote', async () => {
    const nextIndex = await interDAO.findAvailableReceiptIndex(
      proposalAddress,
      wallet.publicKey.toBase58(),
    )
    const expectedReceiptAddress = await interDAO.deriveReceiptAddress(
      nextIndex.sub(new BN(1)),
      proposalAddress,
      true,
    )
    expect(voteAgainstReceiptAddress).to.equal(expectedReceiptAddress)
    const { amount } = await interDAO.getReceiptData(voteAgainstReceiptAddress)
    expect(amount.eq(VOTE_AGAINST)).true
  })

  it('execute the proposal', async () => {
    await asyncWait(30000) // Wait for 30s
    const { amount: prevAmount } = await splProgram.account.token.fetch(
      associatedTokenAddress,
    )
    await interDAO.executeProposal(proposalAddress)
    const { amount: nextAmount } = await splProgram.account.token.fetch(
      associatedTokenAddress,
    )
    expect(nextAmount.sub(prevAmount).eq(TRANSFERRED_AMOUNT)).true
    const { executed } = await interDAO.getProposalData(proposalAddress)
    expect(executed).true
  })

  it('close all receipts', async () => {
    await interDAO.close(voteForReceiptAddress)
    await interDAO.close(voteAgainstReceiptAddress)
    const { amount } = await splProgram.account.token.fetch(
      associatedTokenAddress,
    )
    expect(SUPPLY.add(TRANSFERRED_AMOUNT).eq(amount)).true
  })

  it('update dao regime', async () => {
    await interDAO.updateDaoRegime(DaoRegimes.Autonomous, daoAddress)
    const { regime } = await interDAO.getDaoData(daoAddress)
    expect(regime).to.deep.equal(DaoRegimes.Autonomous)
  })

  it('update dao supply', async () => {
    const newSupply = new BN(200)
    await interDAO.updateDaoSupply(newSupply, daoAddress)
    const { supply } = await interDAO.getDaoData(daoAddress)
    expect(supply.eq(newSupply)).true
  })

  it('update DAO metadata', async () => {
    await interDAO.updateDaoMetadata(SECONDARY_DUMMY_METADATA, daoAddress)
    const { metadata } = await interDAO.getDaoData(daoAddress)
    expect(metadata).deep.equal(SECONDARY_DUMMY_METADATA.toJSON().data)
  })

  it('transfer authority', async () => {
    const newAuthorityAddress = web3.Keypair.generate().publicKey.toBase58()
    await interDAO.transferAuthority(newAuthorityAddress, daoAddress)
    const { authority } = await interDAO.getDaoData(daoAddress)
    expect(authority.toBase58()).to.equal(newAuthorityAddress)
  })
})
