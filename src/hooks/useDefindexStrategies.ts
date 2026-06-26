'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DEFINDEX_STRATEGIES,
  type DefindexStrategyConfig,
} from '@/lib/defindex/catalog'

export type DefindexStrategyLive = DefindexStrategyConfig & {
  apy: number | null
  apyLoaded: boolean
  unlocked: boolean
}

export function useDefindexStrategies() {
  const [strategies, setStrategies] = useState<DefindexStrategyLive[]>(() =>
    DEFINDEX_STRATEGIES.map((s) => ({
      ...s,
      apy: null,
      apyLoaded: false,
      unlocked: true,
    })),
  )
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/defindex/strategies')
      const data = (await res.json().catch(() => ({}))) as {
        strategies?: DefindexStrategyLive[]
      }
      if (res.ok && Array.isArray(data.strategies) && data.strategies.length > 0) {
        setStrategies(data.strategies)
      }
    } catch {
      /* mantiene apy null */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const byPlanId = useCallback(
    (planId?: string) => strategies.find((s) => s.planId === planId),
    [strategies],
  )

  const byStrategyId = useCallback(
    (strategyId?: string) => strategies.find((s) => s.id === strategyId),
    [strategies],
  )

  return { strategies, loading, refresh, byPlanId, byStrategyId }
}
