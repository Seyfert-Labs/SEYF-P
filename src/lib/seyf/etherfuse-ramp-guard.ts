import { NextResponse } from "next/server";
import { normalizeStellarPublicKey } from "@/lib/etherfuse/stellar-public-key";
import { requireSession } from "@/lib/stellar/db-auth";

/**
 * Sesión SEP-10 obligatoria para operar la rampa. Si la petición nombra una
 * wallet, tiene que ser la de la sesión: nadie cotiza ni ordena por otra cuenta.
 */
export function requireRampAccount(
  req: Request,
  wallet?: string | null,
): { ok: true; account: string } | { ok: false; response: NextResponse } {
  const auth = requireSession(req);
  if (!auth.ok) return auth;
  if (wallet && normalizeStellarPublicKey(wallet) !== auth.account) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Esta cuenta no te pertenece." }, { status: 403 }),
    };
  }
  return auth;
}

/**
 * Igual que el mock de inversión: en producción la rampa vía API solo si se habilita explícitamente.
 */
export function guardEtherfuseRampRoutes(): NextResponse | null {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SEYF_ALLOW_ETHERFUSE_RAMP !== "true" &&
    process.env.SEYF_ALLOW_ETHERFUSE_RAMP !== "true"
  ) {
    return NextResponse.json(
      {
        error:
          "Rampa Etherfuse deshabilitada en producción. Establece SEYF_ALLOW_ETHERFUSE_RAMP=true o usa otro entorno.",
      },
      { status: 403 },
    );
  }
  return null;
}
