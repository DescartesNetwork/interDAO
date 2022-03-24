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

describe('interDAO', () => {
  // Configure the client to use the local cluster.
  const provider = Provider.env()
  setProvider(provider)

  const program = workspace.InterDao as Program<InterDao>
  const spl = Spl.token()
  const dao = new web3.Keypair()
  let masterKey: web3.PublicKey
  let treasury: web3.PublicKey
  let proposal: web3.PublicKey
  const mint = new web3.Keypair()
  let tokenAccount: web3.PublicKey

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
    treasury = await utils.token.associatedAddress({
      mint: mint.publicKey,
      owner: masterKey,
    })
    await initializeAccount(treasury, mint.publicKey, masterKey, provider)
    await spl.rpc.mintTo(new BN(1_000_000_000_000), {
      accounts: {
        mint: mint.publicKey,
        to: treasury,
        authority: provider.wallet.publicKey,
      },
    })
    // Derive proposal account
    const [proposalPublicKey] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('proposal'), dao.publicKey.toBuffer()],
      program.programId,
    )
    proposal = proposalPublicKey
  })

  it('initialize a DAO', async () => {
    await program.rpc.initializeDao({
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
    const pubkeys = [treasury, tokenAccount, masterKey]
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
      {
        accounts: {
          authority: provider.wallet.publicKey,
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

  it('execute a proposal', async () => {
    const { amount: prevAmount } = await spl.account.token.fetch(treasury)
    console.log('Prev Amount', prevAmount.toString())

    const remainingAccounts = [
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: masterKey, isSigner: false, isWritable: true },
    ]
    await program.rpc.executeProposal({
      accounts: {
        authority: provider.wallet.publicKey,
        proposal,
        dao: dao.publicKey,
        masterKey,
        invokedProgram: spl.programId,
      },
      remainingAccounts,
    })

    const { amount: nextAmount } = await spl.account.token.fetch(treasury)
    console.log('Next Amount', nextAmount.toString())
  })
})
