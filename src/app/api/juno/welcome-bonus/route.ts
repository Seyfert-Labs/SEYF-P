import { junoRequest } from "@/lib/juno/client";
import { ok, fail, badRequest } from "@/lib/juno/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bono de bienvenida: Juno emite y envía MXNB on-chain a la smart wallet del
// usuario nuevo (para probar la app y el gas patrocinado en testnet).
const BONUS_AMOUNT = process.env.WELCOME_BONUS_AMOUNT || "1500";
const ASSET = process.env.JUNO_WITHDRAWAL_ASSET || "mxn";
const BLOCKCHAIN = process.env.JUNO_BLOCKCHAIN || "ARBITRUM";

// Anti-doble-reclamo best-effort (se reinicia con el server).
// Producción: persistir en una base de datos.
const granted = new Set<string>();

export async function POST(request: Request) {
  try {
    const { address } = (await request.json()) as { address?: string };
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return badRequest("Dirección de wallet inválida.");
    }
    const key = address.toLowerCase();
    if (granted.has(key)) {
      return badRequest("Esta wallet ya reclamó el bono de bienvenida.");
    }

    const { payload, idempotencyKey } = await junoRequest(
      "POST",
      "/mint_platform/v1/withdrawals",
      {
        body: {
          address,
          amount: BONUS_AMOUNT,
          asset: ASSET,
          blockchain: BLOCKCHAIN,
          compliance: {},
        },
        idempotency: true,
      },
    );

    granted.add(key);
    return ok(payload, { idempotency_key: idempotencyKey, amount: BONUS_AMOUNT });
  } catch (error) {
    return fail(error);
  }
}
