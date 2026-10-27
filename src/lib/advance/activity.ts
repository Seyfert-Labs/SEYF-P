import 'server-only'

/**
 * Actividad acumulada del adelanto para la landing: cuántos adelantos se han
 * abierto, en cuántas cuentas y cuánto ahorro los respaldó (valor de las
 * acciones bloqueadas al abrir). No es TVL: el vault es de un tercero.
 *
 * El RPC guarda ~7 días de eventos, así que el acumulado es un corte verificable
 * (`activity-checkpoint.json`, de `scripts/advance-checkpoint.mjs`) más los
 * eventos `advance_opened` posteriores. Si el RPC ya no llega al corte, se
 * devuelve solo el corte con su fecha: sigue siendo cierto, solo menos reciente.
 * Se excluye a la cuenta admin del contrato: sus adelantos son pruebas del equipo.
 */

import { Address, nativeToScVal, scValToNative } from '@stellar/stellar-sdk'
import checkpoint from '@/lib/advance/activity-checkpoint.json'
import { advanceContractId } from '@/lib/advance/config'
import { scanAdvanceEvents } from '@/lib/advance/events'
import { readContract } from '@/lib/advance/soroban'

const OPENED_TOPIC = nativeToScVal('advance_opened', { type: 'symbol' }).toXDR('base64')

/** Cuenta fuente para simular `admin()`; no necesita existir. */
const READ_SOURCE = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'

export type AdvanceActivity = {
  advances: number
  accounts: number
  /** USDC en unidades mínimas (7 decimales). */
  backing: string
  /** Hasta cuándo cuentan los datos (ISO). */
  asOf: string
  contract: string
}

export async function advanceActivity(): Promise<AdvanceActivity | null> {
  const contract = advanceContractId()
  // El corte es de un contrato concreto (mainnet); con otro contrato no aplica.
  if (checkpoint.contract !== contract) return null

  const fromCheckpoint: AdvanceActivity = {
    advances: checkpoint.advances,
    accounts: checkpoint.accounts.length,
    backing: checkpoint.backing,
    asOf: checkpoint.asOf,
    contract,
  }

  const [scan, admin] = await Promise.all([
    scanAdvanceEvents([[OPENED_TOPIC, '*']], checkpoint.ledger + 1),
    readContract<string>(READ_SOURCE, contract, 'admin', [], () => undefined),
  ])
  if (scan.firstLedger > checkpoint.ledger + 1) {
    console.error(
      `[advance/activity] el corte (ledger ${checkpoint.ledger}) salió de la ventana del RPC; ` +
        'corre scripts/advance-checkpoint.mjs. Se muestran solo los datos del corte.',
    )
    return fromCheckpoint
  }

  const accounts = new Set(checkpoint.accounts)
  let advances = checkpoint.advances
  let backing = BigInt(checkpoint.backing)
  for (const ev of scan.events) {
    const user = Address.fromScVal(ev.topic[1]).toString()
    const data = scValToNative(ev.value) as { value?: unknown } | null
    if (user === admin || typeof data?.value !== 'bigint') continue
    advances += 1
    backing += data.value
    accounts.add(user)
  }

  return {
    advances,
    accounts: accounts.size,
    backing: backing.toString(),
    asOf: new Date().toISOString(),
    contract,
  }
}
