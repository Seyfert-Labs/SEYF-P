import 'server-only'
import { DefindexSDK, SupportedNetworks } from '@defindex/sdk'
import { isPublicStellarTestnet } from '@/lib/seyf/stellar-wallet-network'

// ============================================================
// Cliente DeFindex (solo servidor). El SDK habla con api.defindex.io usando
// una API key (`sk_...`) que JAMÁS debe exponerse al navegador — por eso vive
// detrás de los route handlers /api/defindex/*, igual que los secrets de
// Juno/Bitso. El cliente firma el XDR resultante con Pollar y lo reenvía a
// /api/defindex/submit.
// ============================================================

export { SupportedNetworks }

/** Red DeFindex alineada con la red de la wallet Pollar (testnet por defecto). */
export function defindexNetwork(): SupportedNetworks {
  return isPublicStellarTestnet() ? SupportedNetworks.TESTNET : SupportedNetworks.MAINNET
}

let cached: DefindexSDK | null = null

/**
 * Instancia perezosa del SDK. La API key es opcional en testnet para lecturas,
 * pero las escrituras (deposit/withdraw/submit) suelen requerirla.
 */
export function getDefindexSDK(): DefindexSDK {
  if (cached) return cached
  cached = new DefindexSDK({
    apiKey: process.env.DEFINDEX_API_KEY?.trim() || undefined,
    baseUrl: process.env.DEFINDEX_BASE_URL?.trim() || 'https://api.defindex.io',
    defaultNetwork: defindexNetwork(),
  })
  return cached
}
