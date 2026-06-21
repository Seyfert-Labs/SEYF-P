// ============================================================
// Cliente server-side para la API de Dynerox.
// Auth: header `x-api-key` (esquema ApiKeyAuth del OpenAPI). SIN HMAC.
// La key vive SOLO en el servidor (process.env.DYNEROX_API_KEY).
// Análogo a lib/juno/client.ts, pero mucho más simple.
// ============================================================

export const DYNEROX_BASE_URL =
  process.env.DYNEROX_BASE_URL?.replace(/\/$/, '') || 'https://api-stage.dynerox.com';

export class DyneroxApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'DyneroxApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function dyneroxConfigured(): boolean {
  return !!process.env.DYNEROX_API_KEY?.trim();
}

export interface DyneroxRequestOptions {
  /** Cuerpo de la petición (se serializa a JSON). */
  body?: unknown;
  /** Query params (se serializan y anexan al path). */
  query?: Record<string, string | number | undefined>;
  /** Timeout en ms (default 30s). */
  timeoutMs?: number;
}

function buildPath(path: string, query?: DyneroxRequestOptions['query']): string {
  if (!query) return path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/**
 * Realiza una petición a Dynerox con header `x-api-key` y devuelve el JSON parseado.
 */
export async function dyneroxRequest<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  { body, query, timeoutMs = 30000 }: DyneroxRequestOptions = {},
): Promise<{ data: T; raw: unknown; status: number }> {
  const apiKey = process.env.DYNEROX_API_KEY?.trim();
  if (!apiKey) {
    throw new DyneroxApiError(
      'Falta DYNEROX_API_KEY. Define la API key de Dynerox en .env (entorno stage).',
      503,
      undefined,
    );
  }

  const fullPath = buildPath(path, query);
  const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;

  let res: Response;
  try {
    res = await fetch(`${DYNEROX_BASE_URL}${fullPath}`, {
      method,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: method === 'GET' ? undefined : bodyStr,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const name = (e as { name?: string })?.name;
    const message =
      name === 'TimeoutError' || name === 'AbortError'
        ? `Dynerox tardó más de ${Math.round(timeoutMs / 1000)}s en responder.`
        : `No se pudo conectar con Dynerox (${e instanceof Error ? e.message : 'error de red'}).`;
    throw new DyneroxApiError(message, 504, { cause: String(e) });
  }

  const raw = await res.json().catch(() => ({}));

  if (!res.ok) {
    const r = raw as { error?: { message?: string }; message?: string };
    const message =
      r?.error?.message ||
      (typeof r?.message === 'string' ? r.message : '') ||
      `Dynerox respondió HTTP ${res.status}`;
    throw new DyneroxApiError(message, res.status, raw);
  }

  // Dynerox puede envolver datos en `data`; si no, devolvemos el cuerpo completo.
  const data = ((raw as { data?: unknown })?.data ?? raw) as T;
  return { data, raw, status: res.status };
}
