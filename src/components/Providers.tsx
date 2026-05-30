"use client";

/* Provee autenticación + wallets embebidas (Privy) a toda la app.
   Login social (Google / Email OTP), wallet creada sin seed phrase.
   Si no hay App ID, expone un WalletContext por defecto (modo demo). */
import { PrivyProvider } from "@privy-io/react-auth";
import { activeChain } from "@/lib/chain";
import { WalletCtx, defaultWalletState } from "./wallet/WalletContext";
import PrivyBridge from "./wallet/PrivyBridge";

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  // Sin App ID configurado: modo demo (sin Privy), contexto por defecto.
  if (!appId) {
    return <WalletCtx.Provider value={defaultWalletState}>{children}</WalletCtx.Provider>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["google", "email"],
        appearance: {
          theme: "dark",
          accentColor: "#C8FF4D",
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
      <PrivyBridge>{children}</PrivyBridge>
    </PrivyProvider>
  );
}
