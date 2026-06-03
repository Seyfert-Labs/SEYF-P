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
  /** dirección efectiva del usuario (smart wallet si existe, si no la embebida). */
  address?: string;
  /** dirección de la cuenta inteligente (ERC-4337), si está activa. */
  smartAddress?: string;
  /** true si la smart wallet está lista para enviar transacciones patrocinadas. */
  gaslessReady: boolean;
  /** correo del usuario (si lo hay). */
  email?: string;
  /** saldo MXNB on-chain (unidades), leído de la wallet del usuario. */
  balance: number;
  balanceLoading: boolean;
  balanceError: string | null;
  login: () => void;
  logout: () => void;
  refreshBalance: () => void;
  /** Envía MXNB on-chain desde la smart wallet (gas patrocinado). Devuelve el hash. */
  sendMXNB: (to: string, amount: string) => Promise<string>;
  /** Envía una transacción arbitraria (call a contrato) desde la smart wallet. Devuelve el hash. */
  sendTx: (to: string, data: `0x${string}`) => Promise<string>;
}

export const defaultWalletState: WalletState = {
  enabled: false,
  ready: true,
  authenticated: false,
  gaslessReady: false,
  balance: 0,
  balanceLoading: false,
  balanceError: null,
  login: () => {},
  logout: () => {},
  refreshBalance: () => {},
  sendMXNB: async () => {
    throw new Error("Wallet no disponible (modo demo)");
  },
  sendTx: async () => {
    throw new Error("Wallet no disponible (modo demo)");
  },
};

export const WalletCtx = createContext<WalletState>(defaultWalletState);

export const useWallet = () => useContext(WalletCtx);
