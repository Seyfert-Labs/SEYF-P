import { junoRequest } from '@/lib/juno/client';
import { ok, fail } from '@/lib/juno/respond';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/juno/create-clabe — genera una CLABE única (AUTO_PAYMENT) para el usuario.
export async function POST() {
  try {
    // El cuerpo `{}` debe firmarse y enviarse idéntico.
    const { payload } = await junoRequest('POST', '/mint_platform/v1/clabes', {
      body: {},
    });
    return ok(payload);
  } catch (error) {
    return fail(error);
  }
}
