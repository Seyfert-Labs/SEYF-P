"use client";

/* Pantallas de ahorro: Bóvedas, detalle de bóveda y conversión FX */
import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Icon } from "../ui";
import { Celebration } from "../Celebration";
import { Seyf3D } from "@/components/brand/Seyf3D";
import { GrowthBars, VaultDial } from "../SavingsArt";
import { BondPicker, COIN_GRADIENT, CoinSphere, coinKind } from "../BondCoins";
import { SubHeader, AvatarButton } from "../shared";
import { IS_MAINNET } from "@/lib/rails";
import { FMT, RISK_PROFILES, planByApy, planById, projectSavings, loadRiskProfile, type VaultPlan, type RiskLevel, type AllocationSlice } from "../data";
import { GrowingAmount, YieldRate } from "../GrowingAmount";
import { MoneyInput, formatWithCommas } from "../MoneyInput";
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
import { useAppRetiro } from "../RetiroContext";
import { toBigInt, unitsToNumber } from "@/components/retiro/units";
import { stellarTxExplorerUrl } from "@/lib/etherfuse/stellar-tx-url";
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";
import { tradableSdexAssets, sdexAssetByCode, type SdexAsset } from "@/lib/sdex/assets";
import { quoteSdexSwap, executeSdexSwap } from "@/lib/sdex/swap";

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

/** Bóveda como tarjeta (estilo cartera): se apilan y cada una lleva el color
    y la moneda de su activo. Tocarla abre el detalle, igual que antes. */
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
  // APY efectivo para que el saldo crezca en vivo aunque la bóveda guarde apy 0.
  const effApy = v.apy > 0 ? v.apy : strat ? strat.apyTarget : plan.apy;
  const kind = strat ? coinKind(strat) : "other";
  const [c1, c2] = COIN_GRADIENT[kind];
  return (
    <motion.div
      className="vcard"
      role="button"
      tabIndex={0}
      onClick={() => go("boveda", v)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") go("boveda", v); }}
      style={{ "--vc1": c1, "--vc2": c2, zIndex: index + 1 } as React.CSSProperties}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="vc-ring" />
      <div className="vc-top">
        <p className="vc-nm">{v.nm}</p>
        <span className="vc-chip">{strat?.assetSymbol ?? strategyLabel ?? plan.name} · {FMT(effApy, 1)}%</span>
      </div>
      <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.75 }}>{strategyLabel ?? strat?.name ?? plan.name}</p>
      <div className="vc-bal">
        <p className="k">En tu bóveda</p>
        <GrowingAmount base={v.bal} apy={effApy} size={30} align="left" color="#fff" id={`vault-${v.id}`} anchorMs={v.updatedAt} />
      </div>
      <span className="vc-mark"><CoinSphere kind={kind} size={40} label={strat?.assetSymbol} /></span>
    </motion.div>
  );
}

export function ScreenVaults({ go }: { go: Go }) {
  const wallet = useWallet();
  const { vaults, addVault, totalSaved, busy, onchain, ready, sessionOk } = useVaultsRail(wallet.address);
  const [createError, setCreateError] = useState<string | null>(null);
  const { strategies, byPlanId } = useDefindexStrategies();
  const [opening, setOpening] = useState(false);
  const [creating, setCreating] = useState<null | { stellar?: DefindexStrategyLive; evmPlan?: VaultPlan }>(null);
  const [recId] = useState<string | null>(() => loadRiskProfile());
  const recPlan = recId ? planById(recId) : null;

  // Preferencia XLM: es la bóveda con la que el usuario sí puede depositar
  // (tiene XLM por Friendbot). Se preselecciona aunque el quiz recomiende otra.
  // En mainnet solo opera el vault USDC (el del adelanto); CETES y XLM son de testnet.
  // Si el catálogo no trae USDC, no se oculta nada (mejor ver opciones que una pantalla vacía).
  const usdcOnly = strategies.filter((s) => s.assetSymbol === "USDC");
  const offered = IS_MAINNET && usdcOnly.length > 0 ? usdcOnly : strategies;
  const defaultStrategy = IS_MAINNET
    ? offered[0]
    : byPlanId("balanceado") ?? (recPlan && byPlanId(recPlan.id)) ?? strategies[0];

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
  const { isAuthenticated: pollarOk, wallet: pollarWallet } = usePollar();
  const pollarPk = pollarWallet?.address;
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
    setCreateError(null);
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
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "No se pudo crear la bóveda. Intenta de nuevo.");
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
          <div className="card" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12, background: "var(--surface-2)" }}>
            <span className="spin" style={{ color: "var(--accent)" }} />
            <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)" }}>Procesando en la red… esto tarda unos segundos.</p>
          </div>
        )}

        {/* Hero — ahorro total creciendo en vivo */}
        {/* Héroe sólido: barras de crecimiento animadas. */}
        <div className="hero-v2">
          <div className="savings-hero">
            <div style={{ minWidth: 0 }}>
              <p className="eyebrow">Tu ahorro total</p>
              <div style={{ marginTop: 12 }}>
                                <GrowingAmount base={totalSaved} apy={weightedApy} size={44} align="left" color="#fff" id="vaults-total" anchorMs={totalAnchorMs} />
              </div>
            </div>
            <GrowthBars size={112} live={totalSaved > 0} />
          </div>
          {totalSaved > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <span className="pos-pill"><Icon name="leaf" size={12} /> {FMT(weightedApy, 1)}% anual</span>
              <YieldRate base={totalSaved} apy={weightedApy} />
            </div>
          ) : (
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "rgba(244,242,251,.75)", lineHeight: 1.5 }}>
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
          <div className="card" style={{ marginTop: 14, padding: "14px 16px", background: "var(--surface-2)", border: "1px solid var(--accent)" }}>
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

        {STELLAR_RAIL && ready && !sessionOk && (
          <div className="card" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, background: "var(--surface-2)" }}>
            <Icon name="info" size={20} color="var(--txt-muted)" />
            <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.45 }}>
              Tu sesión segura no está abierta: ves tu saldo, pero los nombres de tus bóvedas aparecen al abrirla.
            </p>
          </div>
        )}

        {/* Mis bóvedas — metas con nombre propio del usuario */}
        <div className="sec-head">
          <h3>Mis bóvedas</h3>
          <span style={{ fontSize: 12, color: "var(--txt-dim)", fontWeight: 700 }}>{vaults.length}/{MAX_VAULTS}</span>
        </div>
        {!ready ? (
          <div className="card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="spin" style={{ color: "var(--accent)" }} />
            <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.45 }}>Cargando tus bóvedas…</p>
          </div>
        ) : vaults.length === 0 ? (
          <button type="button" className="first-vault" onClick={() => setCreating({ stellar: defaultStrategy })}>
            <VaultDial color="#C8FF4D" size={50} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="t">Crea tu primera bóveda</p>
              <p className="s">Ponle nombre a tu meta y elige dónde rinde.</p>
            </div>
            <span style={{ width: 36, height: 36, borderRadius: 12, background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon name="plus" size={18} />
            </span>
          </button>
        ) : (
          <div className="vstack">
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
              <button type="button" className="vcard add" onClick={() => setCreating({ stellar: defaultStrategy })}>
                <Icon name="plus" size={18} /> Nueva bóveda
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
          <h3>{STELLAR_RAIL ? "Tasas de hoy" : "Estrategias de ahorro"}</h3>
        </div>
        {STELLAR_RAIL && (
          <p style={{ margin: "0 2px 12px", fontSize: 12.5, color: "var(--txt-muted)", lineHeight: 1.5 }}>
            Lo que paga hoy cada activo. Cambia con el mercado.
          </p>
        )}
        {!STELLAR_RAIL && (
          <p style={{ margin: "0 2px 14px", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
            {recPlan ? (
              <>Según tu perfil te recomendamos <b style={{ color: "var(--accent)" }}>{recPlan.name}</b>.</>
            ) : (
              <>Cada perfil ajusta tu mezcla de instrumentos soberanos según tu horizonte.</>
            )}
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {STELLAR_RAIL
            ? offered.length > 0 && (
                // Lista informativa de tasas (la elección con monedas vive solo en "Nueva bóveda").
                // Tocar una fila hace lo mismo que antes el botón "Abrir bóveda en …".
                <div className="card rate-list">
                  {offered.map((s) => {
                    const apy = s.apy ?? s.apyTarget;
                    return (
                      <button
                        key={s.planId}
                        type="button"
                        className="rate-row"
                        disabled={atCap}
                        onClick={atCap ? undefined : () => setCreating({ stellar: s })}
                      >
                        <CoinSphere kind={coinKind(s)} size={38} label={s.assetSymbol} />
                        <div className="rr-mid">
                          <p className="rr-nm">
                            {s.assetSymbol ?? s.name}
                            {recPlan?.id === s.planId && <span style={{ marginLeft: 6, verticalAlign: -1 }}><Icon name="star" size={12} color="var(--accent)" /></span>}
                          </p>
                          <p className="rr-ex">{s.exposure} · Riesgo {s.risk.toLowerCase()}</p>
                        </div>
                        <div className="rr-apy">
                          <div className="v num">{apy != null && Number.isFinite(apy) ? `${FMT(apy, 1)}%` : "—"}</div>
                          <div className="k">anual</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
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
            strategies={offered}
            busy={opening}
            vaults={vaults}
            sessionOk={sessionOk}
            error={createError}
            onOpenExisting={(v) => { setCreating(null); go("boveda", v); }}
            onClose={() => { setCreating(null); setCreateError(null); }}
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

/** Crear bóveda Stellar: nombre + estrategia DeFindex (CETES/USDC/XLM).
    Valida el nombre y avisa antes de crear: si ya hay una bóveda en ese activo
    (una posición on-chain por activo) o si la sesión segura no está abierta. */
function CreateVaultModalStellar({
  preset, recId, strategies, busy, vaults, sessionOk, error, onOpenExisting, onClose, onCreate,
}: {
  preset: DefindexStrategyLive;
  recId: string | null;
  strategies: DefindexStrategyLive[];
  busy: boolean;
  vaults: UserVault[];
  sessionOk: boolean;
  error: string | null;
  onOpenExisting: (v: UserVault) => void;
  onClose: () => void;
  onCreate: (name: string, strategy: DefindexStrategyLive) => void;
}) {
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const defaultId =
    preset?.planId
    ?? (recId && strategies.find((s) => s.planId === recId)?.planId)
    ?? strategies[0]?.planId
    ?? "conservador";
  const [planId, setPlanId] = useState<string>(defaultId);
  const strategy = strategies.find((s) => s.planId === planId) ?? preset;
  const existing = vaults.find((v) => inferPlanIdForVault(v) === strategy?.planId);
  const nameMissing = name.trim().length === 0;
  const showNameError = touched && nameMissing;

  const submit = () => {
    setTouched(true);
    if (nameMissing || existing || !sessionOk) return;
    onCreate(name, strategy);
  };

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="modal-title">Nueva bóveda</p>
            <p className="modal-sub" style={{ marginTop: 2 }}>Dos pasos: ponle nombre y elige dónde rinde.</p>
          </div>
          <Seyf3D kind="suitcase" size={88} style={{ margin: "-10px -6px -10px 0" }} />
        </div>

        <div className="cv-step">
          <span className="cv-n">1</span>
          <label className="cv-lb" htmlFor="cv-name">¿Para qué es esta bóveda?</label>
        </div>
        <input
          id="cv-name"
          className={`input${showNameError ? " input-err" : ""}`}
          placeholder="Ej. Fondo de emergencia, Viaje, Enganche…"
          value={name}
          maxLength={32}
          autoFocus
          aria-invalid={showNameError}
          aria-describedby="cv-name-help"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        <p id="cv-name-help" className={`cv-help${showNameError ? " err" : ""}`}>
          {showNameError ? "Escribe un nombre para tu bóveda." : `${name.trim().length}/32 · Así la verás en tu lista.`}
        </p>

        <div className="cv-step" style={{ marginTop: 14 }}>
          <span className="cv-n">2</span>
          <span className="cv-lb">Dónde rinde</span>
        </div>
        <BondPicker options={strategies} value={planId} onChange={setPlanId} compact />

        {existing && (
          <div className="cv-note">
            <Icon name="info" size={18} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 800 }}>Ya tienes una bóveda en {strategy?.assetSymbol}</p>
              <p style={{ margin: "3px 0 0", color: "var(--txt-muted)" }}>
                «{existing.nm}» ya guarda tu ahorro en {strategy?.assetSymbol}. Abónale ahí; no se puede abrir otra en el mismo activo.
              </p>
            </div>
          </div>
        )}
        {!existing && !sessionOk && (
          <div className="cv-note">
            <Icon name="shield" size={18} />
            <p style={{ margin: 0, flex: 1, color: "var(--txt-muted)" }}>
              Abre tu sesión segura (aviso de abajo) para poder guardar la bóveda.
            </p>
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}

        {existing ? (
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => onOpenExisting(existing)}>
            Ir a «{existing.nm}»
          </button>
        ) : (
          <button className="btn btn-primary" style={{ marginTop: 18 }} disabled={busy || !sessionOk} onClick={submit}>
            {busy ? <span className="spin" /> : <><Icon name="plus" size={18} /> Crear bóveda</>}
          </button>
        )}
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
  const { vaults, updateBalance, removeVault, reload, busy, onchain, limits } = useVaultsRail(wallet.address);
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
  // Saldo de la wallet en el activo de la bóveda: lo que se puede abonar. Sin
  // filas de saldo (aún cargando o sin conectar) no se conoce y no se limita.
  const stellar = useSeyfStellarWallet();
  const walletRow = stellar.assetBalances.find((b) => (b.code || "").toUpperCase() === vaultAsset.toUpperCase());
  const walletAvailable = STELLAR_RAIL && stellar.assetBalances.length > 0 ? Number(walletRow?.balance ?? 0) : undefined;

  // Adelanto (`seyf_advance`): al abrirlo, las acciones del vault pasan al
  // contrato en garantía, así que el saldo de la bóveda ya es solo lo libre.
  const retiro = useAppRetiro();
  const advPos = retiro?.ctx.data.advance.data?.position ?? null;
  const advStatus = retiro?.ctx.data.advance.data?.unlockStatus ?? null;
  const isAdvanceVault = Boolean(STELLAR_RAIL && defindexStrategy?.assetSymbol === "USDC");
  const advanceDebt = isAdvanceVault && advPos ? unitsToNumber(toBigInt(advPos.advance)) : 0;
  const advanceEscrow = isAdvanceVault && advPos ? unitsToNumber(toBigInt(advStatus?.valueNow ?? advPos.valueAtOpen)) : 0;
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
        <div
          className="vault-hero"
          style={(() => {
            const [c1, c2] = COIN_GRADIENT[defindexStrategy ? coinKind(defindexStrategy) : "xlm"];
            return { "--vc1": c1, "--vc2": c2 } as React.CSSProperties;
          })()}
        >
          <motion.div
            aria-hidden
            style={{
              position: "absolute", left: "50%", top: "46%", width: 260, height: 260,
              marginLeft: -130, marginTop: -130, borderRadius: "50%", pointerEvents: "none",
              background: "radial-gradient(circle, rgba(255,255,255,.18), transparent 70%)",
            }}
            animate={reduced ? undefined : { scale: [1, 1.18, 1], opacity: [0.45, 0.85, 0.45] }}
            transition={reduced ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
          {STELLAR_RAIL && defindexStrategy && (
            <p style={{ position: "relative", margin: "0 0 8px", fontSize: 12, color: "rgba(255,255,255,.75)" }}>
              Activo · <b style={{ color: "#fff" }}>{defindexStrategy.name}</b>
            </p>
          )}
          <div style={{ position: "relative" }}>
            {/* Violeta = saldo en bóveda (convención de estado en toda la app). */}
            <GrowingAmount base={v.bal} apy={liveApy} size={56} color="#fff" id={`vault-${v.id}`} anchorMs={v.updatedAt} countUpOnMount />
          </div>
          <p style={{ position: "relative", fontSize: 13.5, color: "rgba(255,255,255,.75)", margin: "10px 0 0" }}>
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
                  <CoinSphere kind={coinKind(defindexStrategy)} size={44} label={defindexStrategy.assetSymbol} />
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
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={async () => { if (await ensureConnected("retirar de tu bóveda")) setAction("retirar"); }} disabled={!canFund || busy || v.bal <= 0}>Retirar</button>
        </div>
        {!canFund && (
          <p style={{ margin: "12px 4px 0", fontSize: 12, color: "var(--txt-dim)", lineHeight: 1.5, textAlign: "center" }}>
            {STELLAR_RAIL
              ? "Configura tu bóveda para abonar y retirar."
              : "Abonar y retirar se activan al conectar el contrato on-chain."}
          </p>
        )}
        {/* Adelanto — acción de liquidez sobre el ahorro para el retiro. Cotizar,
            pedir y repagar viven en LiquidityAdvanceModal; aquí solo el acceso. */}
        {isAdvanceVault && (v.bal > 0 || advanceDebt > 0) && (
          advanceDebt > 0 ? (
            <button
              className="btn btn-ghost"
              style={{ marginTop: 12, justifyContent: "space-between" }}
              onClick={() => setAdvance(true)}
              disabled={busy}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Icon name="bolt" size={18} color="var(--warning, #E8A838)" /> Adelanto activo · {FMT(advanceDebt, 2)} USDC · {FMT(advanceEscrow, 2)} en garantía
              </span>
              <Icon name="chevR" size={16} color="var(--txt-dim)" />
            </button>
          ) : (
            <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setAdvance(true)} disabled={busy}>
              <Icon name="bolt" size={18} /> Adelantar rendimiento
            </button>
          )
        )}
        {/* Solo se elimina una bóveda vacía: con saldo (o garantía de un adelanto) el botón no aparece. */}
        {v.bal > 0 || advanceDebt > 0 ? (
          <p style={{ marginTop: 18, fontSize: 12, color: "var(--txt-dim)" }}>
            {advanceDebt > 0
              ? "Para eliminar esta bóveda, primero repaga tu adelanto y retira tu saldo."
              : "Para eliminar esta bóveda, primero retira tu saldo."}
          </p>
        ) : (
          <button disabled={busy} onClick={async () => { await removeVault(v.id); go("bovedas"); }} style={{ marginTop: 18, background: "none", border: "none", color: "var(--neg)", fontWeight: 700, fontSize: 13, cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1 }}>Eliminar bóveda</button>
        )}
      </div>
      <div className="scroll-bottom" />
      {action && (
        <Portal>
          <VaultAmountModal
            mode={action}
            vault={v}
            assetSymbol={vaultAsset}
            locked={0}
            maxDeposit={limits?.available}
            cap={limits?.max}
            walletAvailable={walletAvailable}
            onClose={() => setAction(null)}
            onConfirm={(amt) => updateBalance(v.id, action === "abonar" ? amt : -amt)}
          />
        </Portal>
      )}
      {advance && (
        <Portal>
          <LiquidityAdvanceModal
            onClose={() => { setAdvance(false); retiro?.ctx.data.refresh(); void reload(); }}
            onGoSavings={() => go("bovedas")}
          />
        </Portal>
      )}
    </div>
  );
}

/* ---------------- CONVERTIR · próximamente (mainnet) ---------------- */
export function ScreenConvertSoon({ go }: { go: Go }) {
  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title="Convertir" go={go} back="home" />
      <div className="screen-pad">
        <div className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
          <Icon name="swap" size={30} color="var(--accent)" />
          <p style={{ margin: "14px 0 6px", fontWeight: 800, fontSize: 17 }}>Próximamente</p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
            Cambiar entre pesos y dólares digitales llega con la rampa SPEI. Mientras tanto, tu ahorro rinde en tu bóveda.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={() => go("bovedas")}>Ir a mis bóvedas</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- CONVERTIR (SDEX · Stellar DEX) ---------------- */
function SwapAssetBadge({ emoji }: { emoji: string }) {
  return (
    <span style={{ width: 40, height: 40, borderRadius: 999, background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{emoji}</span>
  );
}

function SwapSelect({ value, onChange, exclude, assets }: { value: string; onChange: (v: string) => void; exclude?: string; assets: SdexAsset[] }) {
  return (
    <select
      className="chip"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ appearance: "none", WebkitAppearance: "none", cursor: "pointer", color: "var(--txt)", fontWeight: 700 }}
    >
      {assets.filter((a) => a.code !== exclude).map((a) => (
        <option key={a.code} value={a.code} style={{ color: "#000" }}>{a.code}</option>
      ))}
    </select>
  );
}

export function ScreenConvert({ go }: { go: Go }) {
  const stellar = useSeyfStellarWallet();
  const { ensureConnected } = useStellarConnect();
  const assets = tradableSdexAssets();
  const fallbackCode = assets[0]?.code ?? "XLM";
  const [fromCode, setFromCode] = useState<string>(() => assets.find((a) => a.code === "XLM")?.code ?? fallbackCode);
  const [toCode, setToCode] = useState<string>(
    () => assets.find((a) => a.code === "USDC")?.code ?? assets.find((a) => a.code !== "XLM")?.code ?? fallbackCode,
  );
  const [amount, setAmount] = useState("10");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [quoteOut, setQuoteOut] = useState<number | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [doneInfo, setDoneInfo] = useState<
    { received: number; recCode: string; spent: number; spentCode: string; txHash?: string } | null
  >(null);

  const from = sdexAssetByCode(fromCode) ?? assets[0];
  const to = sdexAssetByCode(toCode) ?? assets[1] ?? assets[0];
  const amt = Number(amount) || 0;
  const sameAsset = fromCode === toCode;

  // Saldo del activo origen leído de la wallet Pollar (XLM, USDC, …).
  const balanceOf = (code: string) =>
    Number(stellar.assetBalances.find((b) => (b.code || "").toUpperCase() === code.toUpperCase())?.balance ?? 0);
  const availableFrom = balanceOf(fromCode);

  useEffect(() => {
    if (stellar.authenticated) void stellar.refreshBalance();
  }, [stellar.authenticated, stellar.refreshBalance]);

  const swap = () => { setFromCode(toCode); setToCode(fromCode); setStatus("idle"); };
  const setPct = (p: number) => {
    const v = availableFrom * (p / 100);
    setAmount(v > 0 ? String(Number(v.toFixed(from?.decimals ?? 7))) : "0");
    setStatus("idle");
  };

  // Cotización en vivo (debounced) vía SDEX de Stellar.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (amt <= 0 || sameAsset) {
        if (!cancelled) { setQuoteOut(null); setQuoteErr(null); setQuoting(false); }
        return;
      }
      setQuoting(true);
      setQuoteErr(null);
      try {
        const r = await quoteSdexSwap(fromCode, toCode, amt);
        if (!cancelled) setQuoteOut(r.amountOut);
      } catch (e) {
        if (!cancelled) { setQuoteOut(null); setQuoteErr(e instanceof Error ? e.message : "Sin cotización"); }
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [fromCode, toCode, amt, sameAsset]);

  const result = quoteOut;
  const unitRate = quoteOut != null && amt > 0 ? quoteOut / amt : null;

  const doSwap = async () => {
    if (amt <= 0 || sameAsset) return;
    if (availableFrom + 1e-9 < amt) {
      setStatus("error");
      setMsg(`Saldo insuficiente de ${fromCode}. Disponible: ${FMT(availableFrom, from?.decimals ?? 7)}.`);
      return;
    }
    // Conecta la wallet Stellar (Pollar) justo antes de firmar, si hace falta.
    if (!(await ensureConnected("convertir tus activos"))) return;
    setStatus("sending");
    setDoneInfo(null);
    try {
      const res = await executeSdexSwap({
        from: fromCode,
        to: toCode,
        amount: amt,
        getClient: stellar.getClient,
      });
      void stellar.refreshBalanceAfterTx();
      setDoneInfo({ received: res.amountOut, recCode: toCode, spent: res.amountIn, spentCode: fromCode, txHash: res.txHash });
      setMsg("");
      // Pop-up de confirmación breve (~5s) y se cierra solo (solo si sigue en done).
      setStatus("done");
      setTimeout(() => setStatus((s) => (s === "done" ? "idle" : s)), 5000);
    } catch (e) {
      setStatus("error");
      setMsg(e instanceof Error ? e.message : "No se pudo ejecutar el swap.");
    }
  };

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title="Convertir" go={go} back="home" />
      <div className="screen-pad">
        <div style={{ position: "relative" }}>
          <div className="conv-field">
            <SwapAssetBadge emoji={from?.flag ?? "🪙"} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)" }}>{from?.name}</p>
              <MoneyInput
                className="big num"
                value={amount}
                onChange={(v) => { setAmount(v); setStatus("idle"); }}
                style={{ background: "none", border: "none", outline: "none", color: "var(--txt)", width: "100%", padding: 0, margin: "2px 0 0" }}
              />
            </div>
            <SwapSelect value={fromCode} onChange={(v) => { setFromCode(v); setStatus("idle"); }} exclude={toCode} assets={assets} />
          </div>
          <div className="conv-swap" onClick={swap} style={{ cursor: "pointer" }}><Icon name="swap" size={20} /></div>
          <div className="conv-field">
            <SwapAssetBadge emoji={to?.flag ?? "🪙"} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)" }}>{to?.name}</p>
              <p className="big num" style={{ margin: "2px 0 0" }}>{quoting ? "…" : result == null ? "—" : FMT(result, to?.decimals ?? 7)}</p>
            </div>
            <SwapSelect value={toCode} onChange={(v) => { setToCode(v); setStatus("idle"); }} exclude={fromCode} assets={assets} />
          </div>
        </div>

        {/* % del balance a convertir */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "12px 4px 8px" }}>
          <span style={{ fontSize: 12, color: "var(--txt-dim)" }}>
            Disponible: <b className="num" style={{ color: "var(--txt-muted)" }}>{FMT(availableFrom, from?.decimals ?? 7)} {from?.code}</b>
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
            <Icon name="globe" size={16} color="var(--accent)" /> 1 {from?.code} = <b>{unitRate == null ? "—" : FMT(unitRate, 6)} {to?.code}</b>
          </div>
          <span className="pos-pill">{quoting ? "SDEX…" : "Stellar DEX"}</span>
        </div>

        <button
          className="btn btn-primary"
          style={{ marginTop: 14 }}
          disabled={sameAsset || amt <= 0 || status === "sending" || quoting || availableFrom + 1e-9 < amt}
          onClick={doSwap}
        >
          {status === "sending" ? <span className="spin" /> : <><Icon name="swap" size={18} /> Convertir {amt > 0 ? `${FMT(amt, from?.decimals ?? 7)} ${from?.code}` : ""}</>}
        </button>

        {sameAsset ? (
          <p style={{ fontSize: 12, color: "var(--txt-dim)", margin: "10px 4px 0" }}>Elige dos activos distintos para convertir.</p>
        ) : quoteErr ? (
          <p style={{ fontSize: 12, color: "var(--neg)", margin: "10px 4px 0" }}>{quoteErr}</p>
        ) : null}
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
                    <Seyf3D kind="coins" size={130} burst style={{ margin: "-8px auto -6px" }} />
                    <h3 style={{ margin: "8px 0 0", fontSize: 19, fontWeight: 800 }}>¡Cambio completado!</h3>
                    <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--txt-muted)", lineHeight: 1.55 }}>
                      Recibiste <b className="num" style={{ color: "var(--txt)" }}>{FMT(doneInfo.received, 6)} {doneInfo.recCode}</b> en tu wallet Stellar.
                      <br />
                      Se descontó <b className="num" style={{ color: "var(--txt)" }}>{FMT(doneInfo.spent, 6)} {doneInfo.spentCode}</b>.
                    </p>
                    {doneInfo.txHash && (
                      <a
                        href={stellarTxExplorerUrl(doneInfo.txHash) || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: "inline-block", marginTop: 10, fontSize: 12.5, color: "var(--accent)", fontWeight: 700 }}
                      >
                        Ver en el explorador ↗
                      </a>
                    )}
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

        {/* Tus activos Stellar: saldos reales de la wallet Pollar (XLM, USDC, …) */}
        {stellar.assetBalances.length > 0 && (
          <>
            <div className="sec-head"><h3>Tus activos</h3></div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
              {stellar.assetBalances.map((b) => {
                const code = (b.code || "").toUpperCase();
                const meta = sdexAssetByCode(code);
                return (
                  <div key={code} className="card" style={{ flex: "0 0 auto", minWidth: 130, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{meta?.flag ?? "🪙"}</span>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{code}</span>
                    </div>
                    <p className="num" style={{ margin: "10px 0 0", fontWeight: 800, fontSize: 20 }}>{FMT(Number(b.balance ?? 0), 4)}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <p style={{ fontSize: 12, color: "var(--txt-dim)", margin: "14px 4px 0", lineHeight: 1.5 }}>
          Conversión on-chain en el <b style={{ color: "var(--txt)" }}>SDEX de Stellar</b> (libro de órdenes descentralizado). Las tasas vienen del mercado en vivo.
        </p>
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

function VaultAmountModal({ mode, vault, assetSymbol = "MXN", locked = 0, maxDeposit, cap, walletAvailable, onClose, onConfirm }: { mode: "abonar" | "retirar"; vault: UserVault; assetSymbol?: string; locked?: number; maxDeposit?: number; cap?: number; walletAvailable?: number; onClose: () => void; onConfirm: (amt: number) => void | Promise<string | undefined> }) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Abonar: limitado por el cupo disponible bajo el tope de la beta (cap por usuario,
  // leído on-chain). Si no se conoce el cupo, no se restringe localmente.
  // y por lo que hay en la wallet.
  // Retirar: limitado por el saldo LIBRE (saldo − colateral bloqueado por un adelanto).
  const capRoom = maxDeposit ?? Infinity;
  const walletRoom = walletAvailable ?? Infinity;
  const max = mode === "retirar" ? Math.max(0, vault.bal - locked) : Math.min(capRoom, walletRoom);
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
      ? stellarTxExplorerUrl(txHash)
      : null;
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ position: "relative" }}>
          <div className="modal-grab" />
          {isAbono && <Celebration originY="22%" />}
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <Seyf3D kind={isAbono ? "vault" : "coins"} size={150} burst style={{ margin: "-6px auto -10px" }} />
            <p className="modal-title" style={{ marginTop: 8, textAlign: "center" }}>
              {isAbono ? "¡Guardado en tu bóveda!" : "Retiro listo"}
            </p>
            <motion.p
              className="num"
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.18, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              style={{ margin: "6px 0 0", fontSize: 30, fontWeight: 700, color: "var(--accent)" }}
            >
              ${FMT(n, 2)} {assetSymbol}
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

        {/* Monto grande y centrado; mismo MoneyInput y mismo estado que antes. */}
        <div className="amount-xl">
          <div className="ax-row">
            <span className="ax-cur">$</span>
            <MoneyInput
              placeholder="0"
              value={amount}
              onChange={setAmount}
              aria-label={`Monto en ${STELLAR_RAIL ? assetSymbol : "MXN"}`}
              autoFocus
              // el ancho sigue al número para que el "$" quede pegado
              style={{ width: `${(formatWithCommas(amount) || "0").length + 0.6}ch` }}
            />
          </div>
          <div className="ax-sym">{STELLAR_RAIL ? assetSymbol : "MXN"}</div>
          {max > 0 && Number.isFinite(max) && (
            <div className="quick-amts">
              {[0.25, 0.5].map((f) => (
                <button key={f} type="button" className="chip" onClick={() => setAmount(String(Math.floor(max * f * 100) / 100))}>{f * 100}%</button>
              ))}
              <button type="button" className="chip" onClick={() => setAmount(String(Math.floor(max * 100) / 100))}>Todo</button>
            </div>
          )}
        </div>
        {mode === "retirar" && (
          <p className="modal-sub" style={{ margin: "8px 0 0" }}>
            Disponible para retirar: ${FMT(max, 2)}
            {locked > 0 && (
              <> · <span style={{ color: "var(--warning, #E8A838)" }}>${FMT(locked, 2)} bloqueado por adelanto</span></>
            )}
          </p>
        )}
        {mode === "abonar" && walletAvailable != null && (
          <p className="modal-sub" style={{ margin: "8px 0 0" }}>
            Disponible en tu wallet: <b style={{ color: "var(--txt)" }}>${FMT(walletAvailable, 2)} {assetSymbol}</b>
          </p>
        )}
        {mode === "abonar" && maxDeposit != null && (
          <p className="modal-sub" style={{ margin: "4px 0 0", color: "var(--txt-dim)" }}>
            Tope de la beta: te quedan ${FMT(maxDeposit, 2)}{cap != null && <> de ${FMT(cap, 0)} por usuario</>}
          </p>
        )}
        {mode === "abonar" && walletAvailable === 0 && (
          <p className="modal-sub" style={{ margin: "4px 0 0" }}>
            No tienes {assetSymbol} en tu wallet. Agrega dinero primero desde Inicio.
          </p>
        )}
        {n > max && Number.isFinite(max) && (
          <p className="modal-sub" style={{ margin: "4px 0 0", color: "var(--neg)" }}>
            {mode === "abonar"
              ? walletRoom <= capRoom
                ? `Solo tienes $${FMT(walletRoom, 2)} ${assetSymbol} disponibles en tu wallet.`
                : `Durante la beta puedes depositar como máximo $${FMT(max, 2)} más.`
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
