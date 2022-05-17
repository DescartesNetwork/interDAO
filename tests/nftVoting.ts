import {
  web3,
  setProvider,
  workspace,
  utils,
  Spl,
  BN,
  AnchorProvider,
} from '@project-serum/anchor'
import { Program } from '@project-serum/anchor'
import { InterDao } from '../target/types/inter_dao'
import { initializeAccount, initializeMint } from './pretest'
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

describe('interDAO', () => {
  // Configure the client to use the local cluster.
  const provider = AnchorProvider.local()
  setProvider(provider)

  const program = workspace.InterDao as Program<InterDao>
  const spl = Spl.token()
  const mint = new web3.Keypair()
  let tokenAccount: web3.PublicKey

  const mintNFT1 = new web3.Keypair()
  let nftTokenAccount1: web3.PublicKey
  const mintNFT2 = new web3.Keypair()
  let nftTokenAccount2: web3.PublicKey
  const mintNFT3 = new web3.Keypair()
  let nftTokenAccount3: web3.PublicKey

  let treasuryNFT1: web3.PublicKey
  let treasuryNFT2: web3.PublicKey
  let treasuryNFT3: web3.PublicKey

  const dao = new web3.Keypair()
  let master: web3.PublicKey
  let daoTreasury: web3.PublicKey
  let proposal: web3.PublicKey
  let voteForReceipt: web3.PublicKey
  let voteForReceipt3: web3.PublicKey
  let voteAgainstReceipt: web3.PublicKey
  let treasurer: web3.PublicKey
  let treasury: web3.PublicKey
  const currentTime = Math.floor(Number(new Date()) / 1000)
  let listeners: number[] = []

  before(async () => {
    // Init a mint
    await initializeMint(9, mint, provider)
    // Derive token account
    tokenAccount = await utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: provider.wallet.publicKey,
    })

    await initializeAccount(
      tokenAccount,
      mint.publicKey,
      provider.wallet.publicKey,
      provider,
    )
    await spl.rpc.mintTo(new BN(1_000_000_000_000), {
      accounts: {
        mint: mint.publicKey,
        to: tokenAccount,
        authority: provider.wallet.publicKey,
      },
    })

    // Init a mint NFT 1
    await initializeMint(0, mintNFT1, provider)
    // Derive NFT token account
    nftTokenAccount1 = await utils.token.associatedAddress({
      mint: mintNFT1.publicKey,
      owner: provider.wallet.publicKey,
    })
    await initializeAccount(
      nftTokenAccount1,
      mintNFT1.publicKey,
      provider.wallet.publicKey,
      provider,
    )
    await spl.rpc.mintTo(new BN(1), {
      accounts: {
        mint: mintNFT1.publicKey,
        to: nftTokenAccount1,
        authority: provider.wallet.publicKey,
      },
    })

    // Init a mint NFT 2
    await initializeMint(0, mintNFT2, provider)
    // Derive NFT token account
    nftTokenAccount2 = await utils.token.associatedAddress({
      mint: mintNFT2.publicKey,
      owner: provider.wallet.publicKey,
    })
    await initializeAccount(
      nftTokenAccount2,
      mintNFT2.publicKey,
      provider.wallet.publicKey,
      provider,
    )
    await spl.rpc.mintTo(new BN(1), {
      accounts: {
        mint: mintNFT2.publicKey,
        to: nftTokenAccount2,
        authority: provider.wallet.publicKey,
      },
    })

    // Init a mint NFT 3
    await initializeMint(0, mintNFT3, provider)
    // Derive NFT token account
    nftTokenAccount3 = await utils.token.associatedAddress({
      mint: mintNFT3.publicKey,
      owner: provider.wallet.publicKey,
    })
    await initializeAccount(
      nftTokenAccount3,
      mintNFT3.publicKey,
      provider.wallet.publicKey,
      provider,
    )
    await spl.rpc.mintTo(new BN(1), {
      accounts: {
        mint: mintNFT3.publicKey,
        to: nftTokenAccount3,
        authority: provider.wallet.publicKey,
      },
    })

    console.log(
      'nftTokenAccount: ',
      await spl.account.token.fetch(nftTokenAccount1),
      await spl.account.token.fetch(nftTokenAccount2),
      await spl.account.token.fetch(nftTokenAccount3),
    )

    // Derive master account
    const [masterKeyPublicKey] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('master'), dao.publicKey.toBuffer()],
      program.programId,
    )
    master = masterKeyPublicKey
    // Derive treasury account
    daoTreasury = await utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: master,
    })
    await initializeAccount(daoTreasury, mint.publicKey, master, provider)
    await spl.rpc.mintTo(new BN(1_000_000_000_000), {
      accounts: {
        mint: mint.publicKey,
        to: daoTreasury,
        authority: provider.wallet.publicKey,
      },
    })
    // Derive proposal account
    const [proposalPublicKey] = await web3.PublicKey.findProgramAddress(
      [
        Buffer.from('proposal'),
        new BN(0).toArrayLike(Buffer, 'le', 8), // Browser compatibility
        dao.publicKey.toBuffer(),
      ],
      program.programId,
    )
    proposal = proposalPublicKey
    const [treasurerPublicKey] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('treasurer'), proposal.toBuffer()],
      program.programId,
    )
    treasurer = treasurerPublicKey

    //treasury for NFT1, NFT2, NFT3
    treasuryNFT1 = await utils.token.associatedAddress({
      mint: mintNFT1.publicKey,
      owner: treasurer,
    })
    treasuryNFT2 = await utils.token.associatedAddress({
      mint: mintNFT2.publicKey,
      owner: treasurer,
    })
    treasuryNFT3 = await utils.token.associatedAddress({
      mint: mintNFT3.publicKey,
      owner: treasurer,
    })

    const [voteForReceiptPublicKey] = await web3.PublicKey.findProgramAddress(
      [
        Buffer.from('receipt'),
        new BN(0).toArrayLike(Buffer, 'le', 8), // Browser compatibility
        proposal.toBuffer(),
        provider.wallet.publicKey.toBuffer(),
      ],
      program.programId,
    )
    voteForReceipt = voteForReceiptPublicKey

    const [voteAgainstReceiptPublicKey] =
      await web3.PublicKey.findProgramAddress(
        [
          Buffer.from('receipt'),
          new BN(1).toArrayLike(Buffer, 'le', 8), // Browser compatibility
          proposal.toBuffer(),
          provider.wallet.publicKey.toBuffer(),
        ],
        program.programId,
      )
    voteAgainstReceipt = voteAgainstReceiptPublicKey

    const [voteForReceiptPublicKey3] = await web3.PublicKey.findProgramAddress(
      [
        Buffer.from('receipt'),
        new BN(2).toArrayLike(Buffer, 'le', 8), // Browser compatibility
        proposal.toBuffer(),
        provider.wallet.publicKey.toBuffer(),
      ],
      program.programId,
    )
    voteForReceipt3 = voteForReceiptPublicKey3
  })

  it('add listeners', async () => {
    program.idl.events.forEach(async ({ name }) => {
      const id = await program.addEventListener(name, (event, slot) => {
        console.group(`Event: ${name} / Slot: ${slot}`)
        console.log(event)
        console.groupEnd()
      })
      listeners.push(id)
    })
  })

  it('initialize a NFT DAO', async () => {
    await program.rpc.initializeDao(
      DaoRegimes.Autonomous,
      new BN(1),
      PRIMARY_DUMMY_METADATA,
      true,
      {
        accounts: {
          dao: dao.publicKey,
          authority: provider.wallet.publicKey,
          master,
          mint: mint.publicKey,
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

  it('vote NFT for the proposal', async () => {
    await asyncWait(10000) // Wait for 10 seconds

    const { votingForPower: prevVotingForPower } =
      await program.account.proposal.fetch(proposal)
    console.log('Prev Voting-For Power', prevVotingForPower.toString())

    await program.rpc.voteNftFor(new BN(0), new BN(0), new BN(0), {
      accounts: {
        authority: provider.wallet.publicKey,
        src: nftTokenAccount1,
        treasurer,
        mint: mint.publicKey,
        mintNft: mintNFT1.publicKey,
        treasury: treasuryNFT1,
        proposal,
        dao: dao.publicKey,
        receipt: voteForReceipt,
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

  it('vote NFT against the proposal', async () => {
    const { votingAgainstPower: prevVotingAgainstPower } =
      await program.account.proposal.fetch(proposal)
    console.log('Prev Voting-Against Power', prevVotingAgainstPower.toString())

    await program.rpc.voteNftAgainst(new BN(1), new BN(0), new BN(0), {
      accounts: {
        authority: provider.wallet.publicKey,
        src: nftTokenAccount2,
        treasurer,
        mint: mint.publicKey,
        mintNft: mintNFT2.publicKey,
        treasury: treasuryNFT2,
        proposal,
        dao: dao.publicKey,
        receipt: voteAgainstReceipt,
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
      'nftTokenAccount2: ',
      await spl.account.token.fetch(nftTokenAccount1),
    )
    console.log('treasuryNFT2: ', await spl.account.token.fetch(treasuryNFT1))
  })

  it('vote NFT3 for the proposal', async () => {
    const { votingForPower: prevVotingForPower } =
      await program.account.proposal.fetch(proposal)
    console.log('Prev Voting-For Power', prevVotingForPower.toString())

    await program.rpc.voteNftFor(new BN(2), new BN(0), new BN(0), {
      accounts: {
        authority: provider.wallet.publicKey,
        src: nftTokenAccount3,
        treasurer,
        mint: mint.publicKey,
        mintNft: mintNFT3.publicKey,
        treasury: treasuryNFT3,
        proposal,
        dao: dao.publicKey,
        receipt: voteForReceipt3,
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

  it('close the vote-nft-for receipt', async () => {
    const data = await program.account.receipt.fetch(voteForReceipt)
    console.log('Receipt Data', data)
    await program.rpc.closeNftVoting({
      accounts: {
        authority: provider.wallet.publicKey,
        dst: nftTokenAccount1,
        treasurer,
        mint: mint.publicKey,
        mintNft: mintNFT1.publicKey,
        treasury: treasuryNFT1,
        proposal,
        dao: dao.publicKey,
        receipt: voteForReceipt,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    })
    try {
      await program.account.receipt.fetch(voteForReceipt)
      throw new Error('The receipt account is not closed correctly')
    } catch (er) {
      console.log(er.message)
    }
  })

  it('close the vote-nft-for receipt 3', async () => {
    const data = await program.account.receipt.fetch(voteForReceipt3)
    console.log('Receipt Data', data)
    await program.rpc.closeNftVoting({
      accounts: {
        authority: provider.wallet.publicKey,
        dst: nftTokenAccount3,
        treasurer,
        mint: mint.publicKey,
        mintNft: mintNFT3.publicKey,
        treasury: treasuryNFT3,
        proposal,
        dao: dao.publicKey,
        receipt: voteForReceipt3,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    })
    try {
      await program.account.receipt.fetch(voteForReceipt3)
      throw new Error('The receipt account is not closed correctly')
    } catch (er) {
      console.log(er.message)
    }
  })

  it('close the vote-nft-against receipt', async () => {
    const data = await program.account.receipt.fetch(voteAgainstReceipt)
    console.log('Receipt Data', data)
    await program.rpc.closeNftVoting({
      accounts: {
        authority: provider.wallet.publicKey,
        dst: nftTokenAccount2,
        treasurer,
        mint: mint.publicKey,
        mintNft: mintNFT2.publicKey,
        treasury: treasuryNFT2,
        proposal,
        dao: dao.publicKey,
        receipt: voteAgainstReceipt,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    })
    try {
      await program.account.receipt.fetch(voteAgainstReceipt)
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

  it('remove listeners', async () => {
    listeners.forEach(async (id) => {
      await program.removeEventListener(id)
    })
  })
})
