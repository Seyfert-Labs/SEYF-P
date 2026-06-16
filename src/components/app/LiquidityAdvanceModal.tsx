"use client";

/* Adelanto de liquidez por AÑOS de rendimiento futuro.
   Flujo on-chain: requestAdvance(vaultId, años) → bloquea el principal libre
   como colateral en ReyfVaults y transfiere `principal × APY × años` al smart
   wallet del usuario. El adelanto nunca excede el 90% del colateral (LTV ≤ 90%),
   lo que limita los años a piso(0.90 / APY).
   El capital sigue generando rendimiento; el advance se cubre con él.
   Requiere NEXT_PUBLIC_SEYF_ADVANCE_ADDRESS y NEXT_PUBLIC_SEYF_VAULTS_ADDRESS. */
import React, { useState } from "react";
import { encodeFunctionData } from "viem";
import { Icon } from "./ui";
import { FMT, AFORE_LOAN_RATE } from "./data";
import { useWallet } from "@/components/wallet/WalletContext";
import {
  ADVANCE_ONCHAIN,
  SEYF_ADVANCE_ADDRESS,
  reyfAdvanceAbi,
  waitForTx,
  explorerBase,
} from "@/lib/chain";

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

  // Coherente con el contrato: apyBps = apy×100, maxYears = piso(9000 / apyBps),
  // rendimiento anual = saved × apyBps / 10000.
  const apyBps = Math.round(apy * 100);
  const maxYears = apyBps > 0 ? Math.floor(9000 / apyBps) : 0;
  const annualYield = (saved * apyBps) / 10000;

  const [years, setYears] = useState(1);
  const [step, setStep] = useState<"select" | "confirm" | "sending" | "done">("select");
  const [err, setErr] = useState("");
  const [txHash, setTxHash] = useState("");

  const amount = annualYield * years;          // monto a recibir
  const ltv = saved > 0 ? (amount / saved) * 100 : 0; // % del colateral
  const canAdvance = ADVANCE_ONCHAIN && vaultId !== undefined;

  // Sin ahorro suficiente
  if (saved <= 0 || maxYears < 1) {
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
              ${FMT(amount, 2)} MXN
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
              {years} {years === 1 ? "año" : "años"} de rendimiento por adelantado. Tu capital (${FMT(saved, 2)}) queda comprometido generándolo.
            </p>
            {txHash && (
              <a
                href={`${explorerBase}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "block", marginTop: 8, fontSize: 12, color: "var(--accent)" }}
              >
                Ver comprobante en el explorador →
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
        args: [BigInt(vaultId!), BigInt(years)],
      });
      const hash = await wallet.sendTx(SEYF_ADVANCE_ADDRESS as string, data);
      await waitForTx(hash as `0x${string}`);
      setTxHash(hash as string);
      onConfirm?.(amount);
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
                ${FMT(amount, 2)} MXN
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Adelantas</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{years} {years === 1 ? "año" : "años"} de rendimiento</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Colateral bloqueado</span>
              <span className="num" style={{ fontWeight: 700, fontSize: 14 }}>${FMT(saved, 2)} <span style={{ color: "var(--txt-dim)", fontWeight: 600 }}>({FMT(ltv, 0)}% LTV)</span></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Interés</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>0% — es tu rendimiento</span>
            </div>
          </div>

          <p style={{ margin: "12px 2px 0", fontSize: 12, color: "var(--txt-dim)", lineHeight: 1.5 }}>
            Tu capital queda comprometido como colateral pero sigue generando rendimiento. Repaga para liberarlo. Sin venta de posiciones.
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
          <button className="btn btn-ghost" style={{ marginTop: 12 }} disabled={step === "sending"} onClick={() => setStep("select")}>
            Atrás
          </button>
        </div>
      </div>
    );
  }

  // Paso 1: selección de años
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="bolt" size={22} color="var(--accent)" /> Adelanto de liquidez
        </p>
        <p className="modal-sub" style={{ marginTop: 6, lineHeight: 1.5 }}>
          Recibe hoy varios años de tu rendimiento futuro sin vender tu ahorro. Tu capital queda comprometido generándolo.
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

        <span className="field-label" style={{ marginTop: 16 }}>¿Cuántos años de rendimiento quieres adelantar?</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {Array.from({ length: maxYears }, (_, i) => i + 1).map((y) => (
            <button
              key={y}
              onClick={() => setYears(y)}
              className="chip"
              style={{
                cursor: "pointer",
                padding: "10px 14px",
                fontWeight: 800,
                background: y === years ? "var(--accent)" : "var(--surface-2)",
                color: y === years ? "var(--on-accent)" : "var(--txt)",
                border: `1px solid ${y === years ? "var(--accent)" : "var(--line)"}`,
              }}
            >
              {y} {y === 1 ? "año" : "años"}
            </button>
          ))}
        </div>

        <div className="card" style={{ marginTop: 14, background: "var(--accent-soft)", border: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Recibes ahora</span>
            <span className="num" style={{ fontWeight: 800, fontSize: 22, color: "var(--accent)" }}>${FMT(amount, 2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Colateral comprometido</span>
            <span className="num" style={{ fontWeight: 700, fontSize: 14 }}>${FMT(saved, 2)} <span style={{ color: "var(--txt-dim)", fontWeight: 600 }}>({FMT(ltv, 0)}% LTV)</span></span>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--txt-dim)", lineHeight: 1.45 }}>
            Máximo {maxYears} {maxYears === 1 ? "año" : "años"} (el adelanto no excede el 90% de tu colateral).
          </p>
        </div>

        {!canAdvance && (
          <p style={{ margin: "12px 2px 0", fontSize: 12, color: "var(--txt-dim)", lineHeight: 1.5 }}>
            Configura <code>NEXT_PUBLIC_SEYF_ADVANCE_ADDRESS</code> para activar esta función.
          </p>
        )}

        <button
          className="btn btn-primary"
          style={{ marginTop: 18 }}
          disabled={!(years >= 1 && years <= maxYears && canAdvance)}
          onClick={() => setStep("confirm")}
        >
          <Icon name="bolt" size={18} /> Continuar
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
