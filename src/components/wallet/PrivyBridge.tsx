"use client";

/* Puente: traduce el estado de Privy (auth + wallet embebida) + el saldo MXNB
   on-chain al WalletContext que consume la app. Se monta SOLO dentro de
   PrivyProvider (cuando hay App ID). */
import { useCallback, useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { WalletCtx, type WalletState } from "./WalletContext";
import { readMXNBBalance } from "@/lib/chain";
import type { Address } from "viem";

export default function PrivyBridge({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();

  const address = user?.wallet?.address as Address | undefined;
  const email =
    user?.email?.address ||
    (user?.google?.email as string | undefined) ||
    undefined;

  const [balance, setBalance] = useState(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const b = await readMXNBBalance(address);
      setBalance(b);
    } catch (e) {
      setBalanceError(e instanceof Error ? e.message : "Error leyendo saldo on-chain");
    } finally {
      setBalanceLoading(false);
    }
  }, [address]);

  // Lee el saldo al conectar y lo refresca cada 20s.
  useEffect(() => {
    if (!address) {
      setBalance(0);
      return;
    }
    void refreshBalance();
    const id = setInterval(() => void refreshBalance(), 20000);
    return () => clearInterval(id);
  }, [address, refreshBalance]);

  const value: WalletState = {
    enabled: true,
    ready,
    authenticated,
    address,
    email,
    balance,
    balanceLoading,
    balanceError,
    login,
    logout,
    refreshBalance,
  };

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}
