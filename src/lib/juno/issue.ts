import { junoRequest } from "./client";

// Envía MXNB on-chain a una wallet desde el float del negocio (Juno
// mint_platform/v1/withdrawals). Es el rail que sube el saldo on-chain del
// usuario: lo usa el bono de bienvenida, fund-wallet y el regreso divisa→MXNB
// del flujo de conversión. `idempotencyKey` (si se pasa) deduplica el withdrawal
// del lado de Juno ante reintentos.
const ASSET = process.env.JUNO_WITHDRAWAL_ASSET || "MXNB";
const BLOCKCHAIN = process.env.JUNO_BLOCKCHAIN || "ARBITRUM";

export interface WithdrawResult {
  payload: unknown;
  idempotencyKey?: string;
}

export async function withdrawMXNB(
  address: string,
  amount: number | string,
  idempotencyKey?: string,
): Promise<WithdrawResult> {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("Dirección de wallet inválida.");
  }
  const numeric = Number(amount);
  if (!numeric || isNaN(numeric) || numeric <= 0) {
    throw new Error("El monto debe ser un número mayor a 0.");
  }
  const { payload, idempotencyKey: key } = await junoRequest("POST", "/mint_platform/v1/withdrawals", {
    body: {
      address,
      amount: String(numeric),
      asset: ASSET,
      blockchain: BLOCKCHAIN,
      compliance: {},
    },
    idempotency: true,
    idempotencyKey,
    timeoutMs: 60000,
  });
  return { payload, idempotencyKey: key };
}
