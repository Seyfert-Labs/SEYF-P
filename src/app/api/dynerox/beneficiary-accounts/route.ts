import { dyneroxRequest } from '@/lib/dynerox/client';
import { ok, fail, badRequest } from '@/lib/dynerox/respond';
import { isValidClabe, normalizeClabe } from '@/lib/dynerox/clabe';
import type { DyneroxBankAccount, DyneroxCreateBankAccount } from '@/types/dynerox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cuentas beneficiarias (CLABEs) de un usuario Dynerox.
//
// Además de registrar la cuenta, el POST **resuelve el titular**: devuelve
// `beneficiary_name`, `institution_name`/`institution_code` y un
// `verification_status`. Eso lo hace útil para `AddBankModal` incluso mientras
// el on-ramp sigue bloqueado (ver README: el bloqueo del merchant solo afecta
// a `/routes`).

// GET /api/dynerox/beneficiary-accounts?user_id=<uuid>
// `user_id` es obligatorio: sin él Dynerox responde `Invalid UUID format`.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id')?.trim();
  if (!userId) return badRequest('Falta el parámetro `user_id` (UUID del usuario Dynerox).');

  try {
    const { data } = await dyneroxRequest('GET', '/v1/public/beneficiary-accounts', {
      query: { user_id: userId },
    });
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}

// POST /api/dynerox/beneficiary-accounts
// Body: { user_id, clabe, currency: "MXN", network: "SPEI" }
export async function POST(request: Request) {
  let body: DyneroxCreateBankAccount;
  try {
    body = (await request.json()) as DyneroxCreateBankAccount;
  } catch {
    return badRequest('Cuerpo JSON inválido.');
  }

  const clabe = normalizeClabe(String(body?.clabe ?? ''));
  if (!clabe) return badRequest('Falta la `clabe`.');
  // Validamos el dígito verificador aquí para dar un mensaje claro: Dynerox
  // solo responde `Invalid CLABE` sin decir por qué.
  if (!isValidClabe(clabe)) {
    return badRequest('La CLABE no es válida (deben ser 18 dígitos con dígito verificador correcto).');
  }

  const missing = (['currency', 'network'] as const).filter((k) => !body?.[k]);
  if (missing.length) return badRequest(`Faltan campos requeridos: ${missing.join(', ')}.`);

  try {
    const { data } = await dyneroxRequest<DyneroxBankAccount>(
      'POST',
      '/v1/public/beneficiary-accounts',
      { body: { ...body, clabe } },
    );
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}
