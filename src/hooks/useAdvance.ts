"use client";

// Lee el estado del advance activo de una bóveda on-chain:
// deuda pendiente (en SeyfAdvance) y colateral bloqueado (en SeyfVaults).
// Solo funciona cuando ADVANCE_ONCHAIN es true.
import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import {
  publicClient,
  SEYF_ADVANCE_ADDRESS,
  SEYF_VAULTS_ADDRESS,
  ADVANCE_ONCHAIN,
  readAdvanceQuote,
  type AdvanceContractMode,
  type AdvanceQuoteResult,
  seyfAdvanceAbi,
  seyfVaultsAbi,
  MXNB_DECIMALS,
} from "@/lib/chain";

export interface AdvanceState {
  debt: number;    // MXN adeudado
  locked: number;  // MXN bloqueado como colateral
  loading: boolean;
}

export function useAdvance(address?: string, vaultId?: number): AdvanceState & { reload: () => void } {
  const [debt, setDebt] = useState(0);
  const [locked, setLocked] = useState(0);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!address || vaultId === undefined || !ADVANCE_ONCHAIN) return;
    setLoading(true);
    try {
      const [debtRaw, lockedRaw] = await Promise.all([
        publicClient.readContract({
          address: SEYF_ADVANCE_ADDRESS as Address,
          abi: seyfAdvanceAbi,
          functionName: "debt",
          args: [address as Address, BigInt(vaultId)],
        }),
        publicClient.readContract({
          address: SEYF_VAULTS_ADDRESS as Address,
          abi: seyfVaultsAbi,
          functionName: "lockedAmount",
          args: [address as Address, BigInt(vaultId)],
        }),
      ]);
      setDebt(Number(debtRaw as bigint) / 10 ** MXNB_DECIMALS);
      setLocked(Number(lockedRaw as bigint) / 10 ** MXNB_DECIMALS);
    } catch {
      setDebt(0);
      setLocked(0);
    } finally {
      setLoading(false);
    }
  }, [address, vaultId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { debt, locked, loading, reload };
}

export interface AdvanceQuote {
  mode: AdvanceContractMode;
  freeBalance: number;
  quote: number;
  maxYears: number;
  requestArg: bigint;
  capped?: boolean;
  loading: boolean;
  ready: boolean;
}

/** Cotización on-chain para el adelanto (mismo cálculo que `requestAdvance`). */
export function useAdvanceQuote(
  address?: string,
  vaultId?: number,
  years = 1,
): AdvanceQuote & { reload: () => void; quoteResult: AdvanceQuoteResult | null } {
  const [quoteResult, setQuoteResult] = useState<AdvanceQuoteResult | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!address || vaultId === undefined || !ADVANCE_ONCHAIN) {
      setQuoteResult(null);
      return;
    }
    setLoading(true);
    try {
      const q = await readAdvanceQuote(address as Address, vaultId, years);
      setQuoteResult(q);
    } finally {
      setLoading(false);
    }
  }, [address, vaultId, years]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    mode: quoteResult?.mode ?? "years",
    freeBalance: quoteResult?.freeBalance ?? 0,
    quote: quoteResult?.quote ?? 0,
    maxYears: quoteResult?.maxYears ?? 0,
    requestArg: quoteResult?.requestArg ?? 0n,
    capped: quoteResult?.capped,
    loading,
    ready: quoteResult !== null,
    quoteResult,
    reload,
  };
}
