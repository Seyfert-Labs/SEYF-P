/**
 * Equivalente en pesos (referencia) del saldo CETES usando precio MXN por 1 CETES (p. ej. tokenPriceDecimal de /lookup/stablebonds).
 * No es cotización de mercado MXNe on-chain; es la misma referencia que usa el dashboard CETES.
 */
export function cetesBalanceEquivMxne(
  cetesUnits: number,
  priceMxnPerCetes: number | null | undefined,
): number | null {
  if (!(cetesUnits > 0)) return null
  if (priceMxnPerCetes == null || !Number.isFinite(priceMxnPerCetes) || priceMxnPerCetes <= 0) {
    return null
  }
  return cetesUnits * priceMxnPerCetes
}
