"use client";

/* Adelanto de liquidez por AÑOS de rendimiento futuro.
   Flujo on-chain: requestAdvance(vaultId, años) → bloquea el principal libre
   como colateral en ReyfVaults y transfiere `principal × APY × años` al smart
   wallet del usuario. El adelanto nunca excede el 90% del colateral (LTV ≤ 90%),
   lo que limita los años a piso(0.90 / APY).
   El capital sigue generando rendimiento; el advance se cubre con él.
   Requiere NEXT_PUBLIC_SEYF_ADVANCE_ADDRESS y NEXT_PUBLIC_SEYF_VAULTS_ADDRESS. */
import React, { useEffect, useState } from "react";
import { Icon } from "./ui";
import { FMT, AFORE_LOAN_RATE } from "./data";
import { useWallet } from "@/components/wallet/WalletContext";
import { useAdvance, useAdvanceQuote } from "@/hooks/useAdvance";
import { RepayModal } from "./modals/RepayModal";
import {
  ADVANCE_ONCHAIN,
  SEYF_ADVANCE_ADDRESS,
  encodeRequestAdvance,
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
  // Estado del adelanto activo de esta bóveda (deuda + colateral). Esta pantalla
  // es ahora el único hogar del adelanto: solicitarlo Y repagarlo (antes el repago
  // vivía como tarjeta dentro de la bóveda).
  const { debt, locked, reload } = useAdvance(wallet.address, vaultId);

  const [years, setYears] = useState(1);
  const [step, setStep] = useState<"select" | "confirm" | "sending" | "done">("select");
  const [repaying, setRepaying] = useState(false);
  const [err, setErr] = useState("");
  const [txHash, setTxHash] = useState("");
  const [receivedAmount, setReceivedAmount] = useState(0);

  const canAdvance = ADVANCE_ONCHAIN && vaultId !== undefined;
  const onchain = useAdvanceQuote(wallet.address, vaultId, years);

  const isLegacy = onchain.mode === "amount";
  const amount = onchain.quote;
  const collateral = isLegacy ? amount : onchain.freeBalance;
  const maxYears = onchain.maxYears;
  const ltv = onchain.freeBalance > 0 ? (amount / onchain.freeBalance) * 100 : 0;

  useEffect(() => {
    if (onchain.ready && onchain.mode === "amount") setYears(1);
  }, [onchain.ready, onchain.mode]);

  useEffect(() => {
    if (onchain.ready && maxYears >= 1 && years > maxYears) setYears(maxYears);
  }, [onchain.ready, maxYears, years]);
  const balanceMismatch =
    canAdvance &&
    onchain.ready &&
    !onchain.loading &&
    saved > 0.01 &&
    collateral > 0 &&
    Math.abs(saved - collateral) / saved > 0.05;

  // Repago: la pantalla de adelanto monta el RepayModal encima.
  if (repaying && vaultId !== undefined) {
    return (
      <RepayModal
        vaultId={vaultId}
        debt={debt}
        apy={apy}
        balance={saved}
        locked={locked}
        onClose={() => setRepaying(false)}
        onDone={() => reload()}
      />
    );
  }

  // Adelanto activo: vista de gestión + repago (en vez del flujo de solicitud).
  // Solo si NO acabamos de tomar uno fresco (ese caso muestra la pantalla "done").
  if (debt > 0 && step !== "done") {
    const monthlyYield = (saved * (apy / 100)) / 12;
    const monthsLeft = monthlyYield > 0 ? Math.ceil(debt / monthlyYield) : null;
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <p className="modal-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="bolt" size={22} color="var(--accent)" /> Tu adelanto activo
          </p>
          <p className="modal-sub" style={{ marginTop: 6, lineHeight: 1.5 }}>
            Recibiste tu rendimiento por adelantado. Tu capital queda comprometido hasta que repagues.
          </p>

          <div className="card" style={{ marginTop: 14, background: "var(--accent-soft)", border: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Pendiente por repagar</span>
              <span className="num" style={{ fontWeight: 800, fontSize: 22, color: "var(--accent)" }}>${FMT(debt, 2)} MXN</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Colateral bloqueado</span>
              <span className="num" style={{ fontWeight: 700, fontSize: 14 }}>${FMT(locked, 2)} MXN</span>
            </div>
            {monthsLeft !== null && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Se libera en (estimado)</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>
                  ~{monthsLeft} {monthsLeft === 1 ? "mes" : "meses"}
                </span>
              </div>
            )}
          </div>

          <p style={{ margin: "12px 2px 0", fontSize: 12, color: "var(--txt-dim)", lineHeight: 1.5 }}>
            Estimación según el rendimiento de tu bóveda. Puedes repagar cuando quieras para liberar tu capital antes.
          </p>

          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => setRepaying(true)}>
            <Icon name="bolt" size={18} /> Repagar adelanto
          </button>
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    );
  }

  // Sin ahorro suficiente (saldo libre on-chain)
  if (onchain.ready && !onchain.loading && (collateral <= 0 || maxYears < 1 || amount <= 0)) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <p className="modal-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="bolt" size={22} color="var(--accent)" /> Adelanto de liquidez
          </p>
          <p className="modal-sub" style={{ marginTop: 6, lineHeight: 1.55 }}>
            {balanceMismatch
              ? `Tu bóveda muestra $${FMT(saved, 2)} en la app, pero el saldo disponible on-chain es $${FMT(onchain.freeBalance, 2)}. Abona de nuevo o espera a que se confirme tu depósito antes de adelantar.`
              : "Aún no tienes ahorro invertido on-chain en esta bóveda. Abona fondos y podrás adelantar tus rendimientos futuros sin vender tus posiciones."}
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
              ${FMT(receivedAmount > 0 ? receivedAmount : amount, 2)} MXN
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
              {isLegacy || years === 1
                ? `1 año de rendimiento por adelantado. Recibiste ${FMT(receivedAmount > 0 ? receivedAmount : amount, 2)} MXN.`
                : `${years} años de rendimiento por adelantado. Tu capital (${FMT(collateral, 2)}) queda comprometido generándolo.`}
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
    if (!canAdvance || amount <= 0 || !onchain.quoteResult) return;
    setErr("");
    setStep("sending");
    const quoted = amount;
    try {
      const data = encodeRequestAdvance(vaultId!, onchain.quoteResult);
      const hash = await wallet.sendTx(SEYF_ADVANCE_ADDRESS as string, data);
      await waitForTx(hash as `0x${string}`);
      setTxHash(hash as string);
      setReceivedAmount(quoted);
      onConfirm?.(quoted);
      void reload();
      void onchain.reload();
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
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                {isLegacy ? "1 año de rendimiento" : `${years} ${years === 1 ? "año" : "años"} de rendimiento`}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Colateral bloqueado</span>
              <span className="num" style={{ fontWeight: 700, fontSize: 14 }}>
                ${FMT(collateral, 2)}
                {!isLegacy && (
                  <span style={{ color: "var(--txt-dim)", fontWeight: 600 }}> ({FMT(ltv, 0)}% LTV)</span>
                )}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Interés</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>0% — es tu rendimiento</span>
            </div>
          </div>

          {balanceMismatch && (
            <div className="card" style={{ marginTop: 12, borderColor: "var(--warning, #E8A838)", display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Icon name="info" size={18} color="var(--warning, #E8A838)" />
              <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.5 }}>
                El saldo en la app (${FMT(saved, 2)}) no coincide con el on-chain (${FMT(onchain.freeBalance, 2)}). Confirmas recibir <b>${FMT(amount, 2)}</b>, no ${FMT((saved * apy * years) / 100, 2)}.
              </p>
            </div>
          )}

          <p style={{ margin: "12px 2px 0", fontSize: 12, color: "var(--txt-dim)", lineHeight: 1.5 }}>
            Tu capital queda comprometido como colateral pero sigue generando rendimiento. Repaga para liberarlo. Sin venta de posiciones.
          </p>

          {err && <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--neg)" }}>{err}</p>}

          <button
            className="btn btn-primary"
            style={{ marginTop: 20 }}
            disabled={step === "sending" || amount <= 0}
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
          {isLegacy && onchain.ready
            ? "Recibe hoy un año de tu rendimiento futuro sin vender tu ahorro. Por ahora solo puedes adelantar hasta 1 año por bóveda."
            : "Recibe hoy varios años de tu rendimiento futuro sin vender tu ahorro. Tu capital queda comprometido generándolo."}
        </p>

        {isLegacy && onchain.ready && amount > 0 && (
          <div
            className="card"
            style={{
              marginTop: 14,
              padding: "12px 14px",
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 1, display: "inline-flex" }}><Icon name="info" size={20} color="var(--accent)" /></span>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>Límite actual: 1 año de rendimiento</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.5 }}>
                Con tu saldo en bóveda puedes adelantar como máximo <b className="num">${FMT(amount, 2)} MXN</b>
                {" "}(≈{FMT(apy, 1)}% anual × 1 año). Para adelantar más años a la vez habrá una actualización del contrato.
              </p>
            </div>
          </div>
        )}

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

        {isLegacy && onchain.ready ? (
          <div style={{ marginTop: 16 }}>
            <span className="field-label">Adelanto disponible</span>
            <div
              className="chip"
              style={{
                marginTop: 8,
                display: "inline-flex",
                padding: "10px 14px",
                fontWeight: 800,
                background: "var(--accent)",
                color: "var(--on-accent)",
                border: "1px solid var(--accent)",
              }}
            >
              1 año de rendimiento
            </div>
          </div>
        ) : (
          <>
            <span className="field-label" style={{ marginTop: 16 }}>¿Cuántos años de rendimiento quieres adelantar?</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {onchain.loading || !onchain.ready ? (
                <span style={{ fontSize: 13, color: "var(--txt-muted)", padding: "8px 0" }}>Calculando tope…</span>
              ) : (
                Array.from({ length: maxYears }, (_, i) => i + 1).map((y) => (
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
                ))
              )}
            </div>
          </>
        )}

        <div className="card" style={{ marginTop: 14, background: "var(--accent-soft)", border: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Recibes ahora</span>
            <span className="num" style={{ fontWeight: 800, fontSize: 22, color: "var(--accent)" }}>${FMT(amount, 2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Colateral comprometido</span>
            <span className="num" style={{ fontWeight: 700, fontSize: 14 }}>
              ${FMT(collateral, 2)}
              {!isLegacy && (
                <span style={{ color: "var(--txt-dim)", fontWeight: 600 }}> ({FMT(ltv, 0)}% LTV)</span>
              )}
            </span>
          </div>
          {balanceMismatch && (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--warning, #E8A838)", lineHeight: 1.45 }}>
              Saldo en app ${FMT(saved, 2)} · on-chain ${FMT(onchain.freeBalance, 2)}
            </p>
          )}
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--txt-dim)", lineHeight: 1.45 }}>
            {isLegacy
              ? "Equivale a 1 año de rendimiento sobre tu saldo en bóveda."
              : `Máximo ${maxYears} ${maxYears === 1 ? "año" : "años"} (el adelanto no excede el 90% de tu colateral).`}
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
          disabled={!(canAdvance && amount > 0 && maxYears >= 1 && onchain.ready && !onchain.loading)}
          onClick={() => setStep("confirm")}
        >
          <Icon name="bolt" size={18} /> Continuar
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
