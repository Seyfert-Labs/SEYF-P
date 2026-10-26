'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getAccountState,
  getAdvancePosition,
  getVaultPosition,
  type AccountState,
  type AdvanceState,
  type VaultPosition,
} from './api'

export type Loadable<T> = { data: T | null; error: string | null; loading: boolean }

const empty = <T,>(): Loadable<T> => ({ data: null, error: null, loading: true })

/** Recarga cada 30 s y después de cada operación. La cadena es la fuente de verdad. */
const POLL_MS = 30_000

export type RetiroData = {
  account: Loadable<AccountState>
  vault: Loadable<VaultPosition>
  advance: Loadable<AdvanceState>
  refresh: () => void
}

export function useRetiroData(publicKey: string, usdcIssuer: string, sessionReady: boolean): RetiroData {
  const [account, setAccount] = useState<Loadable<AccountState>>(empty)
  const [vault, setVault] = useState<Loadable<VaultPosition>>(empty)
  const [advance, setAdvance] = useState<Loadable<AdvanceState>>(empty)
  const seq = useRef(0)

  const load = useCallback(() => {
    const id = ++seq.current
    const track = <T,>(set: (v: Loadable<T>) => void, p: Promise<T>) =>
      p.then(
        (data) => id === seq.current && set({ data, error: null, loading: false }),
        (e: unknown) =>
          id === seq.current &&
          set({ data: null, error: e instanceof Error ? e.message : 'Error al leer la red', loading: false }),
      )

    track(setAccount, getAccountState(publicKey, usdcIssuer))
    // Las rutas de B pueden exigir la sesión SEP-10: esperamos a tenerla.
    if (!sessionReady) return
    track(setVault, getVaultPosition(publicKey))
    track(setAdvance, getAdvancePosition(publicKey))
  }, [publicKey, usdcIssuer, sessionReady])

  useEffect(() => {
    load()
    const t = setInterval(load, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  // Tras enviar, el ledger tarda unos segundos en reflejarlo: leemos ahora y otra vez luego.
  const refresh = useCallback(() => {
    load()
    setTimeout(load, 4_000)
  }, [load])

  return { account, vault, advance, refresh }
}
