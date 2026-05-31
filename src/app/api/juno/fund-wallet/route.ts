import { junoRequest } from "@/lib/juno/client";
import { ok, fail, badRequest } from "@/lib/juno/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fondea la smart wallet del usuario con MXNB on-chain (testnet).
// Juno emite/envía desde el float del negocio a la dirección del usuario.
// Es el rail que hace que un "depósito" caiga en la cuenta del usuario.
const ASSET = process.env.JUNO_WITHDRAWAL_ASSET || "MXNB";
const BLOCKCHAIN = process.env.JUNO_BLOCKCHAIN || "ARBITRUM";

export async function POST(request: Request) {
  try {
    const { address, amount } = (await request.json()) as { address?: string; amount?: string | number };

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return badRequest("Dirección de wallet inválida.");
    }
    const numeric = Number(amount);
    if (!numeric || isNaN(numeric) || numeric <= 0) {
      return badRequest("El monto debe ser un número mayor a 0.");
    }

    const { payload, idempotencyKey } = await junoRequest(
      "POST",
      "/mint_platform/v1/withdrawals",
      {
        body: {
          address,
          amount: String(numeric),
          asset: ASSET,
          blockchain: BLOCKCHAIN,
          compliance: {},
        },
        idempotency: true,
        timeoutMs: 60000,
      },
    );
    return ok(payload, { idempotency_key: idempotencyKey, amount: String(numeric) });
  } catch (error) {
    return fail(error);
  }
}
