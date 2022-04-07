import { BN, web3 } from '@project-serum/anchor'

/**
 * Validate an address
 * @param address Base58 string
 * @returns true/false
 */
export const isAddress = (address: string | undefined): address is string => {
  if (!address) return false
  try {
    const publicKey = new web3.PublicKey(address)
    if (!publicKey) throw new Error('Invalid public key')
    return true
  } catch (er) {
    return false
  }
}

/**
 * Find the proposal of a dao based on canonical bump
 * @param index Proposal index
 * @param daoPublicKey Dao public key
 * @param programId InterDAO program public key
 * @returns Proposal public key
 */
export const findProposal = async (
  index: BN,
  daoPublicKey: web3.PublicKey,
  programId: web3.PublicKey,
) => {
  const [proposalPublicKey] = await web3.PublicKey.findProgramAddress(
    [
      Buffer.from('proposal'),
      index.toArrayLike(Buffer, 'le', 8), // Browser compatibility
      daoPublicKey.toBuffer(),
    ],
    programId,
  )
  return proposalPublicKey
}

/**
 * Find the my receipt of an proposal based on canonical bump
 * @param index Receipt index
 * @param proposalPublicKey Proposal public key
 * @param authorityPublicKey Receipt authority public key
 * @param programId InterDAO program public key
 * @returns Receipt public key
 */
export const findReceipt = async (
  index: BN,
  proposalPublicKey: web3.PublicKey,
  authorityPublicKey: web3.PublicKey,
  programId: web3.PublicKey,
) => {
  const [receiptPublicKey] = await web3.PublicKey.findProgramAddress(
    [
      Buffer.from('receipt'),
      index.toArrayLike(Buffer, 'le', 8), // Browser compatibility
      proposalPublicKey.toBuffer(),
      authorityPublicKey.toBuffer(),
    ],
    programId,
  )
  return receiptPublicKey
}
