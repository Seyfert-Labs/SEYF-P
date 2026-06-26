/**
 * guards.ts — rate limits, adelantos y locks onramp en Supabase.
 */

import { NextResponse } from 'next/server'
import {
  bumpRateLimitBucket,
  deleteAdvanceSessionRow,
  getAdvanceSessionRow,
  releaseOnrampLockRow,
  tryAcquireOnrampLock,
  upsertAdvanceSessionRow,
} from '@/lib/supabase/db'

// ─── 1. Rate Limiter ────────────────────────────────────────────────────────

export type RateLimitConfig = {
  key: string
  limit: number
  windowSec: number
}

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSec: number }

export async function checkRateLimit(cfg: RateLimitConfig): Promise<RateLimitResult> {
  try {
    const { hits, expiresAt } = await bumpRateLimitBucket(cfg.key, cfg.windowSec)
    if (hits > cfg.limit) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000),
      )
      return { allowed: false, retryAfterSec }
    }
    return { allowed: true, remaining: Math.max(0, cfg.limit - hits) }
  } catch {
    return { allowed: true, remaining: 1 }
  }
}

export async function rateLimitResponse(
  request: Request,
  endpoint: string,
  opts: { limit: number; windowSec: number },
): Promise<NextResponse | null> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  const result = await checkRateLimit({
    key: `${ip}:${endpoint}`,
    limit: opts.limit,
    windowSec: opts.windowSec,
  })
  if (!result.allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'rate_limited',
          message_es: `Demasiadas solicitudes. Intenta de nuevo en ${result.retryAfterSec} segundos.`,
          retryable: true,
          retryAfterSec: result.retryAfterSec,
        },
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfterSec),
          'X-RateLimit-Limit': String(opts.limit),
        },
      },
    )
  }
  return null
}

// ─── 2. Advance Session Store ───────────────────────────────────────────────

export type AdvanceStatus = 'pending' | 'confirmed' | 'repaid' | 'cancelled'

export type AdvanceSession = {
  customerId: string
  amountMxn: number
  feeMxn: number
  netMxn: number
  requestedAt: string
  confirmedAt: string | null
  repaidAt: string | null
  status: AdvanceStatus
  orderId: string | null
}

export async function getAdvanceSession(customerId: string): Promise<AdvanceSession | null> {
  try {
    const row = await getAdvanceSessionRow(customerId)
    return row ? (row as AdvanceSession) : null
  } catch {
    return null
  }
}

export async function upsertAdvanceSession(session: AdvanceSession): Promise<void> {
  await upsertAdvanceSessionRow(session.customerId, session as unknown as Record<string, unknown>)
}

export async function clearAdvanceSession(customerId: string): Promise<void> {
  try {
    await deleteAdvanceSessionRow(customerId)
  } catch {
    /* noop */
  }
}

export async function hasActiveAdvance(customerId: string): Promise<boolean> {
  const session = await getAdvanceSession(customerId)
  return session !== null && (session.status === 'pending' || session.status === 'confirmed')
}

// ─── 3. Distributed Lock (onramp idempotency) ───────────────────────────────

export async function acquireOnrampLock(customerId: string, ttlSec = 30): Promise<boolean> {
  try {
    return await tryAcquireOnrampLock(customerId, ttlSec)
  } catch {
    return true
  }
}

export async function releaseOnrampLock(customerId: string): Promise<void> {
  try {
    await releaseOnrampLockRow(customerId)
  } catch {
    /* noop */
  }
}

export async function withOnrampLock<T>(
  customerId: string,
  fn: () => Promise<T>,
  ttlSec = 30,
): Promise<T | NextResponse> {
  const acquired = await acquireOnrampLock(customerId, ttlSec)
  if (!acquired) {
    return NextResponse.json(
      {
        error: {
          code: 'conflict',
          message_es: 'Ya hay una orden en proceso para esta cuenta. Espera unos segundos e intenta de nuevo.',
          retryable: true,
        },
      },
      { status: 409 },
    )
  }
  try {
    return await fn()
  } finally {
    await releaseOnrampLock(customerId)
  }
}
