import type { PollarClient } from '@pollar/core'
import type { RetiroData } from './useRetiroData'

export type RetiroCtx = {
  publicKey: string
  network: 'mainnet' | 'testnet'
  usdcIssuer: string
  getClient: () => PollarClient
  data: RetiroData
  goTo: (tab: 'fondear' | 'ahorro' | 'adelanto') => void
}
