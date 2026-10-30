'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Precios reales en MXN por unidad de cada activo (vía /api/prices/mxn: Bitso para
 * cripto/fiat, Etherfuse para CETES). Refresca cada 60 s. `valueOf(code, bal)`
 * devuelve el valor en MXN (0 si no hay precio para ese activo).
 */
export function useAssetPricesMxn(codes: string[], wallet?: string | null) {
  const [prices, setPrices] = useState<Record<string, number>>({})
  // Clave cuya primera respuesta ya llegó (con o sin éxito): permite esperar a los precios sin colgarse.
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  // Clave estable para no re-fetch en cada render por identidad del array.
  const key = codes.map((c) => c.toUpperCase()).sort().join(',')

  const refresh = useCallback(async () => {
    if (!key) return
    try {
      const qs = new URLSearchParams({ codes: key })
      if (wallet) qs.set('wallet', wallet)
      const r = await fetch(`/api/prices/mxn?${qs.toString()}`)
      const d = (await r.json().catch(() => ({}))) as { prices?: Record<string, number> }
      if (d.prices) setPrices(d.prices)
    } catch {
      // conserva el último mapa
    }
    setLoadedKey(key)
  }, [key, wallet])

  useEffect(() => {
    // refresh() es async: el setState ocurre tras el await, no síncrono.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  useEffect(() => {
    const id = setInterval(() => void refresh(), 60_000)
    return () => clearInterval(id)
  }, [refresh])

  const valueOf = useCallback(
    (code: string, bal: number): number => {
      const p = prices[code.toUpperCase()]
      return typeof p === 'number' ? bal * p : 0
    },
    [prices],
  )

  /** Hay precio cargado para el activo (sin él, `valueOf` devuelve 0). */
  const hasPrice = useCallback((code: string) => typeof prices[code.toUpperCase()] === 'number', [prices])

  /** Ya respondió el primer fetch para el conjunto actual de activos. */
  const loaded = !key || loadedKey === key

  return { prices, valueOf, hasPrice, loaded, refresh }
}
