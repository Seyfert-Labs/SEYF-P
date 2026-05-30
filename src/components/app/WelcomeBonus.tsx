"use client";

/* Bono de bienvenida: Juno emite 1,500 MXNB on-chain a la smart wallet del
   usuario nuevo (para probar la app + el gas patrocinado en testnet). */
import React, { useState } from "react";
import { Icon } from "./ui";
import { useWallet } from "@/components/wallet/WalletContext";
import { junoService } from "@/services/junoService";

const claimKey = (addr: string) => `seyf_bonus_${addr.toLowerCase()}`;

export function WelcomeBonus() {
  const wallet = useWallet();
  const [state, setState] = useState<"idle" | "claiming" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  // Solo para usuarios con sesión, smart wallet lista y saldo aún en cero.
  const alreadyClaimed =
    typeof window !== "undefined" && wallet.address
      ? !!localStorage.getItem(claimKey(wallet.address))
      : false;

  if (!wallet.enabled || !wallet.authenticated || !wallet.address) return null;
  if (wallet.balance > 0 || alreadyClaimed) return null;

  const claim = async () => {
    if (!wallet.address) return;
    setState("claiming");
    setError(null);
    try {
      await junoService.claimWelcomeBonus(wallet.address);
      localStorage.setItem(claimKey(wallet.address), "1");
      setState("done");
      // El saldo on-chain tarda unos segundos; forzamos algunas relecturas.
      setTimeout(() => wallet.refreshBalance(), 4000);
      setTimeout(() => wallet.refreshBalance(), 12000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reclamar el bono");
      setState("idle");
    }
  };

  return (
    <div className="card glow" style={{ marginTop: 18, background: "var(--accent-soft)", border: "none", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="leaf" size={24} />
        </span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: "var(--accent)" }}>🎁 Bono de bienvenida</p>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>
            {state === "done"
              ? "¡Listo! Tus $1,500 MXNB llegarán en unos segundos."
              : "Recibe $1,500 MXNB para probar Seyf en testnet."}
          </p>
        </div>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      {state !== "done" && (
        <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={claim} disabled={state === "claiming"}>
          {state === "claiming" ? <span className="spin" /> : <Icon name="plus" size={18} />}
          Reclamar $1,500 MXNB
        </button>
      )}
    </div>
  );
}
