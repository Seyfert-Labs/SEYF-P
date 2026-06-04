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
import { Portal } from "./Portal";

type Status = "idle" | "claiming" | "validating" | "done" | "slow" | "error";

const DISMISS_KEY = "reyf_bonus_dismissed";

export function WelcomeBonus() {
  const wallet = useWallet();
  const pending = usePendingTxns(wallet.address);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState(true);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  });
  const balanceBefore = useRef(0);

  const dismiss = () => {
    try { window.localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  };

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

  const showBanner =
    wallet.enabled &&
    wallet.authenticated &&
    !!wallet.address &&
    wallet.balance === 0 &&
    !alreadyClaimed &&
    !dismissed &&
    status === "idle";

  return (
    <>
      {showBanner && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          marginTop: 14, padding: "10px 14px",
          background: "var(--accent-soft)", borderRadius: 14,
          border: "1px solid var(--accent)",
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🎁</span>
          <p style={{ margin: 0, flex: 1, fontSize: 13, fontWeight: 700, color: "var(--accent)", lineHeight: 1.3 }}>
            Tienes <span className="num">$1,500</span> de bienvenida
          </p>
          <button
            onClick={claim}
            style={{
              flexShrink: 0, padding: "6px 14px", borderRadius: 10,
              background: "var(--accent)", color: "var(--on-accent)",
              border: "none", fontWeight: 800, fontSize: 13, cursor: "pointer",
            }}
          >
            Reclamar
          </button>
          <button
            onClick={dismiss}
            aria-label="En otro momento"
            style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 8,
              background: "none", border: "none", cursor: "pointer",
              fontSize: 18, lineHeight: 1, color: "var(--txt-muted)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ×
          </button>
        </div>
      )}

      {status !== "idle" && (
        <Portal><div className="modal-overlay" onClick={() => (status === "done" || status === "error" || status === "slow") && setStatus("idle")}>
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
                    ? "Estamos acreditando tu saldo."
                    : "Confirmando tu depósito. Esto toma unos segundos."}
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
                    <>Recibiste <b style={{ color: "var(--accent)" }}>$1,500</b>. Saldo actual:{" "}
                      <b className="num" style={{ color: "var(--txt)" }}>${JunoService.formatMXNB(wallet.balance)}</b>.</>
                  ) : (
                    <>Está tardando un poco más. Tus <b style={{ color: "var(--accent)" }}>$1,500</b> aparecerán pronto; puedes cerrar esta ventana.</>
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
        </div></Portal>
      )}
    </>
  );
}
