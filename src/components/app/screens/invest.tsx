"use client";

/* Pantallas de ahorro: Bóvedas, detalle de bóveda y conversión FX */
import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Icon, Flag } from "../ui";
import { Celebration } from "../Celebration";
import { SubHeader, AvatarButton } from "../shared";
import { FMT, RISK_PROFILES, planByApy, planById, projectSavings, loadRiskProfile, type VaultPlan, type RiskLevel, type AllocationSlice } from "../data";
import { GrowingAmount, YieldRate } from "../GrowingAmount";
import { MoneyInput } from "../MoneyInput";
import type { Go } from "../nav";
import { useWallet } from "@/components/wallet/WalletContext";
import { usePollar } from "@pollar/react";
import { useVaultsRail, MAX_VAULTS, STELLAR_RAIL, type UserVault } from "@/hooks/useVaultsRail";
import { isPlanUnlocked, STELLAR_VAULTS_ONCHAIN } from "@/lib/defindex/vaults";
import { inferPlanIdForVault, inferStrategyForVault } from "@/lib/defindex/catalog";
import { useDefindexStrategies, type DefindexStrategyLive } from "@/hooks/useDefindexStrategies";
import { useStellarConnect } from "../StellarConnectGate";
import { LiquidityAdvanceModal } from "../LiquidityAdvanceModal";
import { Portal } from "../Portal";
import { useAdvance } from "@/hooks/useAdvance";
import { useBitsoRates, useBitsoBalances } from "@/hooks/useBitsoRates";
import { useConversions } from "@/hooks/useConversions";
import { usePendingTxns } from "@/hooks/usePendingTxns";
import { BITSO_ASSETS, assetByCode } from "@/lib/bitso/assets";
import { TREASURY_ADDRESS, TREASURY_ENABLED, ADVANCE_ONCHAIN, explorerBase } from "@/lib/chain";
import { stellarTxExplorerUrl } from "@/lib/etherfuse/stellar-tx-url";

// Con Supabase, el ledger de conversiones lo escribe /api/convert (servidor);
// sin él, el cliente lo persiste localmente con la capa `store`.
const USE_SUPABASE = process.env.NEXT_PUBLIC_USE_SUPABASE === "true";

function fmtApy(apy: number | null | undefined): string {
  return apy != null && Number.isFinite(apy) ? `${FMT(apy, 1)}%` : "—";
}

/* ---------------- DONUT CHART ---------------- */
const DONUT_R = 68;
const DONUT_CIRC = 2 * Math.PI * DONUT_R;
const DONUT_GAP = 3;

function DonutChart({ slices }: { slices: AllocationSlice[] }) {
  const reduced = useReducedMotion();
  // Offset acumulado sin reasignar variables en render (regla react-hooks).
  const segments = slices.map((s, i) => {
    const dash = Math.max(0, (s.pct / 100) * DONUT_CIRC - DONUT_GAP);
    const offset = slices.slice(0, i).reduce((acc, x) => acc + (x.pct / 100) * DONUT_CIRC, 0);
    return { ...s, dash, offset };
  });

  return (
    <svg viewBox="0 0 160 160" width={160} height={160} style={{ display: "block", margin: "0 auto", overflow: "visible" }}>
      <circle cx={80} cy={80} r={DONUT_R} fill="none" stroke="var(--surface-2)" strokeWidth={24} />
      {segments.map((seg, i) => (
        <motion.circle
          key={i}
          cx={80}
          cy={80}
          r={DONUT_R}
          fill="none"
          stroke={seg.color}
          strokeWidth={24}
          strokeDashoffset={-seg.offset}
          strokeLinecap="butt"
          // Draw-in escalonado: cada segmento se "dibuja" de 0 a su longitud.
          initial={reduced ? false : { strokeDasharray: `0 ${DONUT_CIRC}` }}
          animate={{ strokeDasharray: `${seg.dash} ${DONUT_CIRC}` }}
          transition={{ duration: 0.7, delay: 0.1 + i * 0.13, ease: [0.22, 1, 0.36, 1] }}
          style={{ transform: "rotate(-90deg)", transformOrigin: "80px 80px" }}
        />
      ))}
      <text x={80} y={75} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fill: "var(--txt-muted)", fontFamily: "inherit" }}>
        composición
      </text>
      <text x={80} y={92} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 13, fill: "var(--txt)", fontWeight: 800, fontFamily: "inherit" }}>
        {slices.length} activos
      </text>
    </svg>
  );
}

/* ---------------- AHORRO (BÓVEDAS) ---------------- */
const RISK_COLOR: Record<RiskLevel, string> = { Bajo: "var(--accent)", Medio: "#F5A623", Alto: "var(--neg)" };
const riskIcon = (r: RiskLevel): string => (r === "Alto" ? "trend" : r === "Medio" ? "chart" : "shield");

function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <span className="pos-pill" style={{ background: "transparent", border: `1px solid ${RISK_COLOR[risk]}`, color: RISK_COLOR[risk] }}>
      Riesgo {risk.toLowerCase()}
    </span>
  );
}

/** Tile con icono según el riesgo del plan (para tarjetas de estrategia). */
function PlanTile({ risk, size = 46 }: { risk: RiskLevel; size?: number }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: size * 0.3, flexShrink: 0,
        background: "var(--surface-2)", border: "1px solid var(--line)", color: RISK_COLOR[risk],
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <Icon name={riskIcon(risk)} size={size * 0.46} />
    </span>
  );
}

/** Icono representativo de cada estrategia DeFindex (reemplaza el emoji). */
const STRATEGY_ICON: Record<string, string> = { cetes: "shield", usdc: "globe", xlm: "trend" };
function strategyIconName(s: { id?: string; risk: RiskLevel }): string {
  return (s.id && STRATEGY_ICON[s.id]) || riskIcon(s.risk);
}

/** Tile con icono animado (flota + late suave) para las tarjetas de estrategia.
 *  Mismo tamaño/estilo de caja que los iconos de Inicio (`.ava` 44px, borde sutil)
 *  para que no se vean más grandes; el color va solo en el glifo. */
function AnimatedStrategyIcon({ name, color, size = 44 }: { name: string; color: string; size?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      style={{
        width: size, height: size, borderRadius: 14, flexShrink: 0,
        background: "var(--surface-2)", border: "1px solid var(--line)", color,
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
      }}
      animate={reduced ? undefined : { y: [0, -2.5, 0] }}
      transition={reduced ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.span
        style={{ display: "flex" }}
        animate={reduced ? undefined : { scale: [1, 1.1, 1] }}
        transition={reduced ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <Icon name={name} size={size * 0.46} color={color} />
      </motion.span>
    </motion.span>
  );
}

/** APY a mostrar: el vivo de DeFindex si llegó; si no, el de referencia del catálogo. */
function strategyApyText(s: { apy: number | null; apyTarget?: number }): { text: string; estimated: boolean } {
  if (s.apy != null && Number.isFinite(s.apy)) return { text: `${FMT(s.apy, 1)}%`, estimated: false };
  if (s.apyTarget != null && Number.isFinite(s.apyTarget)) return { text: `${FMT(s.apyTarget, 1)}%`, estimated: true };
  return { text: "—", estimated: false };
}

function PlanCard({ plan, onPick, recommended, locked }: { plan: VaultPlan; onPick: () => void; recommended?: boolean; locked?: boolean }) {
  return (
    <div
      className="card bond-card"
      onClick={locked ? undefined : onPick}
      style={{
        cursor: locked ? "default" : "pointer",
        border: recommended ? "1px solid var(--accent)" : undefined,
        background: recommended ? "var(--accent-soft)" : undefined,
        opacity: locked ? 0.55 : 1,
      }}
    >
      <PlanTile risk={plan.risk} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{plan.name}</p>
          {locked
            ? <span className="pos-pill" style={{ background: "var(--surface-2)", color: "var(--txt-muted)" }}><Icon name="lock" size={11} /> Próximamente</span>
            : recommended && <span className="pos-pill"><Icon name="star" size={11} /> Para ti</span>}
        </div>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{plan.exposure}</p>
        <div style={{ marginTop: 6 }}><RiskBadge risk={plan.risk} /></div>
      </div>
      <div className="yield" style={{ textAlign: "right" }}>
        <div className="num" style={{ fontWeight: 800, fontSize: 20, color: "var(--accent)" }}>{FMT(plan.apy, 1)}%</div>
        <div className="lb">anual</div>
      </div>
    </div>
  );
}

/** Tarjeta de estrategia DeFindex (CETES / USDC / XLM) — contrato on-chain, no la bóveda del usuario. */
function StrategyCard({
  strategy,
  onPick,
  recommended,
}: {
  strategy: DefindexStrategyLive;
  onPick: () => void;
  recommended?: boolean;
}) {
  const apy = strategyApyText(strategy);
  return (
    <div
      className="card bond-card"
      onClick={onPick}
      style={{
        cursor: "pointer",
        border: recommended ? "1px solid var(--accent)" : undefined,
        background: recommended ? "var(--accent-soft)" : undefined,
      }}
    >
      <AnimatedStrategyIcon name={strategyIconName(strategy)} color={strategy.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{strategy.name}</p>
          {recommended && <span className="pos-pill"><Icon name="star" size={11} /> Para ti</span>}
        </div>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{strategy.exposure}</p>
        <div style={{ marginTop: 6 }}><RiskBadge risk={strategy.risk} /></div>
      </div>
      <div className="yield" style={{ textAlign: "right" }}>
        <div className="num" style={{ fontWeight: 800, fontSize: 22, color: "var(--accent)" }}>{apy.text}</div>
        <div className="lb">{apy.estimated ? "anual est." : "anual"}</div>
      </div>
    </div>
  );
}

/** Tarjeta de bóveda para el carrusel horizontal: saldo grande creciendo en vivo. */
function VaultCard({
  v, go, index = 0, strategyLabel,
}: {
  v: UserVault;
  go: Go;
  index?: number;
  strategyLabel?: string;
}) {
  const strat = STELLAR_RAIL ? inferStrategyForVault(v) : null;
  const plan = strat ? planById(strat.planId) : (v.planId ? planById(v.planId) : planByApy(v.apy));
  const tileColor = strat?.color ?? plan.color;
  const iconName = strat ? strategyIconName({ id: strat.id, risk: strat.risk }) : riskIcon(plan.risk);
  // APY efectivo para que el saldo crezca en vivo aunque la bóveda guarde apy 0.
  const effApy = v.apy > 0 ? v.apy : strat ? strat.apyTarget : plan.apy;
  const apyShown = `${FMT(effApy, 1)}%`;
  return (
    <motion.div
      className="card vault-card"
      onClick={() => go("boveda", v)}
      style={{
        cursor: "pointer", flex: "0 0 auto", width: 264, scrollSnapAlign: "start",
        display: "flex", flexDirection: "column", padding: 18,
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.975 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <AnimatedStrategyIcon name={iconName} color={tileColor} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v.nm}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--txt-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {strategyLabel ?? strat?.name ?? plan.name}
          </p>
        </div>
      </div>
      <div style={{ marginTop: 18 }}>
        <GrowingAmount base={v.bal} apy={effApy} size={38} align="left" id={`vault-${v.id}`} anchorMs={v.updatedAt} />
      </div>
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="pos-pill"><Icon name="leaf" size={12} /> {apyShown} anual</span>
        <span style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 2 }}>
          Ver <Icon name="chevR" size={15} color="var(--accent)" />
        </span>
      </div>
    </motion.div>
  );
}

export function ScreenVaults({ go }: { go: Go }) {
  const wallet = useWallet();
  const { vaults, addVault, totalSaved, busy, onchain, ready } = useVaultsRail(wallet.address);
  const { strategies, byPlanId } = useDefindexStrategies();
  const [opening, setOpening] = useState(false);
  const [creating, setCreating] = useState<null | { stellar?: DefindexStrategyLive; evmPlan?: VaultPlan }>(null);
  const [recId] = useState<string | null>(() => loadRiskProfile());
  const recPlan = recId ? planById(recId) : null;

  const defaultStrategy =
    (recPlan && byPlanId(recPlan.id)) ?? strategies[0];

  // APY efectivo de una bóveda: el guardado si existe, si no el vivo de DeFindex
  // y, en su defecto, el de referencia del catálogo. Evita que el APY salga 0/—.
  const effectiveApy = (v: UserVault): number => {
    if (v.apy > 0) return v.apy;
    if (STELLAR_RAIL) {
      const s = byPlanId(inferPlanIdForVault(v));
      return (s?.apy ?? inferStrategyForVault(v).apyTarget) || 0;
    }
    return v.apy;
  };

  const weightedApy =
    totalSaved > 0
      ? vaults.reduce((s, v) => s + v.bal * effectiveApy(v), 0) / totalSaved
      : (defaultStrategy?.apy ?? defaultStrategy?.apyTarget ?? recPlan?.apy ?? 10.5);
  // Ancla del timer del total = lectura de saldo más reciente entre las bóvedas.
  const totalAnchorMs = vaults.reduce((m, v) => Math.max(m, v.updatedAt ?? 0), 0) || undefined;
  const atCap = vaults.length >= MAX_VAULTS;
  const { isAuthenticated: pollarOk, walletAddress: pollarPk } = usePollar();
  const [orphanOnchain, setOrphanOnchain] = useState<
    { planId: string; name: string; assetSymbol: string; underlyingBalance: number; strategyId: string }[]
  >([]);

  // Firma estable del conjunto de activos cubiertos por bóvedas locales. Usar esto
  // (y no el array `vaults`, que es una referencia nueva en cada refresco de saldo)
  // evita que el efecto re-consulte /positions en cada tick: ese re-fetch, sumado al
  // rate-limit del endpoint (a veces responde vacío), hacía parpadear la tarjeta verde.
  const coveredKey = STELLAR_RAIL ? vaults.map((v) => inferPlanIdForVault(v)).sort().join(",") : "";

  useEffect(() => {
    // Gate en `ready`: antes de que carguen las bóvedas el set `covered` está vacío
    // y TODA posición on-chain parece huérfana → la tarjeta verde aparece y se borra.
    if (!STELLAR_RAIL || !pollarOk || !pollarPk || !ready) {
      // Reset intencional al desconectar/no-listo: limpia huérfanos obsoletos.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrphanOnchain([]);
      return;
    }
    const covered = new Set<string>(coveredKey ? coveredKey.split(",") : []);
    void fetch(`/api/defindex/positions?publicKey=${pollarPk}`)
      .then((r) => r.json())
      .then((data: { withBalance?: { planId: string; name: string; assetSymbol: string; underlyingBalance: number; strategyId: string }[] }) => {
        const rows = data.withBalance ?? [];
        setOrphanOnchain(rows.filter((p) => p.underlyingBalance > 0 && !covered.has(p.planId)));
      })
      .catch(() => setOrphanOnchain([]));
  }, [STELLAR_RAIL, pollarOk, pollarPk, ready, coveredKey]);

  const handleCreate = async (name: string, strategy: DefindexStrategyLive) => {
    setOpening(true);
    try {
      await addVault({
        nm: name.trim() || strategy.name,
        goal: 0,
        apy: strategy.apy ?? 0,
        color: strategy.color,
        planId: strategy.planId,
        strategyId: strategy.id,
      });
      setCreating(null);
    } finally {
      setOpening(false);
    }
  };

  const handleCreateEvm = async (name: string, plan: VaultPlan) => {
    setOpening(true);
    try {
      await addVault({ nm: name.trim() || plan.name, goal: 0, apy: plan.apy, color: plan.color });
      setCreating(null);
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <div className="app-head" style={{ paddingTop: 4 }}>
        <p className="name">Ahorro</p>
        <div className="head-actions">
          <button className="icon-btn" onClick={() => go("notifs")} aria-label="Notificaciones">
            <Icon name="bell" size={20} />
          </button>
          <AvatarButton go={go} />
        </div>
      </div>
      <div className="screen-pad">
        {(busy || opening) && (
          <div className="card" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12, background: "var(--accent-soft)", border: "none" }}>
            <span className="spin" style={{ color: "var(--accent)" }} />
            <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)" }}>Procesando en la red… esto tarda unos segundos.</p>
          </div>
        )}

        {/* Hero — ahorro total creciendo en vivo */}
        <div className="card glow" style={{ padding: "24px 22px" }}>
          <p className="eyebrow">Tu ahorro total</p>
          <div style={{ marginTop: 14 }}>
            <GrowingAmount base={totalSaved} apy={weightedApy} size={56} align="left" id="vaults-total" anchorMs={totalAnchorMs} />
          </div>
          {totalSaved > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <span className="pos-pill"><Icon name="leaf" size={12} /> {FMT(weightedApy, 1)}% anual</span>
              <YieldRate base={totalSaved} apy={weightedApy} />
            </div>
          ) : (
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
              Abre una bóveda y mira tu dinero crecer al instante, segundo a segundo.
            </p>
          )}
        </div>

        {!onchain && (
          <div className="card" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, background: "var(--surface-2)" }}>
            <Icon name="info" size={20} color="var(--txt-muted)" />
            <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.45 }}>
              Puedes planear tu estrategia. <b style={{ color: "var(--txt)" }}>Fondear con dinero real</b>{" "}
              {STELLAR_RAIL
                ? "se activa al conectar tu wallet (verifica tu identidad en Perfil)."
                : "se activa al conectar el contrato on-chain."}
            </p>
          </div>
        )}

        {STELLAR_RAIL && orphanOnchain.length > 0 && (
          <div className="card" style={{ marginTop: 14, padding: "14px 16px", background: "var(--accent-soft)", border: "1px solid var(--accent)" }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--txt)" }}>
              Tienes saldo invertido sin bóveda asignada
            </p>
            <p style={{ margin: "6px 0 12px", fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.5 }}>
              Eliminar una bóveda <b>no retira</b> tu dinero. Tu saldo sigue invertido y rindiendo; crea otra bóveda con el mismo activo para verlo.
            </p>
            {orphanOnchain.map((p) => {
              const strat = strategies.find((s) => s.planId === p.planId);
              return (
                <div key={p.planId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{p.name}</p>
                    <p className="num" style={{ margin: "2px 0 0", fontSize: 13, color: "var(--accent)" }}>
                      {FMT(p.underlyingBalance, 4)} {p.assetSymbol}
                    </p>
                  </div>
                  {!atCap && strat && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: "8px 12px", fontSize: 12 }}
                      onClick={() => setCreating({ stellar: strat })}
                    >
                      Recuperar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Mis bóvedas — metas con nombre propio del usuario */}
        <div className="sec-head">
          <h3>Mis bóvedas</h3>
          <span style={{ fontSize: 12, color: "var(--txt-dim)", fontWeight: 700 }}>{vaults.length}/{MAX_VAULTS}</span>
        </div>
        {STELLAR_RAIL && (
          <p style={{ margin: "0 2px 12px", fontSize: 12.5, color: "var(--txt-muted)", lineHeight: 1.5 }}>
            Tu <b style={{ color: "var(--txt)" }}>bóveda</b> es el nombre de tu meta (viaje, emergencia…).
            El <b style={{ color: "var(--txt)" }}>activo</b> (CETES, USDC, XLM) define en qué rinde tu dinero.
          </p>
        )}
        {vaults.length === 0 ? (
          <button
            className="btn btn-ghost"
            onClick={() => setCreating({ stellar: defaultStrategy })}
            style={{ width: "100%", justifyContent: "center", borderStyle: "dashed" }}
          >
            <Icon name="plus" size={18} /> Crear mi primera bóveda
          </button>
        ) : (
          <div
            className="h-carousel"
            style={{ display: "flex", gap: 12, overflowX: "auto", scrollSnapType: "x mandatory", padding: "2px 2px 6px", margin: "0 -2px" }}
          >
            {vaults.map((v, i) => (
              <VaultCard
                key={v.id}
                v={v}
                go={go}
                index={i}
                strategyLabel={STELLAR_RAIL ? (byPlanId(inferPlanIdForVault(v))?.name ?? inferStrategyForVault(v).name) : undefined}
              />
            ))}
            {!atCap && (
              <button
                type="button"
                className="card vault-card"
                onClick={() => setCreating({ stellar: defaultStrategy })}
                style={{
                  flex: "0 0 auto", width: 150, scrollSnapAlign: "start", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
                  borderStyle: "dashed", color: "var(--txt-muted)", background: "transparent",
                }}
              >
                <span style={{ width: 42, height: 42, borderRadius: 13, background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
                  <Icon name="plus" size={20} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Nueva bóveda</span>
              </button>
            )}
          </div>
        )}
        {atCap && (
          <p style={{ margin: "6px 4px 0", fontSize: 12.5, color: "var(--txt-dim)", textAlign: "center" }}>
            Llegaste al máximo de {MAX_VAULTS} bóvedas de ahorro.
          </p>
        )}

        {/* Activos de ahorro (Stellar) o perfiles de riesgo (EVM) */}
        <div className="sec-head" style={{ marginTop: 24 }}>
          <h3>{STELLAR_RAIL ? "Activos de ahorro" : "Estrategias de ahorro"}</h3>
        </div>
        <p style={{ margin: "0 2px 14px", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
          {STELLAR_RAIL ? (
            <>Cada activo rinde a su propia tasa. Elige el que mejor se ajuste a tu meta.</>
          ) : recPlan ? (
            <>Según tu perfil te recomendamos <b style={{ color: "var(--accent)" }}>{recPlan.name}</b>.</>
          ) : (
            <>Cada perfil ajusta tu mezcla de instrumentos soberanos según tu horizonte.</>
          )}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {STELLAR_RAIL
            ? strategies.map((s) => (
                <StrategyCard
                  key={s.id}
                  strategy={s}
                  recommended={recPlan?.id === s.planId}
                  onPick={atCap ? () => {} : () => setCreating({ stellar: s })}
                />
              ))
            : RISK_PROFILES.map((p) => {
                const locked = !isPlanUnlocked(p.id);
                return (
                  <PlanCard
                    key={p.id}
                    plan={p}
                    locked={locked}
                    recommended={!locked && recPlan?.id === p.id}
                    onPick={atCap || locked ? () => {} : () => setCreating({ evmPlan: p })}
                  />
                );
              })}
        </div>
      </div>
      <div className="scroll-bottom" />
      {creating && STELLAR_RAIL && (
        <Portal>
          <CreateVaultModalStellar
            preset={creating.stellar ?? defaultStrategy}
            recId={recId}
            strategies={strategies}
            busy={opening}
            onClose={() => setCreating(null)}
            onCreate={handleCreate}
          />
        </Portal>
      )}
      {creating && !STELLAR_RAIL && (
        <Portal>
          <CreateVaultModalEvm
            preset={creating.evmPlan ?? (recPlan && isPlanUnlocked(recPlan.id) ? recPlan : RISK_PROFILES[0])}
            recId={recId}
            busy={opening}
            onClose={() => setCreating(null)}
            onCreate={handleCreateEvm}
          />
        </Portal>
      )}
    </div>
  );
}

/** Crear bóveda Stellar: nombre + estrategia DeFindex (CETES/USDC/XLM). */
function CreateVaultModalStellar({
  preset, recId, strategies, busy, onClose, onCreate,
}: {
  preset: DefindexStrategyLive;
  recId: string | null;
  strategies: DefindexStrategyLive[];
  busy: boolean;
  onClose: () => void;
  onCreate: (name: string, strategy: DefindexStrategyLive) => void;
}) {
  const [name, setName] = useState("");
  const defaultId =
    preset?.planId
    ?? (recId && strategies.find((s) => s.planId === recId)?.planId)
    ?? strategies[0]?.planId
    ?? "conservador";
  const [planId, setPlanId] = useState<string>(defaultId);
  const strategy = strategies.find((s) => s.planId === planId) ?? preset;

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">Nueva bóveda</p>
        <p className="modal-sub" style={{ marginTop: 2 }}>
          Ponle nombre a tu meta y elige el activo donde rendirá.
        </p>

        <span className="field-label" style={{ marginTop: 14 }}>Nombre de tu bóveda</span>
        <input
          className="input"
          placeholder="Ej. Fondo de emergencia, Viaje, Enganche…"
          value={name}
          maxLength={32}
          onChange={(e) => setName(e.target.value)}
        />

        <span className="field-label" style={{ marginTop: 16 }}>Activo</span>
        <div style={{ display: "grid", gap: 8 }}>
          {strategies.map((s) => {
            const active = s.planId === planId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setPlanId(s.planId)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: 12, borderRadius: 14,
                  cursor: "pointer",
                  border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
                  background: active ? "var(--accent-soft)" : "var(--surface-2)",
                }}
              >
                <span style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: "var(--surface-2)", border: "1px solid var(--line)", color: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={strategyIconName(s)} size={20} color={s.color} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14.5 }}>{s.name}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--txt-muted)" }}>{s.exposure}</p>
                </div>
                <span className="num" style={{ fontWeight: 800, fontSize: 16, color: "var(--accent)" }}>{strategyApyText(s).text}</span>
              </button>
            );
          })}
        </div>

        <button className="btn btn-primary" style={{ marginTop: 18 }} disabled={busy} onClick={() => onCreate(name, strategy)}>
          {busy ? <span className="spin" /> : <><Icon name="plus" size={18} /> Crear bóveda</>}
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose} disabled={busy}>Cancelar</button>
      </div>
    </div>
  );
}

/** Crear bóveda EVM: nombre + perfil de riesgo. */
function CreateVaultModalEvm({
  preset, recId, busy, onClose, onCreate,
}: {
  preset?: VaultPlan;
  recId: string | null;
  busy: boolean;
  onClose: () => void;
  onCreate: (name: string, plan: VaultPlan) => void;
}) {
  const [name, setName] = useState("");
  const defaultId =
    preset && isPlanUnlocked(preset.id) ? preset.id
    : recId && isPlanUnlocked(recId) ? recId
    : RISK_PROFILES.find((p) => isPlanUnlocked(p.id))?.id ?? RISK_PROFILES[0].id;
  const [planId, setPlanId] = useState<string>(defaultId);
  const plan = planById(planId);
  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">Nueva bóveda</p>
        <p className="modal-sub" style={{ marginTop: 2 }}>Ponle nombre y elige su estrategia.</p>

        <span className="field-label" style={{ marginTop: 14 }}>Nombre</span>
        <input
          className="input"
          placeholder="Ej. Fondo de emergencia, Viaje, Enganche…"
          value={name}
          maxLength={32}
          onChange={(e) => setName(e.target.value)}
        />

        <span className="field-label" style={{ marginTop: 16 }}>Estrategia</span>
        <div style={{ display: "grid", gap: 8 }}>
          {RISK_PROFILES.map((p) => {
            const active = p.id === planId;
            const locked = !isPlanUnlocked(p.id);
            return (
              <button
                key={p.id}
                type="button"
                disabled={locked}
                onClick={() => !locked && setPlanId(p.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: 12, borderRadius: 14,
                  cursor: locked ? "default" : "pointer",
                  opacity: locked ? 0.5 : 1,
                  border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
                  background: active ? "var(--accent-soft)" : "var(--surface-2)",
                }}
              >
                <PlanTile risk={p.risk} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14.5, display: "flex", alignItems: "center", gap: 6 }}>
                    {p.name}
                    {locked && <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--txt-muted)", display: "inline-flex", alignItems: "center", gap: 3 }}><Icon name="lock" size={10} /> Próximamente</span>}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--txt-muted)" }}>Riesgo {p.risk.toLowerCase()} · {p.horizon}</p>
                </div>
                <span className="num" style={{ fontWeight: 800, fontSize: 16, color: "var(--accent)" }}>{FMT(p.apy, 1)}%</span>
              </button>
            );
          })}
        </div>

        <button className="btn btn-primary" style={{ marginTop: 18 }} disabled={busy} onClick={() => onCreate(name, plan)}>
          {busy ? <span className="spin" /> : <><Icon name="plus" size={18} /> Crear bóveda</>}
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose} disabled={busy}>Cancelar</button>
      </div>
    </div>
  );
}

/* ---------------- VAULT DETAIL ---------------- */
export function ScreenVaultDetail({ go, ctx }: { go: Go; ctx?: unknown }) {
  const wallet = useWallet();
  const { vaults, updateBalance, removeVault, busy, onchain, limits } = useVaultsRail(wallet.address);
  const { byPlanId } = useDefindexStrategies();
  const ctxV = ctx as UserVault | undefined;
  const v = vaults.find((x) => x.id === ctxV?.id) ?? ctxV;
  const resolvedPlanId = STELLAR_RAIL && v ? inferPlanIdForVault(v) : undefined;
  // `liveStrategy` (del hook) trae el APY en vivo; si no hay, caemos al catálogo.
  const liveStrategy = STELLAR_RAIL && v ? byPlanId(resolvedPlanId) : undefined;
  const defindexStrategy =
    liveStrategy ?? (STELLAR_RAIL && v ? inferStrategyForVault(v) : undefined);
  const liveApy =
    liveStrategy?.apy != null && Number.isFinite(liveStrategy.apy)
      ? liveStrategy.apy
      : v?.apy && v.apy > 0
        ? v.apy
        : defindexStrategy?.apyTarget ?? 0;
  const vaultAsset = defindexStrategy?.assetSymbol ?? "MXN";

  // vaultId numérico solo cuando estamos on-chain (ids son índices del contrato).
  // Se calcula antes del early return para no violar reglas de hooks.
  const numVaultId = onchain && v ? parseInt(v.id) : undefined;
  const advanceState = useAdvance(wallet.address, numVaultId);
  const { ensureConnected } = useStellarConnect();
  // En el riel Stellar se puede abonar/retirar si la vault está configurada,
  // aunque Pollar aún no esté conectada: la conexión se pide al hacer la acción.
  const canFund = onchain || (STELLAR_RAIL && STELLAR_VAULTS_ONCHAIN);

  const [action, setAction] = useState<null | "abonar" | "retirar">(null);
  const [advance, setAdvance] = useState(false);
  const reduced = useReducedMotion();

  if (!v) {
    return (
      <div className="screen screen-enter">
        <div className="safe-top" />
        <SubHeader title="Bóveda" go={go} back="bovedas" />
        <div className="screen-pad"><p style={{ color: "var(--txt-muted)" }}>Esta bóveda ya no existe.</p></div>
      </div>
    );
  }

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title={v.nm} go={go} back="bovedas" />
      <div className="screen-pad" style={{ textAlign: "center" }}>
        {/* Hero — saldo creciendo en vivo, con halo animado */}
        <div className="card glow" style={{ marginTop: 6, padding: "28px 22px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <motion.div
            aria-hidden
            style={{
              position: "absolute", left: "50%", top: "46%", width: 260, height: 260,
              marginLeft: -130, marginTop: -130, borderRadius: "50%", pointerEvents: "none",
              background: "radial-gradient(circle, var(--accent-soft), transparent 70%)",
            }}
            animate={reduced ? undefined : { scale: [1, 1.18, 1], opacity: [0.45, 0.85, 0.45] }}
            transition={reduced ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
          {STELLAR_RAIL && defindexStrategy && (
            <p style={{ position: "relative", margin: "0 0 8px", fontSize: 12, color: "var(--txt-muted)" }}>
              Activo · <b style={{ color: "var(--txt)" }}>{defindexStrategy.name}</b>
            </p>
          )}
          <div style={{ position: "relative" }}>
            <GrowingAmount base={v.bal} apy={liveApy} size={56} id={`vault-${v.id}`} anchorMs={v.updatedAt} countUpOnMount />
          </div>
          <p style={{ position: "relative", fontSize: 13.5, color: "var(--txt-muted)", margin: "10px 0 0" }}>
            {STELLAR_RAIL ? `${vaultAsset} en bóveda` : "MXN en bóveda"}
          </p>
          {v.bal > 0 && liveApy > 0 && (
            <div style={{ position: "relative", marginTop: 12, display: "inline-flex", alignItems: "center", gap: 8 }}>
              <motion.span
                style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }}
                animate={reduced ? undefined : { opacity: [1, 0.25, 1], scale: [1, 0.7, 1] }}
                transition={reduced ? undefined : { duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <YieldRate base={v.bal} apy={liveApy} />
            </div>
          )}
        </div>
        <div className="stat-grid" style={{ marginTop: 16, textAlign: "left" }}>
          <div className="tile"><div className="k">Rendimiento</div><div className="v" style={{ color: "var(--accent)", fontSize: 20 }}>{fmtApy(liveApy)}</div></div>
          <div className="tile"><div className="k">En 10 años</div><div className="v num" style={{ fontSize: 16 }}>${FMT(projectSavings(v.bal, 0, liveApy, 10), 0)}</div></div>
        </div>

        {/* Activo de la bóveda */}
        {STELLAR_RAIL && defindexStrategy && (
          <>
              <div className="card" style={{ marginTop: 16, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <AnimatedStrategyIcon name={strategyIconName(defindexStrategy)} color={defindexStrategy.color} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{defindexStrategy.name}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>
                      {defindexStrategy.exposure}
                    </p>
                  </div>
                  <RiskBadge risk={defindexStrategy.risk} />
                </div>
                <div className="divider" />
                <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
                  {defindexStrategy.structured}
                </p>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--txt-dim)" }}>
                  Horizonte: {defindexStrategy.horizon}
                </p>
              </div>
            {v.bal > 0 && (
              <div className="card" style={{ marginTop: 14, textAlign: "left", background: "var(--accent-soft)", border: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon name="trend" size={18} color="var(--accent)" />
                  <p className="eyebrow" style={{ color: "var(--accent)", margin: 0 }}>Proyección de tu retiro</p>
                </div>
                <p style={{ margin: "8px 0 6px", fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.45 }}>
                  Manteniendo tu saldo a {fmtApy(liveApy)} anual, podrías retirar:
                </p>
                {[1, 5, 10, 20].map((yrs, i) => (
                  <div key={yrs} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
                    <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>En {yrs} {yrs === 1 ? "año" : "años"}</span>
                    <span className="num" style={{ fontSize: 16, fontWeight: 800, color: "var(--accent)" }}>${FMT(projectSavings(v.bal, 0, liveApy, yrs), 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!STELLAR_RAIL && (() => {
          const plan = v.planId ? planById(v.planId) : planByApy(v.apy);
          return (
            <>
              <div className="card" style={{ marginTop: 16, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <PlanTile risk={plan.risk} size={42} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{plan.name}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{plan.exposure}</p>
                  </div>
                  <RiskBadge risk={plan.risk} />
                </div>
                <div className="divider" />
                <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>{plan.structured}</p>
              </div>
              {v.bal > 0 && (
                <div className="card" style={{ marginTop: 14, textAlign: "left", background: "var(--accent-soft)", border: "none" }}>
                  <p style={{ margin: "8px 0 6px", fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.45 }}>
                    Manteniendo tu saldo a {FMT(v.apy, 1)}% anual, podrías retirar:
                  </p>
                  {[1, 5, 10, 20].map((yrs, i) => (
                    <div key={yrs} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
                      <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>En {yrs} {yrs === 1 ? "año" : "años"}</span>
                      <span className="num" style={{ fontSize: 16, fontWeight: 800, color: "var(--accent)" }}>${FMT(projectSavings(v.bal, 0, v.apy, yrs), 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}

        {/* Composición (solo riel EVM) */}
        {!STELLAR_RAIL && (() => {
          const plan = v.planId ? planById(v.planId) : planByApy(v.apy);
          if (!plan.allocation?.length) return null;
          return (
            <div className="card" style={{ marginTop: 16, textAlign: "left" }}>
              <p className="eyebrow" style={{ marginBottom: 14 }}>Composición</p>
              <DonutChart slices={plan.allocation} />
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {plan.allocation.map((s) => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--txt)" }}>{s.label}</span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, color: "var(--txt-muted)", minWidth: 36, textAlign: "right" }}>{s.pct}%</span>
                    <span className="num" style={{ fontSize: 12, color: "var(--accent)", minWidth: 52, textAlign: "right" }}>{FMT(s.apy, 1)}% est.</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {busy && (
          <div className="card" style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, background: "var(--accent-soft)", border: "none" }}>
            <span className="spin" style={{ color: "var(--accent)" }} />
            <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)" }}>Procesando en la red…</p>
          </div>
        )}
        <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={async () => { if (await ensureConnected("abonar a tu bóveda")) setAction("abonar"); }} disabled={!canFund || busy}><Icon name="plus" size={18} /> Abonar</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={async () => { if (await ensureConnected("retirar de tu bóveda")) setAction("retirar"); }} disabled={!canFund || busy || (onchain && (v.bal - advanceState.locked) <= 0)}>Retirar</button>
        </div>
        {!canFund && (
          <p style={{ margin: "12px 4px 0", fontSize: 12, color: "var(--txt-dim)", lineHeight: 1.5, textAlign: "center" }}>
            {STELLAR_RAIL
              ? "Configura tu bóveda para abonar y retirar."
              : "Abonar y retirar se activan al conectar el contrato on-chain."}
          </p>
        )}
        {/* Adelanto — acción de liquidez sobre esta bóveda. Solicitar y repagar
            viven en su propia pantalla (LiquidityAdvanceModal); aquí solo el acceso.
            Solo en el riel EVM: en Stellar (DeFindex) el adelanto se hará con Blend. */}
        {!STELLAR_RAIL && v.bal > 0 && (
          advanceState.debt > 0 ? (
            <button
              className="btn btn-ghost"
              style={{ marginTop: 12, justifyContent: "space-between" }}
              onClick={() => setAdvance(true)}
              disabled={busy}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Icon name="bolt" size={18} color="var(--warning, #E8A838)" /> Adelanto activo · ${FMT(advanceState.debt, 2)} pendiente
              </span>
              <Icon name="chevR" size={16} color="var(--txt-dim)" />
            </button>
          ) : (
            <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setAdvance(true)} disabled={busy}>
              <Icon name="bolt" size={18} /> Adelantar rendimiento
            </button>
          )
        )}
        <button disabled={busy || advanceState.locked > 0} title={advanceState.locked > 0 ? "Repaga tu adelanto para liberar el colateral antes de eliminar la bóveda" : undefined} onClick={async () => { await removeVault(v.id); go("bovedas"); }} style={{ marginTop: 18, background: "none", border: "none", color: "var(--neg)", fontWeight: 700, fontSize: 13, cursor: busy || advanceState.locked > 0 ? "default" : "pointer", opacity: busy || advanceState.locked > 0 ? 0.5 : 1 }}>Eliminar bóveda</button>
      </div>
      <div className="scroll-bottom" />
      {action && (
        <Portal>
          <VaultAmountModal
            mode={action}
            vault={v}
            assetSymbol={vaultAsset}
            locked={advanceState.locked}
            maxDeposit={limits?.available}
            cap={limits?.max}
            onClose={() => setAction(null)}
            onConfirm={(amt) => updateBalance(v.id, action === "abonar" ? amt : -amt)}
          />
        </Portal>
      )}
      {advance && (
        <Portal>
          <LiquidityAdvanceModal
            saved={v.bal}
            apy={v.apy}
            vaultId={numVaultId}
            onClose={() => { setAdvance(false); void advanceState.reload(); }}
          />
        </Portal>
      )}
    </div>
  );
}

/* ---------------- CONVERTIR (FX real con Bitso · MXNB ↔ divisas) ---------------- */
function ConvAssetBadge({ flag }: { flag: string | null }) {
  if (flag) return <Flag code={flag} cls="sm" />;
  return (
    <span className="num" style={{ width: 40, height: 40, borderRadius: 999, background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>$</span>
  );
}

function ConvSelect({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude?: string }) {
  return (
    <select
      className="chip"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ appearance: "none", WebkitAppearance: "none", cursor: "pointer", color: "var(--txt)", fontWeight: 700 }}
    >
      {BITSO_ASSETS.filter((a) => a.code !== exclude).map((a) => (
        <option key={a.code} value={a.code} style={{ color: "#000" }}>{a.code}</option>
      ))}
    </select>
  );
}

export function ScreenConvert({ go }: { go: Go }) {
  const { loading, error, quote, mxnPriceOf } = useBitsoRates();
  const wallet = useWallet();
  const { add: addConversion, balances: localBalances, reload: reloadConversions } = useConversions(wallet.address);
  const pending = usePendingTxns(wallet.address);
  const { balances: liveBalances, refresh: refreshBalances } = useBitsoBalances();
  const [fromCode, setFromCode] = useState("MXN");
  const [toCode, setToCode] = useState("USDT");
  const [amount, setAmount] = useState("1000");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [doneInfo, setDoneInfo] = useState<
    { fwd: boolean; received: number; recCode: string; spent: number; spentCode: string } | null
  >(null);

  const from = assetByCode(fromCode)!;
  const to = assetByCode(toCode)!;
  const amt = Number(amount) || 0;
  const result = quote(fromCode, toCode, amt);
  const unitRate = quote(fromCode, toCode, 1);
  const oneSideIsMXN = fromCode === "MXN" || toCode === "MXN";

  const swap = () => { setFromCode(toCode); setToCode(fromCode); setStatus("idle"); };

  // Flujo soportado on-chain: MXNB → divisa. El usuario transfiere su MXNB a la
  // tesorería del negocio (baja su saldo on-chain), el swap se ejecuta en Bitso
  // (pool del negocio) y el USDT se atribuye al usuario en el ledger.
  const sellingMXNB = fromCode === "MXN";

  // Saldo disponible del lado origen: MXNB on-chain (forward) o divisa del ledger (inverse).
  const availableFrom = sellingMXNB ? wallet.balance : localBalances[fromCode] ?? 0;
  const setPct = (p: number) => {
    const v = availableFrom * (p / 100);
    setAmount(v > 0 ? String(Number(v.toFixed(from.dec))) : "0");
    setStatus("idle");
  };

  const doConvert = async () => {
    if (!oneSideIsMXN || amt <= 0 || result == null) return;
    if (!wallet.address) {
      setStatus("error");
      setMsg("Conecta tu wallet para convertir.");
      return;
    }
    setStatus("sending");
    setDoneInfo(null);
    try {
      // Validación previa según el sentido.
      if (sellingMXNB) {
        // FORWARD MXN→divisa: mueve el MXNB del usuario a la tesorería on-chain
        // (baja su saldo real). Lo firma su smart wallet, no puede ir al servidor.
        if (TREASURY_ENABLED) {
          if (wallet.balance < amt) {
            setStatus("error");
            setMsg(`Saldo insuficiente. Disponible: ${FMT(wallet.balance, 2)} MXN.`);
            return;
          }
          await wallet.sendMXNB(TREASURY_ADDRESS, String(amt));
        }
      } else {
        // INVERSE divisa→MXN: valida el saldo del usuario en el ledger.
        const have = localBalances[fromCode] ?? 0;
        if (have + 1e-9 < amt) {
          setStatus("error");
          setMsg(`Saldo insuficiente de ${fromCode}. Disponible: ${FMT(have, from.dec)}.`);
          return;
        }
      }

      // Orquestación server-side, atómica e idempotente por `key`:
      // orden Bitso + (inverso) emisión MXNB a la wallet + liquidación del ledger.
      const key = crypto.randomUUID();
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: wallet.address,
          address: wallet.address,
          from: fromCode,
          to: toCode,
          amount: amt,
          key,
          quotedFrom: amt,
          quotedTo: result,
        }),
      });
      const d = (await res.json()) as {
        ok?: boolean;
        error?: string;
        oid?: string;
        filledFrom?: number;
        filledTo?: number;
      };
      if (!d.ok) {
        setStatus("error");
        setMsg(
          sellingMXNB && TREASURY_ENABLED
            ? `Tu MXN quedó en tesorería; la conversión no se completó (${d.error || "error"}).`
            : d.error || "No se pudo ejecutar la conversión.",
        );
        return;
      }

      // Refleja el ledger: con Supabase el servidor ya escribió la fila → recargar;
      // sin Supabase (modo local) la persistimos en el store con los montos reales.
      if (USE_SUPABASE) {
        await reloadConversions();
      } else {
        await addConversion({
          from: fromCode,
          to: toCode,
          amountFrom: d.filledFrom ?? amt,
          amountTo: d.filledTo ?? result,
          oid: d.oid,
        });
      }

      // Reflejar el resultado y refrescar saldos.
      void refreshBalances();
      wallet.refreshBalance();
      // Loader pendiente en el historial (igual que depósito): se confirma al
      // detectar la tx on-chain — forward = MXNB out (a tesorería), inverse =
      // MXNB in (withdrawal). `ref` deduplica la fila normal mientras tanto.
      pending.add("convert", sellingMXNB ? amt : d.filledTo ?? result ?? 0, {
        dir: sellingMXNB ? "out" : "in",
        ref: key,
      });
      setDoneInfo({
        fwd: sellingMXNB,
        received: d.filledTo ?? result ?? 0,
        recCode: sellingMXNB ? toCode : "MXN",
        spent: d.filledFrom ?? amt,
        spentCode: fromCode,
      });
      setMsg("");
      // Pop-up de confirmación breve (~4s) y se cierra solo (solo si sigue en done).
      setStatus("done");
      setTimeout(() => setStatus((s) => (s === "done" ? "idle" : s)), 4000);
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : "No se pudo completar la conversión.");
    }
  };

  // Divisas con saldo: derivado local por-usuario, confirmado con el live de Bitso.
  const divisaCodes = Array.from(
    new Set([...Object.keys(localBalances), ...Object.keys(liveBalances).filter((c) => c !== "MXN")]),
  );

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title="Convertir" go={go} back="card" />
      <div className="screen-pad">
        <div style={{ position: "relative" }}>
          <div className="conv-field">
            <ConvAssetBadge flag={from.flag} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)" }}>{from.name}</p>
              <MoneyInput
                className="big num"
                value={amount}
                onChange={(v) => { setAmount(v); setStatus("idle"); }}
                style={{ background: "none", border: "none", outline: "none", color: "var(--txt)", width: "100%", padding: 0, margin: "2px 0 0" }}
              />
            </div>
            <ConvSelect value={fromCode} onChange={(v) => { setFromCode(v); setStatus("idle"); }} exclude={toCode} />
          </div>
          <div className="conv-swap" onClick={swap} style={{ cursor: "pointer" }}><Icon name="swap" size={20} /></div>
          <div className="conv-field">
            <ConvAssetBadge flag={to.flag} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)" }}>{to.name}</p>
              <p className="big num" style={{ margin: "2px 0 0" }}>{result == null ? "—" : FMT(result, to.dec)}</p>
            </div>
            <ConvSelect value={toCode} onChange={(v) => { setToCode(v); setStatus("idle"); }} exclude={fromCode} />
          </div>
        </div>

        {/* % del balance a convertir */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "12px 4px 8px" }}>
          <span style={{ fontSize: 12, color: "var(--txt-dim)" }}>
            Disponible: <b className="num" style={{ color: "var(--txt-muted)" }}>{FMT(availableFrom, from.dec)} {from.code}</b>
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPct(p)}
              disabled={availableFrom <= 0}
              style={{ flex: 1, padding: "9px 0", borderRadius: 11, border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--txt-muted)", fontWeight: 800, fontSize: 12.5, cursor: availableFrom > 0 ? "pointer" : "not-allowed", opacity: availableFrom > 0 ? 1 : 0.5 }}
            >
              {p === 100 ? "MÁX" : `${p}%`}
            </button>
          ))}
        </div>

        <div className="card" style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="gmatch">
            <Icon name="globe" size={16} color="var(--accent)" /> 1 {from.code} = <b>{unitRate == null ? "—" : FMT(unitRate, 4)} {to.code}</b>
          </div>
          <span className="pos-pill">{loading ? "Bitso…" : "Tipo Bitso"}</span>
        </div>

        <button
          className="btn btn-primary"
          style={{ marginTop: 14 }}
          disabled={!oneSideIsMXN || amt <= 0 || status === "sending" || result == null}
          onClick={doConvert}
        >
          {status === "sending" ? <span className="spin" /> : <><Icon name="swap" size={18} /> Convertir {amt > 0 ? `${FMT(amt, from.dec)} ${from.code}` : ""}</>}
        </button>

        {!oneSideIsMXN && (
          <p style={{ fontSize: 12, color: "var(--txt-dim)", margin: "10px 4px 0" }}>Una de las divisas debe ser MXN para ejecutar la conversión.</p>
        )}
        {/* Pop-up de estado: "en camino" (loader) → completado / error */}
        {status !== "idle" && (
          <Portal>
            <div
              onClick={status === "sending" ? undefined : () => setStatus("idle")}
              style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 22 }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="screen-enter"
                style={{ width: "100%", maxWidth: 360, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 24, padding: "30px 24px", textAlign: "center" }}
              >
                {status === "sending" && (
                  <>
                    <span className="spin" style={{ width: 46, height: 46, color: "var(--accent)", margin: "0 auto" }} />
                    <h3 style={{ margin: "20px 0 0", fontSize: 19, fontWeight: 800 }}>Tu cambio está en camino</h3>
                    <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
                      Estamos procesando tu conversión y confirmándola en tu saldo. Puede tardar unos segundos…
                    </p>
                  </>
                )}
                {status === "done" && doneInfo && (
                  <>
                    <div style={{ width: 58, height: 58, borderRadius: "50%", background: "var(--accent-soft)", display: "grid", placeItems: "center", margin: "0 auto" }}>
                      <Icon name="check" size={30} color="var(--accent)" />
                    </div>
                    <h3 style={{ margin: "18px 0 0", fontSize: 19, fontWeight: 800 }}>¡Cambio completado!</h3>
                    <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--txt-muted)", lineHeight: 1.55 }}>
                      Recibiste <b className="num" style={{ color: "var(--txt)" }}>{FMT(doneInfo.received, doneInfo.fwd ? to.dec : 2)} {doneInfo.recCode}</b>
                      {doneInfo.fwd ? " en tu saldo en divisas." : " en tu wallet."}
                      <br />
                      Se descontó <b className="num" style={{ color: "var(--txt)" }}>{FMT(doneInfo.spent, doneInfo.fwd ? 2 : assetByCode(doneInfo.spentCode)?.dec ?? 2)} {doneInfo.fwd ? "MXN" : doneInfo.spentCode}</b> de tu saldo.
                    </p>
                    <button className="btn btn-primary" style={{ marginTop: 22 }} onClick={() => setStatus("idle")}>Listo</button>
                  </>
                )}
                {status === "error" && (
                  <>
                    <div style={{ width: 58, height: 58, borderRadius: "50%", background: "rgba(255,90,90,0.14)", display: "grid", placeItems: "center", margin: "0 auto" }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--neg)" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </div>
                    <h3 style={{ margin: "18px 0 0", fontSize: 19, fontWeight: 800 }}>No se completó</h3>
                    <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>{msg || "No se pudo ejecutar la conversión."}</p>
                    <button className="btn btn-primary" style={{ marginTop: 22 }} onClick={() => setStatus("idle")}>Entendido</button>
                  </>
                )}
              </div>
            </div>
          </Portal>
        )}

        {/* Tus divisas: tarjetas horizontales (saldo por-usuario derivado de tus conversiones) */}
        {divisaCodes.length > 0 && (
          <>
            <div className="sec-head"><h3>Tus divisas</h3></div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
              {divisaCodes.map((code) => {
                const a = assetByCode(code);
                const bal = localBalances[code] ?? 0;
                const live = liveBalances[code]?.available;
                return (
                  <div key={code} className="card" style={{ flex: "0 0 auto", minWidth: 130, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Flag code={a?.flag || "us"} cls="sm" />
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{code}</span>
                    </div>
                    <p className="num" style={{ margin: "10px 0 0", fontWeight: 800, fontSize: 20 }}>{FMT(bal, a?.dec ?? 2)}</p>
                    {live != null && (
                      <p className="num" style={{ margin: "2px 0 0", fontSize: 11, color: "var(--txt-dim)" }}>Bitso: {FMT(live, a?.dec ?? 2)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <p style={{ fontSize: 12, color: "var(--txt-dim)", margin: "14px 4px 0", lineHeight: 1.5 }}>
          Tasas y ejecución vía <b style={{ color: "var(--txt)" }}>Bitso</b> en tiempo real. USDC no opera contra MXN en Bitso; el dólar digital disponible es USDT.
        </p>

        <div className="sec-head"><h3>Tipos de cambio (Bitso)</h3>{error && <span className="link" style={{ color: "var(--neg)" }}>sin conexión</span>}</div>
        <div className="card" style={{ padding: "4px 18px" }}>
          {BITSO_ASSETS.filter((a) => a.book).map((a) => {
            const price = mxnPriceOf(a.code);
            return (
              <div className="fx-row" key={a.code}>
                <Flag code={a.flag || "us"} cls="sm" />
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{a.code}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{a.name}</p>
                </div>
                <div className="fx-rate">
                  <div className="r num">{price == null ? "—" : `$${FMT(price, 4)}`}</div>
                  <div className="num" style={{ fontSize: 11, color: "var(--txt-dim)" }}>MXN</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="scroll-bottom" />
    </div>
  );
}


/** Traduce el error de un revert/cancelación on-chain a un mensaje claro para el usuario. */
function friendlyVaultError(e: unknown, assetSymbol = "MXN"): string {
  const raw = (e instanceof Error ? e.message : String(e)) || "";
  const s = raw.toLowerCase();
  if (s.includes("beta cap"))
    return "Durante la beta, tu saldo total en bóvedas no puede superar $10,000 MXN. Reduce el monto e intenta de nuevo.";
  if (s.includes("free balance") || s.includes("exceeds free"))
    return "No puedes retirar el colateral bloqueado por un adelanto activo. Repaga el adelanto primero.";
  if (s.includes("paused"))
    return "Las bóvedas están en mantenimiento por el momento. Intenta más tarde.";
  if (s.includes("user rejected") || s.includes("denied") || s.includes("rejected the request"))
    return "Cancelaste la operación.";
  if (s.includes("insufficient") || s.includes("underfunded") || s.includes("under_funded"))
    return `Saldo insuficiente de ${assetSymbol} en tu wallet para completar la operación.`;
  if (s.includes("txbadauth") || s.includes("bad auth"))
    return "No se pudo autorizar la transacción. Vuelve a conectar tu wallet e intenta de nuevo.";
  if (s.includes("fee_limit"))
    return `Esta operación cuesta una pequeña comisión de red en XLM (se descuenta de tu saldo XLM, no de tu ${assetSymbol}). Si el error persiste, recarga la página e intenta de nuevo.`;
  if (s.includes("slippage") || s.includes("blend"))
    return "El depósito no pudo invertirse por variación de precio. Intenta con un monto menor.";
  if (raw.trim().length > 0 && raw.length < 200) return raw;
  return "No se pudo completar la operación. Intenta de nuevo en un momento.";
}

function VaultAmountModal({ mode, vault, assetSymbol = "MXN", locked = 0, maxDeposit, cap, onClose, onConfirm }: { mode: "abonar" | "retirar"; vault: UserVault; assetSymbol?: string; locked?: number; maxDeposit?: number; cap?: number; onClose: () => void; onConfirm: (amt: number) => void | Promise<string | undefined> }) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Abonar: limitado por el cupo disponible bajo el tope de la beta (cap por usuario,
  // leído on-chain). Si no se conoce el cupo, no se restringe localmente.
  // Retirar: limitado por el saldo LIBRE (saldo − colateral bloqueado por un adelanto).
  const max = mode === "retirar" ? Math.max(0, vault.bal - locked) : (maxDeposit ?? Infinity);
  const n = Number(amount);
  const valid = n > 0 && n <= max && !submitting;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const hash = await onConfirm(n);
      if (typeof hash === "string" && hash) setTxHash(hash);
      setDone(true);
    } catch (e) {
      setError(friendlyVaultError(e, assetSymbol));
    } finally {
      setSubmitting(false);
    }
  };

  // Pop-up de confirmación (abonar y retirar) con comprobante del explorador.
  if (done) {
    const isAbono = mode === "abonar";
    const explorerUrl = txHash
      ? STELLAR_RAIL
        ? stellarTxExplorerUrl(txHash)
        : `${explorerBase}/tx/${txHash}`
      : null;
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
          <div className="modal-grab" />
          {isAbono && <Celebration originY="22%" />}
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <motion.span
              initial={{ scale: 0, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 16, delay: 0.05 }}
              style={{ width: 64, height: 64, borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              <Icon name="check" size={32} />
            </motion.span>
            <p className="modal-title" style={{ marginTop: 16, textAlign: "center" }}>
              {isAbono ? "¡Guardado en tu bóveda!" : "Retiro listo"}
            </p>
            <motion.p
              className="num"
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.18, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              style={{ margin: "6px 0 0", fontSize: 30, fontWeight: 700, color: "var(--accent)" }}
            >
              ${FMT(n, 2)} MXN
            </motion.p>
            <p className="modal-sub" style={{ textAlign: "center", marginTop: 8 }}>
              {isAbono ? (
                <>Tu dinero quedó guardado en <b style={{ color: "var(--txt)" }}>{vault.nm}</b> y ya está rindiendo.</>
              ) : (
                <>Retirados de <b style={{ color: "var(--txt)" }}>{vault.nm}</b>. Ya están en tus <b style={{ color: "var(--accent)" }}>Pesos digitales</b>.</>
              )}
            </p>
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 16, padding: "10px 16px", borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent)", fontSize: 13, fontWeight: 700 }}
              >
                <Icon name="check" size={15} /> Ver comprobante en el explorador →
              </a>
            ) : (
              <p className="modal-sub" style={{ textAlign: "center", marginTop: 12, fontSize: 12, opacity: 0.7 }}>
                Operación confirmada.
              </p>
            )}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={onClose}>Listo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={submitting ? undefined : onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">{mode === "abonar" ? "Abonar a" : "Retirar de"} {vault.nm}</p>

        {mode === "retirar" && (
          <div className="card" style={{ marginTop: 4, marginBottom: 4, background: "var(--accent-soft)", border: "none", display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="recv" size={16} color="var(--accent)" />
            <p style={{ margin: 0, fontSize: "var(--t-xs)", color: "var(--txt-muted)", lineHeight: 1.5 }}>
              El monto pasará a tus <b style={{ color: "var(--accent)" }}>Pesos digitales</b>, disponible al instante.
            </p>
          </div>
        )}

        <span className="field-label">
          Monto ({STELLAR_RAIL ? assetSymbol : "MXN"})
        </span>
        <MoneyInput
          className="input num-input"
          placeholder="0.00"
          value={amount}
          onChange={setAmount}
        />
        {mode === "retirar" && (
          <p className="modal-sub" style={{ margin: "8px 0 0" }}>
            Disponible para retirar: ${FMT(max, 2)}
            {locked > 0 && (
              <> · <span style={{ color: "var(--warning, #E8A838)" }}>${FMT(locked, 2)} bloqueado por adelanto</span></>
            )}
          </p>
        )}
        {mode === "abonar" && maxDeposit != null && (
          <p className="modal-sub" style={{ margin: "8px 0 0" }}>
            Puedes depositar hasta ${FMT(max, 2)}
            {cap != null && <span style={{ color: "var(--txt-dim)" }}> · tope de la beta ${FMT(cap, 0)} por usuario</span>}
          </p>
        )}
        {n > max && Number.isFinite(max) && (
          <p className="modal-sub" style={{ margin: "4px 0 0", color: "var(--neg)" }}>
            {mode === "abonar"
              ? `Durante la beta puedes depositar como máximo $${FMT(max, 2)} más.`
              : `El máximo retirable es $${FMT(max, 2)}${locked > 0 ? " (tienes colateral bloqueado por un adelanto activo)" : ""}.`}
          </p>
        )}

        {error && (
          <div className="card" style={{ marginTop: 14, borderColor: "var(--neg)", display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name="info" size={18} color="var(--neg)" />
            <p style={{ margin: 0, color: "var(--neg)", fontSize: 13, lineHeight: 1.45 }}>{error}</p>
          </div>
        )}

        <button className="btn btn-primary" style={{ marginTop: 18 }} disabled={!valid} onClick={submit}>
          {submitting ? <span className="spin" /> : mode === "abonar" ? "Abonar" : "Retirar a Pesos digitales"}
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose} disabled={submitting}>Cancelar</button>
      </div>
    </div>
  );
}
