"use client";

/* Estado de wallet/usuario expuesto a toda la app vía contexto.
   Así las pantallas no llaman hooks de Privy directamente (funcionan con o
   sin Privy configurado). */
import { createContext, useContext } from "react";

export interface WalletState {
  /** true si Privy está configurado (NEXT_PUBLIC_PRIVY_APP_ID presente). */
  enabled: boolean;
  /** SDK de Privy inicializado. */
  ready: boolean;
  /** usuario con sesión iniciada. */
  authenticated: boolean;
  /** dirección de la wallet embebida (Arbitrum). */
  address?: string;
  /** correo del usuario (si lo hay). */
  email?: string;
  /** saldo MXNB on-chain (unidades), leído de la wallet del usuario. */
  balance: number;
  balanceLoading: boolean;
  balanceError: string | null;
  login: () => void;
  logout: () => void;
  refreshBalance: () => void;
}

export const defaultWalletState: WalletState = {
  enabled: false,
  ready: true,
  authenticated: false,
  balance: 0,
  balanceLoading: false,
  balanceError: null,
  login: () => {},
  logout: () => {},
  refreshBalance: () => {},
};

export const WalletCtx = createContext<WalletState>(defaultWalletState);

export const useWallet = () => useContext(WalletCtx);
