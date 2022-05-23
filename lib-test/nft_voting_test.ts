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
const CIRCULATED_SUPPLY = new BN(4)

const PRIMARY_DUMMY_METADATA = Buffer.from(
  'b2b68b298b9bfa2dd2931cd879e5c9997837209476d25319514b46f7b7911d31',
  'hex',
)
const SECONDARY_DUMMY_METADATA = Buffer.from(
  'b2b68b298b9bfa2dd2931cd879e5c9997837209476d25319514b46f7b7911d32',
  'hex',
)

// NFT
const NFT_COLLECTION = new web3.PublicKey(
  'HgzRcYdx9GnJcXUBrPEiVxdTMk6LtbZZYHb9hAZ2GnMJ',
)
const MINT_NFT1 = new web3.PublicKey(
  '2dnKYHscHnwkm3vj1SzkH3cdfj8qsc5VYW4qC4oH3b1J',
)
const MINT_NFT2 = new web3.PublicKey(
  '41j3fNSWk4DzDYiX5ZitVMSNskLf4ajgHsEJPFLQ9xjs',
)
const MINT_NFT3 = new web3.PublicKey(
  'G6y4PLa4U5aX13TYNiDLuUrr95Lfsq7Yaq1EKYY46TUZ',
)
const MINT_NFT4 = new web3.PublicKey(
  '2hGafui2jQndYjpff1sTtZN2WYsrimWorMmcRhvts6zZ',
)

describe('@interdao/nft_voting', function () {
  const wallet = new Wallet(web3.Keypair.fromSecretKey(PRIV_KEY_FOR_TEST_ONLY))
  let interDAO: InterDAO,
    connection: web3.Connection,
    splProgram: Program<SplToken>,
    daoAddress: string,
    proposalAddress: string,
    voteForReceiptAddress1: string,
    voteForReceiptAddress2: string,
    voteAgainstReceiptAddress3: string,
    voteForReceiptAddress4: string,
    tokenAddress: string,
    associatedTokenAddress: string,
    currentTime: number

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
      NFT_COLLECTION.toBase58(),
      CIRCULATED_SUPPLY,
      PRIMARY_DUMMY_METADATA,
      undefined,
      undefined,
      true,
      true,
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
    const { proposalAddress: _proposalAddress } =
      await interDAO.initializeProposal(
        daoAddress,
        utils.token.TOKEN_PROGRAM_ID.toBase58(),
        buf.toBuffer(),
        pubkeys,
        isSigners,
        isWritables,
        isMasters,
        currentTime + 20,
        currentTime + 60,
        PRIMARY_DUMMY_METADATA,
        ConsensusMechanisms.StakedTokenCounter,
        ConsensusQuorums.OneThird,
        {
          tax: new BN(10 ** 6),
          taxmanAddress: wallet.publicKey.toBase58(),
        },
      )
    proposalAddress = _proposalAddress
  })

  it('get proposal data', async () => {
    const { dao } = await interDAO.getProposalData(proposalAddress)
    expect(dao.toBase58()).to.equal(daoAddress)
  })

  it('vote NFT1 for', async () => {
    await asyncWait(20000) // Wait for 5s
    const { receiptAddress } = await interDAO.voteNftFor(
      proposalAddress,
      MINT_NFT1.toBase58(),
      {
        tax: new BN(10 ** 6),
        taxmanAddress: wallet.publicKey.toBase58(),
        revenue: new BN(10 ** 6),
        revenuemanAddress: wallet.publicKey.toBase58(),
      },
    )
    voteForReceiptAddress1 = receiptAddress
  })

  it('get receipt data after vote NFT1', async () => {
    const nextIndex = await interDAO.findAvailableReceiptIndex(
      proposalAddress,
      wallet.publicKey.toBase58(),
    )
    const expectedReceiptAddress = await interDAO.deriveReceiptAddress(
      nextIndex.sub(new BN(1)),
      proposalAddress,
      true,
    )
    expect(voteForReceiptAddress1).to.equal(expectedReceiptAddress)
    const { amount } = await interDAO.getReceiptData(voteForReceiptAddress1)
    const proposalData = await interDAO.getProposalData(proposalAddress)
    console.log(
      'voting_for_power after vote NFT 1: ',
      proposalData.votingForPower.toNumber(),
    )
    expect(amount.eq(new BN(1))).true
  })

  it('vote NFT2 for', async () => {
    const { receiptAddress } = await interDAO.voteNftFor(
      proposalAddress,
      MINT_NFT2.toBase58(),
      {
        tax: new BN(10 ** 6),
        taxmanAddress: wallet.publicKey.toBase58(),
        revenue: new BN(10 ** 6),
        revenuemanAddress: wallet.publicKey.toBase58(),
      },
    )
    voteForReceiptAddress2 = receiptAddress
  })

  it('get receipt data after vote NFT2', async () => {
    const nextIndex = await interDAO.findAvailableReceiptIndex(
      proposalAddress,
      wallet.publicKey.toBase58(),
    )
    const expectedReceiptAddress = await interDAO.deriveReceiptAddress(
      nextIndex.sub(new BN(1)),
      proposalAddress,
      true,
    )
    expect(voteForReceiptAddress2).to.equal(expectedReceiptAddress)
    const { amount } = await interDAO.getReceiptData(voteForReceiptAddress2)
    const proposalData = await interDAO.getProposalData(proposalAddress)
    console.log(
      'voting_for_power after vote NFT 2: ',
      proposalData.votingForPower.toNumber(),
    )
    expect(amount.eq(new BN(1))).true
  })

  it('vote NFT3 against', async () => {
    const { receiptAddress } = await interDAO.voteNftAgainst(
      proposalAddress,
      MINT_NFT3.toBase58(),
      {
        tax: new BN(10 ** 6),
        taxmanAddress: wallet.publicKey.toBase58(),
        revenue: new BN(10 ** 6),
        revenuemanAddress: wallet.publicKey.toBase58(),
      },
    )
    voteAgainstReceiptAddress3 = receiptAddress
  })

  it('get receipt data after vote against NFT3', async () => {
    const nextIndex = await interDAO.findAvailableReceiptIndex(
      proposalAddress,
      wallet.publicKey.toBase58(),
    )
    const expectedReceiptAddress = await interDAO.deriveReceiptAddress(
      nextIndex.sub(new BN(1)),
      proposalAddress,
      true,
    )
    expect(voteAgainstReceiptAddress3).to.equal(expectedReceiptAddress)
    const { amount } = await interDAO.getReceiptData(voteAgainstReceiptAddress3)
    const proposalData = await interDAO.getProposalData(proposalAddress)
    console.log(
      'voting_against_power after vote NFT 3: ',
      proposalData.votingAgainstPower.toNumber(),
    )
    expect(amount.eq(new BN(1))).true
  })

  it('vote NFT4 for', async () => {
    const { receiptAddress } = await interDAO.voteNftFor(
      proposalAddress,
      MINT_NFT4.toBase58(),
      {
        tax: new BN(10 ** 6),
        taxmanAddress: wallet.publicKey.toBase58(),
        revenue: new BN(10 ** 6),
        revenuemanAddress: wallet.publicKey.toBase58(),
      },
    )
    voteForReceiptAddress4 = receiptAddress
  })

  it('get receipt data after vote NFT4', async () => {
    const nextIndex = await interDAO.findAvailableReceiptIndex(
      proposalAddress,
      wallet.publicKey.toBase58(),
    )
    const expectedReceiptAddress = await interDAO.deriveReceiptAddress(
      nextIndex.sub(new BN(1)),
      proposalAddress,
      true,
    )
    expect(voteForReceiptAddress4).to.equal(expectedReceiptAddress)
    const { amount } = await interDAO.getReceiptData(voteForReceiptAddress4)
    const proposalData = await interDAO.getProposalData(proposalAddress)
    console.log(
      'voting_for_power after vote NFT 4: ',
      proposalData.votingForPower.toNumber(),
    )
    expect(amount.eq(new BN(1))).true
  })

  it('execute the proposal', async () => {
    await asyncWait(40000) // Wait for 40s
    const { amount: prevAmount } = await splProgram.account.token.fetch(
      associatedTokenAddress,
    )
    console.log('proposalAddress: ', proposalAddress)
    const { txId } = await interDAO.executeProposal(proposalAddress)
    console.log('txId: ', txId)
    const { amount: nextAmount } = await splProgram.account.token.fetch(
      associatedTokenAddress,
    )
    expect(nextAmount.sub(prevAmount).eq(TRANSFERRED_AMOUNT)).true
    const { executed } = await interDAO.getProposalData(proposalAddress)
    expect(executed).true
  })

  it('close all receipts', async () => {
    await interDAO.closeNftVoting(voteForReceiptAddress1)
    await interDAO.closeNftVoting(voteForReceiptAddress2)
    await interDAO.closeNftVoting(voteAgainstReceiptAddress3)
    await interDAO.closeNftVoting(voteForReceiptAddress4)
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
