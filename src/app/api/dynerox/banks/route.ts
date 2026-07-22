import { dyneroxRequest } from '@/lib/dynerox/client';
import { ok, fail, badRequest } from '@/lib/dynerox/respond';
import { isValidClabe, normalizeClabe } from '@/lib/dynerox/clabe';
import type { DyneroxBankLookup } from '@/types/dynerox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/dynerox/banks?clabe=012180110400000819
// Lookup de institución a partir de una CLABE. A diferencia de
// `beneficiary-accounts`, NO crea nada ni requiere usuario: sirve para
// autocompletar el banco mientras el usuario teclea.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clabe = normalizeClabe(searchParams.get('clabe')?.trim() ?? '');
  if (!clabe) return badRequest('Falta el parámetro `clabe`.');
  if (!isValidClabe(clabe)) {
    return badRequest('La CLABE no es válida (deben ser 18 dígitos con dígito verificador correcto).');
  }

  try {
    const { data } = await dyneroxRequest<DyneroxBankLookup>(
      'GET',
      `/v1/public/banks/clabe/${clabe}`,
    );
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}
