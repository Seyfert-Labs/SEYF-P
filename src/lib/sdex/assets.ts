// Catálogo de activos para swaps en el SDEX de Stellar (path payments vía Horizon).

export type SdexAssetCode = 'XLM' | 'USDC'

export interface SdexAsset {
  code: SdexAssetCode
  name: string
  decimals: number
  flag: string
}

export const SDEX_DECIMALS = 7
export const SDEX_UNIT = 10 ** SDEX_DECIMALS

export const SDEX_ASSETS: SdexAsset[] = [
  { code: 'XLM', name: 'Stellar Lumens', decimals: SDEX_DECIMALS, flag: '🪙' },
  { code: 'USDC', name: 'USD Coin', decimals: SDEX_DECIMALS, flag: '🇺🇸' },
]

export function sdexAssetByCode(code: string): SdexAsset | undefined {
  return SDEX_ASSETS.find((a) => a.code === code.toUpperCase())
}

export function tradableSdexAssets(): SdexAsset[] {
  return SDEX_ASSETS
}

/** Monto humano → stroops (7 decimales) para Horizon. */
export function toStroops(amount: number): string {
  return String(Math.round(amount * SDEX_UNIT))
}
