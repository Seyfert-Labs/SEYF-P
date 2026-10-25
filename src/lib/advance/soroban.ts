import 'server-only'

/**
 * Lectura y armado de invocaciones Soroban por RPC, sin firmar ni enviar.
 * El usuario firma con Pollar y el envío pasa por /api/stellar/sponsor/submit.
 */

import {
  Account,
  BASE_FEE,
  Contract,
  SorobanDataBuilder,
  TransactionBuilder,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk'
import { sorobanRpcUrl, stellarNetworkPassphrase } from '@/lib/stellar/network'

/** Vigencia del XDR armado: Pollar exige timebounds. */
const TX_TIMEOUT_SEC = 300

/** Margen sobre el resourceFee simulado (+15 %), como en `prepare-xdr.ts`. */
const RESOURCE_FEE_MARGIN_PCT = 115n

/** Error con status HTTP y mensaje en español para el cliente. */
export class AdvanceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Traduce el código de error de un contrato a un mensaje; `undefined` si no lo conoce. */
export type ContractErrorMessages = (code: number, contractId: string) => string | undefined

/**
 * Errores del Stellar Asset Contract (USDC), que aparecen cuando el vault o el
 * adelanto mueven USDC del usuario. Códigos de `ContractError` en stellar-core.
 */
const SAC_ERRORS: Record<number, string> = {
  10: 'Saldo de USDC insuficiente.',
  13: 'La cuenta no tiene la trustline de USDC.',
}

let server: rpc.Server | null = null

export function sorobanServer(): rpc.Server {
  if (!server) server = new rpc.Server(sorobanRpcUrl(), { allowHttp: false })
  return server
}

/** Contrato que originó el error (el más antiguo del log) y su código. */
function contractErrorFrom(simError: string): { contractId?: string; code: number } | null {
  const events = [
    ...simError.matchAll(/contract:(C[A-Z2-7]{55}), topics:\[error, Error\(Contract, #(\d+)\)/g),
  ]
  const origin = events.at(-1)
  if (origin) return { contractId: origin[1], code: Number(origin[2]) }
  const bare = simError.match(/Error\(Contract, #(\d+)\)/)
  return bare ? { code: Number(bare[1]) } : null
}

function simulationError(simError: string, messages: ContractErrorMessages): AdvanceError {
  console.error('[advance/soroban] simulación:', simError.slice(0, 600))
  const parsed = contractErrorFrom(simError)
  if (parsed) {
    const known =
      messages(parsed.code, parsed.contractId ?? '') ?? SAC_ERRORS[parsed.code]
    if (known) return new AdvanceError(422, known)
    return new AdvanceError(422, `El contrato rechazó la operación (código ${parsed.code}).`)
  }
  if (simError.includes('Error(Auth')) {
    return new AdvanceError(422, 'La operación requiere la firma de otra cuenta.')
  }
  return new AdvanceError(502, 'No se pudo simular la operación en la red.')
}

function invokeTx(source: Account, contractId: string, method: string, args: xdr.ScVal[]) {
  return new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: stellarNetworkPassphrase(),
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(TX_TIMEOUT_SEC)
    .build()
}

async function simulate(
  tx: ReturnType<typeof invokeTx>,
  messages: ContractErrorMessages,
): Promise<rpc.Api.SimulateTransactionSuccessResponse> {
  let sim: rpc.Api.SimulateTransactionResponse
  try {
    sim = await sorobanServer().simulateTransaction(tx)
  } catch (e) {
    console.error('[advance/soroban] RPC:', e instanceof Error ? e.message : e)
    throw new AdvanceError(502, 'No se pudo contactar el RPC de Stellar.')
  }
  if (rpc.Api.isSimulationError(sim)) throw simulationError(sim.error, messages)
  if (rpc.Api.isSimulationRestore(sim)) {
    throw new AdvanceError(409, 'El estado del contrato está archivado y debe restaurarse.')
  }
  return sim
}

/**
 * Llama una función de solo lectura y devuelve su resultado en nativo
 * (`i128` → bigint, structs → objetos, `Option::None` → null).
 * La cuenta fuente no necesita existir: la simulación no consume secuencia.
 */
export async function readContract<T>(
  caller: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  messages: ContractErrorMessages,
): Promise<T> {
  const sim = await simulate(invokeTx(new Account(caller, '0'), contractId, method, args), messages)
  if (!sim.result) throw new AdvanceError(502, 'La simulación no devolvió resultado.')
  return scValToNative(sim.result.retval) as T
}

/**
 * Arma la invocación con la cuenta del usuario como fuente, la simula y la
 * devuelve preparada (footprint, auth y resourceFee) y sin firmar.
 */
export async function buildInvokeXdr(
  sourceAddress: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  messages: ContractErrorMessages,
): Promise<string> {
  let source: Account
  try {
    source = await sorobanServer().getAccount(sourceAddress)
  } catch {
    throw new AdvanceError(404, 'La cuenta no existe en la red Stellar.')
  }

  const tx = invokeTx(source, contractId, method, args)
  const sim = await simulate(tx, messages)

  const minFee = BigInt(sim.minResourceFee)
  const resourceFee = (minFee * RESOURCE_FEE_MARGIN_PCT) / 100n
  const sorobanData = new SorobanDataBuilder(sim.transactionData.build())
    .setResourceFee(resourceFee)
    .build()

  // assembleTransaction pone auth y footprint; el fee total se recalcula
  // para que cubra el resourceFee con margen más la comisión de inclusión.
  const assembled = rpc.assembleTransaction(tx, sim).build()
  const prepared = TransactionBuilder.cloneFrom(assembled, {
    fee: BASE_FEE,
    sorobanData,
    networkPassphrase: stellarNetworkPassphrase(),
  }).build()
  return prepared.toXDR()
}
