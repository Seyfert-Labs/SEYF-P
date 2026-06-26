import 'server-only'

import {
  Networks,
  SorobanDataBuilder,
  Transaction,
  rpc,
} from '@stellar/stellar-sdk'
import { isPublicStellarTestnet } from '@/lib/reyf/stellar-wallet-network'

function networkPassphrase(): string {
  return isPublicStellarTestnet() ? Networks.TESTNET : Networks.PUBLIC
}

function sorobanRpcUrl(): string {
  return isPublicStellarTestnet()
    ? 'https://soroban-testnet.stellar.org'
    : 'https://soroban.stellar.org'
}

/** Margen sobre minResourceFee (1.15 = +15 %). No multiplicar el fee total: rompe el XDR Soroban. */
function resourceFeeMargin(): number {
  const raw = Number(process.env.DEFINDEX_FEE_MARGIN || '1.15')
  if (!Number.isFinite(raw) || raw < 1) return 1.15
  return Math.min(raw, 1.5)
}

/**
 * Re-simula el XDR de DeFindex al instante y ajusta solo el resourceFee interno
 * (con margen pequeño). Evita FEE_LIMIT_EXCEEDED sin corromper la extensión Soroban.
 */
export async function prepareSorobanXdr(unsignedXdr: string): Promise<string> {
  const passphrase = networkPassphrase()
  const server = new rpc.Server(sorobanRpcUrl())
  const tx = new Transaction(unsignedXdr, passphrase)

  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulación Soroban falló: ${sim.error}`)
  }

  const margin = resourceFeeMargin()
  const minFee = BigInt(sim.minResourceFee ?? '0')
  const resourceFee =
    minFee > 0n
      ? (minFee * BigInt(Math.round(margin * 100))) / 100n
      : minFee

  const sorobanData =
    resourceFee > minFee && sim.transactionData
      ? new SorobanDataBuilder(sim.transactionData.build())
          .setResourceFee(resourceFee)
          .build()
      : sim.transactionData.build()

  const prepared = rpc
    .assembleTransaction(tx, sim)
    .setSorobanData(sorobanData)
    .build()

  const check = await server.simulateTransaction(prepared)
  if (rpc.Api.isSimulationError(check)) {
    throw new Error(`Simulación tras preparar falló: ${check.error}`)
  }

  return prepared.toXDR()
}
