import {
  web3,
  setProvider,
  utils,
  Spl,
  BN,
  AnchorProvider,
  Wallet,
} from '@project-serum/anchor'
import { Program } from '@project-serum/anchor'
import { IDL, InterDao } from '../target/types/inter_dao'
import {
  DEFAULT_CLUSTER,
  DEFAULT_COMMITMENT,
  getCurrentUnixTimestamp,
  getMetadataPDA,
  initializeAccount,
  initializeMint,
  INTERDAO_PROGRAM_ID,
} from './pretest'
import * as soproxABI from 'soprox-abi'
import { expect } from 'chai'

const { data: PRIMARY_DUMMY_METADATA } = Buffer.from(
  'b2b68b298b9bfa2dd2931cd879e5c9997837209476d25319514b46f7b7911d31',
  'hex',
).toJSON()
const { data: SECONDARY_DUMMY_METADATA } = Buffer.from(
  'c2b68b298b9bfa2dd2931cd879e5c9997837209476d25319514b46f7b7911d31',
  'hex',
).toJSON()

const PRIV_KEY_FOR_TEST_ONLY = Buffer.from([
  2, 178, 226, 192, 204, 173, 232, 36, 247, 215, 203, 12, 177, 251, 254, 243,
  92, 38, 237, 60, 38, 248, 213, 19, 73, 180, 31, 164, 63, 210, 172, 90, 85,
  215, 166, 105, 84, 194, 133, 92, 34, 27, 39, 2, 158, 57, 64, 226, 198, 222,
  25, 127, 150, 87, 141, 234, 34, 239, 139, 107, 155, 32, 47, 199,
])
/// Mint hashcode privateKey for test
const MINT_PRIV_KEY = Buffer.from([
  113, 203, 195, 181, 2, 118, 181, 35, 13, 224, 187, 136, 135, 132, 6, 72, 243,
  1, 36, 241, 228, 34, 156, 105, 255, 251, 136, 132, 110, 200, 239, 228, 25,
  187, 72, 113, 126, 98, 149, 103, 116, 38, 112, 124, 74, 152, 8, 36, 80, 126,
  170, 238, 131, 149, 146, 160, 98, 212, 204, 8, 136, 77, 253, 207,
])

/// Dao hashcode privateKey for test
const DAO_PRIV_KEY = Buffer.from([
  250, 18, 160, 160, 95, 119, 38, 47, 6, 25, 193, 175, 107, 17, 235, 142, 152,
  158, 70, 68, 66, 73, 191, 21, 15, 123, 104, 123, 13, 158, 48, 39, 230, 253,
  79, 168, 249, 31, 55, 119, 92, 99, 130, 206, 16, 39, 65, 93, 70, 118, 14, 0,
  189, 136, 246, 48, 106, 199, 237, 21, 212, 183, 53, 54,
])

export const asyncWait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

// Consensus mechanism
export const ConsensusMechanisms = {
  StakedTokenCounter: { stakedTokenCounter: {} },
  LockedTokenCounter: { lockedTokenCounter: {} },
}
// Consensus quorum
export const ConsensusQuorums = {
  OneThird: { oneThird: {} },
  Half: { half: {} },
  TwoThird: { twoThird: {} },
}
// Dao mechanism
export const DaoRegimes = {
  Dictatorial: { dictatorial: {} },
  Democratic: { democratic: {} },
  Autonomous: { autonomous: {} },
}

describe('interDAO_NFT_Voting', () => {
  // Configure the client to use the devnet cluster.
  const wallet = new Wallet(web3.Keypair.fromSecretKey(PRIV_KEY_FOR_TEST_ONLY))
  const connection = new web3.Connection(DEFAULT_CLUSTER, DEFAULT_COMMITMENT)
  const provider = new AnchorProvider(connection, wallet, {
    preflightCommitment: DEFAULT_COMMITMENT,
  })
  setProvider(provider)
  const program = new Program<InterDao>(IDL, INTERDAO_PROGRAM_ID, provider)
  const spl = Spl.token(provider)

  // Init a token
  const mint = new web3.Keypair()
  //   const mint = web3.Keypair.fromSecretKey(MINT_PRIV_KEY)
  let tokenAccount: web3.PublicKey

  // NFT
  const collection = new web3.PublicKey(
    'PV64GFvXc9vNWWvQs9XAxGYjy9xzACHw9yAJhAypeVe',
  )
  const mintNFT1 = new web3.PublicKey(
    '6LGK11vFr4vZkxccc9xHVjkj3X15tArHMGZm7agswUJN',
  )
  const mintNFT2 = new web3.PublicKey(
    'D3JBrQnWwDPGDYDaYLSdqtqNvhueFhr3RjwWEcUgvw7G',
  )
  const mintNFT3 = new web3.PublicKey(
    'DgvNAogiS9GBDFHP6hQoTncCpVjuDUCfo1ZrApNhj6zJ',
  )

  console.log('NFT1: ', mintNFT1)
  console.log('NFT2: ', mintNFT2)
  console.log('NFT3: ', mintNFT3)

  let nftTokenAccount1: web3.PublicKey
  let nftTokenAccount2: web3.PublicKey
  let nftTokenAccount3: web3.PublicKey

  let metadataAddressNFT1: web3.PublicKey
  let metadataAddressNFT2: web3.PublicKey
  let metadataAddressNFT3: web3.PublicKey

  let treasuryNFT1: web3.PublicKey
  let treasuryNFT2: web3.PublicKey
  let treasuryNFT3: web3.PublicKey

  //Init dao
  const dao = new web3.Keypair()
  //   const dao = web3.Keypair.fromSecretKey(DAO_PRIV_KEY)
  let master: web3.PublicKey
  let daoTreasury: web3.PublicKey
  let proposal: web3.PublicKey

  let voteForReceipt1: web3.PublicKey
  let voteForReceipt2: web3.PublicKey
  let voteAgainstReceipt3: web3.PublicKey
  let treasurer: web3.PublicKey

  let currentTime: number

  before(async () => {
    console.log(
      'WalletInfo: ',
      wallet.publicKey.toBase58(),
      provider.wallet.publicKey.toBase58(),
    )
    tokenAccount = await utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: wallet.publicKey,
    })

    // Init and Mint Token
    await initializeMint(9, mint, provider, spl)
    await initializeAccount(
      tokenAccount,
      mint.publicKey,
      wallet.publicKey,
      provider,
    )
    await spl.rpc.mintTo(new BN(1_000_000_000_000), {
      accounts: {
        mint: mint.publicKey,
        to: tokenAccount,
        authority: wallet.publicKey,
      },
    })
    console.log('Dao: ', dao.publicKey.toBase58())
    console.log('Mint: ', mint.publicKey.toBase58())
    console.log('TokenAccount: ', tokenAccount.toBase58())

    //  Derive NFT token account
    nftTokenAccount1 = await utils.token.associatedAddress({
      mint: mintNFT1,
      owner: provider.wallet.publicKey,
    })
    nftTokenAccount2 = await utils.token.associatedAddress({
      mint: mintNFT2,
      owner: provider.wallet.publicKey,
    })
    nftTokenAccount3 = await utils.token.associatedAddress({
      mint: mintNFT3,
      owner: provider.wallet.publicKey,
    })
    console.log('nftTokenAccount1: ', nftTokenAccount1.toBase58())
    console.log('nftTokenAccount2: ', nftTokenAccount2.toBase58())
    console.log('nftTokenAccount3: ', nftTokenAccount3.toBase58())

    //  Derive NFT token account metadata
    metadataAddressNFT1 = await getMetadataPDA(mintNFT1)
    metadataAddressNFT2 = await getMetadataPDA(mintNFT2)
    metadataAddressNFT3 = await getMetadataPDA(mintNFT3)

    console.log(
      'metadata address: ',
      metadataAddressNFT1.toBase58(),
      metadataAddressNFT2.toBase58(),
      metadataAddressNFT3.toBase58(),
    )

    // Derive master account
    const [masterKeyPublicKey] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('master'), dao.publicKey.toBuffer()],
      program.programId,
    )
    master = masterKeyPublicKey
    // Derive dao treasury account
    daoTreasury = await utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: master,
    })

    // Init and mint daoTreasury
    await initializeAccount(daoTreasury, mint.publicKey, master, provider)
    await spl.rpc.mintTo(new BN(1_000_000_000_000), {
      accounts: {
        mint: mint.publicKey,
        to: daoTreasury,
        authority: provider.wallet.publicKey,
      },
    })
    console.log(
      'daoTreasury: ',
      daoTreasury.toBase58(),
      await (await spl.account.token.fetch(daoTreasury)).amount.toString(),
    )

    // Derive proposal account
    const [proposalPublicKey] = await web3.PublicKey.findProgramAddress(
      [
        Buffer.from('proposal'),
        new BN(0).toArrayLike(Buffer, 'le', 8), // Browser compatibility 6
        dao.publicKey.toBuffer(),
      ],
      program.programId,
    )
    proposal = proposalPublicKey
    console.log('proposal: ', proposal.toBase58())

    const [treasurerPublicKey] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('treasurer'), proposal.toBuffer()],
      program.programId,
    )
    treasurer = treasurerPublicKey
    console.log('treasurer: ', treasurer.toBase58())

    //treasury for NFT1, NFT2, NFT3
    treasuryNFT1 = await utils.token.associatedAddress({
      mint: mintNFT1,
      owner: treasurer,
    })
    console.log('treasuryNFT1: ', treasuryNFT1.toBase58())

    treasuryNFT2 = await utils.token.associatedAddress({
      mint: mintNFT2,
      owner: treasurer,
    })
    console.log('treasuryNFT2: ', treasuryNFT2.toBase58())

    treasuryNFT3 = await utils.token.associatedAddress({
      mint: mintNFT3,
      owner: treasurer,
    })
    console.log('treasuryNFT3: ', treasuryNFT3.toBase58())

    //Voter's receipt
    const [voteForReceiptPublicKey1] = await web3.PublicKey.findProgramAddress(
      [
        Buffer.from('receipt'),
        new BN(0).toArrayLike(Buffer, 'le', 8), // Browser compatibility
        proposal.toBuffer(),
        provider.wallet.publicKey.toBuffer(),
      ],
      program.programId,
    )
    voteForReceipt1 = voteForReceiptPublicKey1
    console.log('voteForReceipt1: ', voteForReceipt1.toBase58())

    const [voteForReceiptPublicKey2] = await web3.PublicKey.findProgramAddress(
      [
        Buffer.from('receipt'),
        new BN(1).toArrayLike(Buffer, 'le', 8), // Browser compatibility
        proposal.toBuffer(),
        provider.wallet.publicKey.toBuffer(),
      ],
      program.programId,
    )
    voteForReceipt2 = voteForReceiptPublicKey2
    console.log('voteForReceipt2: ', voteForReceipt2.toBase58())

    const [voteAgainstReceiptPublicKey3] =
      await web3.PublicKey.findProgramAddress(
        [
          Buffer.from('receipt'),
          new BN(2).toArrayLike(Buffer, 'le', 8), // Browser compatibility
          proposal.toBuffer(),
          provider.wallet.publicKey.toBuffer(),
        ],
        program.programId,
      )
    voteAgainstReceipt3 = voteAgainstReceiptPublicKey3
    console.log('voteAgainstReceipt3: ', voteAgainstReceipt3.toBase58())
  })

  it('constructor', async () => {
    console.log('ProgramID: ', program.programId.toBase58())

    // Airdrop to wallet
    const lamports = await connection.getBalance(wallet.publicKey)
    if (lamports < 10 * web3.LAMPORTS_PER_SOL)
      await connection.requestAirdrop(wallet.publicKey, web3.LAMPORTS_PER_SOL)
    // Current Unix Timestamp
    currentTime = await getCurrentUnixTimestamp(provider)
    console.log('current Time: ', currentTime)
  })

  it('initialize a NFT DAO', async () => {
    await program.rpc.initializeDao(
      DaoRegimes.Autonomous,
      new BN(1),
      PRIMARY_DUMMY_METADATA,
      true,
      true,
      {
        accounts: {
          dao: dao.publicKey,
          authority: provider.wallet.publicKey,
          master,
          mint: collection,
          systemProgram: web3.SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [dao],
      },
    )
    const data = await program.account.dao.fetch(dao.publicKey)
    console.log('DAO data', data)
  })

  it('initialize a NFT proposal', async () => {
    const buf = new soproxABI.struct(
      [
        { key: 'code', type: 'u8' },
        { key: 'amount', type: 'u64' },
      ],
      { code: 3, amount: 1000n },
    )
    const pubkeys = [daoTreasury, tokenAccount, master]
    const isSigners = [false, false, true]
    const isWritables = [true, true, true]
    const isMasters = [false, false, true]
    await program.rpc.initializeProposal(
      buf.toBuffer(),
      pubkeys,
      isSigners,
      isWritables,
      isMasters,
      ConsensusMechanisms.LockedTokenCounter,
      ConsensusQuorums.OneThird,
      new BN(currentTime + 10),
      new BN(currentTime + 60),
      PRIMARY_DUMMY_METADATA,
      new BN(10 ** 6), // tax
      new BN(10 ** 6), // revenue
      {
        accounts: {
          caller: provider.wallet.publicKey,
          proposal,
          dao: dao.publicKey,
          invokedProgram: utils.token.TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
          taxman: provider.wallet.publicKey,
          revenueman: provider.wallet.publicKey,
        },
      },
    )
    const { dataLen, data, accountsLen, accounts } =
      await program.account.proposal.fetch(proposal)
    console.log('1. Proposal data', dataLen.toString(), data)
    console.log('2. Proposal data', accountsLen.toString(), accounts)
  })

  it('vote NFT1 for the proposal', async () => {
    await asyncWait(10000) // Wait for 10 seconds

    const { votingForPower: prevVotingForPower } =
      await program.account.proposal.fetch(proposal)
    console.log('Prev Voting-For Power', prevVotingForPower.toString())

    await program.rpc.voteNftFor(new BN(0), new BN(0), new BN(0), {
      accounts: {
        authority: provider.wallet.publicKey,
        src: nftTokenAccount1,
        treasurer,
        mint: mintNFT1,
        metadata: metadataAddressNFT1,
        treasury: treasuryNFT1,
        proposal,
        dao: dao.publicKey,
        receipt: voteForReceipt1,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
        taxman: provider.wallet.publicKey,
        revenueman: provider.wallet.publicKey,
      },
    })

    const { votingForPower: nextVotingForPower } =
      await program.account.proposal.fetch(proposal)
    console.log('Next Voting_For Power', nextVotingForPower.toString())
    console.log(
      'nftTokenAccount1: ',
      await spl.account.token.fetch(nftTokenAccount1),
    )
    console.log('treasuryNFT1: ', await spl.account.token.fetch(treasuryNFT1))
  })

  it('vote NFT2 for the proposal', async () => {
    const { votingForPower: prevVotingForPower } =
      await program.account.proposal.fetch(proposal)
    console.log('Prev Voting-For Power', prevVotingForPower.toString())

    await program.rpc.voteNftFor(new BN(1), new BN(0), new BN(0), {
      accounts: {
        authority: provider.wallet.publicKey,
        src: nftTokenAccount2,
        treasurer,
        mint: mintNFT2,
        metadata: metadataAddressNFT2,
        treasury: treasuryNFT2,
        proposal,
        dao: dao.publicKey,
        receipt: voteForReceipt2,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
        taxman: provider.wallet.publicKey,
        revenueman: provider.wallet.publicKey,
      },
    })

    const { votingForPower: nextVotingForPower } =
      await program.account.proposal.fetch(proposal)
    console.log('Next Voting_For Power', nextVotingForPower.toString())
    console.log(
      'nftTokenAccount2: ',
      await spl.account.token.fetch(nftTokenAccount2),
    )
    console.log('treasuryNFT2: ', await spl.account.token.fetch(treasuryNFT2))
  })

  it('vote NFT3 against the proposal', async () => {
    const { votingAgainstPower: prevVotingAgainstPower } =
      await program.account.proposal.fetch(proposal)
    console.log('Prev Voting-Against Power', prevVotingAgainstPower.toString())

    await program.rpc.voteNftAgainst(new BN(2), new BN(0), new BN(0), {
      accounts: {
        authority: provider.wallet.publicKey,
        src: nftTokenAccount3,
        treasurer,
        mint: mintNFT3,
        metadata: metadataAddressNFT3,
        treasury: treasuryNFT3,
        proposal,
        dao: dao.publicKey,
        receipt: voteAgainstReceipt3,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
        taxman: provider.wallet.publicKey,
        revenueman: provider.wallet.publicKey,
      },
    })

    const { votingAgainstPower: nextVotingAgainstPower } =
      await program.account.proposal.fetch(proposal)
    console.log('Next Voting-Against Power', nextVotingAgainstPower.toString())
    console.log(
      'nftTokenAccount3: ',
      await spl.account.token.fetch(nftTokenAccount3),
    )
    console.log('treasuryNFT3: ', await spl.account.token.fetch(treasuryNFT3))
  })

  it('execute the NFT proposal', async () => {
    await asyncWait(60000) // Wait for a minute

    const { amount: prevAmount } = await spl.account.token.fetch(daoTreasury)
    console.log('Prev Amount', prevAmount.toString())

    const remainingAccounts = [
      { pubkey: daoTreasury, isSigner: false, isWritable: true },
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: master, isSigner: false, isWritable: true },
    ]
    await program.rpc.executeProposal({
      accounts: {
        caller: provider.wallet.publicKey,
        proposal,
        dao: dao.publicKey,
        master,
        invokedProgram: spl.programId,
      },
      remainingAccounts,
    })

    const { amount: nextAmount } = await spl.account.token.fetch(daoTreasury)
    console.log('Next Amount', nextAmount.toString())
    console.log(
      'Token Account',
      await (await spl.account.token.fetch(tokenAccount)).amount.toString(),
    )
  })

  it('close the vote-nft-for receipt1', async () => {
    const data = await program.account.receipt.fetch(voteForReceipt1)
    console.log('Receipt1 Data', data)
    await program.rpc.closeNftVoting({
      accounts: {
        authority: provider.wallet.publicKey,
        dst: nftTokenAccount1,
        treasurer,
        mint: mintNFT1,
        metadata: metadataAddressNFT1,
        treasury: treasuryNFT1,
        proposal,
        dao: dao.publicKey,
        receipt: voteForReceipt1,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    })
    try {
      await program.account.receipt.fetch(voteForReceipt1)
      throw new Error('The receipt account is not closed correctly')
    } catch (er) {
      console.log(er.message)
    }
  })

  it('close the vote-nft-for receipt2', async () => {
    const data = await program.account.receipt.fetch(voteForReceipt2)
    console.log('Receipt2 Data', data)
    await program.rpc.closeNftVoting({
      accounts: {
        authority: provider.wallet.publicKey,
        dst: nftTokenAccount2,
        treasurer,
        mint: mintNFT2,
        metadata: metadataAddressNFT2,
        treasury: treasuryNFT2,
        proposal,
        dao: dao.publicKey,
        receipt: voteForReceipt2,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    })
    try {
      await program.account.receipt.fetch(voteForReceipt2)
      throw new Error('The receipt account is not closed correctly')
    } catch (er) {
      console.log(er.message)
    }
  })

  it('close the vote-nft-for receipt 3', async () => {
    const data = await program.account.receipt.fetch(voteAgainstReceipt3)
    console.log('Receipt Data', data)
    await program.rpc.closeNftVoting({
      accounts: {
        authority: provider.wallet.publicKey,
        dst: nftTokenAccount3,
        treasurer,
        mint: mintNFT3,
        metadata: metadataAddressNFT3,
        treasury: treasuryNFT3,
        proposal,
        dao: dao.publicKey,
        receipt: voteAgainstReceipt3,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    })
    try {
      await program.account.receipt.fetch(voteAgainstReceipt3)
      throw new Error('The receipt account is not closed correctly')
    } catch (er) {
      console.log(er.message)
    }
  })

  it('update dao regime', async () => {
    const regime = DaoRegimes.Democratic
    await program.rpc.updateDaoRegime(regime, {
      accounts: {
        authority: provider.wallet.publicKey,
        dao: dao.publicKey,
      },
    })
    const { regime: updatedRegime } = await program.account.dao.fetch(
      dao.publicKey,
    )
    expect(updatedRegime).to.deep.equal(regime)
  })

  it('update total power', async () => {
    const newSupply = new BN(10)
    await program.rpc.updateSupply(newSupply, {
      accounts: {
        authority: provider.wallet.publicKey,
        dao: dao.publicKey,
      },
    })
    const { supply } = await program.account.dao.fetch(dao.publicKey)
    expect(supply.eq(newSupply)).true
  })

  it('update DAO metadata', async () => {
    await program.rpc.updateDaoMetadata(SECONDARY_DUMMY_METADATA, {
      accounts: {
        authority: provider.wallet.publicKey,
        dao: dao.publicKey,
      },
    })
    const { metadata } = await program.account.dao.fetch(dao.publicKey)
    expect(metadata).deep.equal(SECONDARY_DUMMY_METADATA)
  })

  it('transfer authority', async () => {
    const newAuthority = new web3.Keypair().publicKey
    await program.rpc.transferAuthority({
      accounts: {
        authority: provider.wallet.publicKey,
        newAuthority,
        dao: dao.publicKey,
      },
    })
    const { authority } = await program.account.dao.fetch(dao.publicKey)
    expect(authority.equals(newAuthority)).true
  })
})
