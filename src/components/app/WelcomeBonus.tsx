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
/** Tasa CETES anual aproximada — solo para el proyectado visual del simulador. */
const CETES_ANNUAL_RATE = 0.102;
/** Etapas visuales del simulador de depósito de CETES. */
const CETES_STAGES = [
  { icon: "bank", title: "Depositando por SPEI", detail: "Recibiendo $300.00 MXN a tu CLABE" },
  { icon: "leaf", title: "Comprando CETES", detail: "Bonos soberanos · tasa ~10.2% anual" },
  { icon: "vault", title: "Depositando en tu bóveda", detail: "Acreditando en tu ahorro" },
] as const;
type CetesStatus = "idle" | "simulating" | "done" | "error";
type FriendbotStatus = "idle" | "funding" | "done" | "error";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function WelcomeBonus() {
  const wallet = useWallet();
  const stellar = useSeyfStellarWallet();
  const kyc = useKycStatus();

  // --- CETES bonus state ---
  const [cetesStatus, setCetesStatus] = useState<CetesStatus>("idle");
  const [cetesError, setCetesError] = useState<string | null>(null);
  const [cetesClaimed, setCetesClaimed] = useState<boolean | null>(null);
  // Etapa actual del simulador (0..CETES_STAGES.length). Igual a N = las N primeras completadas.
  const [cetesStep, setCetesStep] = useState(0);
  const cetesStarted = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

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

  // --- Onramp real de Etherfuse (best-effort, corre en segundo plano) ---
  // Devuelve el orderId si tuvo éxito; no lanza — la simulación no depende de esto.
  const runRealOnramp = useCallback(async (walletPk: string): Promise<string | undefined> => {
    try {
      const quoteRes = await fetch("/api/seyf/etherfuse/quote/onramp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceAmount: String(BONUS_AMOUNT), wallet: walletPk }),
      });
      const quoteData = await quoteRes.json();
      if (!quoteRes.ok) throw new Error(quoteData?.error?.message_es ?? "quote falló");
      const quoteId = quoteData?.quote?.quoteId ?? quoteData?.quote?.quote_id;
      if (!quoteId) throw new Error("sin quoteId");

      const orderRes = await fetch("/api/seyf/etherfuse/order/onramp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId, wallet: walletPk }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData?.error?.message_es ?? "order falló");
      return orderData?.orderId;
    } catch (e) {
      console.warn("[bono-cetes] onramp real no completó (la simulación continúa):", e);
      return undefined;
    }
  }, []);

  // --- CETES claim: simulación visual por etapas + onramp real de fondo ---
  const claimCetes = useCallback(async () => {
    if (!address || cetesStarted.current) return;
    cetesStarted.current = true;
    setCetesError(null);
    setCetesStep(0);
    setCetesStatus("simulating");

    // Dispara la compra real de Etherfuse en segundo plano (no bloquea la animación).
    const realOrderPromise = pk ? runRealOnramp(pk) : Promise.resolve<string | undefined>(undefined);

    try {
      // Recorre las etapas con un ritmo agradable. cetesStep = índice de la etapa
      // activa; una etapa i queda "completada" cuando cetesStep > i.
      await wait(450);
      for (let i = 0; i < CETES_STAGES.length; i++) {
        if (!mountedRef.current) return;
        setCetesStep(i);
        await wait(i === CETES_STAGES.length - 1 ? 900 : 1250);
      }
      if (!mountedRef.current) return;
      setCetesStep(CETES_STAGES.length); // todas completadas
      await wait(500);

      const orderId = await realOrderPromise; // ya suele estar resuelta; best-effort
      await store.setBonus(address, BONUS_AMOUNT, orderId);
      if (!mountedRef.current) return;
      setCetesClaimed(true);
      setCetesStatus("done");
    } catch (e) {
      if (!mountedRef.current) return;
      setCetesError(e instanceof Error ? e.message : "No se pudo activar el bono");
      setCetesStatus("error");
    } finally {
      cetesStarted.current = false;
    }
  }, [address, pk, runRealOnramp]);

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

      {/* ── Modal CETES: simulador por etapas ── */}
      {cetesStatus === "simulating" && (
        <Portal><div className="modal-overlay">
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 26 }}>
            <div className="modal-grab" />

            {/* Hero: monto → CETES con barra de progreso */}
            <div style={{
              position: "relative", overflow: "hidden",
              borderRadius: 18, padding: "20px 18px",
              background: "linear-gradient(135deg, var(--accent-soft), color-mix(in srgb, var(--accent) 12%, transparent))",
              border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--txt-muted)" }}>Depósito simulado</p>
                  <p className="num" style={{ margin: "3px 0 0", fontSize: 30, fontWeight: 900, lineHeight: 1 }}>$300<span style={{ fontSize: 16, opacity: .7 }}>.00</span></p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>MXN → CETES</p>
                </div>
                <span style={{
                  width: 52, height: 52, borderRadius: 15, flexShrink: 0,
                  background: "var(--accent)", color: "var(--on-accent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon name="leaf" size={26} />
                </span>
              </div>
              {/* barra de progreso */}
              <div style={{ marginTop: 16, height: 6, borderRadius: 999, background: "color-mix(in srgb, var(--accent) 18%, transparent)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 999, background: "var(--accent)",
                  width: `${Math.min(100, (cetesStep / CETES_STAGES.length) * 100)}%`,
                  transition: "width .6s cubic-bezier(.4,0,.2,1)",
                }} />
              </div>
            </div>

            {/* Etapas */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
              {CETES_STAGES.map((stage, i) => {
                const done = cetesStep > i;
                const active = cetesStep === i;
                return (
                  <div key={stage.icon} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "11px 12px", borderRadius: 13,
                    background: active ? "var(--accent-soft)" : "var(--surface-2)",
                    border: `1px solid ${active ? "color-mix(in srgb, var(--accent) 34%, transparent)" : "var(--line)"}`,
                    opacity: done || active ? 1 : 0.5,
                    transition: "all .35s ease",
                  }}>
                    <span style={{
                      width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: done ? "var(--accent)" : active ? "var(--accent-soft)" : "var(--surface)",
                      color: done ? "var(--on-accent)" : "var(--accent)",
                      border: done ? "none" : "1px solid var(--line)",
                    }}>
                      {done ? <Icon name="check" size={18} />
                        : active ? <span className="spin" style={{ width: 16, height: 16, color: "var(--accent)" }} />
                        : <Icon name={stage.icon} size={17} color="var(--txt-muted)" />}
                    </span>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: done || active ? "var(--txt)" : "var(--txt-muted)" }}>{stage.title}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--txt-muted)", lineHeight: 1.35 }}>{stage.detail}</p>
                    </div>
                    {done && <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: "var(--accent)" }}>Listo</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div></Portal>
      )}

      {cetesStatus === "error" && (
        <Portal><div className="modal-overlay" onClick={() => setCetesStatus("idle")}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ textAlign: "center", paddingBottom: 30 }}>
            <div className="modal-grab" />
            <div style={{ fontSize: 44, margin: "6px 0 4px" }}>⚠️</div>
            <p className="modal-title" style={{ textAlign: "center" }}>No se pudo activar</p>
            <div className="alert alert-error" style={{ textAlign: "left" }}>{cetesError}</div>
            <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={() => { setCetesStatus("idle"); cetesStarted.current = false; }}>Cerrar</button>
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
              Se depositaron <b style={{ color: "var(--accent)" }}>$300.00 MXN</b> en CETES a tu bóveda de ahorro.
            </p>
            {/* Proyectado anual atractivo */}
            <div style={{
              margin: "16px 0 0", padding: "13px 16px", borderRadius: 14,
              background: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 26%, transparent)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <Icon name="trend" size={16} color="var(--accent)" />
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>
                Ganarás ~<b className="num" style={{ color: "var(--accent)" }}>${(BONUS_AMOUNT * CETES_ANNUAL_RATE).toFixed(2)}</b> al año <span style={{ opacity: .7 }}>(~10.2%)</span>
              </span>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => setCetesStatus("idle")}>Listo</button>
          </div>
        </div></Portal>
      )}
    </>
  );
}
