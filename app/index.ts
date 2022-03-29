import { web3, Program, Provider, utils, BN } from '@project-serum/anchor'
import { TypeDef } from '@project-serum/anchor/dist/cjs/program/namespace/types'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { InterDao } from '../target/types/inter_dao'

import {
  DEFAULT_RPC_ENDPOINT,
  DEFAULT_INTERDAO_PROGRAM_ID,
  DEFAULT_INTERDAO_IDL,
} from './constant'
import { findProposal, findReceipt, isAddress } from './utils'

export type AnchorWallet = Wallet

export type InterDaoAccountChangeInfo = {
  type: 'dao' | 'proposal' | 'receipt'
  address: string
  data: Buffer
}

export type DaoData = TypeDef<InterDao['accounts'][0], InterDao>
export type ProposalData = TypeDef<InterDao['accounts'][1], InterDao>
export type ReceiptData = TypeDef<InterDao['accounts'][2], InterDao>

type Dictatorial = { dictatorial: {} }
type Democratic = { democratic: {} }
type Autonomous = { autonomous: {} }
export type DaoMechanism = Dictatorial | Democratic | Autonomous
export const DaoMechanisms: Record<string, DaoMechanism> = {
  Dictatorial: { dictatorial: {} },
  Democratic: { democratic: {} },
  Autonomous: { autonomous: {} },
}

type StakedTokenCounter = { stakedTokenCounter: {} }
type LockedTokenCounter = { lockedTokenCounter: {} }
export type ConsensusMechanism = StakedTokenCounter | LockedTokenCounter
export const ConsensusMechanisms: Record<string, ConsensusMechanism> = {
  StakedTokenCounter: { stakedTokenCounter: {} },
  LockedTokenCounter: { lockedTokenCounter: {} },
}

class InterDAO {
  private _connection: web3.Connection
  private _provider: Provider
  readonly program: Program<InterDao>

  constructor(
    wallet: AnchorWallet,
    rpcEndpoint: string = DEFAULT_RPC_ENDPOINT,
    programId: string = DEFAULT_INTERDAO_PROGRAM_ID,
  ) {
    if (!isAddress(programId)) throw new Error('Invalid program id')
    // Private
    this._connection = new web3.Connection(rpcEndpoint, 'confirmed')
    this._provider = new Provider(this._connection, wallet, {
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
   * Parse dao buffer data.
   * @param data Dao buffer data.
   * @returns Dao readable data.
   */
  parseDaoData = (data: Buffer): DaoData => {
    return this.program.coder.accounts.decode('Dao', data)
  }

  /**
   * Get dao data.
   * @param daoAddress Dao address.
   * @returns Dao readable data.
   */
  getDaoData = async (daoAddress: string): Promise<DaoData> => {
    return this.program.account.dao.fetch(daoAddress)
  }

  /**
   * Parse proposal buffer data.
   * @param data Proposal buffer data.
   * @returns Proposal readable data.
   */
  parseProposalData = (data: Buffer): ProposalData => {
    return this.program.coder.accounts.decode('Proposal', data)
  }

  /**
   * Get proposal data.
   * @param proposalAddress Proposal address.
   * @returns Proposal readable data.
   */
  getProposalData = async (proposalAddress: string): Promise<ProposalData> => {
    return this.program.account.proposal.fetch(proposalAddress)
  }

  /**
   * Parse receipt buffer data.
   * @param data Receipt buffer data.
   * @returns Receipt readable data.
   */
  parseReceiptData = (data: Buffer): ReceiptData => {
    return this.program.coder.accounts.decode('Receipt', data)
  }

  /**
   * Get receipt data.
   * @param receiptAddress Receipt address.
   * @returns Receipt readable data.
   */
  getReceiptData = async (receiptAddress: string): Promise<ReceiptData> => {
    return this.program.account.receipt.fetch(receiptAddress)
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

    const proposalPublickKey = await findProposal(
      new BN(proposalIndex),
      new web3.PublicKey(daoAddress),
      this.program.programId,
    )
    const proposalAddress = proposalPublickKey.toBase58()

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

    const receiptPublickKey = await findReceipt(
      receiptIndex,
      new web3.PublicKey(proposalAddress),
      this.program.provider.wallet.publicKey,
      this.program.programId,
    )
    const receiptAddress = receiptPublickKey.toBase58()

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

    return proposalAddress
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
      [Buffer.from('master_key'), daoPublicKey.toBuffer()],
      this.program.programId,
    )
    return masterPublicKey.toBase58()
  }

  /**
   * Initialize a DAO. This DAO will be empowered by the token.
   * @param tokenAddress The token (mint) that be be accepted to vote in the DAO.
   * @param tokenSupply The total number of tokens that is fairly distributed out to the community. Circulating amount could be acceptable definition.
   * @param dao (Optional) The dao keypair. If it's not provided, a new one will be auto generated.
   * @param daoMechanism (Optional) DAO mechanism. Default is Dictatorial.
   * @returns { txId, daoAddress }
   */
  initializeDao = async (
    tokenAddress: string,
    tokenSupply: BN,
    dao: web3.Keypair = web3.Keypair.generate(),
    daoMechanism: DaoMechanism = DaoMechanisms.Dictatorial,
  ) => {
    if (!isAddress(tokenAddress)) throw new Error('Invalid token address')
    if (!tokenSupply.gt(new BN(0)))
      throw new Error('Invalid token supply must be greater than zero')
    const masterAddress = await this.deriveMasterAddress(
      dao.publicKey.toBase58(),
    )
    const masterPublicKey = new web3.PublicKey(masterAddress)
    const tokenPublicKey = new web3.PublicKey(tokenAddress)
    const txId = await this.program.rpc.initializeDao(
      daoMechanism,
      tokenSupply,
      {
        accounts: {
          dao: dao.publicKey,
          authority: this._provider.wallet.publicKey,
          masterKey: masterPublicKey,
          mint: tokenPublicKey,
          systemProgram: web3.SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [dao],
      },
    )
    return { txId, daoAddress: dao.publicKey.toBase58() }
  }
}

export default InterDAO
