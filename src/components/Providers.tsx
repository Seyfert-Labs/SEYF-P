"use client";

/* Provee autenticación + wallets embebidas (Privy) a toda la app.
   Login social (Google / Email OTP), wallet creada sin seed phrase.
   Si no hay App ID, expone un WalletContext por defecto (modo demo). */
import { PrivyProvider } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { activeChain } from "@/lib/chain";
import { WalletCtx, defaultWalletState } from "./wallet/WalletContext";
import PrivyBridge from "./wallet/PrivyBridge";
import ReyfPollarProvider from "./providers/ReyfPollarProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // Sin App ID configurado: modo demo (sin Privy), contexto por defecto.
  // Pollar envuelve igual: la wallet Stellar de verificación vive dentro del shell.
  if (!appId) {
    return (
      <WalletCtx.Provider value={defaultWalletState}>
        <ReyfPollarProvider>{children}</ReyfPollarProvider>
      </WalletCtx.Provider>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email"],
        appearance: {
          theme: "dark",
          accentColor: "#8B5CF6",
          walletChainType: "ethereum-only",
        },
        defaultChain: activeChain,
        supportedChains: [activeChain],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
          showWalletUIs: false,
        },
      }}
    >
      <SmartWalletsProvider>
        <PrivyBridge>
          <ReyfPollarProvider>{children}</ReyfPollarProvider>
        </PrivyBridge>
      </SmartWalletsProvider>
    </PrivyProvider>
  );
}
