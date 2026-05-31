"use client";

/* UTONOMA — pantallas de inversión: Bonos, Detalle, Bóvedas, Convertir */
import React, { useState } from "react";
import { Icon, Flag, Spark, Ring } from "../ui";
import { SubHeader } from "../shared";
import { BONDS, FX, FMT, type Bond } from "../data";
import type { Go } from "../nav";
import { useWallet } from "@/components/wallet/WalletContext";
import { useVaults, type UserVault } from "@/hooks/useVaults";

/* ---------------- BONOS LIST ---------------- */
export function ScreenBonos({ go }: { go: Go }) {
  const [tab, setTab] = useState<"gobierno" | "acciones">("gobierno");
  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <div className="app-head" style={{ paddingTop: 4 }}>
        <p className="name">Invertir</p>
        <button className="icon-btn"><Icon name="search" size={20} /></button>
      </div>
      <div className="screen-pad">
        <div className="seg" style={{ marginBottom: 18 }}>
          <button className={tab === "gobierno" ? "on" : ""} onClick={() => setTab("gobierno")}>Bonos de gobierno</button>
          <button className={tab === "acciones" ? "on" : ""} onClick={() => setTab("acciones")}>Acciones premium</button>
        </div>

        {tab === "gobierno" ? (
          <>
            <div className="card" style={{ display: "flex", gap: 14, alignItems: "center", background: "var(--accent-2-soft)", border: "none", marginBottom: 16 }}>
              <span style={{ width: 42, height: 42, borderRadius: 12, background: "var(--accent-2)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="shield" size={22} />
              </span>
              <p style={{ margin: 0, fontSize: 13, color: "var(--txt-muted)", lineHeight: 1.45 }}>
                Deuda soberana respaldada por gobiernos. <b style={{ color: "var(--txt)" }}>El instrumento más seguro</b> para hacer crecer tu dinero.
              </p>
            </div>
            <p className="eyebrow" style={{ marginBottom: 12 }}>4 países disponibles</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {BONDS.map((b) => (
                <div key={b.id} className="card bond-card" onClick={() => go("bono", b)}>
                  <Flag code={b.flag} cls="lg" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{b.country}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>{b.code} · {b.cur}</p>
                  </div>
                  <Spark data={b.series} w={52} h={30} fillArea />
                  <div className="yield">
                    <div className="pc num">{FMT(b.yield, 2)}%</div>
                    <div className="lb">anual</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Cartera curada</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { t: "NVIDIA", s: "NVDA · Tecnología", pc: "+1.84%", v: "$2,310.50" },
                { t: "Apple", s: "AAPL · Tecnología", pc: "+0.42%", v: "$3,902.10" },
                { t: "S&P 500 ETF", s: "VOO · Índice", pc: "+0.61%", v: "$5,140.00" },
                { t: "Berkshire", s: "BRK.B · Holding", pc: "−0.18%", v: "$1,980.20", neg: true },
              ].map((s, i) => (
                <div key={i} className="card bond-card">
                  <span style={{ width: 48, height: 48, borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 800 }} className="brand">{s.t[0]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{s.t}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>{s.s}</p>
                  </div>
                  <div className="yield">
                    <div className="num" style={{ fontWeight: 800, fontSize: 16 }}>{s.v}</div>
                    <div className="num" style={{ fontSize: 12, fontWeight: 700, color: s.neg ? "var(--neg)" : "var(--accent)" }}>{s.pc}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="scroll-bottom" />
    </div>
  );
}

/* ---------------- BOND DETAIL ---------------- */
export function ScreenBondDetail({ go, ctx }: { go: Go; ctx?: unknown }) {
  const b = (ctx as Bond) || BONDS[0];
  const [range, setRange] = useState("1A");
  const proj = (10000 * (b.yield / 100)).toFixed(0);
  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title={b.country} go={go} back="bonos" action={<button className="icon-btn"><Icon name="star" size={20} /></button>} />
      <div className="screen-pad">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Flag code={b.flag} cls="lg" />
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>{b.code}</p>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>Bono soberano · {b.cur}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 22 }}>
          <span className="det-amount num" style={{ color: "var(--accent)" }}>{FMT(b.yield, 2)}%</span>
          <span style={{ fontSize: 15, color: "var(--txt-muted)" }}>rendimiento anual</span>
        </div>
        <div className="card" style={{ marginTop: 18, padding: "22px 20px 16px" }}>
          <Spark data={b.series} w={320} h={120} color="var(--accent)" fillArea />
          <div className="seg" style={{ marginTop: 16 }}>
            {["1M", "3M", "6M", "1A", "5A"].map((r) => (
              <button key={r} className={range === r ? "on" : ""} onClick={() => setRange(r)}>{r}</button>
            ))}
          </div>
        </div>
        <div className="stat-grid" style={{ marginTop: 16 }}>
          <div className="tile"><div className="k">Riesgo</div><div className="v" style={{ fontSize: 18 }}>{b.risk}</div></div>
          <div className="tile"><div className="k">Calificación</div><div className="v num" style={{ fontSize: 18 }}>{b.rating}</div></div>
          <div className="tile"><div className="k">Plazo</div><div className="v" style={{ fontSize: 16 }}>{b.term}</div></div>
          <div className="tile"><div className="k">Mínimo</div><div className="v num" style={{ fontSize: 18 }}>${b.min} {b.cur}</div></div>
        </div>
        <div className="card" style={{ marginTop: 16, background: "var(--accent-soft)", border: "none" }}>
          <p className="eyebrow" style={{ color: "var(--accent)" }}>Proyección de rendimientos</p>
          <p style={{ margin: "12px 0 0", fontSize: 14, color: "var(--txt-muted)", lineHeight: 1.5 }}>
            Si inviertes <b className="num" style={{ color: "var(--txt)" }}>$10,000</b>, en un año podrías ganar
          </p>
          <p className="num" style={{ fontSize: 34, fontWeight: 700, color: "var(--accent)", margin: "8px 0 0" }}>+${FMT(+proj, 0)}</p>
        </div>
        <div className="card" style={{ marginTop: 16 }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--txt-muted)", lineHeight: 1.55 }}>{b.desc}</p>
          <div className="divider" />
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--txt-muted)", fontSize: 13 }}>
            <Icon name="shield" size={16} color="var(--accent)" /> Custodia regulada · liquidación T+1
          </div>
        </div>
      </div>
      <div style={{ position: "sticky", bottom: 0, padding: "14px 22px 24px", background: "linear-gradient(to top, var(--bg) 70%, transparent)" }}>
        <button className="btn btn-primary">Invertir en {b.country}</button>
      </div>
    </div>
  );
}

/* ---------------- BÓVEDAS ---------------- */
export function ScreenVaults({ go }: { go: Go }) {
  const wallet = useWallet();
  const { vaults, addVault, totalSaved } = useVaults(wallet.address);
  const [adding, setAdding] = useState(false);
  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <div className="app-head" style={{ paddingTop: 4 }}>
        <p className="name">Bóvedas</p>
        <button className="icon-btn" onClick={() => setAdding(true)} aria-label="Nueva bóveda"><Icon name="plus" size={22} /></button>
      </div>
      <div className="screen-pad">
        <div className="card glow" style={{ padding: 22 }}>
          <p className="eyebrow">Total ahorrado en bóvedas</p>
          <p className="amount num" style={{ fontSize: 38, marginTop: 12 }}>${FMT(totalSaved, 2).split(".")[0]}<span style={{ opacity: 0.5 }}>.{FMT(totalSaved, 2).split(".")[1]}</span></p>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <span className="chip" style={{ pointerEvents: "none" }}>{vaults.length} {vaults.length === 1 ? "meta" : "metas"}</span>
          </div>
        </div>

        <div className="sec-head"><h3>Tus metas</h3></div>

        {vaults.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 28 }}>
            <span style={{ width: 52, height: 52, borderRadius: 16, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Icon name="vault" size={26} /></span>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>Aún no tienes bóvedas</p>
            <p style={{ margin: "6px 0 16px", fontSize: 13, color: "var(--txt-muted)" }}>Crea una meta de ahorro y sigue tu progreso.</p>
            <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> Crear mi primera bóveda</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {vaults.map((v) => {
              const pct = v.goal > 0 ? Math.round((v.bal / v.goal) * 100) : 0;
              return (
                <div key={v.id} className="vault card" onClick={() => go("boveda", v)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <Ring pct={pct} size={58} color={v.color} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{v.nm}</p>
                      <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>{FMT(v.apy, 1)}% anual</p>
                      <p className="num" style={{ margin: "8px 0 0", fontSize: 15, fontWeight: 800 }}>
                        ${FMT(v.bal, 0)} <span style={{ color: "var(--txt-dim)", fontWeight: 600 }}>/ ${FMT(v.goal, 0)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <button className="card" onClick={() => setAdding(true)} style={{ textAlign: "center", cursor: "pointer", borderStyle: "dashed", color: "var(--txt-muted)", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent" }}>
              <Icon name="plus" size={18} /> Crear nueva bóveda
            </button>
          </div>
        )}
      </div>
      <div className="scroll-bottom" />
      {adding && <AddVaultModal onClose={() => setAdding(false)} onCreate={(v) => { addVault(v); setAdding(false); }} />}
    </div>
  );
}

/* ---------------- VAULT DETAIL ---------------- */
export function ScreenVaultDetail({ go, ctx }: { go: Go; ctx?: unknown }) {
  const wallet = useWallet();
  const { vaults, updateBalance, removeVault } = useVaults(wallet.address);
  const ctxV = ctx as UserVault | undefined;
  const v = vaults.find((x) => x.id === ctxV?.id) ?? ctxV;
  const [action, setAction] = useState<null | "abonar" | "retirar">(null);

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
        <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setAction("abonar")}><Icon name="plus" size={18} /> Abonar</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setAction("retirar")} disabled={v.bal <= 0}>Retirar</button>
        </div>
        <button onClick={() => { removeVault(v.id); go("bovedas"); }} style={{ marginTop: 18, background: "none", border: "none", color: "var(--neg)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Eliminar bóveda</button>
      </div>
      <div className="scroll-bottom" />
      {action && (
        <VaultAmountModal
          mode={action}
          vault={v}
          onClose={() => setAction(null)}
          onConfirm={(amt) => { updateBalance(v.id, action === "abonar" ? amt : -amt); setAction(null); }}
        />
      )}
    </div>
  );
}

/* ---------------- CONVERTIR (calculadora + acción real MXNB↔MXN) ---------------- */
interface Asset { code: string; nm: string; mxn: number; flag: string | null }
const ASSETS: Asset[] = [
  { code: "MXNB", nm: "MXN Bitso (on-chain)", mxn: 1, flag: null },
  { code: "MXN", nm: "Peso mexicano", mxn: 1, flag: null },
  { code: "USD", nm: "Dólar estadounidense", mxn: 17.1252, flag: "us" },
  { code: "BRL", nm: "Real brasileño", mxn: 3.482, flag: "br" },
  { code: "KRW", nm: "Won surcoreano", mxn: 0.01243, flag: "kr" },
];

function AssetBadge({ asset }: { asset: Asset }) {
  if (asset.flag) return <Flag code={asset.flag} cls="sm" />;
  return (
    <span className="num" style={{ width: 40, height: 40, borderRadius: 999, background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>$</span>
  );
}

function AssetSelect({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude?: string }) {
  return (
    <select
      className="chip"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ appearance: "none", WebkitAppearance: "none", cursor: "pointer", color: "var(--txt)", fontWeight: 700 }}
    >
      {ASSETS.filter((a) => a.code !== exclude).map((a) => (
        <option key={a.code} value={a.code} style={{ color: "#000" }}>{a.code}</option>
      ))}
    </select>
  );
}

export function ScreenConvert({ go }: { go: Go }) {
  const [fromCode, setFromCode] = useState("USD");
  const [toCode, setToCode] = useState("MXN");
  const [amount, setAmount] = useState("100");

  const from = ASSETS.find((a) => a.code === fromCode)!;
  const to = ASSETS.find((a) => a.code === toCode)!;
  const amt = Number(amount) || 0;
  const result = to.mxn > 0 ? (amt * from.mxn) / to.mxn : 0;

  const swap = () => { setFromCode(toCode); setToCode(fromCode); };

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title="Convertir" go={go} back="home" />
      <div className="screen-pad">
        <div style={{ position: "relative" }}>
          <div className="conv-field">
            <AssetBadge asset={from} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)" }}>{from.nm}</p>
              <input
                className="big num"
                value={amount}
                inputMode="decimal"
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                style={{ background: "none", border: "none", outline: "none", color: "var(--txt)", width: "100%", padding: 0, margin: "2px 0 0" }}
              />
            </div>
            <AssetSelect value={fromCode} onChange={setFromCode} exclude={toCode} />
          </div>
          <div className="conv-swap" onClick={swap} style={{ cursor: "pointer" }}><Icon name="swap" size={20} /></div>
          <div className="conv-field">
            <AssetBadge asset={to} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--txt-muted)" }}>{to.nm}</p>
              <p className="big num" style={{ margin: "2px 0 0" }}>{FMT(result, to.code === "KRW" ? 0 : 2)}</p>
            </div>
            <AssetSelect value={toCode} onChange={setToCode} exclude={fromCode} />
          </div>
        </div>

        <div className="card" style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="gmatch"><Icon name="globe" size={16} color="var(--accent)" /> 1 {from.code} = <b>{FMT(from.mxn / to.mxn, 4)} {to.code}</b></div>
          <span className="pos-pill">Tipo real</span>
        </div>

        <p style={{ fontSize: 12, color: "var(--txt-dim)", margin: "14px 4px 0", lineHeight: 1.5 }}>
          Calculadora de tipo de cambio en tiempo real, igual al mercado y sin comisión. Para mover dinero usa <b style={{ color: "var(--txt)" }}>Agregar</b>, <b style={{ color: "var(--txt)" }}>Enviar</b> o <b style={{ color: "var(--txt)" }}>Retirar</b> en Inicio.
        </p>

        <div className="sec-head"><h3>Tipos de cambio</h3></div>
        <div className="card" style={{ padding: "4px 18px" }}>
          {FX.map((f) => (
            <div className="fx-row" key={f.code}>
              <Flag code={f.flag} cls="sm" />
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{f.code}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>{f.nm}</p>
              </div>
              <div className="fx-rate">
                <div className="r num">${FMT(f.rate, 4)}</div>
                <div className="d num" style={{ color: f.chg >= 0 ? "var(--accent)" : "var(--neg)" }}>{f.chg >= 0 ? "+" : ""}{FMT(f.chg, 2)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="scroll-bottom" />
    </div>
  );
}

/* ---------------- Modales de bóvedas ---------------- */
const VAULT_COLORS = ["var(--accent)", "var(--accent-2)", "#5BD6C0", "#F5A623", "#FF7A7A"];

function AddVaultModal({ onClose, onCreate }: { onClose: () => void; onCreate: (v: { nm: string; goal: number; apy: number; color: string }) => void }) {
  const [nm, setNm] = useState("");
  const [goal, setGoal] = useState("");
  const [color, setColor] = useState(VAULT_COLORS[0]);
  const valid = nm.trim().length > 0 && Number(goal) > 0;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">Nueva bóveda</p>
        <p className="modal-sub">Ponle nombre y una meta. Tú decides cuánto abonar.</p>
        <span className="field-label">Nombre</span>
        <input className="input" placeholder="Ej. Viaje a Japón" value={nm} onChange={(e) => setNm(e.target.value)} />
        <span className="field-label">Meta (MXN)</span>
        <input className="input num-input" type="number" inputMode="decimal" placeholder="40,000" value={goal} onChange={(e) => setGoal(e.target.value)} />
        <span className="field-label">Color</span>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          {VAULT_COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label="color" style={{ width: 34, height: 34, borderRadius: 999, background: c, border: color === c ? "3px solid var(--txt)" : "3px solid transparent", cursor: "pointer" }} />
          ))}
        </div>
        <button className="btn btn-primary" style={{ marginTop: 20 }} disabled={!valid} onClick={() => onCreate({ nm: nm.trim(), goal: Number(goal), apy: 9, color })}>
          <Icon name="check" size={18} /> Crear bóveda
        </button>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

function VaultAmountModal({ mode, vault, onClose, onConfirm }: { mode: "abonar" | "retirar"; vault: UserVault; onClose: () => void; onConfirm: (amt: number) => void }) {
  const [amount, setAmount] = useState("");
  const max = mode === "abonar" ? Math.max(0, vault.goal - vault.bal) : vault.bal;
  const n = Number(amount);
  const valid = n > 0 && n <= max;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title">{mode === "abonar" ? "Abonar a" : "Retirar de"} {vault.nm}</p>
        <span className="field-label">Monto (MXN)</span>
        <input className="input num-input" type="number" inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <p className="modal-sub" style={{ margin: "8px 0 0" }}>{mode === "abonar" ? `Falta para la meta: $${FMT(max, 2)}` : `Disponible: $${FMT(max, 2)}`}</p>
        <button className="btn btn-primary" style={{ marginTop: 18 }} disabled={!valid} onClick={() => onConfirm(n)}>{mode === "abonar" ? "Abonar" : "Retirar"}</button>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
