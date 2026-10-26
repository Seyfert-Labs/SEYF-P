"use client";

/* Puente: traduce la sesión de Pollar (wallet Stellar sin seed phrase) al
   WalletContext que consume la app. Reemplaza a PrivyBridge: ya no hay EVM.
   Se monta SOLO dentro de SeyfPollarProvider. */
import { useCallback, useEffect, useMemo } from "react";
import { WalletCtx, type WalletState } from "./WalletContext";
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";
import { store } from "@/lib/store";
import { syncRiskProfile } from "@/components/app/data";

/** El SDK de Pollar no expone el correo de la sesión: lo guardamos al entrar. */
const EMAIL_KEY = "seyf-login-email";

export function rememberLoginEmail(email: string) {
  try {
    localStorage.setItem(EMAIL_KEY, email.trim());
  } catch {
    /* sin localStorage la app sigue; solo no mostramos el correo */
  }
}

function readLoginEmail(): string | undefined {
  try {
    return localStorage.getItem(EMAIL_KEY) || undefined;
  } catch {
    return undefined;
  }
}

const noEvm = async (): Promise<string> => {
  throw new Error("Esta operación ya no está disponible: SEYF opera solo en Stellar.");
};

export default function PollarBridge({ children }: { children: React.ReactNode }) {
  const stellar = useSeyfStellarWallet();
  const address = stellar.authenticated ? stellar.publicKey ?? undefined : undefined;
  const authenticated = Boolean(address);
  const email = authenticated ? readLoginEmail() : undefined;

  // Saldo líquido de la wallet = USDC en Stellar (lo que se puede ahorrar).
  const usdc = stellar.assetBalances.find((b) => (b.code || "").toUpperCase() === "USDC");
  const balance = Number(usdc?.balance ?? 0) || 0;

  // Perfil por cuenta Stellar (requiere la sesión SEP-10, que abre SeyfAuthBridge).
  useEffect(() => {
    if (!address) return;
    void store.upsertProfile({ wallet: address, email });
    void syncRiskProfile(address);
  }, [address, email]);

  const { refreshBalance: refreshStellar, logout: logoutStellar } = stellar;
  const refreshBalance = useCallback(() => void refreshStellar(), [refreshStellar]);
  const logout = useCallback(() => {
    try {
      localStorage.removeItem(EMAIL_KEY);
    } catch {
      /* nada que limpiar */
    }
    void logoutStellar();
  }, [logoutStellar]);

  const value: WalletState = useMemo(
    () => ({
      enabled: stellar.enabled,
      ready: true,
      authenticated,
      address,
      gaslessReady: authenticated,
      email,
      name: email?.split("@")[0],
      balance,
      balanceLoading: false,
      balanceError: null,
      // El login vive en SeyfApp (pantalla de correo + código); aquí no hay modal.
      login: () => {},
      logout,
      refreshBalance,
      sendMXNB: noEvm,
      sendTx: noEvm,
    }),
    [stellar.enabled, authenticated, address, email, balance, logout, refreshBalance],
  );

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}
