"use client";

/* UTONOMA — pantallas core: Onboarding, Home, Wallet (wired a Juno) */
import React, { useEffect, useState } from "react";
import { Icon, Spark, Flag } from "../ui";
import { TopBar, SubHeader, TxnRow, PendingTxnRow, ConvTxnRow } from "../shared";
import { TXNS, FMT, type Txn } from "../data";
import type { Go } from "../nav";
import { useWallet } from "@/components/wallet/WalletContext";
import { useOnchainTxns } from "@/hooks/useOnchain";
import { usePendingTxns } from "@/hooks/usePendingTxns";
import { useConversions, type Conversion } from "@/hooks/useConversions";
import { assetByCode } from "@/lib/bitso/assets";
import { useVaultsRail } from "@/hooks/useVaultsRail";
import { useKycStatus } from "@/hooks/useKycStatus";
import type { OnchainTransfer } from "@/lib/chain";
import { DepositModal } from "../modals/DepositModal";
import { SendModal } from "../modals/SendModal";
import { MoreSheet } from "../modals/MoreSheet";
import { WelcomeBonus } from "../WelcomeBonus";
import { OnboardingQuiz } from "../RiskQuiz";
import { LiquidityAdvanceModal } from "../LiquidityAdvanceModal";
import { loadRiskProfile, planById } from "../data";
import { Portal } from "../Portal";
import { ClabeCard } from "../ClabeCard";
import { ProjectionCard } from "../ProjectionCard";
import { GrowingAmount } from "../GrowingAmount";
import { motion } from "motion/react";
import { SeyfWordmark } from "@/components/brand/SeyfLogo";
import { OnboardingHero } from "../OnboardingHero";
import { CurrencyTicker } from "../CurrencyTicker";
import { SEYF_VAULTS_ADDRESS, SEYF_ADVANCE_ADDRESS } from "@/lib/chain";
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";
import { STELLAR_VAULTS_ENABLED } from "@/lib/defindex/vaults";

/* ---------------- ONBOARDING ---------------- */
const ONB_EASE = [0.22, 1, 0.36, 1] as const;
// Fases: 0 = Hero, 1 = Quiz de perfil (5 preguntas full-screen)
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState(0);

  if (phase === 0) {
    const feats: { ic: string; tx: string }[] = [
      { ic: "globe", tx: "Bonos soberanos de 7 países en un toque" },
      { ic: "bolt", tx: "Adelanta tu rendimiento cuando lo necesites" },
      { ic: "shield", tx: "0% de comisión · retira al instante" },
    ];
    return (
      <div className="onb screen-enter" style={{ paddingTop: 40, overflowY: "auto" }}>
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: ONB_EASE }}>
          <SeyfWordmark height={30} />
        </motion.div>
        <div className="onb-hero" style={{ justifyContent: "center", gap: 22 }}>
          <div>
            <motion.h1 style={{ fontSize: 44, lineHeight: 1.03 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.05, ease: ONB_EASE }}>
              Tu dinero rinde el <em>doble que tu Afore</em>.
            </motion.h1>
            <motion.p className="sub" style={{ fontSize: 16.5 }} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.13, ease: ONB_EASE }}>
              Ahorra en bonos soberanos de México y el mundo. Liquidez sin penalización y 0% de comisión sobre tu saldo.
            </motion.p>
          </div>

          <OnboardingHero />

          {/* Ticker de bonos soberanos por país (banda a ancho completo) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9, ease: ONB_EASE }}
            style={{ marginInline: -28 }}
          >
            <p className="eyebrow" style={{ textAlign: "center", marginBottom: 10 }}>Bonos soberanos del mundo</p>
            <CurrencyTicker />
          </motion.div>

          <div>
            {feats.map((f, i) => (
              <motion.div
                key={f.ic}
                className="feat"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 1.2 + i * 0.1, ease: ONB_EASE }}
              >
                <span className="tk"><Icon name={f.ic} size={15} /></span>
                <span className="tx">{f.tx}</span>
              </motion.div>
            ))}
          </div>
        </div>
        <motion.div
          style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 28, paddingTop: 4 }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: ONB_EASE }}
        >
          <button className="btn btn-primary" onClick={() => setPhase(1)}>Comenzar gratis</button>
          <button className="btn btn-ghost" onClick={onDone}>Ya tengo cuenta</button>
        </motion.div>
      </div>
    );
  }

  // Fase 1: quiz full-screen — al terminar llama a onDone (trigger login)
  return <OnboardingQuiz onDone={onDone} />;
}


/* Metadatos de presentación de los activos de la wallet Stellar (sin jerga de protocolo). */
const STELLAR_ASSET_INFO: Record<string, { name: string; icon: string; color: string }> = {
  XLM: { name: "Stellar Lumens", icon: "star", color: "var(--accent)" },
  CETES: { name: "Bonos CETES", icon: "shield", color: "#5BD6C0" },
  USDC: { name: "USD Coin", icon: "globe", color: "#7C9EFF" },
};

/** Avatar redondo del activo Stellar, del mismo tamaño que las banderas de divisas. */
function StellarAssetAvatar({ code }: { code: string }) {
  if (code === "XLM") {
    return (
      <span className="flag sm" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0e14" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
          <path d="M12 3l2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17.8 6.4 20l1.2-6.2L3 9.5l6.3-.8L12 3z" fill="var(--accent)" />
        </svg>
      </span>
    );
  }
  const info = STELLAR_ASSET_INFO[code];
  if (info) {
    return (
      <span className="flag sm" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-3)", color: info.color }}>
        <Icon name={info.icon} size={14} color={info.color} />
      </span>
    );
  }
  return (
    <span className="flag sm" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-3)", color: "var(--txt-muted)", fontWeight: 800, fontSize: 8.5 }}>
      {code.slice(0, 3)}
    </span>
  );
}

const stellarAssetName = (code: string): string => STELLAR_ASSET_INFO[code]?.name ?? code;

/* ---------------- HOME (patrimonio + balance MXNB en vivo) ---------------- */
export function ScreenHome({ go }: { go: Go }) {
  const [hide, setHide] = useState(false);
  const [modal, setModal] = useState<null | "deposit" | "send" | "advance" | "more">(null);
  const wallet = useWallet();
  const stellar = useSeyfStellarWallet();
  const homeTxns = useOnchainTxns(wallet.address);
  const pend = usePendingTxns(wallet.address);
  const conv = useConversions(wallet.address);
  // Riel correcto (Stellar/DeFindex o EVM) para que "En bóveda" del home coincida
  // con el saldo real reconciliado de la pantalla de Ahorro (mismo hook, misma fuente).
  const { vaults, totalSaved, onchain } = useVaultsRail(wallet.address);
  const kyc = useKycStatus();
  const refreshBal = wallet.refreshBalance;

  // Rendimiento promedio ponderado del ahorro (para el adelanto de liquidez).
  const weightedApy = totalSaved > 0 ? vaults.reduce((s, v) => s + v.bal * v.apy, 0) / totalSaved : 10.5;

  // APY del perfil de riesgo asignado (para la proyección).
  const profileApy = (() => {
    const id = loadRiskProfile();
    if (id) { try { return planById(id).apy; } catch {} }
    return weightedApy;
  })();

  // Retira pendientes ya confirmados on-chain.
  useEffect(() => {
    pend.reconcile(homeTxns.txns);
  }, [homeTxns.txns, pend.reconcile]);

  // Saldo XLM (gas Stellar / DeFindex) en la wallet Pollar.
  useEffect(() => {
    if (stellar.authenticated && stellar.publicKey) {
      void stellar.refreshBalance();
    }
  }, [stellar.authenticated, stellar.publicKey]);

  const realData = wallet.enabled && wallet.authenticated;
  const showStellarAssets = STELLAR_VAULTS_ENABLED && stellar.enabled && stellar.authenticated;
  // Todos los activos de la wallet Stellar con saldo (XLM, CETES, USDC, …).
  const stellarAssets = showStellarAssets
    ? stellar.assetBalances
        .map((b) => ({ code: (b.code || "").toUpperCase(), bal: Number(b.balance ?? 0) }))
        .filter((a) => a.code && a.bal > 0)
    : [];
  // Spot: saldo MXNB on-chain. Las bóvedas se muestran en la pantalla de Ahorro.
  const pesos = realData ? wallet.balance : 48250.4;
  // Patrimonio = un solo dinero en dos estados: Disponible (líquido, no rinde) +
  // En bóveda (invertido, rinde). Co-denominados en MXN, por eso se suman aquí;
  // las divisas/activos Stellar viven aparte en "Otros activos" (otras unidades).
  const hasVault = totalSaved > 0;
  const patrimonio = pesos + totalSaved;
  // Solo la porción invertida rinde → tasa efectiva sobre el patrimonio total,
  // para que el número crezca en vivo a la velocidad real (no a la de la bóveda).
  const blendedApy = hasVault && patrimonio > 0 ? (weightedApy * totalSaved) / patrimonio : 0;
  // vaultId numérico para el adelanto (solo válido en modo on-chain).
  // Adelanto: es POR bóveda. Desde Home el usuario no está posicionado en ninguna,
  // así que solo adelantamos directo si hay UNA sola bóveda (no ambiguo). Con varias,
  // lo mandamos a Ahorro a elegir/posicionarse en una y adelantar desde su detalle.
  const advanceVault = onchain && vaults.length === 1 ? vaults[0] : undefined;
  const advanceVaultId = advanceVault ? parseInt(advanceVault.id) : undefined;
  const onAdvance = () => {
    if (onchain && vaults.length > 1) {
      go("bovedas"); // varias bóvedas → elige en cuál posicionarte
    } else {
      setModal("advance"); // 0 o 1 bóveda → modal directo (maneja el caso sin ahorro)
    }
  };

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <TopBar go={go} />
      <div className="screen-pad">

        {/* ── 1. HERO: balance + quick row ── */}
        <div className="card glow" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p className="eyebrow">{hasVault ? "Patrimonio total" : "Saldo disponible · MXN"}</p>
            <button className="icon-btn" style={{ width: 24, height: 24, background: "none", border: "none" }} onClick={() => setHide(!hide)}>
              <Icon name="eye" size={16} color="var(--txt-dim)" />
            </button>
          </div>
          {hide ? (
            <p style={{
              marginTop: 14, fontSize: 56, fontWeight: 800, letterSpacing: "-0.03em",
              fontFamily: "var(--font-display)", lineHeight: 1, color: "var(--txt-muted)",
            }}>
              ••••••
            </p>
          ) : (
            <div style={{ marginTop: 14 }}>
              {/* Número grande = patrimonio (crece a la tasa efectiva). Sin bóveda,
                  es el disponible puro y no crece. Mismo tamaño (56) que Ahorro. */}
              <GrowingAmount base={hasVault ? patrimonio : pesos} apy={blendedApy} size={56} align="left" id="home-patrimonio" />
            </div>
          )}
          {hasVault && !hide && (
            // Split de estados: el mismo dinero, líquido vs. invertido.
            // Lima = Disponible · Violeta = En bóveda (crece en vivo).
            <div style={{ display: "flex", gap: 24, marginTop: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--txt-muted)", fontWeight: 700 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: "var(--accent)" }} /> Disponible
                </span>
                <span className="num" style={{ fontSize: 16, fontWeight: 800 }}>${FMT(pesos, 0)}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--txt-muted)", fontWeight: 700 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: "var(--accent-2)" }} /> En bóveda
                </span>
                <GrowingAmount base={totalSaved} apy={weightedApy} size={16} align="left" color="#c4b5fd" id="home-boveda" />
              </div>
            </div>
          )}

          <div className="quick-row" style={{ marginTop: 18, gap: 6 }}>
            <button className="quick" onClick={() => setModal("deposit")}><span className="ic"><Icon name="plus" /></span><span className="tx">Agregar</span></button>
            <button className="quick" onClick={() => setModal("send")}><span className="ic"><Icon name="send" /></span><span className="tx">Enviar</span></button>
            <button className="quick" onClick={onAdvance}><span className="ic"><Icon name="bolt" /></span><span className="tx">Adelanto</span></button>
            <button className="quick" onClick={() => setModal("more")}><span className="ic" style={{ fontSize: 20, letterSpacing: 2, fontWeight: 800, lineHeight: 1 }}>···</span><span className="tx">Más</span></button>
          </div>
        </div>

        {/* ── 1a. NUDGE de verificación (no bloquea nada; solo invita) ── */}
        {kyc.enabled && !kyc.loading && !kyc.verified && (
          <div
            className="card"
            onClick={() => go("kyc")}
            style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", background: "var(--accent-soft)", border: "none" }}
          >
            <span style={{ width: 34, height: 34, borderRadius: 999, background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="shield" size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--txt)" }}>Verifica tu cuenta</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.4 }}>
                Desbloquea mayores depósitos y mejores bóvedas de rendimiento.
              </p>
            </div>
            <Icon name="chevR" size={16} color="var(--txt-dim)" />
          </div>
        )}

        {/* ── 1b. OTROS ACTIVOS — saldos líquidos (divisas de conversiones + wallet Stellar).
                Etiquetado "Disponible" para separarlo por ESTADO de "Mi ahorro" (bóvedas). ── */}
        {realData && (Object.keys(conv.balances).length > 0 || stellarAssets.length > 0) && (
          <>
          <div className="sec-head" style={{ marginTop: 22, marginBottom: 8 }}>
            <h3>Disponible en tu wallet</h3>
          </div>
          <div className="card" style={{ padding: "4px 18px" }}>
            {Object.entries(conv.balances).map(([code, bal]) => {
              const a = assetByCode(code);
              return (
                <div className="lrow" key={code} style={{ cursor: "pointer" }} onClick={() => go("convertir")}>
                  <div className="ava" style={{ overflow: "hidden", padding: 0 }}><Flag code={a?.flag || "us"} cls="sm" /></div>
                  <div className="mid"><p className="ti">{code}</p><p className="su">{a?.name || code}</p></div>
                  <div className="amt"><div className="a num">{FMT(bal, a?.dec ?? 2)}</div></div>
                  <Icon name="chevR" size={16} color="var(--txt-dim)" />
                </div>
              );
            })}
            {stellarAssets.map((a) => (
              <div className="lrow" key={a.code} style={{ cursor: "default" }}>
                <div className="ava" style={{ overflow: "hidden", padding: 0 }}><StellarAssetAvatar code={a.code} /></div>
                <div className="mid"><p className="ti">{a.code}</p><p className="su">{stellarAssetName(a.code)}</p></div>
                <div className="amt"><div className="a num">{hide ? "••••" : FMT(a.bal, 2)}</div></div>
              </div>
            ))}
          </div>
          </>
        )}

        <WelcomeBonus />

        {/* ── 2. MOVIMIENTOS ── */}
        <div className="sec-head" style={{ marginTop: 22 }}>
          <h3>Movimientos recientes</h3>
          <span className="link" onClick={() => go("wallet")}>Ver todo</span>
        </div>
        <div className="card" style={{ padding: "4px 18px" }}>
          {realData ? (
            pend.pending.length === 0 && conv.conversions.length === 0 && homeTxns.txns.length === 0 ? (
              homeTxns.loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "18px 0" }}>
                  <span className="spin" style={{ color: "var(--accent)" }} />
                </div>
              ) : (
                <p style={{ padding: "16px 4px", fontSize: 13, color: "var(--txt-muted)", textAlign: "center" }}>
                  Aún no tienes movimientos. Agrega fondos para empezar.
                </p>
              )
            ) : (
              <div className="list">
                {pend.pending.map((p) => <PendingTxnRow key={p.id} p={p} />)}
                {mergeRecent(conv.conversions.filter((c) => !pend.pending.some((p) => p.ref === c.id)), homeTxns.txns, go, 3)}
              </div>
            )
          ) : (
            <div className="list">{TXNS.slice(0, 3).map((t) => <TxnRow key={t.id} t={t} go={go} />)}</div>
          )}
        </div>

        {/* ── 3. AHORRO — solo si tiene bóveda activa ── */}
        {totalSaved > 0 && (
          <>
            <div className="sec-head" style={{ marginTop: 22 }}><h3>Mi ahorro</h3></div>
            <div className="card" style={{ padding: "6px 18px" }}>
              <AcctRow go={go} to="bovedas" ic="vault" nm="Bóveda de retiro" su={`${FMT(weightedApy, 1)}% anual`} vl={totalSaved} series={[30, 32, 31, 34, 36, 38, 37, 40]} />
            </div>
          </>
        )}

        {/* ── 4. PROYECCIÓN — hasta el fondo, expandida e ilustrativa. Se coloca al
              final (y separada de "Mi ahorro") para no confundirse con un saldo de bóveda. ── */}
        <div className="sec-head" style={{ marginTop: 26 }}><h3>Proyección a futuro</h3></div>
        <ProjectionCard current={totalSaved} apy={profileApy} defaultOpen />

      </div>
      <div className="scroll-bottom" />

      {modal === "deposit" && <Portal><DepositModal onClose={() => setModal(null)} onSuccess={() => { refreshBal(); homeTxns.refresh(); if (stellar.authenticated) void stellar.refreshBalance(); }} /></Portal>}
      {modal === "send" && <Portal><SendModal onClose={() => setModal(null)} onSuccess={() => { refreshBal(); homeTxns.refresh(); if (stellar.authenticated) void stellar.refreshBalance(); }} maxAmount={realData ? wallet.balance : undefined} /></Portal>}
      {modal === "advance" && (
        <Portal>
          <LiquidityAdvanceModal
            saved={advanceVault?.bal ?? 0}
            apy={advanceVault?.apy ?? weightedApy}
            vaultId={advanceVaultId}
            onClose={() => setModal(null)}
          />
        </Portal>
      )}
      {modal === "more" && <Portal><MoreSheet onClose={() => setModal(null)} /></Portal>}
    </div>
  );
}

function AcctRow({ go, to, ic, nm, su, vl, series }: { go: Go; to: Parameters<Go>[0]; ic: string; nm: string; su: string; vl: number; series: number[] }) {
  return (
    <div className="lrow" onClick={() => go(to)}>
      {/* Violeta = en bóveda (invertido), convención de estado en toda la app. */}
      <div className="ava"><Icon name={ic} size={20} color="var(--accent-2)" /></div>
      <div className="mid"><p className="ti">{nm}</p><p className="su">{su}</p></div>
      <Spark data={series} w={56} h={26} color="var(--accent-2)" fillArea />
      <div className="amt" style={{ marginLeft: 8 }}><div className="a num">${FMT(vl, 0)}</div></div>
      <Icon name="chevR" size={16} color="var(--txt-dim)" />
    </div>
  );
}

/* Fusiona conversiones (Bitso) + transferencias on-chain en una lista ordenada
   por fecha (más reciente primero). Las conversiones viven off-chain, por eso
   se intercalan aquí en lugar de venir del feed on-chain. */
function mergeRecent(conversions: Conversion[], onchain: OnchainTransfer[], go?: Go, limit?: number) {
  const rows: { key: string; ts: number; node: React.ReactNode }[] = [
    ...conversions.map((c) => ({ key: c.id, ts: c.createdAt, node: <ConvTxnRow key={c.id} c={c} /> })),
    ...onchain.map((t, i) => ({
      key: `oc_${i}`,
      ts: t.timestamp || 0,
      node: <TxnRow key={`oc_${i}`} t={onchainToRow(t, i)} go={go} />,
    })),
  ];
  rows.sort((a, b) => b.ts - a.ts);
  return (limit != null ? rows.slice(0, limit) : rows).map((r) => r.node);
}

/* ---------------- WALLET (pesos digitales · MXNB on-chain) ---------------- */
/* Clasifica una transferencia MXNB por su contraparte: abono/retiro de bóveda
   (contrato SeyfVaults), adelanto (contrato SeyfAdvance) o envío/recepción
   simple. Cada tipo lleva su propio icono + color (tint). */
function onchainToRow(t: OnchainTransfer, i: number): Txn {
  const pos = t.direction === "in";
  const to = (t.to || "").toLowerCase();
  const from = (t.from || "").toLowerCase();
  const vaults = (SEYF_VAULTS_ADDRESS || "").toLowerCase();
  const advance = (SEYF_ADVANCE_ADDRESS || "").toLowerCase();

  let nm: string, ic: string, tint: Txn["tint"];
  if (advance && (to === advance || from === advance)) {
    nm = "Adelanto de liquidez"; ic = "bolt"; tint = "advance";
  } else if (vaults && to === vaults) {
    nm = "Abono a bóveda"; ic = "vault"; tint = "vault";
  } else if (vaults && from === vaults) {
    nm = "Retiro de bóveda"; ic = "vault"; tint = "vault";
  } else if (pos) {
    nm = "Dinero recibido"; ic = "in"; tint = "pos";
  } else {
    nm = "Dinero enviado"; ic = "send"; tint = "neutral";
  }

  return {
    id: i + 1,
    nm,
    su: t.timestamp
      ? new Date(t.timestamp).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
      : "Confirmando…",
    amt: pos ? t.value : -t.value,
    ic,
    pos,
    tint,
    hash: t.hash,
    fromAddr: t.from,
    toAddr: t.to,
    blockNumber: t.blockNumber.toString(),
  };
}

export function ScreenWallet({ go }: { go: Go }) {
  const wallet = useWallet();
  const { txns: onchainTxns, loading: loadingTxns, refresh: refreshTxns } = useOnchainTxns(wallet.address);
  const pend = usePendingTxns(wallet.address);
  const conv = useConversions(wallet.address);
  const [modal, setModal] = useState<null | "deposit" | "send">(null);

  useEffect(() => {
    pend.reconcile(onchainTxns);
  }, [onchainTxns, pend.reconcile]);

  const realMode = wallet.enabled && wallet.authenticated;
  // Con sesión: saldo real on-chain (aunque sea $0). Sin sesión: saldo demo.
  const loadingBal = wallet.balanceLoading;
  const shown = realMode ? wallet.balance : 48250.4;
  const refreshBal = wallet.refreshBalance;

  const onSuccess = () => { void refreshBal(); void refreshTxns(); };

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title="Pesos digitales" go={go} back="home" />

      <div className="screen-pad">
        <div className="card glow" style={{ padding: 24, textAlign: "center" }}>
          <p className="eyebrow" style={{ textAlign: "center" }}>Saldo disponible</p>
          {loadingBal ? (
            <div className="skel" style={{ height: 48, width: 200, margin: "16px auto 0" }} />
          ) : (
            <div style={{ marginTop: 12 }}>
              {/* Mismo componente y tamaño (56) que Inicio y Ahorro → unificado. */}
              <GrowingAmount base={shown} apy={0} size={56} id="pesos-digitales" />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14 }}>
            <span className="pos-pill"><Icon name="leaf" size={12} /> {realMode ? "Pesos digitales" : "+$12.40 hoy"}</span>
            <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>{realMode ? "Disponible al instante" : "9% anual · pagado diario"}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setModal("deposit")}><Icon name="plus" size={18} /> Agregar</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModal("send")}><Icon name="send" size={18} /> Enviar</button>
        </div>

        {!realMode && (
          <div className="card" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 14, background: "var(--accent-soft)", border: "none" }}>
            <span style={{ width: 44, height: 44, borderRadius: 13, background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="leaf" size={22} />
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: "var(--accent)" }}>Tu saldo trabaja solo</p>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>Has ganado <b className="num" style={{ color: "var(--txt)" }}>$372.18</b> este mes en intereses.</p>
            </div>
          </div>
        )}

        <div className="sec-head" style={{ marginTop: realMode ? 26 : undefined }}><h3>Movimientos</h3><span className="link" onClick={() => onSuccess()}>Actualizar</span></div>
        <div className="card" style={{ padding: "4px 18px" }}>
          {realMode && pend.pending.length === 0 && conv.conversions.length === 0 && loadingTxns && onchainTxns.length === 0 ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "18px 0" }}><span className="spin" style={{ color: "var(--accent)" }} /></div>
          ) : realMode && pend.pending.length === 0 && conv.conversions.length === 0 && onchainTxns.length === 0 ? (
            <p style={{ padding: "16px 4px", fontSize: 13, color: "var(--txt-muted)", textAlign: "center" }}>Aún no tienes movimientos.</p>
          ) : (
            <div className="list">
              {realMode && pend.pending.map((p) => <PendingTxnRow key={p.id} p={p} />)}
              {realMode
                ? mergeRecent(conv.conversions.filter((c) => !pend.pending.some((p) => p.ref === c.id)), onchainTxns, go)
                : TXNS.map((t) => <TxnRow key={t.id} t={t} go={go} />)}
            </div>
          )}
        </div>
      </div>
      <div className="scroll-bottom" />

      {modal === "deposit" && <Portal><DepositModal onClose={() => setModal(null)} onSuccess={onSuccess} /></Portal>}
      {modal === "send" && <Portal><SendModal onClose={() => setModal(null)} onSuccess={onSuccess} maxAmount={realMode ? wallet.balance : undefined} /></Portal>}
    </div>
  );
}

/* ---------------- PRIMER DEPÓSITO (post-onboarding) ---------------- */

const BANK_STEPS: { bank: string; logo: string; steps: string[] }[] = [
  {
    bank: "BBVA",
    logo: "🔵",
    steps: [
      "Abre la app de BBVA México.",
      "Ve a Transferir → A cuenta CLABE.",
      "Pega tu CLABE de 18 dígitos.",
      "Ingresa el monto y confirma con tu huella o NIP.",
    ],
  },
  {
    bank: "Nu",
    logo: "🟣",
    steps: [
      "Abre la app de Nu.",
      "Toca Transferir → Ingresar CLABE.",
      "Pega tu CLABE y escribe el monto.",
      "Confirma la transferencia.",
    ],
  },
  {
    bank: "Santander",
    logo: "🔴",
    steps: [
      "Abre SuperMóvil de Santander.",
      "Ve a Pagos y Transferencias → SPEI.",
      "Selecciona Nueva cuenta y pega tu CLABE.",
      "Indica el monto y autoriza con Token.",
    ],
  },
  {
    bank: "Banamex",
    logo: "🟠",
    steps: [
      "Abre Citibanamex Móvil.",
      "Ve a Transferencias → A otros bancos (SPEI).",
      "Ingresa la CLABE y el monto.",
      "Confirma con tu contraseña de operaciones.",
    ],
  },
  {
    bank: "HSBC",
    logo: "⬛",
    steps: [
      "Abre la app de HSBC México.",
      "Ve a Pagar y Transferir → Transferencia SPEI.",
      "Pega tu CLABE de 18 dígitos.",
      "Escribe el monto y confirma con tu NIP.",
    ],
  },
];

function BankAccordion() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {BANK_STEPS.map((b) => {
        const isOpen = open === b.bank;
        return (
          <div key={b.bank} className="card" style={{ padding: 0, overflow: "hidden" }}>
            <button
              onClick={() => setOpen(isOpen ? null : b.bank)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", width: "100%", textAlign: "left",
                background: "none", border: "none", cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0 }}>{b.logo}</span>
              <span style={{ flex: 1, fontWeight: 800, fontSize: 15 }}>{b.bank}</span>
              <Icon name={isOpen ? "chevD" : "chevR"} size={16} color="var(--txt-dim)" />
            </button>
            {isOpen && (
              <div style={{ padding: "0 16px 16px" }}>
                <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                  {b.steps.map((s, i) => (
                    <li key={i} style={{ fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>{s}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DepositOnboarding({ onDone }: { onDone: () => void }) {
  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <div className="app-head" style={{ paddingTop: 4 }}>
        <p className="name">Haz tu primer depósito</p>
      </div>
      <div className="screen-pad">
        {/* Hero copy */}
        <div className="card glow" style={{ padding: 20, marginBottom: 18 }}>
          <p className="eyebrow">Tu cuenta está lista</p>
          <p style={{ margin: "10px 0 0", fontSize: 14, color: "var(--txt-muted)", lineHeight: 1.55 }}>
            Transfiere desde cualquier banco mexicano a tu CLABE dedicada.
            Tu dinero se acredita <b style={{ color: "var(--txt)" }}>en minutos</b> y empieza a crecer de inmediato.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: "var(--txt-muted)" }}>
            <Icon name="clock" size={15} color="var(--accent)" />
            <span>El primer depósito puede tardar hasta <b style={{ color: "var(--txt)" }}>15 minutos</b> en reflejarse.</span>
          </div>
        </div>

        {/* CLABE grande */}
        <p className="eyebrow" style={{ marginBottom: 12 }}>Tu CLABE de depósito (SPEI)</p>
        <ClabeCard />

        {/* Monto mínimo */}
        <div className="card" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, background: "var(--accent-2-soft)", border: "none" }}>
          <Icon name="info" size={18} color="var(--accent-2)" />
          <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.4 }}>
            Depósito mínimo: <b style={{ color: "var(--txt)" }}>$500 MXN</b>. Sin comisión.
          </p>
        </div>

        {/* Acordeón por banco */}
        <div className="sec-head" style={{ marginTop: 24 }}>
          <h3>Cómo transferir desde tu banco</h3>
        </div>
        <BankAccordion />

        {/* CTAs */}
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12 }}>
          <button className="btn btn-primary" onClick={onDone}>
            Ya deposité — ir a mi dashboard
          </button>
          <button className="btn btn-ghost" onClick={onDone}>
            Lo haré después
          </button>
        </div>
      </div>
      <div className="scroll-bottom" />
    </div>
  );
}

/* ---------------- DETALLE DE MOVIMIENTO ---------------- */
export function ScreenTxnDetail({ go, ctx }: { go: Go; ctx: unknown }) {
  const t = ctx as (import("../data").Txn | null);

  if (!t) {
    // fallback: sin contexto, volver al inicio
    return (
      <div className="screen screen-enter">
        <div className="safe-top" />
        <SubHeader title="Movimiento" go={go} back="home" />
        <div className="screen-pad" style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 64 }}>
          <p style={{ color: "var(--txt-muted)", fontSize: 14 }}>No hay información disponible.</p>
        </div>
      </div>
    );
  }

  const pos = t.amt > 0;
  const absAmt = Math.abs(t.amt);
  const cur = t.cur || "MXN";

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title="Detalle del movimiento" go={go} back="home" />

      <div className="screen-pad">
        {/* ── Hero: ícono + monto ── */}
        <div className="card glow" style={{ padding: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
          <div style={{
            width: 68, height: 68, borderRadius: 22,
            background: pos ? "var(--accent-soft)" : "var(--surface-2)",
            color: pos ? "var(--accent)" : "var(--txt-muted)",
            border: `1.5px solid ${pos ? "var(--accent)" : "var(--line)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Icon name={t.ic} size={30} />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 18, color: "var(--txt)" }}>{t.nm}</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>{t.su}</p>
          </div>
          <div style={{ lineHeight: 1 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, letterSpacing: "-0.03em" }}>
              <span style={{ fontSize: 22, color: pos ? "var(--accent)" : "var(--neg)", verticalAlign: "top", marginTop: 8, display: "inline-block" }}>
                {pos ? "+" : "−"}$
              </span>
              <span style={{ fontSize: 52, color: pos ? "var(--accent)" : "var(--txt)" }}>
                {FMT(absAmt, 2).split(".")[0]}
              </span>
              <span style={{ fontSize: 28, color: "var(--txt-muted)", fontWeight: 700 }}>
                .{FMT(absAmt, 2).split(".")[1]}
              </span>
              <span style={{ fontSize: 14, color: "var(--txt-muted)", fontWeight: 600, marginLeft: 6, letterSpacing: 0 }}>{cur}</span>
            </span>
          </div>
          {t.sub && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)" }}>{t.sub}</p>
          )}
          <span className={pos ? "pos-pill" : "neg-pill"} style={!pos ? { background: "rgba(255,122,122,.13)", color: "var(--neg)" } : {}}>
            <Icon name="check" size={12} /> Completado
          </span>
        </div>

        {/* ── Información del movimiento ── */}
        {(() => {
          const rows: { label: string; value: string; mono?: boolean }[] = [
            { label: "Tipo", value: pos ? "Entrada" : "Salida" },
            { label: "Divisa", value: cur },
            ...(t.fromAddr ? [{ label: "De", value: shortHex(t.fromAddr), mono: true }] : []),
            ...(t.toAddr ? [{ label: "Para", value: shortHex(t.toAddr), mono: true }] : []),
            ...(t.blockNumber ? [{ label: "Bloque", value: `#${t.blockNumber}`, mono: true }] : []),
          ];
          return (
            <div className="card" style={{ marginTop: 16, padding: "4px 0" }}>
              {rows.map((r, i) => (
                <DetailRow key={r.label} label={r.label} value={r.value} mono={r.mono} last={i === rows.length - 1} />
              ))}
            </div>
          );
        })()}

      </div>
      <div className="scroll-bottom" />
    </div>
  );
}

function DetailRow({ label, value, mono, last }: { label: string; value: string; mono?: boolean; last?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "13px 18px", borderBottom: last ? "none" : "1px solid var(--line)",
    }}>
      <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--txt)", fontFamily: mono ? "var(--font-mono, monospace)" : undefined }}>
        {value}
      </span>
    </div>
  );
}

function shortHex(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : addr;
}
