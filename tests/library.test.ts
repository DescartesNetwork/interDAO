import {
  web3,
  setProvider,
  workspace,
  utils,
  Spl,
  BN,
  AnchorProvider,
  Program,
} from '@project-serum/anchor'

import { initializeAccount, initializeMint } from './pretest'
import * as soproxABI from 'soprox-abi'
import { expect } from 'chai'
import InterDaoProgram from '../dist/app'
import { InterDao } from '../target/types/inter_dao'
import { Connection } from '@solana/web3.js'

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

describe('Library Test', () => {
  // Configure the client to use the local cluster.
  const provider = AnchorProvider.local()
  setProvider(provider)

  const program = workspace.InterDao as Program<InterDao>

  // @ts-ignore
  const rpc = provider.connection._rpcEndpoint
  const interDaoProgram = new InterDaoProgram(
    provider.wallet,
    rpc,
    program.programId.toBase58(),
  )

  const spl = Spl.token()
  const mint = new web3.Keypair()
  let tokenAccount: web3.PublicKey
  const dao = new web3.Keypair()
  let master: web3.PublicKey
  let daoTreasury: web3.PublicKey
  let proposal: web3.PublicKey
  let voteForReceipt: web3.PublicKey
  let voteAgainstReceipt: web3.PublicKey
  let treasurer: web3.PublicKey
  let treasury: web3.PublicKey
  const currentTime = Math.floor(Number(new Date()) / 1000)
  let listeners: number[] = []

  let proposalInstructions = [web3.Keypair.generate(), web3.Keypair.generate()]

  before(async () => {
    // Init a mint
    await initializeMint(9, mint, provider, spl)
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
    treasury = await utils.token.associatedAddress({
      mint: mint.publicKey,
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

  it('initialize a DAO', async () => {
    await program.rpc.initializeDao(
      DaoRegimes.Autonomous,
      new BN(1),
      PRIMARY_DUMMY_METADATA,
      false,
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

  it('initialize a proposal', async () => {
    await interDaoProgram.initializeProposal({
      daoAddress: dao.publicKey.toBase58(),
      startDate: currentTime + 10,
      endDate: currentTime + 20,
      metadata: PRIMARY_DUMMY_METADATA,
      consensusMechanism: ConsensusMechanisms.LockedTokenCounter,
      consensusQuorum: ConsensusQuorums.Half,
    })

    const { startDate } = await program.account.proposal.fetch(proposal)
    console.log('startDate', startDate.toNumber())
  })

  it('initialize a proposal instruction', async () => {
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

    const txs = await Promise.all(
      proposalInstructions.map(async (ix, idx) => {
        const { tx } = await interDaoProgram.initializeProposalInstruction({
          proposal: proposal.toBase58(),
          data: buf.toBuffer(),
          invokedProgramAddress: utils.token.TOKEN_PROGRAM_ID.toBase58(),
          isMasters,
          isSigners,
          isWritables,
          pubkeys,
          proposalInstruction: ix,
          sendAndConfirm: false,
        })

        return { tx, signers: [ix] }
      }),
    )
    await provider.sendAll(txs)
  })

  it('vote for the proposal', async () => {
    await asyncWait(10000) // Wait for 10 seconds

    const { votingForPower: prevVotingForPower } =
      await program.account.proposal.fetch(proposal)
    console.log('Prev Voting-For Power', prevVotingForPower.toString())

    await program.rpc.voteFor(new BN(0), new BN(10), new BN(0), new BN(0), {
      accounts: {
        authority: provider.wallet.publicKey,
        src: tokenAccount,
        treasurer,
        mint: mint.publicKey,
        treasury,
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
  })

  it('vote against the proposal', async () => {
    const { votingAgainstPower: prevVotingAgainstPower } =
      await program.account.proposal.fetch(proposal)
    console.log('Prev Voting-Against Power', prevVotingAgainstPower.toString())

    await program.rpc.voteAgainst(new BN(1), new BN(1), new BN(0), new BN(0), {
      accounts: {
        authority: provider.wallet.publicKey,
        src: tokenAccount,
        treasurer,
        mint: mint.publicKey,
        treasury,
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
  })

  it('execute the proposal instruction', async () => {
    await asyncWait(20000) // Wait for a minute

    const { amount: prevAmount } = await spl.account.token.fetch(daoTreasury)
    console.log('Prev Amount', prevAmount.toString())

    const remainingAccounts = [
      { pubkey: daoTreasury, isSigner: false, isWritable: true },
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: master, isSigner: false, isWritable: true },
    ]

    for (const ix of proposalInstructions) {
      await program.methods
        .executeProposalInstruction()
        .accounts({
          caller: provider.wallet.publicKey,
          proposal,
          proposalInstruction: ix.publicKey,
          dao: dao.publicKey,
          master,
          invokedProgram: spl.programId,
        })
        .remainingAccounts(remainingAccounts)
        .rpc()

      const { amount: nextAmount } = await spl.account.token.fetch(daoTreasury)
      const { totalExecuted } = await program.account.proposal.fetch(proposal)
      console.log('totalExecuted', totalExecuted.toString())
      console.log(' Next Amount', nextAmount.toString())
    }
  })

  it('close the vote-for receipt', async () => {
    const data = await program.account.receipt.fetch(voteForReceipt)
    console.log('Receipt Data', data)
    await program.rpc.close({
      accounts: {
        authority: provider.wallet.publicKey,
        dst: tokenAccount,
        treasurer,
        mint: mint.publicKey,
        treasury,
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

  it('close the vote-against receipt', async () => {
    const data = await program.account.receipt.fetch(voteAgainstReceipt)
    console.log('Receipt Data', data)
    await program.rpc.close({
      accounts: {
        authority: provider.wallet.publicKey,
        dst: tokenAccount,
        treasurer,
        mint: mint.publicKey,
        treasury,
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
