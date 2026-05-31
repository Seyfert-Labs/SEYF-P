"use client";

/* Bono de bienvenida: Juno emite 1,500 MXNB on-chain a la smart wallet del
   usuario nuevo. Incluye pantalla de confirmación, loader de validación y
   reflejo automático en el balance (polling on-chain). */
import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./ui";
import { useWallet } from "@/components/wallet/WalletContext";
import { junoService } from "@/services/junoService";
import { JunoService } from "@/services/junoService";
import { usePendingTxns } from "@/hooks/usePendingTxns";
import { store } from "@/lib/store";

type Status = "idle" | "claiming" | "validating" | "done" | "slow" | "error";

export function WelcomeBonus() {
  const wallet = useWallet();
  const pending = usePendingTxns(wallet.address);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState(true); // asume reclamado hasta verificar
  const balanceBefore = useRef(0);

  // Verifica si ya reclamó el bono (Supabase / local).
  useEffect(() => {
    let active = true;
    (async () => {
      if (!wallet.address) return;
      const claimed = await store.getBonus(wallet.address);
      if (active) setAlreadyClaimed(claimed);
    })();
    return () => {
      active = false;
    };
  }, [wallet.address]);

  // Polling del saldo mientras se valida el depósito on-chain.
  useEffect(() => {
    if (status !== "validating") return;
    const poll = setInterval(() => wallet.refreshBalance(), 4000);
    const giveUp = setTimeout(() => setStatus((s) => (s === "validating" ? "slow" : s)), 75000);
    return () => {
      clearInterval(poll);
      clearTimeout(giveUp);
    };
  }, [status, wallet]);

  // Cuando el saldo sube respecto al inicial → acreditado.
  useEffect(() => {
    if ((status === "validating" || status === "slow") && wallet.balance > balanceBefore.current) {
      setStatus("done");
    }
  }, [status, wallet.balance]);

  const claim = async () => {
    if (!wallet.address) return;
    balanceBefore.current = wallet.balance;
    setStatus("claiming");
    setError(null);
    try {
      await junoService.claimWelcomeBonus(wallet.address);
      await store.setBonus(wallet.address, 1500);
      setAlreadyClaimed(true);
      pending.add("deposit", 1500); // aparece como pendiente en el historial
      setStatus("validating");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reclamar el bono");
      setStatus("error");
    }
  };

  // El banner solo aparece para usuarios con sesión, wallet y saldo en cero.
  const showBanner =
    wallet.enabled &&
    wallet.authenticated &&
    !!wallet.address &&
    wallet.balance === 0 &&
    !alreadyClaimed &&
    status === "idle";

  return (
    <>
      {showBanner && (
        <div className="card glow" style={{ marginTop: 18, background: "var(--accent-soft)", border: "none", padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 46, height: 46, borderRadius: 14, background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="leaf" size={24} />
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: "var(--accent)" }}>🎁 Bono de bienvenida</p>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>
                Recibe $1,500 MXNB para probar Seyf en testnet.
              </p>
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={claim}>
            <Icon name="plus" size={18} /> Reclamar $1,500 MXNB
          </button>
        </div>
      )}

      {status !== "idle" && (
        <div className="modal-overlay" onClick={() => (status === "done" || status === "error" || status === "slow") && setStatus("idle")}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", paddingBottom: 30 }}>
            <div className="modal-grab" />

            {(status === "claiming" || status === "validating") && (
              <>
                <div className="logo-mark brand" style={{ margin: "8px auto 18px", background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <Icon name="leaf" size={26} />
                </div>
                <p className="modal-title" style={{ textAlign: "center" }}>
                  {status === "claiming" ? "Reclamando tu bono…" : "Validando depósito…"}
                </p>
                <p className="modal-sub" style={{ textAlign: "center" }}>
                  {status === "claiming"
                    ? "Juno está emitiendo tus MXNB."
                    : "Confirmando la transacción en Arbitrum. Esto toma unos segundos."}
                </p>
                <div style={{ display: "flex", justifyContent: "center", margin: "20px 0 4px" }}>
                  <span className="spin" style={{ width: 26, height: 26, color: "var(--accent)" }} />
                </div>
              </>
            )}

            {(status === "done" || status === "slow") && (
              <>
                <div style={{ fontSize: 52, margin: "6px 0 4px" }}>🎉</div>
                <p className="modal-title" style={{ textAlign: "center" }}>
                  {status === "done" ? "¡Bono acreditado!" : "Tu bono va en camino"}
                </p>
                <p className="modal-sub" style={{ textAlign: "center" }}>
                  {status === "done" ? (
                    <>Recibiste <b style={{ color: "var(--accent)" }}>$1,500 MXNB</b>. Saldo actual:{" "}
                      <b className="num" style={{ color: "var(--txt)" }}>{JunoService.formatMXNB(wallet.balance)}</b>.</>
                  ) : (
                    <>La red está tardando un poco más. Tus <b style={{ color: "var(--accent)" }}>$1,500 MXNB</b> aparecerán pronto; puedes cerrar esta ventana.</>
                  )}
                </p>
                <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => setStatus("idle")}>Listo</button>
              </>
            )}

            {status === "error" && (
              <>
                <div style={{ fontSize: 44, margin: "6px 0 4px" }}>⚠️</div>
                <p className="modal-title" style={{ textAlign: "center" }}>No se pudo reclamar</p>
                <div className="alert alert-error" style={{ textAlign: "left" }}>{error}</div>
                <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={() => setStatus("idle")}>Cerrar</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
