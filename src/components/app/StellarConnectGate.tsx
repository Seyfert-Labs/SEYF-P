"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";
import { STELLAR_VAULTS_ENABLED } from "@/lib/defindex/vaults";
import { fundStellarWallet } from "@/lib/seyf/use-ensure-stellar-funding";

type Ctx = { connected: boolean; ensureConnected: (intent?: string) => Promise<boolean> };

const StellarConnectCtx = createContext<Ctx>({
  connected: false,
  ensureConnected: async () => true,
});

export const useStellarConnect = () => useContext(StellarConnectCtx);

export function StellarConnectProvider({ children }: { children: ReactNode }) {
  const stellar = useSeyfStellarWallet();
  const connected = Boolean(stellar.authenticated && stellar.publicKey);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    if (!connected || !resolverRef.current) return;
    const pk = stellar.publicKey;
    if (pk) {
      void Promise.race([
        fundStellarWallet(pk).catch(() => {}),
        new Promise<void>((r) => setTimeout(r, 5_000)),
      ]);
    }
    resolverRef.current(true);
    resolverRef.current = null;
  }, [connected, stellar.publicKey]);

  const ensureConnected = useCallback(
    async (label?: string): Promise<boolean> => {
      void label;
      if (!STELLAR_VAULTS_ENABLED || !stellar.enabled) return true;
      if (connected) return true;
      await stellar.login();
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
      });
    },
    [connected, stellar],
  );

  return (
    <StellarConnectCtx.Provider value={{ connected, ensureConnected }}>
      {children}
    </StellarConnectCtx.Provider>
  );
}
