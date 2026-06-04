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
      if (!r) return null;
      // Cordura: los activos soportados son fiat/stablecoins (~1–25 MXN/unidad).
      // En stage, books ilíquidos (p.ej. brl_mxn) devuelven un `last` viejo y
      // absurdo (cientos de miles). Descartamos tasas fuera de rango para no
      // mostrarlas ni ejecutar conversiones a un precio irreal.
      if (r.last <= 0 || r.last > 10000) return null;
      return r.last;
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
  return (await r.json()) as {
    ok?: boolean;
    oid?: string;
    error?: string;
    filledFrom?: number;
    filledTo?: number;
  };
}

export type BitsoBalanceMap = Record<string, { available: number; total: number }>;

/** Saldo real de la cuenta Bitso (live). Confirma el disponible en divisas. */
export function useBitsoBalances() {
  const [balances, setBalances] = useState<BitsoBalanceMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/bitso/balances");
      const d = (await r.json()) as { ok?: boolean; balances?: BitsoBalanceMap; error?: string };
      if (d.ok && d.balances) {
        setBalances(d.balances);
        setError(null);
      } else {
        setError(d.error || "Sin saldo disponible");
      }
    } catch {
      setError("No se pudo leer el saldo de Bitso");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balances, loading, error, refresh };
}
