import { junoRequest } from '@/lib/juno/client';
import { ok, fail, badRequest } from '@/lib/juno/respond';
import type { RegisterBankParams } from '@/types/juno';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_OWNERSHIP = ['COMPANY_OWNED', 'THIRD_PARTY'];

// POST /api/juno/register-bank — registra una CLABE destino para redenciones.
export async function POST(request: Request) {
  try {
    const { tag, recipient_legal_name, clabe, ownership } =
      (await request.json()) as Partial<RegisterBankParams>;

    if (!tag || !recipient_legal_name || !clabe || !ownership) {
      return badRequest(
        'Faltan parámetros requeridos (tag, recipient_legal_name, clabe, ownership).',
      );
    }
    if (!/^\d{18}$/.test(clabe)) {
      return badRequest('La CLABE debe tener exactamente 18 dígitos.');
    }
    if (!VALID_OWNERSHIP.includes(ownership)) {
      return badRequest(`Ownership debe ser uno de: ${VALID_OWNERSHIP.join(', ')}`);
    }

    const { payload } = await junoRequest('POST', '/mint_platform/v1/accounts/banks', {
      body: { tag, recipient_legal_name, clabe, ownership },
    });
    return ok(payload);
  } catch (error) {
    return fail(error);
  }
}
