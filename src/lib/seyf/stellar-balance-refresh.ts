/** Refresca el saldo Stellar varias veces (Horizon/Pollar pueden tardar en indexar). */
export async function pollStellarBalance(
  refresh: (publicKey?: string) => Promise<void>,
  publicKey: string,
  delaysMs: number[] = [0, 2_000, 5_000, 10_000, 15_000],
): Promise<void> {
  for (const delay of delaysMs) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay))
    await refresh(publicKey)
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('seyf:stellar-balance-changed'))
  }
}

export const STELLAR_BALANCE_CHANGED_EVT = 'seyf:stellar-balance-changed'
