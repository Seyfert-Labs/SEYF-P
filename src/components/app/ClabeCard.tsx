"use client";

/* SEYF — Tarjeta de depósito (CLABE única del usuario para SPEI → MXNB).
   La CLABE se genera automáticamente al primer acceso — el usuario solo la ve y copia. */
import React, { useState } from "react";
import { Icon } from "./ui";
import { JunoService } from "@/services/junoService";
import { useWallet } from "@/components/wallet/WalletContext";
import { useUserClabe } from "@/hooks/useUserClabe";

export function ClabeCard() {
  const wallet = useWallet();
  const { clabe, loading, error } = useUserClabe(wallet.address);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!clabe) return;
    navigator.clipboard
      ?.writeText(clabe)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  if (loading || (!clabe && !error)) {
    return (
      <div className="deposit-card" style={{ minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <span className="spin" style={{ color: "var(--accent)" }} />
        <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Preparando tu CLABE…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 22 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--neg)" }}>{error}</p>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>
          Verifica tu conexión e intenta recargar la página.
        </p>
      </div>
    );
  }

  return (
    <div className="deposit-card">
      <div className="dc-glow" />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "var(--txt-muted)", letterSpacing: ".08em", textTransform: "uppercase" }}>CLABE de depósito</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 800, color: "var(--accent)" }}>Depósito por SPEI</p>
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "var(--txt-muted)" }}>
          <Icon name="shield" size={14} color="var(--accent)" /> Juno
        </span>
      </div>

      <p className="dc-clabe num" style={{ margin: "22px 0 0", position: "relative" }}>
        {JunoService.formatCLABE(clabe!)}
      </p>

      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 16 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 10, color: "var(--txt-muted)", letterSpacing: ".06em" }}>TITULAR</p>
          <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
            {wallet.email ?? "Mi cuenta"}
          </p>
        </div>
        <button className="icon-btn" onClick={copy} aria-label="Copiar CLABE" style={{ flexShrink: 0 }}>
          <Icon name={copied ? "check" : "copy"} size={18} color={copied ? "var(--accent)" : "var(--txt)"} />
        </button>
      </div>
    </div>
  );
}
