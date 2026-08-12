'use client'

import type { PollarClient } from '@pollar/core'

/**
 * Shim para el bug de clasificación de errores del OTP en @pollar/core (0.5.3).
 *
 * La API responde a un código equivocado con HTTP 400 y body:
 *   { "code": "INVALID_EMAIL_CODE", "success": false }
 *
 * pero el SDK clasifica leyendo `error?.error ?? data?.code`. En una respuesta
 * no-2xx openapi-fetch deja `data` en undefined y mete el body en `error`, así
 * que `error.error` no existe → ningún código hace match → el SDK cae al estado
 * genérico `EMAIL_VERIFY_FAILED` **sin `clientSessionId`**. Su propio guard de
 * reintento exige `EMAIL_CODE_INVALID|EXPIRED` + `clientSessionId`, de modo que
 * `verifyEmailCode()` lanza `PollarFlowError` en el segundo intento: un simple
 * dedazo dejaba al usuario atorado hasta recargar la página.
 *
 * Solución: middleware `onResponse` del cliente HTTP del SDK que, para las
 * respuestas de error de /auth/email/verify-code, copia `code` a `error` (que es
 * lo que el SDK espera leer). Con eso el SDK conserva el `clientSessionId` y su
 * ruta nativa de reintento funciona: el usuario solo vuelve a teclear el código.
 *
 * Es idempotente y no rompe si Pollar corrige el SDK: solo agrega un campo que
 * su clasificador ya sabe leer.
 */

type ApiMiddleware = {
  onResponse: (ctx: { request: Request; response: Response }) => Promise<Response | undefined>
}

type PollarApiWithMiddleware = { use?: (m: ApiMiddleware) => void }

const patched = new WeakSet<object>()

/** Códigos que el SDK sí sabe mapear a un error de OTP reintentable. */
function normalizeOtpErrorCode(code: string): string {
  const c = code.toUpperCase()
  if (c.includes('EXPIRED')) return 'SDK_EMAIL_CODE_EXPIRED'
  // Solo el código en sí; una sesión inválida NO es reintentable con el mismo
  // clientSessionId y debe seguir cayendo al flujo de "pedir código nuevo".
  if (c === 'INVALID_EMAIL_CODE' || c === 'SDK_EMAIL_CODE_INVALID' || c === 'EMAIL_CODE_INVALID') {
    return 'INVALID_EMAIL_CODE'
  }
  return code
}

export function installPollarOtpErrorShim(client: PollarClient): void {
  const api = (client as unknown as { _api?: PollarApiWithMiddleware })._api
  if (!api || typeof api.use !== 'function' || patched.has(api)) return
  patched.add(api)

  api.use({
    async onResponse({ request, response }) {
      if (response.ok) return undefined
      if (!request.url.includes('/auth/email/verify-code')) return undefined

      let body: unknown
      try {
        body = await response.clone().json()
      } catch {
        return undefined
      }
      if (!body || typeof body !== 'object') return undefined

      const parsed = body as { code?: unknown; error?: unknown }
      if (typeof parsed.code !== 'string' || typeof parsed.error === 'string') return undefined

      const headers = new Headers(response.headers)
      headers.delete('content-length')
      return new Response(
        JSON.stringify({ ...parsed, error: normalizeOtpErrorCode(parsed.code) }),
        { status: response.status, statusText: response.statusText, headers },
      )
    },
  })
}
