"use client";

/* UTONOMA — pantallas core: Onboarding, Home, Wallet (wired a Juno) */
import React, { useEffect, useState } from "react";
import { Icon } from "../ui";
import { TopBar, SubHeader, TxnRow, PendingTxnRow, ConvTxnRow } from "../shared";
import { TXNS, FMT, txnDecimals, type Txn } from "../data";
import type { Go } from "../nav";
import { useWallet } from "@/components/wallet/WalletContext";
import { useOnchainTxns } from "@/hooks/useOnchain";
import { usePendingTxns } from "@/hooks/usePendingTxns";
import { useConversions, type Conversion } from "@/hooks/useConversions";
import { useAssetPricesMxn } from "@/hooks/useAssetPricesMxn";
import { useStellarTxns, type StellarOperation } from "@/hooks/useStellarTxns";
import { useVaultsRail } from "@/hooks/useVaultsRail";
import { useKycStatus } from "@/hooks/useKycStatus";
import type { OnchainTransfer } from "@/lib/chain";
import { DepositModal } from "../modals/DepositModal";
import { SendModal } from "../modals/SendModal";
import { MoreSheet } from "../modals/MoreSheet";
import { OnboardingQuiz } from "../RiskQuiz";
import { GrowthBars } from "../SavingsArt";
import { loadRiskProfile, planById } from "../data";
import { Portal } from "../Portal";
import { ClabeCard } from "../ClabeCard";
import { ProjectionCard } from "../ProjectionCard";
import { GrowingAmount } from "../GrowingAmount";
import { IntroScreen } from "../IntroScreen";
import "../onboarding.css";
import { SEYF_VAULTS_ADDRESS, SEYF_ADVANCE_ADDRESS } from "@/lib/chain";
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";
import { stellarTxExplorerUrl as stellarExplorerTxUrl } from "@/lib/etherfuse/stellar-tx-url";
import { STELLAR_VAULTS_ENABLED, assetSymbolForPlan } from "@/lib/defindex/vaults";

/* ---------------- ONBOARDING ---------------- */
// Fases: 0 = Hero, 1 = Quiz de perfil (5 preguntas full-screen)
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState(0);

  if (phase === 0) {
    // Intro animada con el símbolo SEYF; "Comenzar" pasa al quiz, "Ya tengo cuenta" abre el login
    return <IntroScreen onStart={() => setPhase(1)} onLogin={onDone} />;
  }

  // Fase 1: quiz full-screen — al terminar llama a onDone (trigger login)
  return <OnboardingQuiz onDone={onDone} />;
}


/* Metadatos de presentación de los activos de la wallet Stellar (sin jerga de protocolo). */
export const STELLAR_ASSET_INFO: Record<string, { name: string; icon: string; color: string }> = {
  XLM: { name: "Stellar Lumens", icon: "star", color: "var(--accent)" },
  CETES: { name: "Bonos CETES", icon: "shield", color: "#5BD6C0" },
  USDC: { name: "USD Coin", icon: "globe", color: "#7C9EFF" },
};

/** Avatar redondo del activo Stellar, del mismo tamaño que las banderas de divisas. */
export function StellarAssetAvatar({ code }: { code: string }) {
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

export const stellarAssetName = (code: string): string => STELLAR_ASSET_INFO[code]?.name ?? code;

/* ---------------- HOME (patrimonio + balance MXNB en vivo) ---------------- */
export function ScreenHome({ go }: { go: Go }) {
  const [hide, setHide] = useState(false);
  const [modal, setModal] = useState<null | "deposit" | "send" | "more">(null);
  const wallet = useWallet();
  const stellar = useSeyfStellarWallet();
  // Movimientos EVM (MXNB en Arbitrum) ya no aplican: SEYF es full Stellar.
  const homeTxns = useOnchainTxns(undefined);
  const stellarTxns = useStellarTxns(stellar.publicKey ?? undefined);
  const pend = usePendingTxns(wallet.address);
  const conv = useConversions(wallet.address);
  // Riel correcto (Stellar/DeFindex o EVM) para que "En bóveda" del home coincida
  // con el saldo real reconciliado de la pantalla de Ahorro (mismo hook, misma fuente).
  const { vaults, totalSaved } = useVaultsRail(wallet.address);
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

  const realData = wallet.enabled && wallet.authenticated;

  // Al entrar al inicio, fuerza lectura fresca de saldos Stellar (XLM, USDC, CETES…).
  useEffect(() => {
    if (stellar.authenticated) void stellar.refreshBalance();
  }, [stellar.authenticated, stellar.refreshBalance]);
  const showStellarAssets = STELLAR_VAULTS_ENABLED && stellar.enabled && stellar.authenticated;
  // Todos los activos de la wallet Stellar con saldo (XLM, CETES, USDC, …).
  const stellarAssets = showStellarAssets
    ? stellar.assetBalances
        .map((b) => ({ code: (b.code || "").toUpperCase(), bal: Number(b.balance ?? 0) }))
        .filter((a) => a.code && a.bal > 0)
    : [];
  // Precios reales en MXN de TODOS los activos de la wallet Stellar: Bitso (ticker
  // público por book) para cripto/fiat y quote offramp de Etherfuse para CETES.
  // Sin hardcodeo; genérico para cualquier activo → listo para mainnet.
  // Activo de cada bóveda (en mainnet, USDC): su saldo viene en esa unidad, no en MXN.
  const vaultAssets = vaults.map((v) => ({ code: assetSymbolForPlan(v.planId).toUpperCase(), bal: v.bal }));
  const { valueOf: mxnValueOf } = useAssetPricesMxn(
    [...new Set([...stellarAssets.map((a) => a.code), ...vaultAssets.map((a) => a.code)])],
    stellar.publicKey,
  );
  // "En bóveda" en MXN, igual que "Disponible", para poder sumarlos.
  const savedMxn = vaultAssets.reduce((s, a) => s + mxnValueOf(a.code, a.bal), 0);
  const stellarMxn = stellarAssets.reduce((s, a) => s + mxnValueOf(a.code, a.bal), 0);
  // "Disponible" del hero = valor real en MXN de los activos Stellar (no MXNB de Arbitrum).
  const pesos = realData ? stellarMxn : 48250.4;
  // Patrimonio = un solo dinero en dos estados: Disponible (líquido, no rinde) +
  // En bóveda (invertido, rinde). Co-denominados en MXN, por eso se suman aquí;
  // las divisas/activos Stellar viven aparte en "Otros activos" (otras unidades).
  const hasVault = savedMxn > 0;
  const patrimonio = pesos + savedMxn;
  // Solo la porción invertida rinde → tasa efectiva sobre el patrimonio total,
  // para que el número crezca en vivo a la velocidad real (no a la de la bóveda).
  const blendedApy = hasVault && patrimonio > 0 ? (weightedApy * savedMxn) / patrimonio : 0;
  // El adelanto tiene su propia pestaña (vault USDC + `seyf_advance`).
  const onAdvance = () => go("adelanto");

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <TopBar go={go} />
      <div className="screen-pad">

        {/* ── 1. SALDO: grande y sin caja; acciones en píldoras ── */}
        <div className="home-bal">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p className="eyebrow">{hasVault ? "Patrimonio total" : "Saldo disponible · MXN"}</p>
            <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setHide(!hide)} aria-label={hide ? "Mostrar saldo" : "Ocultar saldo"}>
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
              <GrowingAmount base={hasVault ? patrimonio : pesos} apy={blendedApy} size={62} align="left" id="home-patrimonio" />
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
                <GrowingAmount base={savedMxn} apy={weightedApy} size={16} align="left" color="#c4b5fd" id="home-boveda" />
              </div>
            </div>
          )}

          {/* Mismas acciones que antes (mismos handlers), ahora como píldoras. */}
          <div className="pill-row">
            <button className="pill-btn main" onClick={() => setModal("deposit")}><Icon name="plus" size={17} /> Agregar</button>
            <button className="pill-btn" onClick={() => setModal("send")}><Icon name="send" size={16} /> Enviar</button>
            <button className="pill-btn" onClick={onAdvance}><Icon name="bolt" size={16} /> Adelanto</button>
            <button className="pill-btn icon" onClick={() => setModal("more")} aria-label="Más opciones"><span style={{ fontSize: 18, letterSpacing: 1, lineHeight: 1 }}>···</span></button>
          </div>
        </div>

        {/* ── 1a. NUDGE de verificación (no bloquea nada; solo invita) ── */}
        {kyc.enabled && !kyc.loading && !kyc.verified && (
          <div className="nudge" onClick={() => go("kyc")}>
            <span className="ic">
              <Icon name="shield" size={17} />
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

        {/* ── 1b. TU AHORRO — tarjeta sólida con barras de crecimiento animadas.
              Sin ahorro todavía, invita a abrir la primera bóveda. ── */}
        <button type="button" className="save-teaser" onClick={() => go("bovedas")}>
          <div className="st-copy">
            <p className="st-k">Tu ahorro</p>
            {totalSaved > 0 ? (
              <>
                <div style={{ marginTop: 6 }}>
                  <GrowingAmount base={savedMxn} apy={weightedApy} size={26} align="left" color="#fff" id="home-alcancia" />
                </div>
                <p className="st-s">Creciendo ahora mismo, segundo a segundo.</p>
              </>
            ) : (
              <>
                <p className="st-t">Pon a trabajar tu dinero</p>
                <p className="st-s">Abre una bóveda y mira cómo rinde todos los días.</p>
              </>
            )}
            <span className="st-cta">{totalSaved > 0 ? "Ver mi ahorro" : "Empezar a ahorrar"} <Icon name="chevR" size={14} /></span>
          </div>
          <GrowthBars size={96} live={totalSaved > 0} />
        </button>

        {/* ── 1c. OTROS ACTIVOS — saldos líquidos (divisas de conversiones + wallet Stellar).
                Etiquetado "Disponible" para separarlo por ESTADO de "Mi ahorro" (bóvedas). ── */}
        {realData && stellarAssets.length > 0 && (
          <>
          <div className="sec-head" style={{ marginTop: 22, marginBottom: 8 }}>
            <h3>Disponible en tu wallet</h3>
          </div>
          <div className="card" style={{ padding: "4px 18px" }}>
            {/* Solo activos on-chain de Stellar. Cada uno abre su pantalla de detalle. */}
            {stellarAssets.map((a) => (
              <div className="lrow" key={a.code} style={{ cursor: "pointer" }} onClick={() => go("activo", { code: a.code, bal: a.bal })}>
                <div className="ava" style={{ overflow: "hidden", padding: 0 }}><StellarAssetAvatar code={a.code} /></div>
                <div className="mid"><p className="ti">{a.code}</p><p className="su">{stellarAssetName(a.code)}</p></div>
                <div className="amt"><div className="a num">{hide ? "••••" : FMT(a.bal, 2)}</div></div>
                <Icon name="chevR" size={16} color="var(--txt-dim)" />
              </div>
            ))}
          </div>
          </>
        )}


        {/* ── 2. MOVIMIENTOS ── */}
        {/* Hoja de vidrio que "sube" sobre el fondo, como en las referencias */}
        <div className="sheet-panel">
          <div className="sp-grab" />
          <div className="sp-head">
            <h3>Movimientos</h3>
            <button type="button" className="chip" onClick={() => go("wallet")}>Ver todo <Icon name="chevR" size={13} /></button>
          </div>
          <div style={{ marginTop: 6 }}>
          {realData ? (
            pend.pending.length === 0 && conv.conversions.length === 0 && homeTxns.txns.length === 0 && stellarTxns.ops.length === 0 ? (
              (homeTxns.loading || stellarTxns.loading) ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "18px 0" }}>
                  <span className="spin" style={{ color: "var(--accent)" }} />
                </div>
              ) : (
                <div className="empty-v2">
                  <span className="ic"><Icon name="clock" size={22} /></span>
                  <p className="t">Aún no hay movimientos</p>
                  <p className="s">Cuando agregues dinero, aquí verás cada depósito, envío y rendimiento.</p>
                  <button type="button" className="chip" onClick={() => setModal("deposit")}><Icon name="plus" size={13} /> Agregar dinero</button>
                </div>
              )
            ) : (
              <div className="list">
                {pend.pending.map((p) => <PendingTxnRow key={p.id} p={p} />)}
                {mergeRecent(conv.conversions.filter((c) => !pend.pending.some((p) => p.ref === c.id)), homeTxns.txns, stellarTxns.ops, go, 3)}
              </div>
            )
          ) : (
            <div className="list">{TXNS.slice(0, 3).map((t) => <TxnRow key={t.id} t={t} go={go} />)}</div>
          )}
          </div>
        </div>

        {/* ── 4. PROYECCIÓN — hasta el fondo, expandida e ilustrativa. Se coloca al
              final (y separada de "Mi ahorro") para no confundirse con un saldo de bóveda. ── */}
        <div className="sec-head" style={{ marginTop: 26 }}><h3>Proyección a futuro</h3></div>
        <ProjectionCard current={savedMxn} apy={profileApy} />

      </div>
      <div className="scroll-bottom" />

      {modal === "deposit" && <Portal><DepositModal onClose={() => setModal(null)} onGoSavings={() => go("bovedas")} onSuccess={() => { refreshBal(); void stellarTxns.refresh(); if (stellar.authenticated) void stellar.refreshBalanceAfterTx(); }} /></Portal>}
      {modal === "send" && <Portal><SendModal onClose={() => setModal(null)} onSuccess={() => { refreshBal(); homeTxns.refresh(); void stellarTxns.refresh(); if (stellar.authenticated) void stellar.refreshBalanceAfterTx(); }} maxAmount={realData ? wallet.balance : undefined} /></Portal>}
      {modal === "more" && <Portal><MoreSheet onClose={() => setModal(null)} /></Portal>}
    </div>
  );
}

/* Fusiona conversiones (Bitso) + transferencias on-chain (Arbitrum + Stellar)
   en una lista ordenada por fecha (más reciente primero). */
function mergeRecent(
  conversions: Conversion[],
  onchain: OnchainTransfer[],
  stellarOps: StellarOperation[],
  go?: Go,
  limit?: number,
) {
  const rows: { key: string; ts: number; node: React.ReactNode }[] = [
    ...conversions.map((c) => ({ key: c.id, ts: c.createdAt, node: <ConvTxnRow key={c.id} c={c} /> })),
    ...onchain.map((t, i) => ({
      key: `oc_${i}`,
      ts: t.timestamp || 0,
      node: <TxnRow key={`oc_${i}`} t={onchainToRow(t, i)} go={go} />,
    })),
    ...stellarOps.map((op) => ({
      key: `st_${op.id}`,
      ts: op.createdAt,
      node: <TxnRow key={`st_${op.id}`} t={stellarOpToRow(op)} go={go} />,
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

/* Operaciones del vault y del adelanto. El adelanto bloquea las acciones del
   vault; pagarlo o liquidarlo con el rendimiento las desbloquea. */
const CONTRACT_ROWS: Partial<Record<StellarOperation["type"], { nm: string; ic: string; tint: Txn["tint"]; sub?: string }>> = {
  vault_deposit: { nm: "Abono a tu ahorro", ic: "vault", tint: "vault" },
  vault_withdraw: { nm: "Retiro de tu ahorro", ic: "vault", tint: "vault" },
  advance_open: { nm: "Adelanto recibido", ic: "bolt", tint: "advance", sub: "Ahorro bloqueado" },
  advance_repay: { nm: "Adelanto pagado", ic: "bolt", tint: "advance", sub: "Ahorro desbloqueado" },
  advance_settle: { nm: "Adelanto cubierto con rendimiento", ic: "bolt", tint: "advance", sub: "Ahorro desbloqueado" },
};

function stellarOpToRow(op: StellarOperation): Txn {
  const pos = op.direction === "in";
  const isSwap = op.type === "path_payment_strict_send" || op.type === "path_payment_strict_receive";
  const isTrust = op.type === "change_trust";
  const isCreate = op.type === "create_account";
  const contractRow = CONTRACT_ROWS[op.type];

  let nm: string, ic: string, tint: Txn["tint"];
  if (contractRow) {
    ({ nm, ic, tint } = contractRow);
  } else if (isSwap) {
    nm = `${op.sourceAsset ?? "?"} → ${op.asset}`;
    ic = "swap";
    tint = "swap";
  } else if (isTrust) {
    nm = `Trustline ${op.asset}`;
    ic = "shield";
    tint = "neutral";
  } else if (isCreate) {
    nm = pos ? "Cuenta creada" : "Fondeo de cuenta";
    ic = pos ? "in" : "send";
    tint = pos ? "pos" : "neutral";
  } else if (pos) {
    nm = `${op.asset} recibido`;
    ic = "in";
    tint = "pos";
  } else {
    nm = `${op.asset} enviado`;
    ic = "send";
    tint = "neutral";
  }

  const amt = isSwap
    ? (pos ? op.amount : -(op.sourceAmount ?? op.amount))
    : (pos ? op.amount : -op.amount);

  return {
    id: Number(op.id.slice(-6)) || 0,
    nm,
    su: op.createdAt
      ? new Date(op.createdAt).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
      : "Stellar",
    amt,
    cur: isSwap ? (pos ? op.asset : (op.sourceAsset ?? op.asset)) : op.asset,
    sub: contractRow?.sub,
    ic,
    pos: pos || (isSwap && op.direction === "self"),
    tint,
    hash: op.txHash,
    fromAddr: op.from,
    toAddr: op.to,
    blockNumber: op.ledger ? `L${op.ledger}` : undefined,
  };
}

export function ScreenWallet({ go }: { go: Go }) {
  const wallet = useWallet();
  const stellar = useSeyfStellarWallet();
  const { txns: onchainTxns, loading: loadingTxns, refresh: refreshTxns } = useOnchainTxns(wallet.address);
  const stellarTxns = useStellarTxns(stellar.publicKey ?? undefined);
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

  const onSuccess = () => { void refreshBal(); void refreshTxns(); void stellarTxns.refresh(); };

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
          {realMode && pend.pending.length === 0 && conv.conversions.length === 0 && onchainTxns.length === 0 && stellarTxns.ops.length === 0 ? (
            (loadingTxns || stellarTxns.loading) ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "18px 0" }}><span className="spin" style={{ color: "var(--accent)" }} /></div>
            ) : (
              <p style={{ padding: "16px 4px", fontSize: 13, color: "var(--txt-muted)", textAlign: "center" }}>Aún no tienes movimientos.</p>
            )
          ) : (
            <div className="list">
              {realMode && pend.pending.map((p) => <PendingTxnRow key={p.id} p={p} />)}
              {realMode
                ? mergeRecent(conv.conversions.filter((c) => !pend.pending.some((p) => p.ref === c.id)), onchainTxns, stellarTxns.ops, go)
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
                {FMT(absAmt, txnDecimals(absAmt)).split(".")[0]}
              </span>
              <span style={{ fontSize: 28, color: "var(--txt-muted)", fontWeight: 700 }}>
                .{FMT(absAmt, txnDecimals(absAmt)).split(".")[1]}
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
          const isStellar = t.fromAddr?.startsWith("G") || t.toAddr?.startsWith("G");
          const isLedger = t.blockNumber?.startsWith("L");
          const rows: { label: string; value: string; mono?: boolean }[] = [
            { label: "Tipo", value: pos ? "Entrada" : "Salida" },
            { label: "Divisa", value: cur },
            ...(t.fromAddr ? [{ label: "De", value: shortAddr(t.fromAddr), mono: true }] : []),
            ...(t.toAddr ? [{ label: "Para", value: shortAddr(t.toAddr), mono: true }] : []),
            ...(t.blockNumber ? [{ label: isLedger ? "Ledger" : "Bloque", value: isLedger ? t.blockNumber.slice(1) : `#${t.blockNumber}`, mono: true }] : []),
            ...(isStellar ? [{ label: "Red", value: "Stellar" }] : []),
          ];
          const explorerUrl = t.hash
            ? isStellar
              ? stellarExplorerTxUrl(t.hash)
              : `https://sepolia.arbiscan.io/tx/${t.hash}`
            : null;
          return (
            <>
              <div className="card" style={{ marginTop: 16, padding: "4px 0" }}>
                {rows.map((r, i) => (
                  <DetailRow key={r.label} label={r.label} value={r.value} mono={r.mono} last={i === rows.length - 1} />
                ))}
              </div>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost"
                  style={{ marginTop: 12, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13 }}
                >
                  <Icon name="globe" size={16} /> Ver en explorador
                </a>
              )}
            </>
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

function shortAddr(addr: string) {
  if (addr.startsWith("G") && addr.length >= 56) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
  return addr.length > 12 ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : addr;
}
