// @ts-ignore
import * as soproxABI from 'soprox-abi'
import { web3, Program, utils, BN, AnchorProvider } from '@project-serum/anchor'
import { InterDao } from '../target/types/inter_dao'

import {
  DEFAULT_RPC_ENDPOINT,
  DEFAULT_INTERDAO_PROGRAM_ID,
  DEFAULT_INTERDAO_IDL,
  FEE_OPTIONS,
} from './constant'
import {
  AnchorWallet,
  ConsensusMechanism,
  ConsensusMechanisms,
  ConsensusQuorum,
  ConsensusQuorums,
  DaoData,
  DaoRegime,
  DaoRegimes,
  FeeOptions,
  IdlEvents,
  InvokedAccount,
  ProposalData,
  ReceiptData,
} from './types'
import { findProposal, findReceipt, isAddress } from './utils'

class InterDAO {
  private _connection: web3.Connection
  private _provider: AnchorProvider
  readonly program: Program<InterDao>

  constructor(
    wallet: AnchorWallet,
    rpcEndpoint: string = DEFAULT_RPC_ENDPOINT,
    programId: string = DEFAULT_INTERDAO_PROGRAM_ID,
  ) {
    if (!isAddress(programId)) throw new Error('Invalid program id')
    // Private
    this._connection = new web3.Connection(rpcEndpoint, 'confirmed')
    this._provider = new AnchorProvider(this._connection, wallet, {
      skipPreflight: true,
      commitment: 'confirmed',
    })
    // Public
    this.program = new Program<InterDao>(
      DEFAULT_INTERDAO_IDL,
      programId,
      this._provider,
    )
  }

  /**
   * Get list of event names
   */
  get events() {
    return this.program.idl.events.map(({ name }) => name)
  }

  /**
   * Listen changes on an event
   * @param eventName Event name
   * @param callback Event handler
   * @returns Listener id
   */
  addListener = async <T extends keyof IdlEvents<InterDao>>(
    eventName: T,
    callback: (data: IdlEvents<InterDao>[T]) => void,
  ) => {
    return await this.program.addEventListener(
      eventName as string,
      (data: IdlEvents<InterDao>[T]) => callback(data),
    )
  }

  /**
   * Remove listener by its id
   * @param listenerId Listener id
   * @returns
   */
  removeListener = async (listenerId: number) => {
    try {
      await this.program.removeEventListener(listenerId)
    } catch (er: any) {
      console.warn(er)
    }
  }

  /**
   * Get current Unix Timestamp of Solana Cluster
   * @param getCurrentUnixTimestamp
   * @returns Number (in seconds)
   */
  getCurrentUnixTimestamp = async (): Promise<number> => {
    const { data: buf } =
      (await this.program.provider.connection.getAccountInfo(
        web3.SYSVAR_CLOCK_PUBKEY,
      )) || {}
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

  /**
   * Parse dao buffer data.
   * @param data Dao buffer data.
   * @returns Dao readable data.
   */
  parseDaoData = (data: Buffer): DaoData => {
    return this.program.coder.accounts.decode('dao', data)
  }

  /**
   * Get dao data.
   * @param daoAddress Dao address.
   * @returns Dao readable data.
   */
  getDaoData = async (daoAddress: string): Promise<DaoData> => {
    return this.program.account.dao.fetch(daoAddress) as any
  }

  /**
   * Parse proposal buffer data.
   * @param data Proposal buffer data.
   * @returns Proposal readable data.
   */
  parseProposalData = (data: Buffer): ProposalData => {
    return this.program.coder.accounts.decode('proposal', data)
  }

  /**
   * Get proposal data.
   * @param proposalAddress Proposal address.
   * @returns Proposal readable data.
   */
  getProposalData = async (proposalAddress: string): Promise<ProposalData> => {
    return this.program.account.proposal.fetch(proposalAddress) as any
  }

  /**
   * Parse receipt buffer data.
   * @param data Receipt buffer data.
   * @returns Receipt readable data.
   */
  parseReceiptData = (data: Buffer): ReceiptData => {
    return this.program.coder.accounts.decode('receipt', data)
  }

  /**
   * Get receipt data.
   * @param receiptAddress Receipt address.
   * @returns Receipt readable data.
   */
  getReceiptData = async (receiptAddress: string): Promise<ReceiptData> => {
    return this.program.account.receipt.fetch(receiptAddress) as any
  }

  /**
   * Derive a proposal address by dao address and proposal's index.
   * @param daoAddress Dao address.
   * @param proposalIndex Proposal's index.
   * @param strict (Optional) if true, a validation process will activate to make sure the proposal is safe.
   * @returns Proposal address.
   */
  deriveProposalAddress = async (
    daoAddress: string,
    proposalIndex: BN,
    strict: boolean = false,
  ) => {
    if (!isAddress(daoAddress)) throw new Error('Invalid DAO address')
    if (proposalIndex.isNeg())
      throw new Error('Invalid index must be greater than or equal to zero')

    const proposalPublicKey = await findProposal(
      new BN(proposalIndex),
      new web3.PublicKey(daoAddress),
      this.program.programId,
    )
    const proposalAddress = proposalPublicKey.toBase58()

    if (strict) {
      let onchainDaoAddress: string
      let onchainIndex: BN
      try {
        const { dao, index } = await this.getProposalData(proposalAddress)
        onchainDaoAddress = dao.toBase58()
        onchainIndex = index
      } catch (er) {
        throw new Error(
          `This proposal ${proposalAddress} is not initialized yet`,
        )
      }
      if (daoAddress !== onchainDaoAddress)
        throw new Error('Violated DAO address')
      if (!proposalIndex.eq(onchainIndex)) throw new Error('Violated index')
    }

    return proposalAddress
  }

  /**
   * Derive my receipt address by proposal address and receipt's index.
   * @param receiptIndex Receipt's index.
   * @param proposalAddress Proposal address.
   * @param strict (Optional) if true, a validation process will activate to make sure the receipt is safe.
   * @returns Receipt address.
   */
  deriveReceiptAddress = async (
    receiptIndex: BN,
    proposalAddress: string,
    strict: boolean = false,
  ) => {
    if (receiptIndex.isNeg())
      throw new Error('Invalid index must be greater than or equal to zero')
    if (!isAddress(proposalAddress)) throw new Error('Invalid proposal address')

    const receiptPublicKey = await findReceipt(
      receiptIndex,
      new web3.PublicKey(proposalAddress),
      this._provider.wallet.publicKey,
      this.program.programId,
    )
    const receiptAddress = receiptPublicKey.toBase58()

    if (strict) {
      let onchainAuthorityAddress: string
      let onchainProposalAddress: string
      let onchainIndex: BN
      try {
        const { authority, proposal, index } = await this.getReceiptData(
          receiptAddress,
        )
        onchainAuthorityAddress = authority.toBase58()
        onchainProposalAddress = proposal.toBase58()
        onchainIndex = index
      } catch (er) {
        throw new Error(`This receipt ${receiptAddress} is not initialized yet`)
      }
      if (
        this._provider.wallet.publicKey.toBase58() !== onchainAuthorityAddress
      )
        throw new Error('Violated authority address')
      if (proposalAddress !== onchainProposalAddress)
        throw new Error('Violated proposal address')
      if (!receiptIndex.eq(onchainIndex)) throw new Error('Violated index')
    }

    return receiptAddress
  }

  /**
   * Find an available receipt's index of a wallet for a proposal
   * @param proposalAddress Proposal address
   * @param authorityAddress Wallet address
   * @returns
   */
  findAvailableReceiptIndex = async (
    proposalAddress: string,
    authorityAddress: string,
  ) => {
    if (!isAddress(proposalAddress)) throw new Error('Invalid proposal address')
    if (!isAddress(authorityAddress))
      throw new Error('Invalid authority address')

    let receiptIndex = new BN(0)
    const one = new BN(1)
    while (true) {
      try {
        await this.deriveReceiptAddress(receiptIndex, proposalAddress, true)
        receiptIndex = receiptIndex.add(one)
      } catch (er: any) {
        return receiptIndex
      }
    }
  }

  /**
   * Derive treasurer address of a proposal.
   * @param proposalAddress Proposal address.
   * @returns Treasurer address that holds the secure token treasuries of the printer.
   */
  deriveTreasurerAddress = async (proposalAddress: string) => {
    if (!isAddress(proposalAddress)) throw new Error('Invalid proposal address')
    const proposalPublicKey = new web3.PublicKey(proposalAddress)
    const [treasurerPublicKey] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('treasurer'), proposalPublicKey.toBuffer()],
      this.program.programId,
    )
    return treasurerPublicKey.toBase58()
  }

  /**
   * Derive master address of a dao.
   * @param daoAddress Dao address.
   * @returns Master address that's on behelf of the DAO to execute transactions.
   */
  deriveMasterAddress = async (daoAddress: string) => {
    if (!isAddress(daoAddress)) throw new Error('Invalid DAO address')
    const daoPublicKey = new web3.PublicKey(daoAddress)
    const [masterPublicKey] = await web3.PublicKey.findProgramAddress(
      [Buffer.from('master'), daoPublicKey.toBuffer()],
      this.program.programId,
    )
    return masterPublicKey.toBase58()
  }

  /**
   * Initialize a DAO. This DAO will be empowered by the token.
   * @param tokenAddress The token (mint) that be be accepted to vote in the DAO.
   * @param tokenSupply The total number of tokens that is fairly distributed out to the community. Circulating amount could be acceptable definition.
   * @param dao (Optional) The dao keypair. If it's not provided, a new one will be auto generated.
   * @param regime (Optional) DAO regime. Default is Dictatorial.
   * @returns { txId, daoAddress }
   */
  initializeDao = async (
    tokenAddress: string,
    tokenSupply: BN,
    metadata: Buffer | Uint8Array,
    dao: web3.Keypair = web3.Keypair.generate(),
    regime: DaoRegime = DaoRegimes.Dictatorial,
  ) => {
    if (!isAddress(tokenAddress)) throw new Error('Invalid token address')
    if (!tokenSupply.gt(new BN(0)))
      throw new Error('Invalid token supply must be greater than zero')
    if (metadata.length !== 32) throw new Error('Invalid metadata path')
    const masterAddress = await this.deriveMasterAddress(
      dao.publicKey.toBase58(),
    )
    const masterPublicKey = new web3.PublicKey(masterAddress)
    const tokenPublicKey = new web3.PublicKey(tokenAddress)
    const txId = await this.program.rpc.initializeDao(
      regime,
      tokenSupply,
      metadata,
      {
        accounts: {
          dao: dao.publicKey,
          authority: this._provider.wallet.publicKey,
          master: masterPublicKey,
          mint: tokenPublicKey,
          systemProgram: web3.SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [dao],
      },
    )
    return { txId, daoAddress: dao.publicKey.toBase58() }
  }

  /**
   * Initialize a proposal for a DAO.
   * @param daoAddress The token (mint) that be be accepted to vote in the DAO.
   * @param data The tracsaction data for the action.
   * @param pubkeys The involved account public keys for the action.
   * @param isSigners
   * @param isWritables
   * @param isMasters
   * @param startDate Start voting
   * @param endDate End voting
   * @param consensusMechanism (Optional) Consensus mechanism. Default is StakedTokenCounter.
   * @returns { txId, proposalAddress }
   */
  initializeProposal = async (
    daoAddress: string,
    invokedProgramAddress: string,
    data: Buffer | Uint8Array,
    pubkeys: web3.PublicKey[],
    isSigners: boolean[],
    isWritables: boolean[],
    isMasters: boolean[],
    startDate: number,
    endDate: number,
    metadata: Buffer | Uint8Array,
    consensusMechanism: ConsensusMechanism = ConsensusMechanisms.StakedTokenCounter,
    consensusQuorum: ConsensusQuorum = ConsensusQuorums.Half,
    feeOptions: Partial<FeeOptions> = {},
  ) => {
    const { tax, taxmanAddress, revenue, revenuemanAddress } = {
      ...FEE_OPTIONS(this._provider.wallet.publicKey.toBase58()),
      ...feeOptions,
    }
    if (!isAddress(daoAddress)) throw new Error('Invalid DAO address')
    if (!isAddress(taxmanAddress)) throw new Error('Invalid taxman address')
    if (!isAddress(revenuemanAddress))
      throw new Error('Invalid revenue receiver address')
    if (metadata.length !== 32) throw new Error('Invalid metadata path')
    if (
      pubkeys.length !== isSigners.length ||
      pubkeys.length !== isWritables.length ||
      pubkeys.length !== isMasters.length
    )
      throw new Error(
        'Invalid length of pubkeys and thier flags (isSigner, isWritable, isMaster)',
      )
    const currentTime = await this.getCurrentUnixTimestamp()
    if (startDate <= currentTime) throw new Error('Invalid start date')
    if (endDate <= startDate) throw new Error('Invalid end date')

    const { nonce } = await this.getDaoData(daoAddress)

    const proposalAddress = await this.deriveProposalAddress(daoAddress, nonce)
    const proposalPublicKey = new web3.PublicKey(proposalAddress)
    const daoPublicKey = new web3.PublicKey(daoAddress)
    const invokedProgramPublicKey = new web3.PublicKey(invokedProgramAddress)
    const taxmanPublicKey = new web3.PublicKey(taxmanAddress)
    const revenuemanPublicKey = new web3.PublicKey(revenuemanAddress)

    const txId = await this.program.rpc.initializeProposal(
      data,
      pubkeys,
      isSigners,
      isWritables,
      isMasters,
      consensusMechanism,
      consensusQuorum,
      new BN(startDate),
      new BN(endDate),
      metadata,
      tax,
      revenue,
      {
        accounts: {
          caller: this._provider.wallet.publicKey,
          proposal: proposalPublicKey,
          dao: daoPublicKey,
          invokedProgram: invokedProgramPublicKey,
          systemProgram: web3.SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
          taxman: taxmanPublicKey,
          revenueman: revenuemanPublicKey,
        },
      },
    )
    return { txId, proposalAddress }
  }

  /**
   * Execute a proposal for a DAO.
   * @param daoAddress The token (mint) that be be accepted to vote in the DAO.
   * @returns { txId, proposalAddress }
   */
  executeProposal = async (proposalAddress: string) => {
    if (!isAddress(proposalAddress)) throw new Error('Invalid proposal address')

    const {
      accounts,
      dao: daoPublicKey,
      invokedProgram,
    } = await this.getProposalData(proposalAddress)
    const remainingAccounts = (accounts as InvokedAccount[]).map(
      ({ pubkey, isSigner, isWritable, isMaster }) => ({
        pubkey,
        isSigner: isSigner && !isMaster,
        isWritable,
      }),
    )

    const proposalPublicKey = new web3.PublicKey(proposalAddress)
    const masterPublicKey = await this.deriveMasterAddress(
      daoPublicKey.toBase58(),
    )
    const txId = await this.program.rpc.executeProposal({
      accounts: {
        caller: this._provider.wallet.publicKey,
        proposal: proposalPublicKey,
        dao: daoPublicKey,
        master: masterPublicKey,
        invokedProgram,
      },
      remainingAccounts,
    })
    return { txId }
  }

  /**
   * Vote for a proposal.
   * @param proposalAddress Proposal address.
   * @param amount Amount of tokens to vote.
   * @returns { txId, receiptAddress }
   */
  voteFor = async (
    proposalAddress: string,
    amount: BN,
    feeOptions: Partial<FeeOptions> = {},
  ) => {
    const { tax, taxmanAddress, revenue, revenuemanAddress } = {
      ...FEE_OPTIONS(this._provider.wallet.publicKey.toBase58()),
      ...feeOptions,
    }
    if (!isAddress(proposalAddress)) throw new Error('Invalid proposal address')
    if (!isAddress(taxmanAddress)) throw new Error('Invalid taxman address')
    if (!isAddress(revenuemanAddress))
      throw new Error('Invalid revenue receiver address')
    if (amount.isNeg() || amount.isZero()) throw new Error('Invalid amount')

    const proposalPublicKey = new web3.PublicKey(proposalAddress)
    const { dao: daoPublicKey } = await this.getProposalData(proposalAddress)
    const { mint: mintPublicKey } = await this.getDaoData(
      daoPublicKey.toBase58(),
    )
    const authorityPublicKey = this._provider.wallet.publicKey
    const srcPublicKey = await utils.token.associatedAddress({
      mint: mintPublicKey,
      owner: authorityPublicKey,
    })
    const index = await this.findAvailableReceiptIndex(
      proposalAddress,
      authorityPublicKey.toBase58(),
    )
    const receiptAddress = await this.deriveReceiptAddress(
      index,
      proposalAddress,
    )
    const receiptPublicKey = new web3.PublicKey(receiptAddress)
    const treasurerAddress = await this.deriveTreasurerAddress(proposalAddress)
    const treasurerPublicKey = new web3.PublicKey(treasurerAddress)
    const treasuryPublicKey = await utils.token.associatedAddress({
      mint: mintPublicKey,
      owner: treasurerPublicKey,
    })
    const taxmanPublicKey = new web3.PublicKey(taxmanAddress)
    const revenuemanPublicKey = new web3.PublicKey(revenuemanAddress)

    const txId = await this.program.rpc.voteFor(index, amount, tax, revenue, {
      accounts: {
        authority: authorityPublicKey,
        src: srcPublicKey,
        treasurer: treasurerPublicKey,
        mint: mintPublicKey,
        treasury: treasuryPublicKey,
        proposal: proposalPublicKey,
        dao: daoPublicKey,
        receipt: receiptPublicKey,
        taxman: taxmanPublicKey,
        revenueman: revenuemanPublicKey,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    })
    return { txId, receiptAddress }
  }

  /**
   * Vote against a proposal.
   * @param proposalAddress Proposal address.
   * @param amount Amount of tokens to vote.
   * @param unlockedDate Unlocked date of the tokens.
   * @returns { txId, receiptAddress }
   */
  voteAgainst = async (
    proposalAddress: string,
    amount: BN,
    feeOptions: Partial<FeeOptions> = {},
  ) => {
    const { tax, taxmanAddress, revenue, revenuemanAddress } = {
      ...FEE_OPTIONS(this._provider.wallet.publicKey.toBase58()),
      ...feeOptions,
    }
    if (!isAddress(proposalAddress)) throw new Error('Invalid proposal address')
    if (!isAddress(taxmanAddress)) throw new Error('Invalid taxman address')
    if (!isAddress(revenuemanAddress))
      throw new Error('Invalid revenue receiver address')
    if (amount.isNeg() || amount.isZero()) throw new Error('Invalid amount')

    const proposalPublicKey = new web3.PublicKey(proposalAddress)
    const { dao: daoPublicKey } = await this.getProposalData(proposalAddress)
    const { mint: mintPublicKey } = await this.getDaoData(
      daoPublicKey.toBase58(),
    )
    const authorityPublicKey = this._provider.wallet.publicKey
    const srcPublicKey = await utils.token.associatedAddress({
      mint: mintPublicKey,
      owner: authorityPublicKey,
    })
    const index = await this.findAvailableReceiptIndex(
      proposalAddress,
      authorityPublicKey.toBase58(),
    )
    const receiptAddress = await this.deriveReceiptAddress(
      index,
      proposalAddress,
    )
    const receiptPublicKey = new web3.PublicKey(receiptAddress)
    const treasurerAddress = await this.deriveTreasurerAddress(proposalAddress)
    const treasurerPublicKey = new web3.PublicKey(treasurerAddress)
    const treasuryPublicKey = await utils.token.associatedAddress({
      mint: mintPublicKey,
      owner: treasurerPublicKey,
    })
    const taxmanPublicKey = new web3.PublicKey(taxmanAddress)
    const revenuemanPublicKey = new web3.PublicKey(revenuemanAddress)

    const txId = await this.program.rpc.voteAgainst(
      index,
      amount,
      tax,
      revenue,
      {
        accounts: {
          authority: authorityPublicKey,
          src: srcPublicKey,
          treasurer: treasurerPublicKey,
          mint: mintPublicKey,
          treasury: treasuryPublicKey,
          proposal: proposalPublicKey,
          dao: daoPublicKey,
          receipt: receiptPublicKey,
          taxman: taxmanPublicKey,
          revenueman: revenuemanPublicKey,
          tokenProgram: utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
        },
      },
    )
    return { txId, receiptAddress }
  }

  /**
   * Close receipts and collect tokens and lamports back.
   * @param receiptAddress Receipt address.
   * @param amount Amount of tokens to void.
   * @returns { txId, receiptAddress }
   */
  close = async (receiptAddress: string) => {
    if (!isAddress(receiptAddress)) throw new Error('Invalid receipt address')

    const { proposal: proposalPublicKey } = await this.getReceiptData(
      receiptAddress,
    )
    const proposalAddress = proposalPublicKey.toBase58()
    const { dao: daoPublicKey, endDate } = await this.getProposalData(
      proposalAddress,
    )
    const { mint: mintPublicKey } = await this.getDaoData(
      daoPublicKey.toBase58(),
    )
    const authorityPublicKey = this._provider.wallet.publicKey
    const dstPublicKey = await utils.token.associatedAddress({
      mint: mintPublicKey,
      owner: authorityPublicKey,
    })
    const receiptPublicKey = new web3.PublicKey(receiptAddress)
    const treasurerAddress = await this.deriveTreasurerAddress(proposalAddress)
    const treasurerPublicKey = new web3.PublicKey(treasurerAddress)
    const treasuryPublicKey = await utils.token.associatedAddress({
      mint: mintPublicKey,
      owner: treasurerPublicKey,
    })

    const currentTime = await this.getCurrentUnixTimestamp()
    if (currentTime <= endDate.toNumber())
      throw new Error('The proposal is not ended yet')

    const txId = await this.program.rpc.close({
      accounts: {
        authority: authorityPublicKey,
        dst: dstPublicKey,
        treasurer: treasurerPublicKey,
        mint: mintPublicKey,
        treasury: treasuryPublicKey,
        proposal: proposalPublicKey,
        dao: daoPublicKey,
        receipt: receiptPublicKey,
        tokenProgram: utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      },
    })
    return { txId, receiptAddress }
  }

  /**
   * Update DAO's supply
   * @param supply The new supply.
   * @param daoAddress DAO address.
   * @returns { txId }
   */
  updateDaoSupply = async (supply: BN, daoAddress: string) => {
    if (supply.isNeg() || supply.isZero()) throw new Error('Invalid supply')
    if (!isAddress(daoAddress)) throw new Error('Invalid DAO address')
    const txId = await this.program.rpc.updateSupply(supply, {
      accounts: {
        authority: this._provider.wallet.publicKey,
        dao: new web3.PublicKey(daoAddress),
      },
    })
    return { txId }
  }

  /**
   * Update DAO's regime
   * @param regime The new regime.
   * @param daoAddress DAO address.
   * @returns { txId }
   */
  updateDaoRegime = async (regime: DaoRegime, daoAddress: string) => {
    if (!isAddress(daoAddress)) throw new Error('Invalid DAO address')
    const txId = await this.program.rpc.updateDaoRegime(regime, {
      accounts: {
        authority: this._provider.wallet.publicKey,
        dao: new web3.PublicKey(daoAddress),
      },
    })
    return { txId }
  }

  /**
   * Update DAO's metadata
   * @param metadata The new metadata.
   * @param daoAddress DAO address.
   * @returns { txId }
   */
  updateDaoMetadata = async (
    metadata: Buffer | Uint8Array | number[],
    daoAddress: string,
  ) => {
    if (!isAddress(daoAddress)) throw new Error('Invalid DAO address')
    if (metadata.length !== 32) throw new Error('Invalid metadata path')
    const txId = await this.program.rpc.updateDaoMetadata(
      metadata as number[],
      {
        accounts: {
          authority: this._provider.wallet.publicKey,
          dao: new web3.PublicKey(daoAddress),
        },
      },
    )
    return { txId }
  }

  /**
   * Transfer the DAO authority
   * @param newAuthority The new taxman authority (the function will auto derive the taxman account for the authority).
   * @param daoAddress DAO address.
   * @returns { txId }
   */
  transferAuthority = async (newAuthority: string, daoAddress: string) => {
    if (!isAddress(newAuthority)) throw new Error('Invalid authority address')
    if (!isAddress(daoAddress)) throw new Error('Invalid DAO address')
    const txId = await this.program.rpc.transferAuthority({
      accounts: {
        authority: this._provider.wallet.publicKey,
        newAuthority: new web3.PublicKey(newAuthority),
        dao: new web3.PublicKey(daoAddress),
      },
    })
    return { txId }
  }
}

export default InterDAO
