"use client";

/* Modal de recepción de fondos.
   Único método: SPEI (CLABE). El bloque "Simular depósito" solo aparece fuera de producción. */
import React, { useState } from "react";
import { Icon } from "../ui";
import { useWallet } from "@/components/wallet/WalletContext";
import { junoService } from "@/services/junoService";
import { usePendingTxns } from "@/hooks/usePendingTxns";
import { useMonthlyLimits } from "@/hooks/useMonthlyLimits";
import { ClabeCard } from "../ClabeCard";
import { FMT } from "../data";
import { MoneyInput } from "../MoneyInput";

const IS_DEV = process.env.NODE_ENV !== "production";

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

  // Dev-only
  const [devAmt, setDevAmt] = useState("");
  const [devStatus, setDevStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [devError, setDevError] = useState<string | null>(null);

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

        {/* ── SPEI (CLABE) — único método de depósito ── */}
        <ClabeCard />
        <p className="modal-sub" style={{ marginTop: 12, marginBottom: 0 }}>
          Transfiere desde cualquier banco mexicano. El dinero se acredita automáticamente.
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <span className="chip"><Icon name="clock" size={12} /> ~15 minutos</span>
          <span className="chip"><Icon name="info" size={12} /> Mínimo $500 MXN</span>
        </div>

        {/* ── Dev: simular depósito ── */}
        {IS_DEV && (
          <>
            <div className="divider" style={{ marginTop: 22 }} />
            <p className="eyebrow" style={{ marginBottom: 10 }}>Dev · Simular depósito</p>
            <div style={{ display: "flex", gap: 8 }}>
              <MoneyInput
                className="input num-input"
                placeholder="500.00"
                value={devAmt}
                onChange={(v) => { setDevAmt(v); setDevStatus("idle"); setDevError(null); }}
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
