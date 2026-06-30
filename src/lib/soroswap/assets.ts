// Catálogo de tokens Soroswap (Stellar/Soroban). Isomórfico cliente/servidor.
// Las direcciones son contratos SAC públicos (no son secretos) → NEXT_PUBLIC_.
// Fuente testnet: token list oficial de Soroswap.
//
// NOTA: en Soroswap testnet solo XLM y USDC tienen liquidez. CETES no existe como
// token/pool en testnet → el swap de CETES falla en /quote hasta que haya pool.
// Lo dejamos en el catálogo (deshabilitado salvo que se configure su dirección)
// para no romper la UI y poder activarlo cuando exista liquidez.

export type SoroswapAssetCode = 'XLM' | 'USDC' | 'CETES'

export interface SoroswapAsset {
  code: SoroswapAssetCode
  name: string
  /** Dirección del contrato SAC del token en la red activa. Vacío = no operable. */
  address: string
  /** Stellar usa 7 decimales (1 unidad = 10^7 stroops). */
  decimals: number
  flag: string
}

// Direcciones testnet. XLM = SAC nativo. USDC = SAC de la USDC de Circle en testnet
// (USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5), la que tiene pool.
const XLM_DEFAULT = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
const USDC_DEFAULT = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'

export const SOROSWAP_DECIMALS = 7
export const SOROSWAP_UNIT = 10 ** SOROSWAP_DECIMALS

export const SOROSWAP_ASSETS: SoroswapAsset[] = [
  {
    code: 'XLM',
    name: 'Stellar Lumens',
    address: process.env.NEXT_PUBLIC_SOROSWAP_TOKEN_XLM?.trim() || XLM_DEFAULT,
    decimals: SOROSWAP_DECIMALS,
    flag: '🪙',
  },
  {
    code: 'USDC',
    name: 'USD Coin',
    address: process.env.NEXT_PUBLIC_SOROSWAP_TOKEN_USDC?.trim() || USDC_DEFAULT,
    decimals: SOROSWAP_DECIMALS,
    flag: '🇺🇸',
  },
  {
    // Sin dirección por defecto: CETES no tiene token/pool en Soroswap testnet.
    // Si algún día se despliega, basta con setear NEXT_PUBLIC_SOROSWAP_TOKEN_CETES.
    code: 'CETES',
    name: 'CETES (gob. MX)',
    address: process.env.NEXT_PUBLIC_SOROSWAP_TOKEN_CETES?.trim() || '',
    decimals: SOROSWAP_DECIMALS,
    flag: '🇲🇽',
  },
]

export function soroswapAssetByCode(code: string): SoroswapAsset | undefined {
  return SOROSWAP_ASSETS.find((a) => a.code === code.toUpperCase())
}

/** Solo los activos con dirección configurada → operables en swap. */
export function tradableSoroswapAssets(): SoroswapAsset[] {
  return SOROSWAP_ASSETS.filter((a) => a.address.length > 0)
}

/** Convierte un monto humano a stroops (entero) para la API de Soroswap. */
export function toStroops(amount: number): string {
  return String(Math.round(amount * SOROSWAP_UNIT))
}

/** Convierte stroops (string/number) de la API a monto humano. */
export function fromStroops(raw: string | number | null | undefined): number {
  const n = Number(raw)
  return Number.isFinite(n) ? n / SOROSWAP_UNIT : 0
}
