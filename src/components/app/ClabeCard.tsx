"use client";

/* SEYF — Tarjeta de depósito (CLABE única del usuario para SPEI → MXNB). */
import React, { useState } from "react";
import { Icon } from "./ui";
import { JunoService } from "@/services/junoService";
import { useWallet } from "@/components/wallet/WalletContext";
import { useUserClabe } from "@/hooks/useUserClabe";

export function ClabeCard() {
  const wallet = useWallet();
  const { clabe, loading, error, create } = useUserClabe(wallet.address);
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

  if (!clabe) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 22 }}>
        <span style={{ width: 50, height: 50, borderRadius: 15, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
          <Icon name="card" size={24} />
        </span>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>Tu CLABE de depósito</p>
        <p style={{ margin: "6px 0 14px", fontSize: 13, color: "var(--txt-muted)" }}>
          Crea una CLABE única para recibir depósitos por SPEI. Se acreditan a tu cuenta automáticamente.
        </p>
        <button className="btn btn-primary" onClick={create} disabled={loading}>
          {loading ? <span className="spin" /> : <Icon name="plus" size={18} />} Crear mi CLABE
        </button>
        {error && <div className="alert alert-error">{error}</div>}
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

      <p className="dc-clabe num" style={{ margin: "22px 0 0", position: "relative" }}>{JunoService.formatCLABE(clabe)}</p>

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
