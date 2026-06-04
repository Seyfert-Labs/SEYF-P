"use client";

/* Modal de recepción de fondos.
   Dos métodos: SPEI (CLABE) y Cuenta Reyf (dirección on-chain).
   El bloque "Simular depósito" solo aparece fuera de producción. */
import React, { useState } from "react";
import { Icon } from "../ui";
import { useWallet } from "@/components/wallet/WalletContext";
import { junoService } from "@/services/junoService";
import { usePendingTxns } from "@/hooks/usePendingTxns";
import { useMonthlyLimits } from "@/hooks/useMonthlyLimits";
import { ClabeCard } from "../ClabeCard";
import { FMT } from "../data";
import { explorerBase } from "@/lib/chain";

const IS_DEV = process.env.NODE_ENV !== "production";

type Tab = "spei" | "cuenta";

export function DepositModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const wallet = useWallet();
  const pending = usePendingTxns(wallet.address);
  const limits = useMonthlyLimits(wallet.address);
  const [tab, setTab] = useState<Tab>("spei");
  const [addrCopied, setAddrCopied] = useState(false);

  // Dev-only
  const [devAmt, setDevAmt] = useState("");
  const [devStatus, setDevStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [devError, setDevError] = useState<string | null>(null);

  const copyAddress = () => {
    if (!wallet.address) return;
    navigator.clipboard?.writeText(wallet.address).then(() => {
      setAddrCopied(true);
      setTimeout(() => setAddrCopied(false), 1500);
    }).catch(() => {});
  };

  const simulateDeposit = async () => {
    const n = Number(devAmt);
    if (!wallet.address || n <= 0) return;
    if (!limits.canDo("deposit", n)) {
      setDevError(`Límite mensual alcanzado. Disponible: $${FMT(limits.remaining("deposit"), 2)}`);
      setDevStatus("error");
      return;
    }
    setDevStatus("sending");
    setDevError(null);
    try {
      await junoService.fundWallet(wallet.address, n);
      await limits.record("deposit", n);
      pending.add("deposit", n);
      onSuccess?.();
      setDevStatus("done");
      setTimeout(onClose, 1500);
    } catch (e) {
      setDevError(e instanceof Error ? e.message : "Error al simular depósito");
      setDevStatus("error");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">Agregar dinero</p>

        <div className="seg" style={{ marginBottom: 20 }}>
          <button className={tab === "spei" ? "on" : ""} onClick={() => setTab("spei")}>SPEI</button>
          <button className={tab === "cuenta" ? "on" : ""} onClick={() => setTab("cuenta")}>Cuenta Reyf</button>
        </div>

        {/* ── SPEI ── */}
        {tab === "spei" && (
          <>
            <ClabeCard />
            <p className="modal-sub" style={{ marginTop: 12, marginBottom: 0 }}>
              Transfiere desde cualquier banco mexicano. El dinero se acredita automáticamente.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <span className="chip"><Icon name="clock" size={12} /> ~15 minutos</span>
              <span className="chip"><Icon name="info" size={12} /> Mínimo $500 MXN</span>
            </div>
          </>
        )}

        {/* ── Cuenta Reyf ── */}
        {tab === "cuenta" && (
          <>
            <div className="deposit-card">
              <div className="dc-glow" />
              <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p className="eyebrow">Cuenta Reyf</p>
                  <p style={{ margin: "4px 0 0", fontSize: "var(--t-xs)", fontWeight: 800, color: "var(--accent)" }}>
                    Red Arbitrum · MXNB
                  </p>
                </div>
                <span className="pos-pill"><Icon name="shield" size={11} /> ERC-4337</span>
              </div>
              <p className="num dc-clabe" style={{ marginTop: 18, fontSize: 13, letterSpacing: "0.04em", wordBreak: "break-all", lineHeight: 1.7 }}>
                {wallet.address ?? "—"}
              </p>
              <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                {wallet.address ? (
                  <a
                    className="chip"
                    href={`${explorerBase}/address/${wallet.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: "none" }}
                  >
                    <Icon name="arrowR" size={12} /> Explorador
                  </a>
                ) : <span />}
                <button className="icon-btn" onClick={copyAddress} aria-label="Copiar dirección">
                  <Icon name={addrCopied ? "check" : "copy"} size={18} color={addrCopied ? "var(--accent)" : "var(--txt)"} />
                </button>
              </div>
            </div>

            <div className="card" style={{ marginTop: 12, background: "var(--accent-2-soft)", border: "none", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ flexShrink: 0, marginTop: 1, display: "flex" }}><Icon name="info" size={16} color="var(--accent-2)" /></span>
              <p style={{ margin: 0, fontSize: "var(--t-xs)", color: "var(--txt-muted)", lineHeight: 1.55 }}>
                Solo envía <b style={{ color: "var(--txt)" }}>MXNB</b> en la red{" "}
                <b style={{ color: "var(--txt)" }}>Arbitrum</b>. Otros tokens o redes pueden resultar en pérdida de fondos.
              </p>
            </div>
          </>
        )}

        {/* ── Dev: simular depósito ── */}
        {IS_DEV && (
          <>
            <div className="divider" style={{ marginTop: 22 }} />
            <p className="eyebrow" style={{ marginBottom: 10 }}>Dev · Simular depósito</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input num-input"
                type="number"
                inputMode="decimal"
                placeholder="500.00"
                value={devAmt}
                onChange={(e) => { setDevAmt(e.target.value); setDevStatus("idle"); setDevError(null); }}
                style={{ flex: 1, margin: 0 }}
                disabled={devStatus === "sending"}
              />
              <button
                className="btn btn-ghost"
                style={{ flex: "none", width: "auto", padding: "0 20px", margin: 0 }}
                disabled={!devAmt || Number(devAmt) <= 0 || devStatus === "sending"}
                onClick={simulateDeposit}
              >
                {devStatus === "sending" ? <span className="spin" /> : "Simular"}
              </button>
            </div>
            {devStatus === "done" && (
              <p style={{ margin: "8px 2px 0", fontSize: "var(--t-xs)", color: "var(--accent)", fontWeight: 700 }}>
                ✓ Depósito simulado
              </p>
            )}
            {devError && (
              <p style={{ margin: "8px 2px 0", fontSize: "var(--t-xs)", color: "var(--neg)" }}>{devError}</p>
            )}
          </>
        )}

        <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
