"use client";

/* Bonos de bienvenida — siempre visibles en Perfil:
   1. $300 MXN en CETES (Etherfuse onramp)
   2. 10,000 XLM testnet (Friendbot)
   Ambos muestran estado reclamado/disponible/bloqueado. */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./ui";
import { useWallet } from "@/components/wallet/WalletContext";
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";
import { useKycStatus } from "@/hooks/useKycStatus";
import { store } from "@/lib/store";
import { Portal } from "./Portal";
import { fundStellarWallet } from "@/lib/seyf/use-ensure-stellar-funding";

const BONUS_AMOUNT = 300;
type CetesStatus = "idle" | "quoting" | "ordering" | "processing" | "done" | "error";
type FriendbotStatus = "idle" | "funding" | "done" | "error";

export function WelcomeBonus() {
  const wallet = useWallet();
  const stellar = useSeyfStellarWallet();
  const kyc = useKycStatus();

  // --- CETES bonus state ---
  const [cetesStatus, setCetesStatus] = useState<CetesStatus>("idle");
  const [cetesError, setCetesError] = useState<string | null>(null);
  const [cetesClaimed, setCetesClaimed] = useState<boolean | null>(null);
  const cetesStarted = useRef(false);

  // --- Friendbot bonus state ---
  const [fbStatus, setFbStatus] = useState<FriendbotStatus>("idle");
  const [fbError, setFbError] = useState<string | null>(null);
  const [fbXlm, setFbXlm] = useState<number | null>(null);
  const fbClaimed = fbXlm !== null && fbXlm >= 1;

  const address = wallet.address ?? stellar.publicKey ?? null;
  const pk = stellar.publicKey ?? null;

  useEffect(() => {
    let active = true;
    (async () => {
      if (!address) { setCetesClaimed(null); return; }
      const done = await store.getBonus(address);
      if (active) setCetesClaimed(done);
    })();
    return () => { active = false; };
  }, [address]);

  // Checa saldo XLM on-chain
  const checkXlm = useCallback(async () => {
    if (!pk) { setFbXlm(null); return; }
    const horizonBase = "https://horizon-testnet.stellar.org";
    try {
      const res = await fetch(`${horizonBase}/accounts/${pk}`);
      if (res.ok) {
        const data = await res.json();
        const native = (data.balances as Array<{ asset_type: string; balance: string }>)
          ?.find((b) => b.asset_type === "native");
        setFbXlm(native ? Number(native.balance) : 0);
      } else {
        setFbXlm(null);
      }
    } catch { setFbXlm(null); }
  }, [pk]);

  useEffect(() => { void checkXlm(); }, [checkXlm]);

  // --- CETES claim ---
  const claimCetes = useCallback(async () => {
    if (!address || !pk || cetesStarted.current) return;
    cetesStarted.current = true;
    setCetesStatus("quoting");
    setCetesError(null);

    try {
      const quoteRes = await fetch("/api/seyf/etherfuse/quote/onramp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceAmount: String(BONUS_AMOUNT), wallet: pk }),
      });
      const quoteData = await quoteRes.json();
      if (!quoteRes.ok) {
        throw new Error(quoteData?.error?.message_es ?? quoteData?.error ?? "No se pudo cotizar el bono");
      }
      const quoteId = quoteData?.quote?.quoteId ?? quoteData?.quote?.quote_id;
      if (!quoteId) throw new Error("Etherfuse no devolvió quoteId");

      setCetesStatus("ordering");

      const orderRes = await fetch("/api/seyf/etherfuse/order/onramp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, wallet: pk }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        const msg = orderData?.error?.message_es ?? orderData?.error ?? "No se pudo crear la orden";
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }

      await store.setBonus(address, BONUS_AMOUNT, orderData?.orderId);
      setCetesClaimed(true);
      setCetesStatus("done");
    } catch (e) {
      setCetesError(e instanceof Error ? e.message : "No se pudo reclamar el bono");
      setCetesStatus("error");
      cetesStarted.current = false;
    }
  }, [address, pk]);

  // --- Friendbot claim ---
  const claimFriendbot = useCallback(async () => {
    if (!pk) return;
    setFbStatus("funding");
    setFbError(null);
    try {
      const result = await fundStellarWallet(pk);
      if (!result.ok) throw new Error(result.error);
      // Refrescar saldo para que se muestre "activado"
      await checkXlm();
      setFbStatus("done");
    } catch (e) {
      setFbError(e instanceof Error ? e.message : "No se pudo fondear");
      setFbStatus("error");
    }
  }, [pk, checkXlm]);

  const canClaimCetes =
    wallet.enabled &&
    wallet.authenticated &&
    stellar.enabled &&
    stellar.authenticated &&
    !!pk &&
    kyc.enabled &&
    !kyc.loading &&
    kyc.verified &&
    cetesClaimed === false;

  // Mostrar sección si hay stellar autenticado O wallet autenticado
  const hasAuth = (stellar.enabled && stellar.authenticated && !!pk) || wallet.authenticated;
  if (!hasAuth) return null;

  return (
    <>
      <p className="eyebrow" style={{ margin: "26px 0 12px" }}>Bonos de bienvenida</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* ── Bono CETES $300 ── */}
        {cetesClaimed ? (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{
              width: 44, height: 44, borderRadius: 13, flexShrink: 0,
              background: "var(--accent-soft)", color: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="check" size={22} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>$300 CETES activado</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.4 }}>
                Se depositaron $300 MXN en CETES a tu bóveda.
              </p>
            </div>
            {/* Prueba: reactivar aunque ya esté reclamado (vuelve a correr el onramp Etherfuse). */}
            <button
              onClick={() => { cetesStarted.current = false; void claimCetes(); }}
              disabled={cetesStatus !== "idle"}
              style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 10, background: "var(--surface-2)", color: "var(--txt-muted)", border: "1px solid var(--line)", fontWeight: 700, fontSize: 12, cursor: cetesStatus === "idle" ? "pointer" : "default" }}
            >
              Reactivar
            </button>
          </div>
        ) : canClaimCetes ? (
          <div className="card" style={{
            display: "flex", alignItems: "center", gap: 14,
            border: "1px solid var(--accent)", background: "var(--accent-soft)",
          }}>
            <span style={{
              width: 44, height: 44, borderRadius: 13, flexShrink: 0,
              background: "var(--accent)", color: "var(--on-accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="leaf" size={22} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>$300 en CETES gratis</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.4 }}>
                Sin costo. Se depositan en tu bóveda de ahorro.
              </p>
            </div>
            <button
              onClick={claimCetes}
              disabled={cetesStatus !== "idle"}
              style={{
                flexShrink: 0, padding: "9px 18px", borderRadius: 11,
                background: "var(--accent)", color: "var(--on-accent)",
                border: "none", fontWeight: 800, fontSize: 13,
                cursor: cetesStatus === "idle" ? "pointer" : "default",
                opacity: cetesStatus === "idle" ? 1 : 0.6,
              }}
            >
              Activar
            </button>
          </div>
        ) : cetesClaimed === false ? (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, opacity: 0.7 }}>
            <span style={{
              width: 44, height: 44, borderRadius: 13, flexShrink: 0,
              background: "var(--surface-2)", border: "1px solid var(--line)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon name="lock" size={20} color="var(--txt-muted)" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>$300 en CETES gratis</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.4 }}>
                Verifica tu identidad para activar este bono.
              </p>
            </div>
          </div>
        ) : null}

        {/* ── Bono Friendbot (XLM testnet) ── */}
        {stellar.enabled && stellar.authenticated && pk && (
          fbClaimed ? (
            <div className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{
                width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                background: "rgba(99,102,241,.12)", color: "#6366f1",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name="check" size={22} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>10,000 XLM activado</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.4 }}>
                  Tu wallet fue fondeada con XLM de testnet para operar.
                </p>
              </div>
              {/* Prueba: reintenta el fondeo Friendbot (idempotente; no re-crea cuentas ya existentes). */}
              <button
                onClick={() => void claimFriendbot()}
                disabled={fbStatus === "funding"}
                style={{ flexShrink: 0, padding: "7px 12px", borderRadius: 10, background: "var(--surface-2)", color: "var(--txt-muted)", border: "1px solid var(--line)", fontWeight: 700, fontSize: 12, cursor: fbStatus === "funding" ? "default" : "pointer" }}
              >
                {fbStatus === "funding" ? <span className="spin" style={{ width: 14, height: 14 }} /> : "Reactivar"}
              </button>
            </div>
          ) : (
            <div className="card" style={{
              display: "flex", alignItems: "center", gap: 14,
              border: "1px solid rgba(99,102,241,.3)", background: "rgba(99,102,241,.06)",
            }}>
              <span style={{
                width: 44, height: 44, borderRadius: 13, flexShrink: 0,
                background: "#6366f1", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name="globe" size={22} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>10,000 XLM gratis</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.4 }}>
                  Fondea tu wallet Stellar para operar en testnet.
                </p>
              </div>
              <button
                onClick={claimFriendbot}
                disabled={fbStatus === "funding"}
                style={{
                  flexShrink: 0, padding: "9px 18px", borderRadius: 11,
                  background: "#6366f1", color: "#fff",
                  border: "none", fontWeight: 800, fontSize: 13,
                  cursor: fbStatus === "funding" ? "default" : "pointer",
                  opacity: fbStatus === "funding" ? 0.6 : 1,
                }}
              >
                {fbStatus === "funding" ? <span className="spin" style={{ width: 16, height: 16 }} /> : "Activar"}
              </button>
            </div>
          )
        )}

        {fbStatus === "error" && fbError && (
          <div className="card" style={{ borderColor: "var(--neg)", display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="info" size={16} color="var(--neg)" />
            <p style={{ margin: 0, fontSize: 12, color: "var(--neg)" }}>{fbError}</p>
            <button
              className="btn btn-ghost"
              style={{ marginLeft: "auto", fontSize: 12, padding: "4px 10px" }}
              onClick={() => { setFbStatus("idle"); setFbError(null); }}
            >
              Reintentar
            </button>
          </div>
        )}
      </div>

      {/* ── Modal CETES ── */}
      {cetesStatus !== "idle" && cetesStatus !== "done" && (
        <Portal><div className="modal-overlay" onClick={() => cetesStatus === "error" && setCetesStatus("idle")}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", paddingBottom: 30 }}>
            <div className="modal-grab" />

            {(cetesStatus === "quoting" || cetesStatus === "ordering" || cetesStatus === "processing") && (
              <>
                <div className="logo-mark brand" style={{ margin: "8px auto 18px", background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <Icon name="leaf" size={26} />
                </div>
                <p className="modal-title" style={{ textAlign: "center" }}>
                  {cetesStatus === "quoting" ? "Preparando tu bono…" : cetesStatus === "ordering" ? "Creando orden…" : "Procesando tu bono"}
                </p>
                <p className="modal-sub" style={{ textAlign: "center" }}>
                  {cetesStatus === "quoting"
                    ? "Cotizando $300 MXN en CETES para tu bóveda."
                    : cetesStatus === "ordering"
                      ? "Reservando tus CETES."
                      : "Tus CETES se están depositando en tu bóveda de ahorro."}
                </p>
                <div style={{ display: "flex", justifyContent: "center", margin: "20px 0 4px" }}>
                  <span className="spin" style={{ width: 26, height: 26, color: "var(--accent)" }} />
                </div>
              </>
            )}

            {cetesStatus === "error" && (
              <>
                <div style={{ fontSize: 44, margin: "6px 0 4px" }}>⚠️</div>
                <p className="modal-title" style={{ textAlign: "center" }}>No se pudo activar</p>
                <div className="alert alert-error" style={{ textAlign: "left" }}>{cetesError}</div>
                <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={() => { setCetesStatus("idle"); cetesStarted.current = false; }}>Cerrar</button>
              </>
            )}
          </div>
        </div></Portal>
      )}

      {cetesStatus === "done" && (
        <Portal><div className="modal-overlay" onClick={() => setCetesStatus("idle")}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", paddingBottom: 30 }}>
            <div className="modal-grab" />
            <div style={{ fontSize: 52, margin: "6px 0 4px" }}>🎉</div>
            <p className="modal-title" style={{ textAlign: "center" }}>¡Bono activado!</p>
            <p className="modal-sub" style={{ textAlign: "center" }}>
              <b style={{ color: "var(--accent)" }}>$300 MXN</b> en CETES se depositarán a tu bóveda de ahorro.
            </p>
            <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => setCetesStatus("idle")}>Listo</button>
          </div>
        </div></Portal>
      )}
    </>
  );
}
