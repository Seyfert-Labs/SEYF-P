"use client";

// Lee el estado del advance activo de una bóveda on-chain:
// deuda pendiente (en ReyfAdvance) y colateral bloqueado (en ReyfVaults).
// Solo funciona cuando ADVANCE_ONCHAIN es true.
import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import {
  publicClient,
  SEYF_ADVANCE_ADDRESS,
  SEYF_VAULTS_ADDRESS,
  ADVANCE_ONCHAIN,
  reyfAdvanceAbi,
  reyfVaultsAbi,
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
          abi: reyfAdvanceAbi,
          functionName: "debt",
          args: [address as Address, BigInt(vaultId)],
        }),
        publicClient.readContract({
          address: SEYF_VAULTS_ADDRESS as Address,
          abi: reyfVaultsAbi,
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
