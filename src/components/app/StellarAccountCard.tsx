"use client";

/* SEYF — Tarjeta de la cuenta digital Stellar del usuario.
   Muestra la dirección (public key) de la wallet embebida (Pollar) para recibir
   activos on-chain (XLM, USDC, CETES…). Se activa "just-in-time" con OTP si aún
   no está conectada, igual que las operaciones de dinero. */
import React, { useState } from "react";
import { Icon } from "./ui";
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";
import { useStellarConnect } from "./StellarConnectGate";
import { stellarAccountExplorerUrl } from "@/lib/etherfuse/stellar-tx-url";

/** GABC…WXYZ — recorta el centro conservando inicio y fin. */
function shortAddress(pk: string): string {
  if (pk.length <= 14) return pk;
  return `${pk.slice(0, 8)}…${pk.slice(-6)}`;
}

export function StellarAccountCard() {
  const stellar = useSeyfStellarWallet();
  const { ensureConnected } = useStellarConnect();
  const [copied, setCopied] = useState(false);
  const [activating, setActivating] = useState(false);

  // Solo aplica cuando el riel Stellar (Pollar) está configurado.
  if (!stellar.enabled) return null;

  const publicKey = stellar.publicKey;

  const copy = () => {
    if (!publicKey) return;
    navigator.clipboard
      ?.writeText(publicKey)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  const activate = async () => {
    setActivating(true);
    try {
      await ensureConnected("ver tu cuenta Stellar");
    } finally {
      setActivating(false);
    }
  };

  const explorerUrl = stellarAccountExplorerUrl(publicKey);

  return (
    <div
      className="deposit-card"
      style={{
        marginTop: 14,
        // Tono morado de la app (accent-2) en vez del verde por defecto de .deposit-card.
        background: "linear-gradient(135deg, #1b1533 0%, #0b0a14 100%)",
      }}
    >
      <div className="dc-glow" style={{ background: "radial-gradient(circle, var(--accent-2-soft), transparent 70%)" }} />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "var(--txt-muted)", letterSpacing: ".08em", textTransform: "uppercase" }}>
            Cuenta Digital Stellar
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 800, color: "var(--accent-2)" }}>Recibe activos on-chain</p>
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--txt-muted)" }}>
          <Icon name="globe" size={14} color="var(--accent-2)" /> Stellar
        </span>
      </div>

      {publicKey ? (
        <>
          <p
            className="num"
            style={{
              margin: "22px 0 0",
              position: "relative",
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: ".01em",
              wordBreak: "break-all",
            }}
          >
            {shortAddress(publicKey)}
          </p>

          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 10, color: "var(--txt-muted)", letterSpacing: ".06em" }}>DIRECCIÓN</p>
              {explorerUrl ? (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ margin: "3px 0 0", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 700, color: "var(--accent-2)" }}
                >
                  Ver en el explorador ↗
                </a>
              ) : (
                <p style={{ margin: "3px 0 0", fontSize: 12.5, fontWeight: 700, color: "var(--txt-muted)" }}>Red Stellar</p>
              )}
            </div>
            <button className="icon-btn" onClick={copy} aria-label="Copiar dirección Stellar" style={{ flexShrink: 0 }}>
              <Icon name={copied ? "check" : "copy"} size={18} color={copied ? "var(--accent-2)" : "var(--txt)"} />
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: "20px 0 0", position: "relative", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
            Activa tu cuenta Stellar para obtener tu dirección y recibir activos on-chain.
          </p>
          <button
            className="btn btn-violet"
            style={{ marginTop: 16, position: "relative" }}
            disabled={activating}
            onClick={activate}
          >
            {activating ? <span className="spin" /> : "Activar cuenta Stellar"}
          </button>
        </>
      )}
    </div>
  );
}
