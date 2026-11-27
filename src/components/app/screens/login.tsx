"use client";

import { EmbeddedAuthForm } from "@crossmint/client-sdk-react-ui";
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";
import { stellarWalletNetworkFromEnv } from "@/lib/stellar/network";
import { Icon } from "../ui";

export function ScreenLogin({ onBack }: { onBack: () => void }) {
  const stellar = useSeyfStellarWallet();
  const network = stellarWalletNetworkFromEnv();

  if (!stellar.enabled) {
    return (
      <div className="screen">
        <div className="onb">
          <div className="alert alert-error">
            Falta configurar Crossmint (NEXT_PUBLIC_CROSSMINT_API_KEY). Sin wallet no se puede entrar.
          </div>
          <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={onBack}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="onb">
        <button
          className="icon-btn"
          aria-label="Volver"
          onClick={onBack}
          style={{ marginBottom: 18 }}
        >
          <Icon name="chevL" size={20} />
        </button>
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            background: "var(--accent-soft)",
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="lock" size={28} />
        </span>
        <p className="eyebrow" style={{ marginTop: 22 }}>
          Entrar a SEYF{network === "testnet" ? " · testnet" : ""}
        </p>
        <h1
          className="brand"
          style={{ fontSize: "var(--t-xl)", margin: "8px 0 10px", lineHeight: 1.1 }}
        >
          Entra con tu correo o Google
        </h1>
        <p
          style={{
            color: "var(--txt-muted)",
            fontSize: "var(--t-sm)",
            lineHeight: 1.5,
            margin: "0 0 22px",
          }}
        >
          Tu cuenta Stellar se crea automáticamente: sin frase semilla, sin contraseñas y sin comprar
          XLM para pagar comisiones.
        </p>

        <EmbeddedAuthForm />

        {stellar.error && <div className="alert alert-error">{stellar.error}</div>}
      </div>
    </div>
  );
}
