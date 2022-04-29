import { IdlAccounts, IdlTypes, Idl, BN } from '@project-serum/anchor'
import { IdlEvent } from '@project-serum/anchor/dist/cjs/idl'
import { TypeDef } from '@project-serum/anchor/dist/cjs/program/namespace/types'
import { Wallet } from '@project-serum/anchor/dist/cjs/provider'
import { InterDao } from '../target/types/inter_dao'

export type AnchorWallet = Wallet

export type DaoData = IdlAccounts<InterDao>['dao']
export type ProposalData = IdlAccounts<InterDao>['proposal']
export type ReceiptData = IdlAccounts<InterDao>['receipt']

export type DaoRegime = IdlTypes<InterDao>['DaoRegime']
export const DaoRegimes: Record<string, DaoRegime> = {
  Dictatorial: { dictatorial: {} },
  Democratic: { democratic: {} },
  Autonomous: { autonomous: {} },
}

export type ConsensusMechanism = IdlTypes<InterDao>['ConsensusMechanism']
export const ConsensusMechanisms: Record<string, ConsensusMechanism> = {
  StakedTokenCounter: { stakedTokenCounter: {} },
  LockedTokenCounter: { lockedTokenCounter: {} },
}

export type ConsensusQuorum = IdlTypes<InterDao>['ConsensusQuorum']
export const ConsensusQuorums: Record<string, ConsensusQuorum> = {
  OneThird: { oneThird: {} },
  Half: { half: {} },
  TwoThird: { twoThird: {} },
}

export type InvokedAccount = IdlTypes<InterDao>['InvokedAccount']

type TypeDefDictionary<T extends IdlEvent[], Defined> = {
  [K in T[number]['name']]: TypeDef<
    {
      name: K
      type: {
        kind: 'struct'
        fields: Extract<T[number], { name: K }>['fields']
      }
    },
    Defined
  >
}
export type IdlEvents<T extends Idl> = TypeDefDictionary<
  NonNullable<T['events']>,
  Record<string, never>
>

export type FeeOptions = {
  tax: BN
  taxmanAddress: string
  revenue: BN
  revenuemanAddress: string
}
