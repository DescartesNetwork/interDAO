import {
  web3,
  Provider,
  setProvider,
  workspace,
  utils,
  Spl,
  BN,
} from '@project-serum/anchor'
import { Program } from '@project-serum/anchor'
import { InterDao } from '../target/types/inter_dao'
import { initializeAccount, initializeMint } from './pretest'
import * as soproxABI from 'soprox-abi'
import { expect } from 'chai'

export const asyncWait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

// Consensus mechanism
export const ConsensusMechanism = {
  StakedTokenCounter: { stakedTokenCounter: {} },
  LockedTokenCounter: { lockedTokenCounter: {} },
}
// Dao mechanism
export const DaoMechanism = {
  Dictatorial: { dictatorial: {} },
  Democratic: { democratic: {} },
  Autonomous: { autonomous: {} },
}

describe('interDAO', () => {
  // Configure the client to use the local cluster.
  const provider = Provider.env()
  setProvider(provider)

  const program = workspace.InterDao as Program<InterDao>
  const spl = Spl.token()
  const mint = new web3.Keypair()
  let tokenAccount: web3.PublicKey
  const dao = new web3.Keypair()
  let masterKey: web3.PublicKey
  let daoTreasury: web3.PublicKey
  let proposal: web3.PublicKey
  let receipt: web3.PublicKey
  let treasurer: web3.PublicKey
  let treasury: web3.PublicKey
  const currentTime = Math.floor(Number(new Date()) / 1000)

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
    // Derive master account
    const [masterKeyPublicKey] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('master_key'), dao.publicKey.toBuffer()],
      program.programId,
    )
    masterKey = masterKeyPublicKey
    // Derive treasury account
    daoTreasury = await utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: masterKey,
    })
    await initializeAccount(daoTreasury, mint.publicKey, masterKey, provider)
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
        dao.publicKey.toBuffer(),
        new BN(0).toBuffer('le', 8),
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
    const [receiptPublicKey] = await web3.PublicKey.findProgramAddress(
      [
        Buffer.from('receipt'),
        new BN(0).toBuffer('le', 4),
        dao.publicKey.toBuffer(),
        proposal.toBuffer(),
        provider.wallet.publicKey.toBuffer(),
      ],
      program.programId,
    )
    receipt = receiptPublicKey
  })

  it('initialize a DAO', async () => {
    await program.rpc.initializeDao(DaoMechanism.Autonomous, new BN(1), {
      accounts: {
        dao: dao.publicKey,
        authority: provider.wallet.publicKey,
        masterKey,
        mint: mint.publicKey,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
      signers: [dao],
    })
    const data = await program.account.dao.fetch(dao.publicKey)
    console.log('DAO data', data)
  })

  it('initialize a proposal', async () => {
    const buf = new soproxABI.struct(
      [
        { key: 'code', type: 'u8' },
        { key: 'amount', type: 'u64' },
      ],
      { code: 3, amount: 1000n },
    )
    const pubkeys = [daoTreasury, tokenAccount, masterKey]
    const prevIsSigners = [false, false, false]
    const prevIsWritables = [true, true, true]
    const nextIsSigners = [false, false, true]
    const nextIsWritables = [true, true, true]
    await program.rpc.initializeProposal(
      buf.toBuffer(),
      pubkeys,
      prevIsSigners,
      prevIsWritables,
      nextIsSigners,
      nextIsWritables,
      ConsensusMechanism.LockedTokenCounter,
      new BN(currentTime + 10),
      new BN(currentTime + 60),
      {
        accounts: {
          caller: provider.wallet.publicKey,
          proposal,
          dao: dao.publicKey,
          invokedProgram: utils.token.TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
        },
      },
    )
    const { dataLen, data, accountsLen, accounts } =
      await program.account.proposal.fetch(proposal)
    console.log('1. Proposal data', dataLen.toString(), data)
    console.log('2. Proposal data', accountsLen.toString(), accounts)
  })

  it('vote the proposal', async () => {
    await asyncWait(10000) // Wait for 10 seconds

    const { votedPower: prevVotedPower } = await program.account.proposal.fetch(
      proposal,
    )
    console.log('Prev Voted Power', prevVotedPower.toString())

    await program.rpc.vote(0, new BN(2), new BN(currentTime + 60), {
      accounts: {
        authority: provider.wallet.publicKey,
        src: tokenAccount,
        treasurer,
        mint: mint.publicKey,
        treasury,
        proposal,
        dao: dao.publicKey,
        receipt,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    })

    const { votedPower: nextVotedPower } = await program.account.proposal.fetch(
      proposal,
    )
    console.log('Next Voted Power', nextVotedPower.toString())
  })

  it('void the proposal', async () => {
    const { votedPower: prevVotedPower } = await program.account.proposal.fetch(
      proposal,
    )
    console.log('Prev Voted Power', prevVotedPower.toString())

    await program.rpc.void(0, new BN(1), {
      accounts: {
        authority: provider.wallet.publicKey,
        dst: tokenAccount,
        treasurer,
        mint: mint.publicKey,
        treasury,
        proposal,
        dao: dao.publicKey,
        receipt,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    })

    const { votedPower: nextVotedPower } = await program.account.proposal.fetch(
      proposal,
    )
    console.log('Next Voted Power', nextVotedPower.toString())
  })

  it('execute the proposal', async () => {
    await asyncWait(60000) // Wait for a minute

    const { amount: prevAmount } = await spl.account.token.fetch(daoTreasury)
    console.log('Prev Amount', prevAmount.toString())

    const remainingAccounts = [
      { pubkey: daoTreasury, isSigner: false, isWritable: true },
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: masterKey, isSigner: false, isWritable: true },
    ]
    await program.rpc.executeProposal({
      accounts: {
        caller: provider.wallet.publicKey,
        proposal,
        dao: dao.publicKey,
        masterKey,
        invokedProgram: spl.programId,
      },
      remainingAccounts,
    })

    const { amount: nextAmount } = await spl.account.token.fetch(daoTreasury)
    console.log('Next Amount', nextAmount.toString())
  })

  it('close the receipt', async () => {
    const data = await program.account.receipt.fetch(receipt)
    console.log('Receipt Data', data)
    await program.rpc.close(0, {
      accounts: {
        authority: provider.wallet.publicKey,
        dst: tokenAccount,
        treasurer,
        mint: mint.publicKey,
        treasury,
        proposal,
        dao: dao.publicKey,
        receipt,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    })
    try {
      await program.account.receipt.fetch(receipt)
      throw new Error('The receipt account is not closed correctly')
    } catch (er) {
      console.log(er.message)
    }
  })

  it('update dao mechanism', async () => {
    const daoMechanism = DaoMechanism.Democratic
    await program.rpc.updateDaoMechanism(daoMechanism, {
      accounts: {
        authority: provider.wallet.publicKey,
        dao: dao.publicKey,
      },
    })
    const { mechanism } = await program.account.dao.fetch(dao.publicKey)
    expect(mechanism).to.deep.equal(daoMechanism)
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
