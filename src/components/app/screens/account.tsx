"use client";

/* UTONOMA — Tarjeta + Perfil/Seguridad */
import React, { useState } from "react";
import { Icon, Flag, Ring } from "../ui";
import { SubHeader, TxnRow, AvatarButton } from "../shared";
import { CARD_TXNS, FMT } from "../data";
import type { Go } from "../nav";
import { useWallet } from "@/components/wallet/WalletContext";
import { explorerBase } from "@/lib/chain";
import { ClabeCard } from "../ClabeCard";

function shortAddr(a?: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

/* Ondas de pago sin contacto */
function Contactless({ size = 22, color = "var(--txt-muted)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" style={{ display: "block" }}>
      <path d="M8.5 7a8 8 0 010 10" /><path d="M12 4.5a12 12 0 010 15" /><path d="M5 9.5a4.5 4.5 0 010 5" />
    </svg>
  );
}

/* Chip EMV */
function Chip() {
  return (
    <div style={{ width: 42, height: 32, borderRadius: 7, background: "linear-gradient(135deg, #e9cf7a, #b8932f)", position: "relative", overflow: "hidden", boxShadow: "inset 0 0 0 1px rgba(0,0,0,.15)" }}>
      <span style={{ position: "absolute", inset: "5px 0", borderTop: "1px solid rgba(0,0,0,.25)", borderBottom: "1px solid rgba(0,0,0,.25)" }} />
      <span style={{ position: "absolute", inset: "0 14px", borderLeft: "1px solid rgba(0,0,0,.25)", borderRight: "1px solid rgba(0,0,0,.25)" }} />
    </div>
  );
}

/* ---------------- TARJETA ---------------- */
export function ScreenCard({ go }: { go: Go }) {
  const wallet = useWallet();
  const [frozen, setFrozen] = useState(false);
  const [flip, setFlip] = useState(false);
  const [cur, setCur] = useState("MXN");

  const realMode = wallet.enabled && wallet.authenticated;
  const balance = realMode ? wallet.balance : 48250.4;
  const holder = realMode ? (wallet.email?.split("@")[0]?.toUpperCase() || "TITULAR SEYF") : "DIEGO ROBLES";

  // Saldo expresado en cada divisa (tipo de cambio de referencia).
  const RATES: Record<string, { rate: number; sym: string; flag: string | null; dec: number }> = {
    MXN: { rate: 1, sym: "$", flag: null, dec: 2 },
    USD: { rate: 17.1252, sym: "$", flag: "us", dec: 2 },
    BRL: { rate: 3.482, sym: "R$ ", flag: "br", dec: 2 },
    KRW: { rate: 0.01243, sym: "₩ ", flag: "kr", dec: 0 },
  };

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <div className="app-head" style={{ paddingTop: 4 }}>
        <p className="name">Tarjeta</p>
        <AvatarButton go={go} />
      </div>
      <div className="screen-pad">
        <div className="card-flip" onClick={() => setFlip((f) => !f)}>
          <div className={`card-flip-inner ${flip ? "flipped" : ""}`}>
            {/* Frente */}
            <div className="credit-card card-face" style={frozen ? { filter: "grayscale(.6) brightness(.7)" } : undefined}>
              <div className="sheen" />
              <div className="mesh" />
              <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <span className="brand" style={{ fontSize: 22, fontWeight: 800 }}>Reyf</span>
                <Contactless size={22} color="var(--accent)" />
              </div>
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, marginTop: -4 }}>
                <Chip />
                <div>
                  <p style={{ margin: 0, fontSize: 10, color: "var(--txt-muted)", letterSpacing: ".06em" }}>SALDO</p>
                  <p className="num" style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 800 }}>${FMT(balance, 2)}</p>
                </div>
              </div>
              <div style={{ position: "relative" }}>
                <p className="num" style={{ margin: 0, fontSize: 19, letterSpacing: "0.14em", color: "var(--txt)" }}>4821 ···· ···· 7903</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 14 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 10, color: "var(--txt-muted)", letterSpacing: ".08em" }}>TITULAR</p>
                    <p style={{ margin: "3px 0 0", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>{holder}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: 10, color: "var(--txt-muted)", letterSpacing: ".08em" }}>VÁLIDA</p>
                    <p className="num" style={{ margin: "3px 0 0", fontSize: 14, fontWeight: 700 }}>09/28</p>
                  </div>
                  <span className="brand" style={{ fontSize: 16, fontStyle: "italic", fontWeight: 800, color: "var(--accent)" }}>VISA</span>
                </div>
              </div>
            </div>
            {/* Reverso */}
            <div className="credit-card card-face back" style={frozen ? { filter: "grayscale(.6) brightness(.7)" } : undefined}>
              <div className="sheen" />
              <div className="card-stripe" />
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
                <div className="card-sign"><span className="num" style={{ color: "#111", fontWeight: 700 }}>123</span></div>
                <span style={{ fontSize: 10, color: "var(--txt-muted)", letterSpacing: ".06em" }}>CVV</span>
              </div>
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, color: "var(--txt-muted)", fontSize: 11 }}>
                <Icon name="lock" size={13} color="var(--accent)" /> Cifrado AES‑256 · uso protegido
              </div>
            </div>
          </div>
        </div>
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--txt-dim)", margin: "10px 0 0" }}>
          Toca la tarjeta para ver el {flip ? "frente" : "reverso"}
        </p>

        <div className="quick-row" style={{ marginTop: 18 }}>
          <button className="quick" onClick={() => setFrozen(!frozen)}>
            <span className="ic" style={frozen ? { background: "var(--accent)", color: "var(--on-accent)" } : {}}><Icon name="freeze" /></span>
            <span className="tx">{frozen ? "Activar" : "Congelar"}</span>
          </button>
          <button className="quick"><span className="ic"><Icon name="lock" /></span><span className="tx">PIN</span></button>
          <button className="quick" onClick={() => go("cambio")}><span className="ic"><Icon name="globe" /></span><span className="tx">Divisas</span></button>
          <button className="quick" onClick={() => go("perfil")}><span className="ic"><Icon name="gear" /></span><span className="tx">Ajustes</span></button>
        </div>

        <div className="sec-head"><h3>Gasta en cualquier divisa</h3></div>
        <div className="card" style={{ padding: 18 }}>
          <div className="seg" style={{ marginBottom: 4, border: "none", background: "transparent", padding: 0, gap: 8, flexWrap: "wrap" }}>
            {Object.entries(RATES).map(([c, r]) => (
              <button key={c} onClick={() => setCur(c)}
                style={{ flex: "1 1 44%", border: "1px solid var(--line)", borderRadius: 14, padding: 14, cursor: "pointer", textAlign: "left", background: cur === c ? "var(--accent-soft)" : "var(--surface-2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {r.flag ? <Flag code={r.flag} cls="sm" /> : <span style={{ width: 26, height: 26, borderRadius: 999, background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }} className="num">$</span>}
                  <span style={{ fontWeight: 800, fontSize: 13, color: cur === c ? "var(--accent)" : "var(--txt-muted)" }}>{c}</span>
                </div>
                <p className="num" style={{ margin: "10px 0 0", fontSize: 18, fontWeight: 800 }}>{r.sym}{FMT(balance / r.rate, r.dec)}</p>
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
              <p className="eyebrow">Mi cuenta Reyf</p>
              <span className="pos-pill" style={{ background: "var(--accent-2-soft)", color: "var(--accent-2)" }}>Activa</span>
            </div>
            <div className="clabe-box" style={{ marginTop: 10 }}>
              <span className="clabe-val" style={{ fontSize: 15 }}>{shortAddr(wallet.address)}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="icon-btn" onClick={copyAddr} aria-label="Copiar dirección"><Icon name="copy" size={18} /></button>
                <a className="icon-btn" href={`${explorerBase}/address/${wallet.address}`} target="_blank" rel="noopener noreferrer" aria-label="Ver en explorador"><Icon name="arrowR" size={18} /></a>
              </div>
            </div>
            <p style={{ margin: "10px 2px 0", fontSize: 12, color: "var(--txt-dim)" }}>
              Tu cuenta se creó con tu acceso. No necesitas contraseñas ni pasos extra.
            </p>
          </div>
        )}

        {wallet.enabled && wallet.authenticated && (
          <>
            <p className="eyebrow" style={{ margin: "26px 0 12px" }}>Cuenta de depósito (SPEI)</p>
            <ClabeCard />
          </>
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

/* ---------------- NOTIFICACIONES ---------------- */
export function ScreenNotifs({ go }: { go: Go }) {
  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title="Notificaciones" go={go} back="home" />
      <div className="screen-pad">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            paddingTop: 64,
            textAlign: "center",
          }}
        >
          <span
            style={{
              width: 72,
              height: 72,
              borderRadius: 22,
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="bell" size={32} color="var(--txt-dim)" />
          </span>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 18 }}>Todo tranquilo por aquí</p>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--txt-muted)", lineHeight: 1.55, maxWidth: 260 }}>
              Aquí verás alertas de movimientos, rendimientos y novedades de tu cuenta.
            </p>
          </div>
        </div>
      </div>
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
