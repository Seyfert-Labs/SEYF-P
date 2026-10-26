import 'server-only'

import { NextResponse } from 'next/server'
import { StrKey } from '@stellar/stellar-sdk'
import { z } from 'zod'
import { ConfigError } from '@/lib/advance/config'
import { AdvanceError } from '@/lib/advance/soroban'

export const noStore = { 'Cache-Control': 'no-store' }

/** Cuenta Stellar del usuario (G…). */
export const accountSchema = z
  .string()
  .trim()
  .refine((v) => StrKey.isValidEd25519PublicKey(v), 'Dirección Stellar inválida')

/** Entero positivo en unidades mínimas (cabe en i128). Se prefiere string; se acepta un entero seguro. */
export const unitsSchema = z
  .union([z.string().trim(), z.number().int().safe().transform(String)])
  .pipe(z.string().regex(/^[1-9]\d{0,37}$/, 'Debe ser un entero positivo en unidades mínimas'))
  .transform((v) => BigInt(v))

export const termDaysSchema = z.coerce.number().int().min(1).max(3650)

export function badRequest(error: z.ZodError): NextResponse {
  const issue = error.issues[0]
  const field = issue?.path.join('.')
  const message = issue ? `${field ? `${field}: ` : ''}${issue.message}` : 'Solicitud inválida'
  return NextResponse.json({ error: message }, { status: 400, headers: noStore })
}

export function errorResponse(e: unknown, tag: string): NextResponse {
  if (e instanceof AdvanceError) {
    return NextResponse.json({ error: e.message }, { status: e.status, headers: noStore })
  }
  if (e instanceof ConfigError) {
    console.error(`[${tag}]`, e.message)
    return NextResponse.json({ error: e.message }, { status: 503, headers: noStore })
  }
  console.error(`[${tag}]`, e instanceof Error ? (e.stack ?? e.message) : e)
  return NextResponse.json({ error: 'Error inesperado del servidor.' }, { status: 500, headers: noStore })
}
