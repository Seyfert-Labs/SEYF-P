"use client";

// CLABE de depósito única por usuario (Juno create-clabe).
// Persistimos en localStorage la CLABE asignada a cada wallet, así el usuario
// conserva "su" CLABE. (En producción esta relación user→CLABE vive en tu DB
// y el webhook de Juno acredita/reenvía los depósitos.)
import { useCallback, useEffect, useState } from "react";
import { junoService } from "@/services/junoService";

const KEY = (a?: string) => `seyf_clabe_${(a ?? "anon").toLowerCase()}`;

export function useUserClabe(address?: string) {
  const [clabe, setClabe] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setClabe(localStorage.getItem(KEY(address)));
  }, [address]);

  const create = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = (await junoService.createUserClabe()) as { clabe?: string };
      const c = r?.clabe ?? null;
      if (c) {
        localStorage.setItem(KEY(address), c);
        setClabe(c);
      }
      return c;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la CLABE");
      return null;
    } finally {
      setLoading(false);
    }
  }, [address]);

  return { clabe, loading, error, create };
}
