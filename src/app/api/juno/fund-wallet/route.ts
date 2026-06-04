import { withdrawMXNB } from "@/lib/juno/issue";
import { ok, fail, badRequest } from "@/lib/juno/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fondea la smart wallet del usuario con MXNB on-chain (testnet).
// Juno emite/envía desde el float del negocio a la dirección del usuario.
// Es el rail que hace que un "depósito" caiga en la cuenta del usuario.
export async function POST(request: Request) {
  try {
    const { address, amount } = (await request.json()) as { address?: string; amount?: string | number };
    try {
      const { payload, idempotencyKey } = await withdrawMXNB(address ?? "", amount ?? 0);
      return ok(payload, { idempotency_key: idempotencyKey, amount: String(Number(amount)) });
    } catch (e) {
      if (e instanceof Error && /inválida|mayor a 0/.test(e.message)) return badRequest(e.message);
      throw e;
    }
  } catch (error) {
    return fail(error);
  }
}
