import type { CrossmintStellarClient } from '@/lib/wallet/crossmint-stellar'
import type { RetiroData } from './useRetiroData'

export type RetiroSignerClient = CrossmintStellarClient

export type RetiroCtx = {
  publicKey: string
  network: 'mainnet' | 'testnet'
  usdcIssuer: string
  getClient: () => CrossmintStellarClient
  data: RetiroData
  goTo: (tab: 'fondear' | 'ahorro' | 'adelanto') => void
}
