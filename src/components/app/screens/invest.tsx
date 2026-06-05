"use client";

/* Pantallas de ahorro: Bóvedas, detalle de bóveda y conversión FX */
import React, { useState } from "react";
import { Icon, Flag, Ring } from "../ui";
import { SubHeader, AvatarButton } from "../shared";
import { FMT, RISK_PROFILES, planByApy, planById, projectSavings, loadRiskProfile, type VaultPlan, type RiskLevel } from "../data";
import { ProjectionCard } from "../ProjectionCard";
import type { Go } from "../nav";
import { useWallet } from "@/components/wallet/WalletContext";
import { useVaults, type UserVault } from "@/hooks/useVaults";
import { LiquidityAdvanceModal } from "../LiquidityAdvanceModal";
import { RepayModal } from "../modals/RepayModal";
import { Portal } from "../Portal";
import { useAdvance } from "@/hooks/useAdvance";
import { useBitsoRates, useBitsoBalances } from "@/hooks/useBitsoRates";
import { useConversions } from "@/hooks/useConversions";
import { BITSO_ASSETS, assetByCode } from "@/lib/bitso/assets";
import { TREASURY_ADDRESS, TREASURY_ENABLED, ADVANCE_ONCHAIN } from "@/lib/chain";

// Con Supabase, el ledger de conversiones lo escribe /api/convert (servidor);
// sin él, el cliente lo persiste localmente con la capa `store`.
const USE_SUPABASE = process.env.NEXT_PUBLIC_USE_SUPABASE === "true";

/* ---------------- AHORRO (BÓVEDAS) ---------------- */
const RISK_COLOR: Record<RiskLevel, string> = { Bajo: "var(--accent)", Medio: "#F5A623", Alto: "var(--neg)" };

function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <span className="pos-pill" style={{ background: "transparent", border: `1px solid ${RISK_COLOR[risk]}`, color: RISK_COLOR[risk] }}>
      Riesgo {risk.toLowerCase()}
    </span>
  );
}

function PlanCard({ plan, onPick, recommended }: { plan: VaultPlan; onPick: () => void; recommended?: boolean }) {
  return (
    <div className="card bond-card" onClick={onPick} style={{ cursor: "pointer", border: recommended ? "1px solid var(--accent)" : undefined, background: recommended ? "var(--accent-soft)" : undefined }}>
      <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23 }}>{plan.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{plan.name}</p>
          {recommended && <span className="pos-pill"><Icon name="star" size={11} /> Para ti</span>}
        </div>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{plan.exposure}</p>
        <div style={{ marginTop: 6 }}><RiskBadge risk={plan.risk} /></div>
      </div>
      <div className="yield" style={{ textAlign: "right" }}>
        <div className="num" style={{ fontWeight: 800, fontSize: 18, color: "var(--accent)" }}>{FMT(plan.apy, 1)}%</div>
        <div className="lb">anual</div>
      </div>
    </div>
  );
}


export function ScreenVaults({ go }: { go: Go }) {
  const wallet = useWallet();
  const { vaults, addVault, totalSaved, busy, onchain } = useVaults(wallet.address);
  const [opening, setOpening] = useState(false);
  const [recId] = useState<string | null>(() => loadRiskProfile());
  const recPlan = recId ? planById(recId) : null;

  const weightedApy = totalSaved > 0 ? vaults.reduce((s, v) => s + v.bal * v.apy, 0) / totalSaved : 0;
  const compareApy = totalSaved > 0 ? (weightedApy || 11.5) : (recPlan?.apy ?? 11.5);
  const hasVault = vaults.length > 0;

  const handleOpen = async (plan: VaultPlan) => {
    setOpening(true);
    try {
      await addVault({ nm: plan.name, goal: 0, apy: plan.apy, color: plan.color });
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

        {/* Hero */}
        <div className="card glow" style={{ padding: 22 }}>
          <p className="eyebrow">Tu ahorro total</p>
          <p className="amount num" style={{ fontSize: 38, marginTop: 12 }}>
            ${FMT(totalSaved, 2).split(".")[0]}<span style={{ opacity: 0.5 }}>.{FMT(totalSaved, 2).split(".")[1]}</span>
          </p>
          {totalSaved > 0 && (
            <>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <span className="pos-pill"><Icon name="leaf" size={12} /> {FMT(weightedApy, 1)}% anual</span>
              </div>
              <div className="card" style={{ marginTop: 16, background: "var(--accent-soft)", border: "none", display: "flex", alignItems: "center", gap: 12 }}>
                <Icon name="trend" size={20} color="var(--accent)" />
                <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.4 }}>
                  A este ritmo, en <b style={{ color: "var(--txt)" }}>10 años</b> tendrías <b className="num" style={{ color: "var(--accent)" }}>${FMT(projectSavings(totalSaved, 0, weightedApy || 10.5, 10), 0)}</b>.
                </p>
              </div>
            </>
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

        {/* Proyección */}
        <div style={{ marginTop: 18 }}>
          <ProjectionCard current={totalSaved} apy={compareApy} />
        </div>

        {/* Bóveda activa */}
        {hasVault && (
          <>
            <div className="sec-head"><h3>Tu bóveda</h3></div>
            {vaults.map((v) => {
              const plan = planByApy(v.apy);
              return (
                <div key={v.id} className="vault card" onClick={() => go("boveda", v)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ width: 50, height: 50, borderRadius: 15, flexShrink: 0, background: plan.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                      {plan.emoji}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{v.nm}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{plan.exposure}</p>
                      <p className="num" style={{ margin: "8px 0 0", fontSize: 15, fontWeight: 800 }}>${FMT(v.bal, 0)}</p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div className="num" style={{ fontWeight: 800, fontSize: 18, color: "var(--accent)" }}>{FMT(v.apy, 1)}%</div>
                      <div style={{ fontSize: 11, color: "var(--txt-muted)" }}>anual</div>
                      <Icon name="chevR" size={16} color="var(--txt-dim)" />
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Estrategias — siempre visibles */}
        <div className="sec-head">
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
              onPick={hasVault ? () => {} : () => handleOpen(p)}
            />
          ))}
        </div>
        {!hasVault && opening && (
          <p style={{ margin: "12px 4px 0", fontSize: 13, color: "var(--txt-muted)", textAlign: "center" }}>
            <span className="spin" style={{ display: "inline-block", marginRight: 8 }} />
            Abriendo tu bóveda…
          </p>
        )}
      </div>
      <div className="scroll-bottom" />
    </div>
  );
}

/* ---------------- VAULT DETAIL ---------------- */
export function ScreenVaultDetail({ go, ctx }: { go: Go; ctx?: unknown }) {
  const wallet = useWallet();
  const { vaults, updateBalance, removeVault, busy, onchain } = useVaults(wallet.address);
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
        <p className="num" style={{ fontSize: 46, fontWeight: 800, margin: "18px 0 0" }}>${FMT(v.bal, 2)}</p>
        <p style={{ fontSize: 14, color: "var(--txt-muted)", margin: "4px 0 0" }}>MXN en bóveda</p>
        <div className="stat-grid" style={{ marginTop: 22, textAlign: "left" }}>
          <div className="tile"><div className="k">Rendimiento</div><div className="v" style={{ color: "var(--accent)", fontSize: 20 }}>{FMT(v.apy, 1)}%</div></div>
          <div className="tile"><div className="k">Proyección 10 años</div><div className="v num" style={{ fontSize: 16 }}>${FMT(projectSavings(v.bal, 0, v.apy, 10), 0)}</div></div>
        </div>

        {/* Perfil del plan */}
        {(() => {
          const plan = planByApy(v.apy);
          const projection = projectSavings(v.bal, 0, v.apy, 10);
          return (
            <>
              <div className="card" style={{ marginTop: 16, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 42, height: 42, borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 21, flexShrink: 0 }}>{plan.emoji}</span>
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
              {v.bal > 0 && (
                <div className="card" style={{ marginTop: 14, textAlign: "left", background: "var(--accent-soft)", border: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Icon name="trend" size={18} color="var(--accent)" />
                    <p className="eyebrow" style={{ color: "var(--accent)", margin: 0 }}>Proyección a 10 años</p>
                  </div>
                  <p className="num" style={{ fontSize: 30, fontWeight: 700, color: "var(--accent)", margin: "10px 0 0" }}>${FMT(projection, 0)}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>si mantienes tu saldo actual a {FMT(v.apy, 1)}% anual</p>
                </div>
              )}
            </>
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
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setAction("retirar")} disabled={v.bal <= 0 || !onchain || busy}>Retirar</button>
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
        <button disabled={busy} onClick={async () => { await removeVault(v.id); go("bovedas"); }} style={{ marginTop: 18, background: "none", border: "none", color: "var(--neg)", fontWeight: 700, fontSize: 13, cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1 }}>Eliminar bóveda</button>
      </div>
      <div className="scroll-bottom" />
      {action && (
        <Portal>
          <VaultAmountModal
            mode={action}
            vault={v}
            onClose={() => setAction(null)}
            onConfirm={async (amt) => { await updateBalance(v.id, action === "abonar" ? amt : -amt); setAction(null); }}
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
  const { balances: liveBalances, refresh: refreshBalances } = useBitsoBalances();
  const [fromCode, setFromCode] = useState("MXN");
  const [toCode, setToCode] = useState("USDT");
  const [amount, setAmount] = useState("1000");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

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

  const doConvert = async () => {
    if (!oneSideIsMXN || amt <= 0 || result == null) return;
    if (!wallet.address) {
      setStatus("error");
      setMsg("Conecta tu wallet para convertir.");
      return;
    }
    setStatus("sending");
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

      // Refrescar el saldo MXNB on-chain (Home) y el live de Bitso.
      wallet.refreshBalance();
      void refreshBalances();
      setStatus("done");
      setMsg("");
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
              <input
                className="big num"
                value={amount}
                inputMode="decimal"
                onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, "")); setStatus("idle"); }}
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
        {status === "done" && (
          <div className="card" style={{ marginTop: 12, background: "var(--accent-soft)", border: "none" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--accent)", fontWeight: 800 }}>✓ Orden ejecutada en Bitso</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>
              {sellingMXNB ? (
                <>
                  Recibiste <b className="num" style={{ color: "var(--txt)" }}>{FMT(result ?? 0, to.dec)} {to.code}</b>.
                  {TREASURY_ENABLED ? " Se descontó de tu saldo MXN" : ""}; quedó en tus movimientos y tu saldo en divisas.
                </>
              ) : (
                <>
                  Recibiste <b className="num" style={{ color: "var(--txt)" }}>{FMT(result ?? 0, 2)} MXN</b> emitidos a tu wallet.
                  Se descontó <b className="num" style={{ color: "var(--txt)" }}>{FMT(amt, from.dec)} {from.code}</b> de tu saldo en divisas.
                </>
              )}
            </p>
          </div>
        )}
        {status === "error" && (
          <div className="card" style={{ marginTop: 12 }}>
            <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.5 }}>
              La tasa mostrada es real de Bitso. La ejecución no se completó: <b style={{ color: "var(--txt)" }}>{msg}</b>
            </p>
          </div>
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


function VaultAmountModal({ mode, vault, onClose, onConfirm }: { mode: "abonar" | "retirar"; vault: UserVault; onClose: () => void; onConfirm: (amt: number) => void | Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const max = mode === "abonar" ? Math.max(0, vault.goal - vault.bal) : vault.bal;
  const n = Number(amount);
  const valid = n > 0 && n <= max && !submitting;

  const submit = async () => {
    setSubmitting(true);
    try {
      await onConfirm(n);
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (done && mode === "retirar") {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="modal-grab" />
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            <span style={{ width: 64, height: 64, borderRadius: 999, background: "var(--accent-soft)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="check" size={32} />
            </span>
            <p className="modal-title" style={{ marginTop: 16, textAlign: "center" }}>Listo</p>
            <p className="modal-sub" style={{ textAlign: "center" }}>
              <b style={{ color: "var(--txt)" }}>${FMT(n, 2)} MXN</b> retirados de{" "}
              <b style={{ color: "var(--txt)" }}>{vault.nm}</b>.<br />
              Ya están disponibles en tus <b style={{ color: "var(--accent)" }}>Pesos digitales</b>.
            </p>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={onClose}>Listo</button>
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
        <input
          className="input num-input"
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <p className="modal-sub" style={{ margin: "8px 0 0" }}>
          {mode === "abonar" ? `Falta para la meta: $${FMT(max, 2)}` : `Disponible en bóveda: $${FMT(max, 2)}`}
        </p>

        <button className="btn btn-primary" style={{ marginTop: 18 }} disabled={!valid} onClick={submit}>
          {submitting ? <span className="spin" /> : mode === "abonar" ? "Abonar" : "Retirar a Pesos digitales"}
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose} disabled={submitting}>Cancelar</button>
      </div>
    </div>
  );
}
