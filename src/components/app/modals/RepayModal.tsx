"use client";

/* Repago (total o parcial) de un adelanto de liquidez.
   Flujo: aprueba MXNB al contrato ReyfAdvance → llama repay(vaultId, amount).
   El colateral se libera proporcionalmente al monto repagado. */
import React, { useState } from "react";
import { encodeFunctionData, parseUnits } from "viem";
import type { Address } from "viem";
import { Icon } from "../ui";
import { FMT } from "../data";
import { useWallet } from "@/components/wallet/WalletContext";
import {
  SEYF_ADVANCE_ADDRESS,
  reyfAdvanceAbi,
  erc20Abi,
  MXNB_ADDRESS,
  MXNB_DECIMALS,
  waitForTx,
  explorerBase,
} from "@/lib/chain";

const toUnits = (n: number) => parseUnits(n.toFixed(MXNB_DECIMALS), MXNB_DECIMALS);

export function RepayModal({
  vaultId,
  debt,
  apy,
  balance,
  onClose,
  onDone,
}: {
  vaultId: number;
  debt: number;     // deuda total actual (MXN)
  apy: number;      // APY de la bóveda (para calcular meses de cobertura)
  balance: number;  // balance total de la bóveda
  onClose: () => void;
  onDone: () => void;
}) {
  const wallet = useWallet();
  const [amount, setAmount] = useState(String(debt));
  const [step, setStep] = useState<"amount" | "confirm" | "sending" | "done">("amount");
  const [err, setErr] = useState("");
  const [txHash, setTxHash] = useState("");

  const n = Math.min(Number(amount) || 0, debt);
  const valid = n > 0 && n <= debt;

  // Meses que faltan para cubrirse solo (con el APY)
  const monthlyYield = balance * (apy / 100) / 12;
  const monthsLeft = monthlyYield > 0 ? Math.ceil((debt - n) / monthlyYield) : null;

  const doRepay = async () => {
    setErr("");
    setStep("sending");
    try {
      const units = toUnits(n);

      // 1. Aprobar MXNB al contrato ReyfAdvance
      const approveData = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [SEYF_ADVANCE_ADDRESS as Address, units],
      });
      await waitForTx((await wallet.sendTx(MXNB_ADDRESS as string, approveData)) as `0x${string}`);

      // 2. Repagar — libera el colateral proporcional
      const repayData = encodeFunctionData({
        abi: reyfAdvanceAbi,
        functionName: "repay",
        args: [BigInt(vaultId), units],
      });
      const hash = await wallet.sendTx(SEYF_ADVANCE_ADDRESS as string, repayData);
      await waitForTx(hash as `0x${string}`);

      setTxHash(hash as string);
      setStep("done");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error al procesar el repago.");
      setStep("confirm");
    }
  };

  if (step === "done") {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <span style={{ width: 64, height: 64, borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
              <Icon name="check" size={32} />
            </span>
            <p style={{ margin: "16px 0 0", fontWeight: 800, fontSize: 20 }}>¡Repago confirmado!</p>
            <p className="num" style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>
              ${FMT(n, 2)} MXN
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
              {debt - n <= 0
                ? "Tu bóveda quedó completamente desbloqueada. El saldo ya es retirable."
                : `Deuda restante: $${FMT(debt - n, 2)} MXN.`}
            </p>
            {txHash && (
              <a href={`${explorerBase}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                style={{ display: "block", marginTop: 8, fontSize: 12, color: "var(--accent)" }}>
                Ver transacción →
              </a>
            )}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => { onDone(); onClose(); }}>
            Listo
          </button>
        </div>
      </div>
    );
  }

  if (step === "confirm" || step === "sending") {
    return (
      <div className="modal-overlay" onClick={step === "sending" ? undefined : onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <p className="modal-title">Confirmar repago</p>

          <div className="card" style={{ marginTop: 14, background: "var(--accent-soft)", border: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Pagas</span>
              <span className="num" style={{ fontWeight: 800, fontSize: 22, color: "var(--accent)" }}>${FMT(n, 2)} MXN</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Colateral que se libera</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>${FMT(n, 2)} MXN</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Deuda restante</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: debt - n > 0 ? "var(--warning, #E8A838)" : "var(--accent)" }}>
                ${FMT(Math.max(0, debt - n), 2)} MXN
              </span>
            </div>
          </div>

          {monthsLeft !== null && debt - n > 0 && (
            <p style={{ margin: "12px 2px 0", fontSize: 12, color: "var(--txt-dim)", lineHeight: 1.5 }}>
              El resto se cubrirá con tu rendimiento en aproximadamente <b style={{ color: "var(--txt)" }}>{monthsLeft} {monthsLeft === 1 ? "mes" : "meses"}</b>.
            </p>
          )}

          {err && <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--neg)" }}>{err}</p>}

          <button className="btn btn-primary" style={{ marginTop: 20 }} disabled={step === "sending"} onClick={doRepay}>
            {step === "sending" ? <span className="spin" /> : "Confirmar repago"}
          </button>
          <button className="btn btn-ghost" style={{ marginTop: 12 }} disabled={step === "sending"} onClick={() => setStep("amount")}>
            Atrás
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">Repagar adelanto</p>
        <p className="modal-sub" style={{ marginTop: 6, lineHeight: 1.5 }}>
          Repaga para liberar tu colateral y volver a retirar de tu bóveda cuando quieras.
        </p>

        {/* Resumen del advance activo */}
        <div className="card" style={{ marginTop: 14, background: "var(--surface-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Adelanto pendiente</span>
            <span className="num" style={{ fontWeight: 800, fontSize: 18 }}>${FMT(debt, 2)} MXN</span>
          </div>
          {monthlyYield > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Se cubre solo en</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>
                ~{Math.ceil(debt / monthlyYield)} {Math.ceil(debt / monthlyYield) === 1 ? "mes" : "meses"}
              </span>
            </div>
          )}
        </div>

        <span className="field-label">Monto a repagar (MXN)</span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            className="input num-input"
            type="number"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="chip" onClick={() => setAmount(String(debt))} style={{ cursor: "pointer", flexShrink: 0 }}>
            Todo
          </button>
        </div>
        {n > debt && (
          <p className="modal-sub" style={{ margin: "8px 0 0", color: "var(--neg)" }}>
            El máximo es ${FMT(debt, 2)} MXN.
          </p>
        )}

        <button className="btn btn-primary" style={{ marginTop: 18 }} disabled={!valid} onClick={() => setStep("confirm")}>
          Continuar
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
