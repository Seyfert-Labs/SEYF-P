'use client'

/* Entrar: correo + código (Pollar headless). Sin frase semilla y sin XLM. */
import { useState } from 'react'
import type { useSeyfStellarWallet } from '@/lib/seyf/use-seyf-stellar-wallet'
import { Icon } from '@/components/app/ui'

export default function EntrarScreen({
  stellar,
  network,
}: {
  stellar: ReturnType<typeof useSeyfStellarWallet>
  network: 'mainnet' | 'testnet'
}) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')

  const busy = stellar.phase === 'sending' || stellar.phase === 'verifying'
  const codeSent =
    stellar.phase === 'code' ||
    stellar.phase === 'verifying' ||
    ((stellar.phase === 'error' || stellar.phase === 'sending') && stellar.codeSentOnce)
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim())

  return (
    <div className="screen">
      <div className="onb">
        <span
          style={{
            width: 56, height: 56, borderRadius: 18, background: 'var(--accent-soft)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Icon name="vault" size={28} />
        </span>
        <p className="eyebrow" style={{ marginTop: 22 }}>SEYF Retiro{network === 'testnet' ? ' · testnet' : ''}</p>
        <h1 className="brand" style={{ fontSize: 'var(--t-xl)', margin: '8px 0 10px', lineHeight: 1.1 }}>
          Ahorra para tu retiro en dólares digitales
        </h1>
        <p style={{ color: 'var(--txt-muted)', fontSize: 'var(--t-sm)', lineHeight: 1.5, margin: 0 }}>
          Tu ahorro rinde en un vault de USDC. Si lo necesitas, te adelantamos parte del rendimiento sin
          tocar tu capital. Entras con tu correo: sin frase semilla y sin comprar XLM.
        </p>

        <div style={{ marginTop: 28 }}>
          {!codeSent ? (
            <>
              <span className="field-label">Correo</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && validEmail && !busy && void stellar.sendCode(email.trim())}
              />
              <button
                className="btn btn-primary"
                style={{ marginTop: 14 }}
                disabled={busy || !validEmail}
                onClick={() => void stellar.sendCode(email.trim())}
              >
                {busy ? <span className="spin" /> : 'Enviarme un código'}
              </button>
            </>
          ) : (
            <>
              <span className="field-label">Código que te llegó por correo</span>
              <input
                className="input num-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
                onKeyDown={(e) => e.key === 'Enter' && code && !busy && void stellar.verifyCode(code)}
              />
              <button
                className="btn btn-primary"
                style={{ marginTop: 14 }}
                disabled={busy || code.length < 4}
                onClick={() => void stellar.verifyCode(code)}
              >
                {busy ? <span className="spin" /> : 'Entrar'}
              </button>
              <button
                className="btn btn-ghost"
                style={{ marginTop: 10, padding: 13, fontSize: 'var(--t-sm)' }}
                disabled={busy || !validEmail}
                onClick={() => void stellar.sendCode(email.trim())}
              >
                Mandar otro código
              </button>
            </>
          )}

          {stellar.notice && <div className="alert alert-info">{stellar.notice}</div>}
          {stellar.phase === 'error' && stellar.error && <div className="alert alert-error">{stellar.error}</div>}
        </div>
      </div>
    </div>
  )
}
