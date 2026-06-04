"use client";

/* Pantallas de ahorro: Bóvedas, detalle de bóveda y conversión FX */
import React, { useState } from "react";
import { Icon, Flag, Ring } from "../ui";
import { SubHeader, AvatarButton } from "../shared";
import { FMT, VAULT_PLANS, RISK_PROFILES, planByApy, planById, projectSavings, loadRiskProfile, type VaultPlan, type RiskLevel } from "../data";
import { ProjectionCard } from "../ProjectionCard";
import type { Go } from "../nav";
import { useWallet } from "@/components/wallet/WalletContext";
import { useVaults, type UserVault } from "@/hooks/useVaults";
import { LiquidityAdvanceModal } from "../LiquidityAdvanceModal";
import { Portal } from "../Portal";
import { useBitsoRates, useBitsoBalances, convertOnBitso } from "@/hooks/useBitsoRates";
import { useConversions } from "@/hooks/useConversions";
import { BITSO_ASSETS, assetByCode } from "@/lib/bitso/assets";
import { TREASURY_ADDRESS, TREASURY_ENABLED } from "@/lib/chain";

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
  const [planPick, setPlanPick] = useState<VaultPlan | null>(null);
  // Perfil recomendado por el cuestionario (si lo respondió).
  const [recId] = useState<string | null>(() => loadRiskProfile());
  const recPlan = recId ? planById(recId) : null;

  const weightedApy = totalSaved > 0 ? vaults.reduce((s, v) => s + v.bal * v.apy, 0) / totalSaved : 0;
  const compareApy = totalSaved > 0 ? (weightedApy || 11.5) : (recPlan?.apy ?? 11.5);
  const afore = VAULT_PLANS.find((p) => p.id === "afore")!;

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <div className="app-head" style={{ paddingTop: 4 }}>
        <p className="name">Ahorro</p>
        <div className="head-actions">
          {onchain && <span className="pos-pill"><Icon name="shield" size={12} /> On-chain</span>}
          <AvatarButton go={go} />
        </div>
      </div>
      <div className="screen-pad">
        {busy && (
          <div className="card" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 12, background: "var(--accent-soft)", border: "none" }}>
            <span className="spin" style={{ color: "var(--accent)" }} />
            <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)" }}>Procesando en la red… esto tarda unos segundos.</p>
          </div>
        )}
        {/* Hero */}
        <div className="card glow" style={{ padding: 22 }}>
          <p className="eyebrow">Tu ahorro total</p>
          <p className="amount num" style={{ fontSize: 38, marginTop: 12 }}>${FMT(totalSaved, 2).split(".")[0]}<span style={{ opacity: 0.5 }}>.{FMT(totalSaved, 2).split(".")[1]}</span></p>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {totalSaved > 0 && <span className="pos-pill"><Icon name="leaf" size={12} /> {FMT(weightedApy, 1)}% anual promedio</span>}
            <span className="chip" style={{ pointerEvents: "none" }}>{vaults.length} {vaults.length === 1 ? "bóveda" : "bóvedas"}</span>
          </div>
          {totalSaved > 0 && (
            <div className="card" style={{ marginTop: 16, background: "var(--accent-soft)", border: "none", display: "flex", alignItems: "center", gap: 12 }}>
              <Icon name="trend" size={20} color="var(--accent)" />
              <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.4 }}>
                A este ritmo, en <b style={{ color: "var(--txt)" }}>10 años</b> tendrías <b className="num" style={{ color: "var(--accent)" }}>${FMT(projectSavings(totalSaved, 0, weightedApy || 10.5, 10), 0)}</b>.
              </p>
            </div>
          )}
          {/* Distribución por bóveda */}
          {vaults.length > 1 && (
            <>
              <div className="alloc-bar" style={{ marginTop: 18 }}>
                {vaults.map((v) => <span key={v.id} style={{ width: totalSaved > 0 ? `${(v.bal / totalSaved) * 100}%` : "0%", background: v.color }} />)}
              </div>
              <div className="alloc-legend">
                {vaults.map((v) => (
                  <div className="row" key={v.id}>
                    <span className="dot" style={{ background: v.color }} />
                    <div className="col"><span className="nm">{v.nm}</span><span className="vl num">${FMT(v.bal, 0)}</span></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {!onchain && (
          <div className="card" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, background: "var(--surface-2)" }}>
            <Icon name="info" size={20} color="var(--txt-muted)" />
            <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)", lineHeight: 1.45 }}>
              Puedes planear tus metas y elegir estrategia. <b style={{ color: "var(--txt)" }}>Fondear con MXNB real</b> se activa al conectar el contrato on-chain.
            </p>
          </div>
        )}

        {/* Proyección interactiva Reyf vs Afore */}
        <div style={{ marginTop: 18 }}>
          <ProjectionCard current={totalSaved} apy={compareApy} />
        </div>

        {/* Tus bóvedas */}
        {vaults.length > 0 && (
          <>
            <div className="sec-head"><h3>Tus bóvedas</h3></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {vaults.map((v) => {
                const pct = v.goal > 0 ? Math.round((v.bal / v.goal) * 100) : 0;
                const plan = planByApy(v.apy);
                return (
                  <div key={v.id} className="vault card" onClick={() => go("boveda", v)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <Ring pct={pct} size={58} color={v.color} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{v.nm}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{plan.emoji} {plan.name} · {FMT(v.apy, 1)}% anual</p>
                        <p className="num" style={{ margin: "8px 0 0", fontSize: 15, fontWeight: 800 }}>
                          ${FMT(v.bal, 0)} <span style={{ color: "var(--txt-dim)", fontWeight: 600 }}>/ ${FMT(v.goal, 0)}</span>
                        </p>
                      </div>
                      <Icon name="chevR" size={16} color="var(--txt-dim)" />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Producto destacado: AFORE */}
        <div className="sec-head"><h3>Para tu retiro</h3></div>
        <div className="card glow" onClick={() => setPlanPick(afore)} style={{ cursor: "pointer", padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 50, height: 50, borderRadius: 15, flexShrink: 0, background: "var(--accent-2)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{afore.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{afore.name}</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{afore.tagline}</p>
            </div>
            <div className="yield" style={{ textAlign: "right" }}>
              <div className="num" style={{ fontWeight: 800, fontSize: 20, color: "var(--accent)" }}>{FMT(afore.apy, 1)}%</div>
              <div className="lb">anual</div>
            </div>
          </div>
          {afore.blend && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, color: "var(--txt-muted)", fontSize: 12 }}>
              <Icon name="globe" size={14} color="var(--accent)" /> {afore.blend}
            </div>
          )}
        </div>

        {/* Perfiles de riesgo (4 estrategias del cuestionario) */}
        <div className="sec-head"><h3>Elige tu estrategia</h3></div>
        <p style={{ margin: "0 2px 14px", fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.5 }}>
          {recPlan
            ? <>Según tu perfil te recomendamos <b style={{ color: "var(--accent)" }}>{recPlan.name}</b>. También puedes elegir otra.</>
            : <>Cada perfil ajusta tu mezcla de instrumentos soberanos según tu meta y horizonte.</>}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {RISK_PROFILES.map((p) => (
            <PlanCard key={p.id} plan={p} onPick={() => setPlanPick(p)} recommended={recPlan?.id === p.id} />
          ))}
        </div>
      </div>
      <div className="scroll-bottom" />
      {planPick && <Portal><AddVaultModal plan={planPick} onClose={() => setPlanPick(null)} onCreate={async (v) => { await addVault(v); setPlanPick(null); }} /></Portal>}
    </div>
  );
}

/* ---------------- VAULT DETAIL ---------------- */
export function ScreenVaultDetail({ go, ctx }: { go: Go; ctx?: unknown }) {
  const wallet = useWallet();
  const { vaults, updateBalance, removeVault, busy, onchain } = useVaults(wallet.address);
  const ctxV = ctx as UserVault | undefined;
  const v = vaults.find((x) => x.id === ctxV?.id) ?? ctxV;
  const [action, setAction] = useState<null | "abonar" | "retirar">(null);
  const [advance, setAdvance] = useState(false);

  if (!v) {
    return (
      <div className="screen screen-enter">
        <div className="safe-top" />
        <SubHeader title="Bóveda" go={go} back="bovedas" />
        <div className="screen-pad"><p style={{ color: "var(--txt-muted)" }}>Esta bóveda ya no existe.</p></div>
      </div>
    );
  }

  const pct = v.goal > 0 ? Math.round((v.bal / v.goal) * 100) : 0;
  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title={v.nm} go={go} back="bovedas" />
      <div className="screen-pad" style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", margin: "10px 0 6px", position: "relative" }}>
          <Ring pct={pct} size={180} sw={14} color={v.color} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span className="num" style={{ fontSize: 36, fontWeight: 700 }}>{pct}%</span>
            <span style={{ fontSize: 12, color: "var(--txt-muted)" }}>de tu meta</span>
          </div>
        </div>
        <p className="num" style={{ fontSize: 28, fontWeight: 800, margin: "14px 0 0" }}>${FMT(v.bal, 2)}</p>
        <p style={{ fontSize: 14, color: "var(--txt-muted)", margin: "4px 0 0" }}>de ${FMT(v.goal, 0)} MXN</p>
        <div className="stat-grid" style={{ marginTop: 22, textAlign: "left" }}>
          <div className="tile"><div className="k">Rendimiento</div><div className="v" style={{ color: "var(--accent)", fontSize: 20 }}>{FMT(v.apy, 1)}%</div></div>
          <div className="tile"><div className="k">Faltan</div><div className="v num" style={{ fontSize: 18 }}>${FMT(Math.max(0, v.goal - v.bal), 0)}</div></div>
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
            Abonar y retirar con MXNB real se activan al conectar el contrato on-chain.
          </p>
        )}
        {v.bal > 0 && (
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
      {advance && <Portal><LiquidityAdvanceModal saved={v.bal} apy={v.apy} onClose={() => setAdvance(false)} /></Portal>}
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
  const { add: addConversion, balances: localBalances } = useConversions(wallet.address);
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
    setStatus("sending");
    try {
      if (sellingMXNB) {
        // ── MXNB → divisa ───────────────────────────────────────────────
        // 1. Mover el MXNB del usuario a la tesorería (baja su saldo on-chain real).
        if (TREASURY_ENABLED) {
          if (wallet.balance < amt) {
            setStatus("error");
            setMsg(`Saldo MXNB insuficiente. Disponible: ${FMT(wallet.balance, 2)}.`);
            return;
          }
          await wallet.sendMXNB(TREASURY_ADDRESS, String(amt));
        }
        // 2. Ejecutar el swap en Bitso (pool del negocio).
        const r = await convertOnBitso(fromCode, toCode, amt);
        if (!r.ok) {
          setStatus("error");
          setMsg(
            TREASURY_ENABLED
              ? `Tu MXNB quedó en tesorería; la conversión no se completó (${r.error || "error"}). Se reintentará.`
              : r.error || "No se pudo ejecutar la orden.",
          );
          return;
        }
        // 3. Acreditar el ledger del usuario (atribución por-usuario del USDT del pool).
        const amountFrom = r.filledFrom ?? amt;
        const amountTo = r.filledTo ?? result;
        await addConversion({ from: fromCode, to: toCode, amountFrom, amountTo, oid: r.oid });
      } else {
        // ── divisa → MXNB ───────────────────────────────────────────────
        // El usuario no tiene la divisa on-chain (vive en el ledger del pool).
        // Vendemos en Bitso y enviamos MXNB a su wallet con un WITHDRAWAL de Juno
        // (/mint_platform/v1/withdrawals, saca MXNB del float on-chain). NO es un
        // issuance (eso es mintear MXNB contra un depósito MXN). El MXN del sell
        // queda como reserva del negocio.
        const have = localBalances[fromCode] ?? 0;
        if (have + 1e-9 < amt) {
          setStatus("error");
          setMsg(`Saldo insuficiente de ${fromCode}. Disponible: ${FMT(have, from.dec)}.`);
          return;
        }
        // 1. Vender la divisa → MXN en Bitso.
        const r = await convertOnBitso(fromCode, toCode, amt);
        if (!r.ok) {
          setStatus("error");
          setMsg(r.error || "No se pudo ejecutar la orden.");
          return;
        }
        const mxn = r.filledTo ?? result;
        // 2. Enviar MXNB a la wallet del usuario (withdrawal Juno · sube su saldo on-chain).
        if (wallet.address) {
          const fr = await fetch("/api/juno/fund-wallet", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ address: wallet.address, amount: mxn }),
          });
          if (!fr.ok) {
            setStatus("error");
            setMsg("Vendido en Bitso, pero la emisión de MXNB no se completó. Se reintentará.");
            return;
          }
        }
        // 3. Debitar el ledger (from=divisa, to=MXN → resta la divisa).
        await addConversion({ from: fromCode, to: toCode, amountFrom: r.filledFrom ?? amt, amountTo: mxn, oid: r.oid });
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
          <p style={{ fontSize: 12, color: "var(--txt-dim)", margin: "10px 4px 0" }}>Una de las divisas debe ser MXN (MXNB) para ejecutar la conversión.</p>
        )}
        {status === "done" && (
          <div className="card" style={{ marginTop: 12, background: "var(--accent-soft)", border: "none" }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--accent)", fontWeight: 800 }}>✓ Orden ejecutada en Bitso</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>
              {sellingMXNB ? (
                <>
                  Recibiste <b className="num" style={{ color: "var(--txt)" }}>{FMT(result ?? 0, to.dec)} {to.code}</b>.
                  {TREASURY_ENABLED ? " Se descontó de tu saldo MXNB" : ""}; quedó en tus movimientos y tu saldo en divisas.
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
          Tasas y ejecución vía <b style={{ color: "var(--txt)" }}>Bitso</b> en tiempo real. MXN = MXNB (peso digital). USDC no opera contra MXN en Bitso; el dólar digital disponible es USDT.
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

/* ---------------- Modales de bóvedas ---------------- */
function AddVaultModal({ plan, onClose, onCreate }: { plan: VaultPlan; onClose: () => void; onCreate: (v: { nm: string; goal: number; apy: number; color: string }) => void | Promise<void> }) {
  const [nm, setNm] = useState("");
  const [goal, setGoal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const valid = nm.trim().length > 0 && Number(goal) > 0 && !submitting;
  const submit = async () => {
    setSubmitting(true);
    try {
      await onCreate({ nm: nm.trim(), goal: Number(goal), apy: plan.apy, color: plan.color });
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">Nueva bóveda</p>

        {/* Plan elegido */}
        <div className="card" style={{ display: "flex", gap: 12, alignItems: "center", padding: 14, background: "var(--surface-2)" }}>
          <span style={{ width: 44, height: 44, borderRadius: 13, background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{plan.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{plan.name}</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{plan.exposure}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="num" style={{ fontWeight: 800, fontSize: 16, color: "var(--accent)" }}>{FMT(plan.apy, 1)}%</div>
            <div style={{ fontSize: 11, color: "var(--txt-muted)" }}>anual</div>
          </div>
        </div>
        <p style={{ margin: "10px 2px 0", fontSize: 12, color: "var(--txt-dim)", lineHeight: 1.45 }}>{plan.structured}</p>

        <span className="field-label">Nombre de tu meta</span>
        <input className="input" placeholder="Ej. Mi retiro, Casa propia…" value={nm} onChange={(e) => setNm(e.target.value)} />
        <span className="field-label">Meta (MXN)</span>
        <input className="input num-input" type="number" inputMode="decimal" placeholder="40,000" value={goal} onChange={(e) => setGoal(e.target.value)} />

        <button className="btn btn-primary" style={{ marginTop: 20 }} disabled={!valid} onClick={submit}>
          {submitting ? <span className="spin" /> : <><Icon name="check" size={18} /> Abrir bóveda {plan.name}</>}
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose} disabled={submitting}>Cancelar</button>
      </div>
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
