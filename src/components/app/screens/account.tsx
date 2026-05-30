"use client";

/* UTONOMA — Tarjeta + Perfil/Seguridad */
import React, { useState } from "react";
import { Icon, Flag, Ring } from "../ui";
import { SubHeader, TxnRow } from "../shared";
import { CARD_TXNS } from "../data";
import type { Go } from "../nav";
import { useWallet } from "@/components/wallet/WalletContext";
import { explorerBase, IS_TESTNET } from "@/lib/chain";

function shortAddr(a?: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

/* ---------------- TARJETA ---------------- */
export function ScreenCard({ go }: { go: Go }) {
  const [frozen, setFrozen] = useState(false);
  const [cur, setCur] = useState("MXN");
  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <div className="app-head" style={{ paddingTop: 4 }}>
        <p className="name">Tarjeta</p>
        <button className="icon-btn" onClick={() => go("perfil")}><Icon name="gear" size={20} /></button>
      </div>
      <div className="screen-pad">
        <div className="credit-card" style={{ filter: frozen ? "grayscale(.6) brightness(.7)" : "none", transition: "filter .3s" }}>
          <div className="sheen" />
          <div className="mesh" />
          <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="brand" style={{ fontSize: 22, fontWeight: 800 }}>Seyf</span>
            <Icon name="globe" size={24} color="var(--accent)" />
          </div>
          <div style={{ position: "relative" }}>
            <p className="num" style={{ margin: 0, fontSize: 19, letterSpacing: "0.14em", color: "var(--txt)" }}>4821 ··· ··· 7‑903</p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 14 }}>
              <div>
                <p style={{ margin: 0, fontSize: 10, color: "var(--txt-muted)", letterSpacing: ".08em" }}>TITULAR</p>
                <p style={{ margin: "3px 0 0", fontSize: 14, fontWeight: 700 }}>DIEGO ROBLES</p>
              </div>
              <span className="brand" style={{ fontSize: 16, fontStyle: "italic", fontWeight: 800, color: "var(--accent)" }}>VISA</span>
            </div>
          </div>
        </div>

        <div className="quick-row" style={{ marginTop: 18 }}>
          <button className="quick" onClick={() => setFrozen(!frozen)}>
            <span className="ic" style={frozen ? { background: "var(--accent)", color: "var(--on-accent)" } : {}}><Icon name="freeze" /></span>
            <span className="tx">{frozen ? "Activar" : "Congelar"}</span>
          </button>
          <button className="quick"><span className="ic"><Icon name="lock" /></span><span className="tx">PIN</span></button>
          <button className="quick" onClick={() => go("cambio")}><span className="ic"><Icon name="globe" /></span><span className="tx">Divisas</span></button>
          <button className="quick"><span className="ic"><Icon name="gear" /></span><span className="tx">Ajustes</span></button>
        </div>

        <div className="sec-head"><h3>Gasta en cualquier divisa</h3></div>
        <div className="card" style={{ padding: 18 }}>
          <div className="seg" style={{ marginBottom: 4, border: "none", background: "transparent", padding: 0, gap: 8, flexWrap: "wrap" }}>
            {[
              { c: "MXN", f: null, v: "$48,250.40" },
              { c: "USD", f: "us", v: "$1,204.00" },
              { c: "BRL", f: "br", v: "R$ 860.00" },
              { c: "KRW", f: "kr", v: "₩ 410,000" },
            ].map((x) => (
              <button key={x.c} onClick={() => setCur(x.c)}
                style={{ flex: "1 1 44%", border: "1px solid var(--line)", borderRadius: 14, padding: 14, cursor: "pointer", textAlign: "left", background: cur === x.c ? "var(--accent-soft)" : "var(--surface-2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {x.f ? <Flag code={x.f} cls="sm" /> : <span style={{ width: 26, height: 26, borderRadius: 999, background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }} className="num">$</span>}
                  <span style={{ fontWeight: 800, fontSize: 13, color: cur === x.c ? "var(--accent)" : "var(--txt-muted)" }}>{x.c}</span>
                </div>
                <p className="num" style={{ margin: "10px 0 0", fontSize: 18, fontWeight: 800 }}>{x.v}</p>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--txt-dim)", margin: "14px 4px 0", lineHeight: 1.5 }}>
            Al pagar fuera de México convertimos al tipo de cambio de Google, sin comisión.
          </p>
        </div>

        <div className="sec-head"><h3>Movimientos de la tarjeta</h3></div>
        <div className="card" style={{ padding: "4px 18px" }}>
          <div className="list">{CARD_TXNS.map((t) => <TxnRow key={t.id} t={t} />)}</div>
        </div>
      </div>
      <div className="scroll-bottom" />
    </div>
  );
}

/* ---------------- PERFIL / SEGURIDAD ---------------- */
export function ScreenProfile({ go }: { go: Go }) {
  const wallet = useWallet();
  const email = wallet.email || "diego@correo.com";
  const copyAddr = () => {
    if (wallet.address) navigator.clipboard?.writeText(wallet.address).catch(() => {});
  };
  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title="Perfil" go={go} back="home" />
      <div className="screen-pad">
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div className="avatar" style={{ width: 60, height: 60, fontSize: 22 }}>{(email[0] || "S").toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>{wallet.authenticated ? "Mi cuenta" : "Diego Robles"}</p>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--txt-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</p>
          </div>
          <span className="pos-pill"><Icon name="check" size={12} /> Verificado</span>
        </div>

        {wallet.enabled && wallet.authenticated && wallet.address && (
          <div className="card" style={{ marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p className="eyebrow">Wallet · Arbitrum{IS_TESTNET ? " Sepolia" : ""}</p>
              <span className="pos-pill" style={{ background: "var(--accent-2-soft)", color: "var(--accent-2)" }}>Sin seed phrase</span>
            </div>
            <div className="clabe-box" style={{ marginTop: 10 }}>
              <span className="clabe-val" style={{ fontSize: 15 }}>{shortAddr(wallet.address)}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="icon-btn" onClick={copyAddr} aria-label="Copiar dirección"><Icon name="copy" size={18} /></button>
                <a className="icon-btn" href={`${explorerBase}/address/${wallet.address}`} target="_blank" rel="noopener noreferrer" aria-label="Ver en explorador"><Icon name="arrowR" size={18} /></a>
              </div>
            </div>
            <p style={{ margin: "10px 2px 0", fontSize: 12, color: "var(--txt-dim)" }}>
              Tu wallet se creó con tu login social. No necesitas firmar ni pagar gas.
            </p>
          </div>
        )}

        <div className="card glow" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 16 }}>
          <Ring pct={92} size={66} color="var(--accent)" />
          <div style={{ flex: 1 }}>
            <p className="eyebrow" style={{ color: "var(--accent)" }}>Nivel de seguridad</p>
            <p style={{ margin: "6px 0 0", fontWeight: 800, fontSize: 17 }}>Excelente · 92/100</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>Activa 1 capa más para llegar al 100%</p>
          </div>
        </div>

        <p className="eyebrow" style={{ margin: "26px 0 12px" }}>Seguridad</p>
        <div className="card" style={{ padding: 6 }}>
          <SecRow icon="finger" t="Face ID" right={<Tgl on />} />
          <SecRow icon="lock" t="PIN de 6 dígitos" right={<Icon name="chevR" size={16} color="var(--txt-dim)" />} />
          <SecRow icon="shield" t="Verificación en 2 pasos" right={<Tgl on />} />
          <SecRow icon="eye" t="Ocultar saldos al abrir" right={<Tgl />} last />
        </div>

        <p className="eyebrow" style={{ margin: "26px 0 12px" }}>Tu dinero está protegido</p>
        <div className="card" style={{ background: "var(--accent-2-soft)", border: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--accent-2)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="shield" size={20} /></span>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>Saldo asegurado</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--txt-muted)" }}>Hasta $3,000,000 MXN · cifrado AES‑256</p>
            </div>
          </div>
        </div>

        <p className="eyebrow" style={{ margin: "26px 0 12px" }}>Cuenta</p>
        <div className="card" style={{ padding: 6 }}>
          <SecRow icon="doc" t="Documentos y estados de cuenta" right={<Icon name="chevR" size={16} color="var(--txt-dim)" />} />
          <SecRow icon="headset" t="Soporte 24/7" right={<Icon name="chevR" size={16} color="var(--txt-dim)" />} />
          <SecRow icon="logout" t="Cerrar sesión" right={<Icon name="chevR" size={16} color="var(--txt-dim)" />} danger last onClick={wallet.enabled ? wallet.logout : undefined} />
        </div>
      </div>
      <div className="scroll-bottom" />
    </div>
  );
}

function SecRow({ icon, t, right, last, danger, onClick }: { icon: string; t: string; right?: React.ReactNode; last?: boolean; danger?: boolean; onClick?: () => void }) {
  return (
    <div className="lrow" onClick={onClick} style={{ padding: "12px 12px", borderBottom: last ? "none" : "1px solid var(--line)", cursor: onClick ? "pointer" : undefined }}>
      <span style={{ width: 38, height: 38, borderRadius: 11, background: danger ? "rgba(255,122,122,.13)" : "var(--surface-2)", color: danger ? "var(--neg)" : "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid var(--line)" }}>
        <Icon name={icon} size={19} />
      </span>
      <div style={{ flex: 1, fontWeight: 700, fontSize: 15, color: danger ? "var(--neg)" : "var(--txt)" }}>{t}</div>
      {right}
    </div>
  );
}

function Tgl({ on }: { on?: boolean }) {
  const [v, setV] = useState(!!on);
  return <div className={`tgl ${v ? "on" : ""}`} onClick={() => setV(!v)} />;
}
