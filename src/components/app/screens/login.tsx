"use client";

/* Entrar a SEYF: correo + código (Pollar headless). Sin frase semilla y sin XLM.
   Al verificar, Pollar crea (o recupera) la wallet Stellar del usuario. */
import { useState } from "react";
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";
import { stellarWalletNetworkFromEnv } from "@/lib/stellar/network";
import { rememberLoginEmail } from "@/components/wallet/PollarBridge";
import { Icon } from "../ui";

export function ScreenLogin({ onBack }: { onBack: () => void }) {
  const stellar = useSeyfStellarWallet();
  const network = stellarWalletNetworkFromEnv();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const busy = stellar.phase === "sending" || stellar.phase === "verifying";
  const codeSent =
    stellar.phase === "code" ||
    stellar.phase === "verifying" ||
    ((stellar.phase === "error" || stellar.phase === "sending") && stellar.codeSentOnce);
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  const send = () => {
    const mail = email.trim();
    rememberLoginEmail(mail);
    void stellar.sendCode(mail);
  };

  if (!stellar.enabled) {
    return (
      <div className="screen">
        <div className="onb">
          <div className="alert alert-error">Falta configurar Pollar (NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY). Sin wallet no se puede entrar.</div>
          <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={onBack}>Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="onb">
        <button className="icon-btn" aria-label="Volver" onClick={onBack} disabled={busy} style={{ marginBottom: 18 }}>
          <Icon name="chevL" size={20} />
        </button>
        <span
          style={{
            width: 56, height: 56, borderRadius: 18, background: "var(--accent-soft)", color: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon name="lock" size={28} />
        </span>
        <p className="eyebrow" style={{ marginTop: 22 }}>Entrar a SEYF{network === "testnet" ? " · testnet" : ""}</p>
        <h1 className="brand" style={{ fontSize: "var(--t-xl)", margin: "8px 0 10px", lineHeight: 1.1 }}>
          Entra con tu correo
        </h1>
        <p style={{ color: "var(--txt-muted)", fontSize: "var(--t-sm)", lineHeight: 1.5, margin: 0 }}>
          Te mandamos un código. Tu cuenta se crea sola: sin frase semilla, sin contraseñas y sin comprar nada
          para pagar comisiones.
        </p>

        <div style={{ marginTop: 28 }}>
          {!codeSent ? (
            <>
              <span className="field-label">Correo</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && validEmail && !busy && send()}
              />
              <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={busy || !validEmail} onClick={send}>
                {busy ? <span className="spin" /> : "Enviarme un código"}
              </button>
            </>
          ) : (
            <>
              <span className="field-label">Código que te llegó a {email.trim() || "tu correo"}</span>
              <input
                className="input num-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.trim())}
                onKeyDown={(e) => e.key === "Enter" && code && !busy && void stellar.verifyCode(code)}
              />
              <button
                className="btn btn-primary"
                style={{ marginTop: 14 }}
                disabled={busy || code.length < 4}
                onClick={() => void stellar.verifyCode(code)}
              >
                {busy ? <span className="spin" /> : "Entrar"}
              </button>
              <button
                className="btn btn-ghost"
                style={{ marginTop: 10, padding: 13, fontSize: "var(--t-sm)" }}
                disabled={busy || !validEmail}
                onClick={send}
              >
                Mandar otro código
              </button>
            </>
          )}

          {stellar.notice && <div className="alert alert-info">{stellar.notice}</div>}
          {stellar.phase === "error" && stellar.error && <div className="alert alert-error">{stellar.error}</div>}
        </div>
      </div>
    </div>
  );
}
