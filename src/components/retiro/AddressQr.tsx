'use client'

import { useEffect, useState } from 'react'

/**
 * QR de la dirección G. `qrcode` ya viene en el árbol de dependencias (lo trae
 * Privy); se carga bajo demanda para no inflar el bundle de entrada.
 */
export default function AddressQr({ value, size = 188 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('qrcode')
      .then((mod) => mod.toString(value, { type: 'svg', width: size - 16, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0A0A0F', light: '#FFFFFF' } }))
      .then((s) => !cancelled && setSvg(s))
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (failed) return null
  return (
    <div
      aria-label="Código QR de tu dirección"
      style={{ width: size, height: size, background: '#fff', borderRadius: 16, padding: 8, margin: '0 auto' }}
      // SVG generado localmente a partir de la dirección (solo caracteres base32).
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  )
}
