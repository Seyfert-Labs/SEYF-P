/** Errores del SDK DeFindex (a veces son objetos JSON, no instancias de Error). */
export function defindexErrorText(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; statusCode?: unknown; error?: unknown }
    if (typeof o.message === 'string') return o.message
    if (typeof o.error === 'string') return o.error
  }
  if (typeof e === 'string') return e
  return ''
}

/** Sin posición / API intermitente → tratar como saldo cero. */
export function isDefindexEmptyBalanceError(e: unknown): boolean {
  const msg = defindexErrorText(e).toLowerCase()
  const status =
    e && typeof e === 'object' && 'statusCode' in e
      ? Number((e as { statusCode: unknown }).statusCode)
      : 0
  return (
    status === 404 ||
    status === 502 ||
    status === 503 ||
    msg.includes('not found') ||
    msg.includes('no balance') ||
    msg.includes('no position') ||
    msg.includes('account') ||
    msg.includes('cannot get') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('econnreset')
  )
}

export function isDefindexTransientError(e: unknown): boolean {
  const msg = defindexErrorText(e).toLowerCase()
  const status =
    e && typeof e === 'object' && 'statusCode' in e
      ? Number((e as { statusCode: unknown }).statusCode)
      : 0
  return (
    status >= 500 ||
    status === 429 ||
    msg.includes('timeout') ||
    msg.includes('econnreset') ||
    msg.includes('rate limit') ||
    msg.includes('too many') ||
    msg.includes('network') ||
    msg.includes('fetch failed')
  )
}
