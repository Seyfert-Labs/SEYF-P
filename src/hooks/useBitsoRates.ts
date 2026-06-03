"use client";

// Tasas FX en vivo desde Bitso + ejecución de conversión (vía /api/bitso/*).
import { useCallback, useEffect, useState } from "react";
import { BITSO_ASSETS, assetByCode, type BitsoRate } from "@/lib/bitso/assets";

type RateMap = Record<string, BitsoRate>;

export function useBitsoRates() {
  const [rates, setRates] = useState<RateMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/bitso/rates");
      const d = (await r.json()) as { rates?: RateMap; error?: string };
      if (d.rates && Object.keys(d.rates).length) {
        setRates(d.rates);
        setError(null);
      } else {
        setError(d.error || "Sin tasas disponibles");
      }
    } catch {
      setError("No se pudieron cargar las tasas de Bitso");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 30000);
    return () => clearInterval(id);
  }, [refresh]);

  /** Valor de 1 unidad del `code` expresado en MXN (usando el book vs MXN). */
  const mxnPriceOf = useCallback(
    (code: string): number | null => {
      if (code === "MXN") return 1;
      const book = assetByCode(code)?.book;
      const r = book ? rates[book] : undefined;
      return r ? r.last : null;
    },
    [rates],
  );

  /** Convierte `amount` de `from` a `to` con las tasas vigentes (vía MXN). */
  const quote = useCallback(
    (from: string, to: string, amount: number): number | null => {
      const pf = mxnPriceOf(from);
      const pt = mxnPriceOf(to);
      if (pf == null || pt == null || pt === 0) return null;
      return (amount * pf) / pt; // amount en MXN equiv / precio del destino
    },
    [mxnPriceOf],
  );

  return { rates, loading, error, refresh, mxnPriceOf, quote, assets: BITSO_ASSETS };
}

/** Ejecuta la conversión real en Bitso (orden de mercado). */
export async function convertOnBitso(from: string, to: string, amount: number) {
  const r = await fetch("/api/bitso/convert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ from, to, amount }),
  });
  return (await r.json()) as { ok?: boolean; oid?: string; error?: string };
}
