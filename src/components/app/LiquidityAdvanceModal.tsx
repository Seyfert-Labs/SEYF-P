"use client";

/* Adelanto de liquidez sobre rendimientos futuros.
   Flujo on-chain: requestAdvance(vaultId, amount) → bloquea colateral 1:1
   en ReyfVaults y transfiere MXNB al smart wallet del usuario.
   El capital sigue generando rendimiento; el advance se cubre con él.
   Requiere NEXT_PUBLIC_SEYF_ADVANCE_ADDRESS y NEXT_PUBLIC_SEYF_VAULTS_ADDRESS. */
import React, { useState } from "react";
import { encodeFunctionData, parseUnits } from "viem";
import { Icon } from "./ui";
import { FMT, liquidityAdvance, AFORE_LOAN_RATE } from "./data";
import { useWallet } from "@/components/wallet/WalletContext";
import {
  ADVANCE_ONCHAIN,
  SEYF_ADVANCE_ADDRESS,
  reyfAdvanceAbi,
  MXNB_DECIMALS,
  waitForTx,
  explorerBase,
} from "@/lib/chain";

const toUnits = (n: number) => parseUnits(n.toFixed(MXNB_DECIMALS), MXNB_DECIMALS);

export function LiquidityAdvanceModal({
  saved,
  apy,
  vaultId,
  onClose,
  onConfirm,
}: {
  saved: number;
  apy: number;
  /** Índice numérico de la bóveda on-chain. Undefined = contrato no configurado. */
  vaultId?: number;
  onClose: () => void;
  onConfirm?: (amt: number) => void;
}) {
  const wallet = useWallet();
  const max = Math.floor(liquidityAdvance(saved, apy));
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"amount" | "confirm" | "sending" | "done">("amount");
  const [err, setErr] = useState("");
  const [txHash, setTxHash] = useState("");

  const n = Number(amount);
  const canAdvance = ADVANCE_ONCHAIN && vaultId !== undefined;

  // Sin ahorro
  if (max <= 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <p className="modal-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="bolt" size={22} color="var(--accent)" /> Adelanto de liquidez
          </p>
          <p className="modal-sub" style={{ marginTop: 6, lineHeight: 1.55 }}>
            Aún no tienes ahorro invertido. Empieza a ahorrar en una bóveda y podrás adelantar tus rendimientos futuros sin vender tus posiciones.
          </p>
          <button className="btn btn-ghost" style={{ marginTop: 18 }} onClick={onClose}>Entendido</button>
        </div>
      </div>
    );
  }

  // Éxito
  if (step === "done") {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <span style={{ width: 64, height: 64, borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}>
              <Icon name="check" size={32} />
            </span>
            <p style={{ margin: "16px 0 0", fontWeight: 800, fontSize: 20 }}>¡Adelanto recibido!</p>
            <p className="num" style={{ margin: "8px 0 0", fontSize: 30, fontWeight: 700, color: "var(--accent)" }}>
              ${FMT(n, 2)} MXNB
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
              Ya tienes el MXNB en tu wallet. Tu ahorro sigue invertido y creciendo.
            </p>
            {txHash && (
              <a
                href={`${explorerBase}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "block", marginTop: 8, fontSize: 12, color: "var(--accent)" }}
              >
                Ver transacción →
              </a>
            )}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={onClose}>Listo</button>
        </div>
      </div>
    );
  }

  // Confirmación + envío
  const doAdvance = async () => {
    if (!canAdvance) return;
    setErr("");
    setStep("sending");
    try {
      const data = encodeFunctionData({
        abi: reyfAdvanceAbi,
        functionName: "requestAdvance",
        args: [BigInt(vaultId!), toUnits(n)],
      });
      const hash = await wallet.sendTx(SEYF_ADVANCE_ADDRESS as string, data);
      await waitForTx(hash as `0x${string}`);
      setTxHash(hash as string);
      onConfirm?.(n);
      setStep("done");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error al procesar el adelanto.");
      setStep("confirm");
    }
  };

  if (step === "confirm" || step === "sending") {
    return (
      <div className="modal-overlay" onClick={step === "sending" ? undefined : onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <p className="modal-title">Confirmar adelanto</p>

          <div className="card" style={{ marginTop: 14, background: "var(--accent-soft)", border: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Recibes</span>
              <span className="num" style={{ fontWeight: 800, fontSize: 22, color: "var(--accent)" }}>
                ${FMT(n, 2)} MXNB
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Interés</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>0% — es tu rendimiento</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Destino</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Tu wallet · inmediato</span>
            </div>
          </div>

          <p style={{ margin: "12px 2px 0", fontSize: 12, color: "var(--txt-dim)", lineHeight: 1.5 }}>
            Tu colateral queda bloqueado en la bóveda pero sigue generando rendimiento. Sin venta de posiciones.
          </p>

          {err && <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--neg)" }}>{err}</p>}

          <button
            className="btn btn-primary"
            style={{ marginTop: 20 }}
            disabled={step === "sending"}
            onClick={doAdvance}
          >
            {step === "sending" ? <span className="spin" /> : <><Icon name="bolt" size={18} /> Confirmar adelanto</>}
          </button>
          <button className="btn btn-ghost" style={{ marginTop: 12 }} disabled={step === "sending"} onClick={() => setStep("amount")}>
            Atrás
          </button>
        </div>
      </div>
    );
  }

  // Paso 1: entrada de monto
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="bolt" size={22} color="var(--accent)" /> Adelanto de liquidez
        </p>
        <p className="modal-sub" style={{ marginTop: 6, lineHeight: 1.5 }}>
          Recibe MXNB hoy sin vender tu ahorro. Se cubre con el rendimiento que tu dinero generará el próximo año.
        </p>

        <div className="card" style={{ marginTop: 14, padding: 14 }}>
          <p className="eyebrow">No es un préstamo</p>
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <div style={{ flex: 1, padding: "10px 12px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--line)" }}>
              <p style={{ margin: 0, fontSize: 11, color: "var(--txt-muted)" }}>Préstamo sobre pensión</p>
              <p className="num" style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "var(--neg)" }}>
                {FMT(AFORE_LOAN_RATE, 0)}%<span style={{ fontSize: 11, fontWeight: 600 }}> + IVA</span>
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--txt-dim)" }}>interés anual · deuda</p>
            </div>
            <div style={{ flex: 1, padding: "10px 12px", borderRadius: 12, background: "var(--accent-soft)", border: "1px solid var(--accent)" }}>
              <p style={{ margin: 0, fontSize: 11, color: "var(--accent)" }}>Adelanto Reyf</p>
              <p className="num" style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>
                0%<span style={{ fontSize: 11, fontWeight: 600 }}> interés</span>
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--txt-dim)" }}>es tu propio rendimiento</p>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 12, background: "var(--accent-soft)", border: "none", display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="leaf" size={20} color="var(--accent)" />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)" }}>Disponible para adelantar</p>
            <p className="num" style={{ margin: "2px 0 0", fontWeight: 800, fontSize: 20, color: "var(--accent)" }}>
              ${FMT(max, 2)}
            </p>
          </div>
          <button className="chip" onClick={() => setAmount(String(max))} style={{ cursor: "pointer" }}>Máx</button>
        </div>

        <span className="field-label">Monto (MXNB)</span>
        <input
          className="input num-input"
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {n > max && (
          <p className="modal-sub" style={{ margin: "8px 0 0", color: "var(--neg)" }}>
            El máximo es ${FMT(max, 2)}.
          </p>
        )}

        {!canAdvance && (
          <p style={{ margin: "12px 2px 0", fontSize: 12, color: "var(--txt-dim)", lineHeight: 1.5 }}>
            Configura <code>NEXT_PUBLIC_SEYF_ADVANCE_ADDRESS</code> para activar esta función.
          </p>
        )}

        <button
          className="btn btn-primary"
          style={{ marginTop: 18 }}
          disabled={!(n > 0 && n <= max && canAdvance)}
          onClick={() => setStep("confirm")}
        >
          <Icon name="bolt" size={18} /> Continuar
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
