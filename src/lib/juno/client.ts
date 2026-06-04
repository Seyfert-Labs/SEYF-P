import crypto from 'crypto';

// ============================================================
// Cliente server-side para la API de Juno / Bitso Business.
// Firma HMAC-SHA256 (esquema "Bitso <key>:<nonce>:<sig>").
// Las credenciales viven SOLO en el servidor (process.env).
// Integración v1.0.0 — ver INTEGRATION.md
// ============================================================

export const JUNO_BASE_URL =
  process.env.JUNO_BASE_URL?.replace(/\/$/, '') || 'https://stage.buildwithjuno.com';

/**
 * Construye el header Authorization firmado para Juno/Bitso.
 * La firma se calcula sobre `${nonce}${method}${path}${body}` exactamente,
 * por lo que el `body` que se firma debe ser idéntico al que se envía.
 */
export function buildJunoAuthHeader(
  method: string,
  path: string,
  body = '',
): string {
  const apiKey = process.env.BITSO_APIKEY?.trim();
  const apiSecret = process.env.BITSO_SECRET_APIKEY?.trim();
  if (!apiKey || !apiSecret) {
    throw new Error(
      'Faltan credenciales de Juno. Define BITSO_APIKEY y BITSO_SECRET_APIKEY en .env.local',
    );
  }
  const nonce = Date.now().toString();
  const data = `${nonce}${method}${path}${body}`;
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(data)
    .digest('hex');
  return `Bitso ${apiKey}:${nonce}:${signature}`;
}

export interface JunoRequestOptions {
  /** Cuerpo de la petición (se serializa una sola vez y se reutiliza para firmar y enviar). */
  body?: unknown;
  /** Si true, añade un header X-Idempotency-Key (UUID) — requerido por redeem/withdrawal. */
  idempotency?: boolean;
  /** Key de idempotencia explícito (estable entre reintentos). Si se omite y
   *  `idempotency` es true, se genera un UUID aleatorio. */
  idempotencyKey?: string;
  /** Timeout en ms (default 30s). */
  timeoutMs?: number;
}

export class JunoApiError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'JunoApiError';
    this.status = status;
    this.payload = payload;
  }
}

/**
 * Realiza una petición firmada a Juno y devuelve el JSON parseado.
 * `path` debe incluir el querystring para GET (la firma cubre la ruta completa).
 */
export async function junoRequest<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  { body, idempotency, idempotencyKey: providedKey, timeoutMs = 45000 }: JunoRequestOptions = {},
): Promise<{ payload: T; raw: Record<string, unknown>; idempotencyKey?: string }> {
  const bodyStr = body !== undefined ? JSON.stringify(body) : '';
  const authHeader = buildJunoAuthHeader(method, path, bodyStr);

  const headers: Record<string, string> = {
    Authorization: authHeader,
    'Content-Type': 'application/json',
  };

  let idempotencyKey: string | undefined;
  if (idempotency) {
    idempotencyKey = providedKey || crypto.randomUUID();
    headers['X-Idempotency-Key'] = idempotencyKey;
  }

  let res: Response;
  try {
    res = await fetch(`${JUNO_BASE_URL}${path}`, {
      method,
      headers,
      body: method === 'GET' ? undefined : bodyStr || undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const name = (e as { name?: string })?.name;
    const message =
      name === 'TimeoutError' || name === 'AbortError'
        ? `Juno tardó más de ${Math.round(timeoutMs / 1000)}s en responder. La operación puede seguir procesándose; vuelve a intentar en un momento.`
        : `No se pudo conectar con Juno (${e instanceof Error ? e.message : 'error de red'}).`;
    throw new JunoApiError(message, 504, { cause: String(e) });
  }

  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const errObj = raw?.error as { message?: string } | undefined;
    const message =
      errObj?.message ||
      (typeof raw?.message === 'string' ? (raw.message as string) : '') ||
      `Juno respondió HTTP ${res.status}`;
    throw new JunoApiError(message, res.status, raw);
  }

  // Juno envuelve los datos en `payload`; si no, devolvemos el cuerpo completo.
  const payload = (raw?.payload ?? raw) as T;
  return { payload, raw, idempotencyKey };
}
