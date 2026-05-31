"use client";

// Historial on-chain de MXNB del usuario (transferencias reales).
import { useCallback, useEffect, useState } from "react";
import { readMXNBTransfers, type OnchainTransfer } from "@/lib/chain";
import type { Address } from "viem";

export function useOnchainTxns(address?: string) {
  const [txns, setTxns] = useState<OnchainTransfer[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!address) {
      setTxns([]);
      return;
    }
    setLoading(true);
    try {
      setTxns(await readMXNBTransfers(address as Address));
    } catch {
      setTxns([]);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { txns, loading, refresh };
}
