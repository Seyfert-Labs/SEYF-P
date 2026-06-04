"use client";

// Conversiones de divisas ejecutadas en Bitso (MXNB ↔ USDT/EUR/…).
// El intercambio ocurre en la cuenta Bitso (off-chain), así que no aparece en
// los movimientos on-chain ni en el saldo MXNB de la wallet. Las persistimos
// vía la capa `store` (Supabase si NEXT_PUBLIC_USE_SUPABASE, si no localStorage)
// para: (1) listarlas en Movimientos y (2) derivar el saldo por-usuario en
// divisas. El evento sincroniza las pantallas montadas tras un alta.
import { useCallback, useEffect, useMemo, useState } from "react";
import { store, type StoreConversion } from "@/lib/store";

export type Conversion = StoreConversion;

const EVT = "reyf:conversions-changed";

export function useConversions(address?: string) {
  const [conversions, setConversions] = useState<Conversion[]>([]);

  const reload = useCallback(async () => {
    if (!address) {
      setConversions([]);
      return;
    }
    const list = await store.listConversions(address);
    setConversions([...list].sort((a, b) => b.createdAt - a.createdAt));
  }, [address]);

  useEffect(() => {
    void reload();
    const onChange = () => void reload();
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [reload]);

  const add = useCallback(
    async (c: Omit<Conversion, "id" | "createdAt">) => {
      if (!address) return;
      const full: Conversion = { ...c, id: `c_${Date.now()}`, createdAt: Date.now() };
      await store.addConversion(address, full);
      setConversions((prev) => [full, ...prev]);
      if (typeof window !== "undefined") window.dispatchEvent(new Event(EVT));
    },
    [address],
  );

  // Saldo derivado por divisa (solo no-MXN; el MXN vive on-chain en la wallet).
  // Cada conversión suma el destino y resta el origen.
  const balances = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const c of conversions) {
      if (c.to !== "MXN") acc[c.to] = (acc[c.to] || 0) + c.amountTo;
      if (c.from !== "MXN") acc[c.from] = (acc[c.from] || 0) - c.amountFrom;
    }
    for (const k of Object.keys(acc)) if (acc[k] < 0.01) delete acc[k];
    return acc;
  }, [conversions]);

  return { conversions, add, balances, reload };
}
