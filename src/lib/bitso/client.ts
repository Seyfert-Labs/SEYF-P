import crypto from "crypto";

// ============================================================
// Cliente server-side para la Bitso Exchange API (stage).
// Mismo esquema HMAC que Juno ("Bitso <key>:<nonce>:<sig>", firma sobre
// `${nonce}${method}${path}${body}`) y MISMAS credenciales (Bitso Business).
// Las llaves viven SOLO en el servidor. Endpoints públicos (ticker,
// available_books) no se firman; privados (orders, balance) sí.
// ============================================================

export const BITSO_BASE_URL =
  process.env.BITSO_BASE_URL?.replace(/\/$/, "") || "https://stage.bitso.com";

function buildAuthHeader(method: string, path: string, body = ""): string {
  const apiKey = process.env.BITSO_APIKEY?.trim();
  const apiSecret = process.env.BITSO_SECRET_APIKEY?.trim();
  if (!apiKey || !apiSecret) {
    throw new Error("Faltan credenciales (BITSO_APIKEY / BITSO_SECRET_APIKEY).");
  }
  const nonce = Date.now().toString();
  const data = `${nonce}${method}${path}${body}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(data).digest("hex");
  return `Bitso ${apiKey}:${nonce}:${signature}`;
}

export class BitsoApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "BitsoApiError";
    this.status = status;
    this.payload = payload;
  }
}

interface BitsoOptions {
  /** Cuerpo (se serializa una vez y se reutiliza para firmar y enviar). */
  body?: unknown;
  /** Si true, firma la petición (endpoints privados). */
  signed?: boolean;
  timeoutMs?: number;
}

/**
 * Petición a la API de Bitso. `path` incluye el prefijo `/api/v3/...` y, para
 * GET, el querystring (la firma cubre la ruta completa).
 */
export async function bitsoRequest<T = unknown>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  { body, signed, timeoutMs = 20000 }: BitsoOptions = {},
): Promise<T> {
  const bodyStr = body !== undefined ? JSON.stringify(body) : "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (signed) headers.Authorization = buildAuthHeader(method, path, bodyStr);

  let res: Response;
  try {
    res = await fetch(`${BITSO_BASE_URL}${path}`, {
      method,
      headers,
      body: method === "GET" ? undefined : bodyStr || undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    throw new BitsoApiError(
      `No se pudo conectar con Bitso (${e instanceof Error ? e.message : "error de red"}).`,
      504,
      { cause: String(e) },
    );
  }

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || raw?.success === false) {
    const errObj = raw?.error as { message?: string } | undefined;
    throw new BitsoApiError(errObj?.message || `Bitso respondió HTTP ${res.status}`, res.status, raw);
  }
  return (raw?.payload ?? raw) as T;
}
