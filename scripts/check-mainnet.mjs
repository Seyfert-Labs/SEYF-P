#!/usr/bin/env node
/**
 * check-mainnet — verificador de readiness del flujo `/retiro` en mainnet:
 * Pollar, SEP-10, sponsor, USDC, vault USDC de DeFindex y contrato del adelanto.
 *
 * No toca la red: solo lee el entorno y reporta qué falta o qué apunta a testnet
 * antes de que lo descubras en producción. Pensado para correr en local
 * (`npm run check:mainnet`) y como evidencia de readiness para la SCF.
 *
 * Carga `.env.local` y `.env` si existen (process.env real siempre gana), igual
 * que hace Next para variables de build.
 *
 * Salida: 0 si no hay errores, 1 si falta algo requerido o hay un valor de
 * testnet filtrado a mainnet.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// --- carga mínima de .env (sin dependencias) --------------------------------
function loadEnvFile(name) {
  const path = resolve(ROOT, name)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (!m) continue
    const key = m[1]
    if (key in process.env) continue // process.env real gana
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
}
loadEnvFile('.env.local')
loadEnvFile('.env')

// --- helpers ----------------------------------------------------------------
const env = (k) => (process.env[k] ?? '').trim()
const isG = (v) => /^G[A-Z2-7]{55}$/.test(v) // ed25519 public (issuer)
const isS = (v) => /^S[A-Z2-7]{55}$/.test(v) // ed25519 secret seed
const isC = (v) => /^C[A-Z2-7]{55}$/.test(v) // contract id (vault/SAC)

const NETWORK =
  env('NEXT_PUBLIC_POLLAR_STELLAR_NETWORK') ||
  env('NEXT_PUBLIC_ACCESLY_NETWORK') ||
  env('NEXT_PUBLIC_STELLAR_NETWORK') ||
  'testnet'
const IS_MAINNET = NETWORK === 'mainnet'

// Valores de TESTNET conocidos: si aparecen con la red en mainnet, es un bug.
const TESTNET_LEAKS = {
  STELLAR_USDC_ISSUER: [
    'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    'GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56',
  ],
  NEXT_PUBLIC_STELLAR_USDC_ISSUER: [
    'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    'GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56',
  ],
  NEXT_PUBLIC_DEFINDEX_VAULT_USDC: ['CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN'],
  NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS: ['CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN'],
}

/** USDC de Circle en mainnet (default del código si no hay override). */
const USDC_ISSUER_MAINNET = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'

const errors = []
const warnings = []
const oks = []

function need(key, { label, validate, hint } = {}) {
  const v = env(key)
  const name = label || key
  if (!v) {
    errors.push(`${key} — falta (${name})${hint ? ` · ${hint}` : ''}`)
    return
  }
  if (validate && !validate(v)) {
    errors.push(`${key} — formato inválido (${name})${hint ? ` · ${hint}` : ''}`)
    return
  }
  if ((TESTNET_LEAKS[key] || []).includes(v)) {
    errors.push(`${key} — es un valor de TESTNET con la red en mainnet (${name}). Cámbialo por el de producción.`)
    return
  }
  oks.push(`${key} ✓`)
}

function want(key, { label, validate, hint } = {}) {
  const v = env(key)
  const name = label || key
  if (!v) {
    warnings.push(`${key} — recomendado pero ausente (${name})${hint ? ` · ${hint}` : ''}`)
    return
  }
  if (validate && !validate(v)) {
    warnings.push(`${key} — formato sospechoso (${name})`)
    return
  }
  if ((TESTNET_LEAKS[key] || []).includes(v)) {
    errors.push(`${key} — es un valor de TESTNET con la red en mainnet (${name}).`)
    return
  }
  oks.push(`${key} ✓`)
}

/** Override opcional del emisor USDC: si viene, que sea el de Circle. */
function usdcOverride(key) {
  const v = env(key)
  if (!v) return
  if (!isG(v)) return errors.push(`${key} — formato inválido (emisor USDC)`)
  if ((TESTNET_LEAKS[key] || []).includes(v)) {
    return errors.push(`${key} — es el USDC de TESTNET con la red en mainnet. Quítalo: el default es el de Circle.`)
  }
  if (v !== USDC_ISSUER_MAINNET) {
    return warnings.push(`${key} — no es el USDC de Circle (${USDC_ISSUER_MAINNET}).`)
  }
  oks.push(`${key} ✓`)
}

// --- reglas (flujo /retiro) -------------------------------------------------
function run() {
  // Wallet embebida (Pollar). Su app de mainnet va con el patrocinio de Pollar apagado.
  if (env('NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY') || env('NEXT_PUBLIC_POLLAR_API_KEY')) {
    oks.push('NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY / NEXT_PUBLIC_POLLAR_API_KEY ✓')
  } else {
    errors.push('NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY o NEXT_PUBLIC_POLLAR_API_KEY — falta (API key de la app Pollar de mainnet)')
  }
  for (const key of ['NEXT_PUBLIC_POLLAR_STELLAR_NETWORK', 'NEXT_PUBLIC_STELLAR_NETWORK']) {
    const v = env(key)
    if (v && v !== 'mainnet') errors.push(`${key} — vale "${v}"; debe ser "mainnet" (o quitarse).`)
  }

  // Sesión SEP-10
  need('SEP10_SERVER_SECRET', { label: 'llave que firma challenges SEP-10', validate: isS })
  need('SEYF_AUTH_JWT_SECRET', { label: 'secreto del JWT de sesión', validate: (v) => v.length >= 32, hint: 'mínimo 32 chars' })
  if (env('SEP10_HOME_DOMAIN') || env('NEXT_PUBLIC_SITE_URL')) oks.push('SEP10_HOME_DOMAIN ✓')
  else errors.push('SEP10_HOME_DOMAIN — falta (home domain del challenge; o NEXT_PUBLIC_SITE_URL)')

  // Sponsor (reservas + fee-bump), restringido a la beta
  need('STELLAR_SPONSOR_SECRET', { label: 'llave patrocinadora (fondéala con XLM real)', validate: isS })
  need('SEYF_BETA_ALLOWLIST', {
    label: 'cuentas G de la beta, separadas por comas',
    validate: (v) => v.split(',').map((a) => a.trim()).filter(Boolean).every(isG),
    hint: 'sin ella el sponsor no patrocina nada en mainnet',
  })
  want('STELLAR_SPONSOR_MAX_FEE', { label: 'tope de fee de inclusión por operación (stroops)', validate: (v) => /^\d+$/.test(v) })
  want('STELLAR_SPONSOR_MAX_RESOURCE_FEE', { label: 'tope del resourceFee Soroban (stroops; default 5000000 = 0.5 XLM)', validate: (v) => /^\d+$/.test(v) })

  // USDC: el default del código es Circle; los overrides son opcionales
  usdcOverride('STELLAR_USDC_ISSUER')
  usdcOverride('NEXT_PUBLIC_STELLAR_USDC_ISSUER')

  // Vault USDC de DeFindex (catalog.ts y vaults.ts leen nombres distintos: van los dos)
  need('NEXT_PUBLIC_DEFINDEX_VAULT_USDC', { label: 'vault USDC mainnet', validate: isC })
  need('NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS', { label: 'vault USDC mainnet (vaults.ts)', validate: isC })
  const vUsdc = env('NEXT_PUBLIC_DEFINDEX_VAULT_USDC')
  const vAddr = env('NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS')
  if (vUsdc && vAddr && vUsdc !== vAddr) {
    errors.push('NEXT_PUBLIC_DEFINDEX_VAULT_USDC y NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS — apuntan a vaults distintos.')
  }

  // Contrato del adelanto (seyf_advance)
  need('NEXT_PUBLIC_STELLAR_ADVANCE_CONTRACT', { label: 'contrato seyf_advance en mainnet', validate: isC })

  // Endpoints — opcionales (hay defaults en la lista oficial de proveedores)
  want('NEXT_PUBLIC_SOROBAN_RPC_URL', {
    label: 'Soroban RPC de producción',
    hint: 'default https://mainnet.sorobanrpc.com; respaldo https://soroban-rpc.mainnet.stellar.gateway.fm',
  })
  want('NEXT_PUBLIC_HORIZON_URL', { label: 'Horizon de producción', hint: 'default https://horizon.stellar.org' })
}

// --- salida -----------------------------------------------------------------
const B = '\x1b[1m', R = '\x1b[31m', Y = '\x1b[33m', G = '\x1b[32m', D = '\x1b[2m', X = '\x1b[0m'

console.log(`\n${B}SEYF · readiness mainnet (/retiro)${X}`)
console.log(`${D}red detectada: ${X}${B}${NETWORK}${X}\n`)

if (!IS_MAINNET) {
  console.log(`${Y}La red no está en mainnet — no hay nada que bloquear.${X}`)
  console.log(`${D}Para verificar el set de producción: NEXT_PUBLIC_STELLAR_NETWORK=mainnet npm run check:mainnet${X}`)
  console.log(`${D}(con tus secretos cargados en .env.local)\n${X}`)
  process.exit(0)
}

run()

if (oks.length) {
  console.log(`${G}${B}OK (${oks.length})${X}`)
  for (const o of oks) console.log(`  ${G}✓${X} ${o.replace(' ✓', '')}`)
  console.log('')
}
if (warnings.length) {
  console.log(`${Y}${B}Avisos (${warnings.length})${X}`)
  for (const w of warnings) console.log(`  ${Y}⚠${X}  ${w}`)
  console.log('')
}
if (errors.length) {
  console.log(`${R}${B}Bloqueantes (${errors.length})${X}`)
  for (const e of errors) console.log(`  ${R}✗${X}  ${e}`)
  console.log('')
}

if (errors.length) {
  console.log(`${R}${B}No listo para mainnet: resuelve los ${errors.length} bloqueante(s).${X}\n`)
  process.exit(1)
}
console.log(`${G}${B}Listo para mainnet.${X}${warnings.length ? ` ${Y}(revisa los ${warnings.length} aviso(s))${X}` : ''}\n`)
process.exit(0)
