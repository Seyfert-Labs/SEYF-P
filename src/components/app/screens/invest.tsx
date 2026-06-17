"use client";

/* Pantallas de ahorro: Bóvedas, detalle de bóveda y conversión FX */
import React, { useState } from "react";
import { Icon, Flag } from "../ui";
import { SubHeader, AvatarButton } from "../shared";
import { FMT, RISK_PROFILES, planByApy, planById, projectSavings, loadRiskProfile, type VaultPlan, type RiskLevel, type AllocationSlice } from "../data";
import { GrowingAmount, YieldRate } from "../GrowingAmount";
import { MoneyInput } from "../MoneyInput";
import type { Go } from "../nav";
import { useWallet } from "@/components/wallet/WalletContext";
import { useVaults, MAX_VAULTS, type UserVault } from "@/hooks/useVaults";
import { LiquidityAdvanceModal } from "../LiquidityAdvanceModal";
import { RepayModal } from "../modals/RepayModal";
import { Portal } from "../Portal";
import { useAdvance } from "@/hooks/useAdvance";
import { useBitsoRates, useBitsoBalances } from "@/hooks/useBitsoRates";
import { useConversions } from "@/hooks/useConversions";
import { usePendingTxns } from "@/hooks/usePendingTxns";
import { BITSO_ASSETS, assetByCode } from "@/lib/bitso/assets";
import { TREASURY_ADDRESS, TREASURY_ENABLED, ADVANCE_ONCHAIN, explorerBase } from "@/lib/chain";

// Con Supabase, el ledger de conversiones lo escribe /api/convert (servidor);
// sin él, el cliente lo persiste localmente con la capa `store`.
const USE_SUPABASE = process.env.NEXT_PUBLIC_USE_SUPABASE === "true";

/* ---------------- DONUT CHART ---------------- */
const DONUT_R = 68;
const DONUT_CIRC = 2 * Math.PI * DONUT_R;
const DONUT_GAP = 3;

function DonutChart({ slices }: { slices: AllocationSlice[] }) {
  let offset = 0;
  const segments = slices.map((s) => {
    const dash = Math.max(0, (s.pct / 100) * DONUT_CIRC - DONUT_GAP);
    const seg = { ...s, dash, offset };
    offset += (s.pct / 100) * DONUT_CIRC;
    return seg;
  });

  return (
    <svg viewBox="0 0 160 160" width={160} height={160} style={{ display: "block", margin: "0 auto", overflow: "visible" }}>
      <circle cx={80} cy={80} r={DONUT_R} fill="none" stroke="var(--surface-2)" strokeWidth={24} />
      {segments.map((seg, i) => (
        <circle
          key={i}
          cx={80}
          cy={80}
          r={DONUT_R}
          fill="none"
          stroke={seg.color}
          strokeWidth={24}
          strokeDasharray={`${seg.dash} ${DONUT_CIRC}`}
          strokeDashoffset={-seg.offset}
          strokeLinecap="butt"
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

/** Tile de color con la inicial de la bóveda (reemplaza el emoji). */
function VaultTile({ name, color, size = 52 }: { name: string; color: string; size?: number }) {
  const initial = (name.trim()[0] || "B").toUpperCase();
  return (
    <span
      style={{
        width: size, height: size, borderRadius: size * 0.3, flexShrink: 0, background: color, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 800, fontSize: size * 0.46, fontFamily: "var(--font-display)", letterSpacing: "-0.02em",
      }}
    >
      {initial}
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

function PlanCard({ plan, onPick, recommended }: { plan: VaultPlan; onPick: () => void; recommended?: boolean }) {
  return (
    <div className="card bond-card" onClick={onPick} style={{ cursor: "pointer", border: recommended ? "1px solid var(--accent)" : undefined, background: recommended ? "var(--accent-soft)" : undefined }}>
      <PlanTile risk={plan.risk} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{plan.name}</p>
          {recommended && <span className="pos-pill"><Icon name="star" size={11} /> Para ti</span>}
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

/** Tarjeta de una bóveda en la lista: saldo creciendo en vivo + proyección dentro. */
function VaultRow({ v, go }: { v: UserVault; go: Go }) {
  const plan = planByApy(v.apy);
  const proj10 = projectSavings(v.bal, 0, v.apy, 10);
  return (
    <div className="card vault" onClick={() => go("boveda", v)} style={{ cursor: "pointer", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <VaultTile name={v.nm} color={plan.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em" }}>{v.nm}</p>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--txt-muted)" }}>{plan.name} · {FMT(v.apy, 1)}% anual</p>
        </div>
        <Icon name="chevR" size={18} color="var(--txt-dim)" />
      </div>
      <div style={{ marginTop: 14 }}>
        <GrowingAmount base={v.bal} apy={v.apy} size={32} align="left" id={`vault-${v.id}`} />
      </div>
      {v.bal > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--txt-muted)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="trend" size={14} color="var(--accent)" /> En 10 años
          </span>
          <span className="num" style={{ fontSize: 15, fontWeight: 800, color: "var(--accent)" }}>${FMT(proj10, 0)}</span>
        </div>
      )}
    </div>
  );
}

export function ScreenVaults({ go }: { go: Go }) {
  const wallet = useWallet();
  const { vaults, addVault, totalSaved, busy, onchain } = useVaults(wallet.address);
  const [opening, setOpening] = useState(false);
  const [creating, setCreating] = useState<null | { plan?: VaultPlan }>(null);
  const [recId] = useState<string | null>(() => loadRiskProfile());
  const recPlan = recId ? planById(recId) : null;

  const weightedApy = totalSaved > 0 ? vaults.reduce((s, v) => s + v.bal * v.apy, 0) / totalSaved : (recPlan?.apy ?? 10.5);
  const atCap = vaults.length >= MAX_VAULTS;

  const handleCreate = async (name: string, plan: VaultPlan) => {
    // La verificación de identidad NO bloquea abrir bóvedas: es un incentivo
    // (mayores depósitos / mejores rendimientos) que se invita desde Home.
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
            <GrowingAmount base={totalSaved} apy={weightedApy} size={44} align="left" id="vaults-total" />
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
              Puedes planear tu estrategia. <b style={{ color: "var(--txt)" }}>Fondear con MXN real</b> se activa al conectar el contrato on-chain.
            </p>
          </div>
        )}

        {/* Mis bóvedas */}
        <div className="sec-head">
          <h3>Mis bóvedas</h3>
          <span style={{ fontSize: 12, color: "var(--txt-dim)", fontWeight: 700 }}>{vaults.length}/{MAX_VAULTS}</span>
        </div>
        {vaults.map((v) => <VaultRow key={v.id} v={v} go={go} />)}

        {!atCap ? (
          <button
            className="btn btn-ghost"
            onClick={() => setCreating({ plan: recPlan ?? undefined })}
            style={{ width: "100%", marginTop: vaults.length > 0 ? 2 : 0, justifyContent: "center", borderStyle: "dashed" }}
          >
            <Icon name="plus" size={18} /> {vaults.length === 0 ? "Crear mi primera bóveda" : "Nueva bóveda"}
          </button>
        ) : (
          <p style={{ margin: "6px 4px 0", fontSize: 12.5, color: "var(--txt-dim)", textAlign: "center" }}>
            Llegaste al máximo de {MAX_VAULTS} bóvedas de ahorro.
          </p>
        )}

        {/* Estrategias — informativas; tocar una abre el creador con ese plan */}
        <div className="sec-head" style={{ marginTop: 24 }}>
          <h3>Estrategias de ahorro</h3>
        </div>
        <p style={{ margin: "0 2px 14px", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
          {recPlan
            ? <>Según tu perfil te recomendamos <b style={{ color: "var(--accent)" }}>{recPlan.name}</b>.</>
            : <>Cada perfil ajusta tu mezcla de instrumentos soberanos según tu horizonte.</>}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {RISK_PROFILES.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              recommended={recPlan?.id === p.id}
              onPick={atCap ? () => {} : () => setCreating({ plan: p })}
            />
          ))}
        </div>
      </div>
      <div className="scroll-bottom" />
      {creating && (
        <Portal>
          <CreateVaultModal
            preset={creating.plan}
            recId={recId}
            busy={opening}
            onClose={() => setCreating(null)}
            onCreate={handleCreate}
          />
        </Portal>
      )}
    </div>
  );
}

/** Crear bóveda: ponerle nombre y elegir estrategia. */
function CreateVaultModal({
  preset, recId, busy, onClose, onCreate,
}: {
  preset?: VaultPlan;
  recId: string | null;
  busy: boolean;
  onClose: () => void;
  onCreate: (name: string, plan: VaultPlan) => void;
}) {
  const [name, setName] = useState("");
  const [planId, setPlanId] = useState<string>(preset?.id ?? recId ?? RISK_PROFILES[0].id);
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
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlanId(p.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: 12, borderRadius: 14, cursor: "pointer",
                  border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
                  background: active ? "var(--accent-soft)" : "var(--surface-2)",
                }}
              >
                <PlanTile risk={p.risk} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14.5 }}>{p.name}</p>
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
  const { vaults, updateBalance, removeVault, busy, onchain, limits } = useVaults(wallet.address);
  const ctxV = ctx as UserVault | undefined;
  const v = vaults.find((x) => x.id === ctxV?.id) ?? ctxV;

  // vaultId numérico solo cuando estamos on-chain (ids son índices del contrato).
  // Se calcula antes del early return para no violar reglas de hooks.
  const numVaultId = onchain && v ? parseInt(v.id) : undefined;
  const advanceState = useAdvance(wallet.address, numVaultId);

  const [action, setAction] = useState<null | "abonar" | "retirar">(null);
  const [advance, setAdvance] = useState(false);
  const [repay, setRepay] = useState(false);

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
        <div style={{ marginTop: 18 }}>
          <GrowingAmount base={v.bal} apy={v.apy} size={48} id={`vault-${v.id}`} />
        </div>
        <p style={{ fontSize: 13.5, color: "var(--txt-muted)", margin: "8px 0 0" }}>MXN en bóveda</p>
        <div style={{ marginTop: 6 }}><YieldRate base={v.bal} apy={v.apy} /></div>
        <div className="stat-grid" style={{ marginTop: 22, textAlign: "left" }}>
          <div className="tile"><div className="k">Rendimiento</div><div className="v" style={{ color: "var(--accent)", fontSize: 20 }}>{FMT(v.apy, 1)}%</div></div>
          <div className="tile"><div className="k">En 10 años</div><div className="v num" style={{ fontSize: 16 }}>${FMT(projectSavings(v.bal, 0, v.apy, 10), 0)}</div></div>
        </div>

        {/* Perfil del plan */}
        {(() => {
          const plan = planByApy(v.apy);
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
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--txt-dim)" }}>Horizonte: {plan.horizon}</p>
              </div>
              {/* Proyección de retiro — dentro de la bóveda, varios horizontes */}
              {v.bal > 0 && (
                <div className="card" style={{ marginTop: 14, textAlign: "left", background: "var(--accent-soft)", border: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Icon name="trend" size={18} color="var(--accent)" />
                    <p className="eyebrow" style={{ color: "var(--accent)", margin: 0 }}>Proyección de tu retiro</p>
                  </div>
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

        {/* B4 — Composición de bóveda */}
        {(() => {
          const plan = planByApy(v.apy);
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
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setAction("abonar")} disabled={!onchain || busy}><Icon name="plus" size={18} /> Abonar</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setAction("retirar")} disabled={(v.bal - advanceState.locked) <= 0 || !onchain || busy}>Retirar</button>
        </div>
        {!onchain && (
          <p style={{ margin: "12px 4px 0", fontSize: 12, color: "var(--txt-dim)", lineHeight: 1.5, textAlign: "center" }}>
            Abonar y retirar se activan al conectar el contrato on-chain.
          </p>
        )}
        {/* Advance activo — card prominente cuando hay deuda */}
        {advanceState.debt > 0 && (
          <div className="card" style={{ marginTop: 16, textAlign: "left", background: "var(--accent-2-soft, #fff8ec)", border: "1px solid var(--warning, #E8A838)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="bolt" size={18} color="var(--warning, #E8A838)" />
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>Adelanto activo</p>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Pendiente</span>
              <span className="num" style={{ fontWeight: 800, fontSize: 16 }}>${FMT(advanceState.debt, 2)} MXN</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>Colateral bloqueado</span>
              <span className="num" style={{ fontWeight: 700, fontSize: 14 }}>${FMT(advanceState.locked, 2)} MXN</span>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 14, width: "100%" }} onClick={() => setRepay(true)} disabled={busy}>
              Repagar adelanto
            </button>
          </div>
        )}

        {v.bal > 0 && advanceState.debt === 0 && (
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setAdvance(true)} disabled={busy}>
            <Icon name="bolt" size={18} /> Adelantar rendimiento
          </button>
        )}
        <button disabled={busy || advanceState.locked > 0} title={advanceState.locked > 0 ? "Repaga tu adelanto para liberar el colateral antes de eliminar la bóveda" : undefined} onClick={async () => { await removeVault(v.id); go("bovedas"); }} style={{ marginTop: 18, background: "none", border: "none", color: "var(--neg)", fontWeight: 700, fontSize: 13, cursor: busy || advanceState.locked > 0 ? "default" : "pointer", opacity: busy || advanceState.locked > 0 ? 0.5 : 1 }}>Eliminar bóveda</button>
      </div>
      <div className="scroll-bottom" />
      {action && (
        <Portal>
          <VaultAmountModal
            mode={action}
            vault={v}
            locked={advanceState.locked}
            maxDeposit={limits?.available}
            cap={limits?.max}
            onClose={() => setAction(null)}
            onConfirm={(amt) => updateBalance(v.id, action === "abonar" ? amt : -amt)}
          />
        </Portal>
      )}
      {advance && <Portal><LiquidityAdvanceModal saved={v.bal} apy={v.apy} vaultId={numVaultId} onClose={() => setAdvance(false)} /></Portal>}
      {repay && numVaultId !== undefined && (
        <Portal>
          <RepayModal
            vaultId={numVaultId}
            debt={advanceState.debt}
            apy={v.apy}
            balance={v.bal}
            locked={advanceState.locked}
            onClose={() => setRepay(false)}
            onDone={() => { void advanceState.reload(); }}
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
function friendlyVaultError(e: unknown): string {
  const s = ((e instanceof Error ? e.message : String(e)) || "").toLowerCase();
  if (s.includes("beta cap"))
    return "Durante la beta, tu saldo total en bóvedas no puede superar $10,000 MXN. Reduce el monto e intenta de nuevo.";
  if (s.includes("free balance") || s.includes("exceeds free"))
    return "No puedes retirar el colateral bloqueado por un adelanto activo. Repaga el adelanto primero.";
  if (s.includes("paused"))
    return "Las bóvedas están en mantenimiento por el momento. Intenta más tarde.";
  if (s.includes("user rejected") || s.includes("denied") || s.includes("rejected the request"))
    return "Cancelaste la operación.";
  if (s.includes("insufficient"))
    return "Saldo insuficiente para completar la operación.";
  return "No se pudo completar la operación. Intenta de nuevo en un momento.";
}

function VaultAmountModal({ mode, vault, locked = 0, maxDeposit, cap, onClose, onConfirm }: { mode: "abonar" | "retirar"; vault: UserVault; locked?: number; maxDeposit?: number; cap?: number; onClose: () => void; onConfirm: (amt: number) => void | Promise<string | undefined> }) {
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
      setError(friendlyVaultError(e));
    } finally {
      setSubmitting(false);
    }
  };

  // Pop-up de confirmación (abonar y retirar) con comprobante del explorador.
  if (done) {
    const isAbono = mode === "abonar";
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <span style={{ width: 64, height: 64, borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" size={32} />
            </span>
            <p className="modal-title" style={{ marginTop: 16, textAlign: "center" }}>
              {isAbono ? "¡Guardado en tu bóveda!" : "Retiro listo"}
            </p>
            <p className="num" style={{ margin: "6px 0 0", fontSize: 30, fontWeight: 700, color: "var(--accent)" }}>
              ${FMT(n, 2)} MXN
            </p>
            <p className="modal-sub" style={{ textAlign: "center", marginTop: 8 }}>
              {isAbono ? (
                <>Tu dinero quedó guardado en <b style={{ color: "var(--txt)" }}>{vault.nm}</b> y ya está rindiendo on-chain.</>
              ) : (
                <>Retirados de <b style={{ color: "var(--txt)" }}>{vault.nm}</b>. Ya están en tus <b style={{ color: "var(--accent)" }}>Pesos digitales</b>.</>
              )}
            </p>
            {txHash ? (
              <a
                href={`${explorerBase}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 16, padding: "10px 16px", borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent)", fontSize: 13, fontWeight: 700 }}
              >
                <Icon name="check" size={15} /> Ver comprobante en el explorador →
              </a>
            ) : (
              <p className="modal-sub" style={{ textAlign: "center", marginTop: 12, fontSize: 12, opacity: 0.7 }}>
                Confirmado on-chain.
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

        <span className="field-label">Monto (MXN)</span>
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
