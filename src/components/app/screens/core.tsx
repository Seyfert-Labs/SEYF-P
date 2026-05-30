"use client";

/* UTONOMA — pantallas core: Onboarding, Home, Wallet (wired a Juno) */
import React, { useState } from "react";
import { Icon, Spark } from "../ui";
import { TopBar, SubHeader, TxnRow } from "../shared";
import { ALLOC, TXNS, FMT, type Txn } from "../data";
import type { Go } from "../nav";
import { useTransactions } from "@/hooks/useJuno";
import type { Transaction } from "@/types/juno";
import { useWallet } from "@/components/wallet/WalletContext";
import { DepositModal } from "../modals/DepositModal";
import { RedeemModal } from "../modals/RedeemModal";
import { SendOnchainModal } from "../modals/SendOnchainModal";
import { WelcomeBonus } from "../WelcomeBonus";

/* ---------------- ONBOARDING ---------------- */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);

  if (step === 0)
    return (
      <div className="onb screen-enter">
        <div className="logo-mark brand">S</div>
        <div className="onb-hero">
          <h1>Tu dinero, <em>protegido</em> y creciendo en automático.</h1>
          <p className="sub">Pesos digitales, bonos de gobierno y bóvedas de ahorro en una sola app. Rendimientos premium, tipo de cambio justo.</p>
          <div style={{ marginTop: 30 }}>
            <div className="feat"><span className="tk"><Icon name="leaf" size={15} /></span><span className="tx">Rendimiento diario sobre tu saldo</span></div>
            <div className="feat"><span className="tk"><Icon name="globe" size={15} /></span><span className="tx">Bonos de México, USA, Brasil y Corea</span></div>
            <div className="feat"><span className="tk"><Icon name="shield" size={15} /></span><span className="tx">Saldo asegurado y cifrado de grado bancario</span></div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button className="btn btn-primary" onClick={() => setStep(1)}>Crear mi cuenta</button>
          <button className="btn btn-ghost" onClick={onDone}>Ya tengo cuenta</button>
        </div>
      </div>
    );

  return (
    <div className="onb screen-enter">
      <div className="logo-mark" style={{ background: "var(--accent-2-soft)", color: "var(--accent-2)" }}>
        <Icon name="shield" size={28} />
      </div>
      <h1 style={{ fontSize: 30, marginTop: 22 }}>Activa tu seguridad</h1>
      <p className="sub" style={{ marginBottom: 28 }}>Protegemos cada movimiento con varias capas. Actívalas en segundos.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <SecSetupRow icon="finger" t="Acceso con Face ID" s="Entra sin contraseña" on />
        <SecSetupRow icon="lock" t="PIN de 6 dígitos" s="Respaldo de tu cuenta" on />
        <SecSetupRow icon="bell" t="Alertas en tiempo real" s="Notificación de cada cargo" on />
        <SecSetupRow icon="shield" t="Saldo asegurado" s="Protección hasta $3,000,000 MXN" on lock />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0", color: "var(--txt-muted)", fontSize: 13 }}>
        <Icon name="lock" size={15} color="var(--accent)" />
        <span>Cifrado AES-256 · Regulado y supervisado</span>
      </div>
      <button className="btn btn-primary" onClick={onDone}>Entrar a Seyf</button>
    </div>
  );
}

function SecSetupRow({ icon, t, s, on, lock }: { icon: string; t: string; s: string; on?: boolean; lock?: boolean }) {
  const [v, setV] = useState(!!on);
  return (
    <div className="card sec-row" style={{ padding: 16 }}>
      <span className="ic"><Icon name={icon} size={22} /></span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{t}</p>
        <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>{s}</p>
      </div>
      {lock ? <span className="pos-pill">Incluido</span> : <div className={`tgl ${v ? "on" : ""}`} onClick={() => setV(!v)} />}
    </div>
  );
}

/* ---------------- HOME (patrimonio + balance MXNB en vivo) ---------------- */
export function ScreenHome({ go }: { go: Go }) {
  const [hide, setHide] = useState(false);
  const [modal, setModal] = useState<null | "deposit" | "redeem">(null);
  const wallet = useWallet();
  const refreshBal = wallet.refreshBalance;

  // El saldo de "Pesos digitales" sale del balance MXNB on-chain del usuario.
  const liveBalance = wallet.authenticated && wallet.balance > 0;
  const pesos = liveBalance ? wallet.balance : ALLOC[0].vl;
  const alloc = ALLOC.map((a) => (a.key === "pesos" ? { ...a, vl: pesos } : a));
  const total = alloc.reduce((s, a) => s + a.vl, 0);

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <TopBar go={go} />
      <div className="screen-pad">
        <div className="card glow" style={{ padding: 22 }}>
          <div className="hero-bal">
            <div className="lbl">
              <p className="eyebrow">Patrimonio total</p>
              <button className="icon-btn" style={{ width: 24, height: 24, background: "none", border: "none" }} onClick={() => setHide(!hide)}>
                <Icon name="eye" size={16} color="var(--txt-dim)" />
              </button>
            </div>
            <p className="amount num">
              {hide ? "••••••" : <><span>${FMT(total, 2).split(".")[0]}</span><span className="cents">.{FMT(total, 2).split(".")[1]}</span></>}
              <span className="cur">MXN</span>
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
              <span className="pos-pill"><Icon name="send" size={12} /> +2.15%</span>
              <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>
                {liveBalance ? <>MXNB on-chain · Arbitrum</> : <>+<span className="num">$12,340</span> este mes</>}
              </span>
            </div>
          </div>
          <div className="alloc-bar" style={{ marginTop: 20 }}>
            {alloc.map((a) => <span key={a.key} style={{ width: `${(a.vl / total) * 100}%`, background: a.color }} />)}
          </div>
          <div className="alloc-legend">
            {alloc.map((a) => (
              <div className="row" key={a.key}>
                <span className="dot" style={{ background: a.color }} />
                <div className="col">
                  <span className="nm">{a.nm}</span>
                  <span className="vl num">${FMT(a.vl, 0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <WelcomeBonus />

        <div className="quick-row" style={{ marginTop: 18 }}>
          <button className="quick" onClick={() => setModal("deposit")}><span className="ic"><Icon name="plus" /></span><span className="tx">Agregar</span></button>
          <button className="quick" onClick={() => setModal("redeem")}><span className="ic"><Icon name="send" /></span><span className="tx">Enviar</span></button>
          <button className="quick" onClick={() => go("convertir")}><span className="ic"><Icon name="swap" /></span><span className="tx">Convertir</span></button>
          <button className="quick" onClick={() => go("bonos")}><span className="ic"><Icon name="invest" /></span><span className="tx">Invertir</span></button>
        </div>

        <div className="sec-head"><h3>Mis cuentas</h3></div>
        <div className="card" style={{ padding: "6px 18px" }}>
          <div className="list">
            <AcctRow go={go} to="wallet" ic="leaf" nm="Pesos digitales" su={liveBalance ? "MXNB · on-chain" : "Rinde 9% anual"} vl={pesos} series={[20, 22, 21, 24, 26, 25, 28, 30]} />
            <AcctRow go={go} to="bonos" ic="globe" nm="Bonos de gobierno" su="4 países · hasta 11.75%" vl={ALLOC[1].vl} series={[30, 32, 31, 34, 36, 38, 37, 40]} />
            <AcctRow go={go} to="bovedas" ic="vault" nm="Bóvedas de ahorro" su="3 metas activas" vl={ALLOC[2].vl} series={[18, 19, 21, 23, 24, 26, 28, 29]} />
            <AcctRow go={go} to="bonos" ic="star" nm="Acciones premium" su="Cartera curada" vl={ALLOC[3].vl} series={[40, 38, 42, 44, 43, 46, 48, 47]} />
          </div>
        </div>

        <div className="sec-head"><h3>Movimientos recientes</h3><span className="link" onClick={() => go("wallet")}>Ver todo</span></div>
        <div className="card" style={{ padding: "4px 18px" }}>
          <div className="list">{TXNS.slice(0, 3).map((t) => <TxnRow key={t.id} t={t} go={go} />)}</div>
        </div>
      </div>
      <div className="scroll-bottom" />

      {modal === "deposit" && <DepositModal onClose={() => setModal(null)} onSuccess={refreshBal} />}
      {modal === "redeem" && <RedeemModal onClose={() => setModal(null)} onSuccess={refreshBal} maxAmount={liveBalance ? wallet.balance : undefined} />}
    </div>
  );
}

function AcctRow({ go, to, ic, nm, su, vl, series }: { go: Go; to: Parameters<Go>[0]; ic: string; nm: string; su: string; vl: number; series: number[] }) {
  return (
    <div className="lrow" onClick={() => go(to)}>
      <div className="ava"><Icon name={ic} size={20} color="var(--accent)" /></div>
      <div className="mid"><p className="ti">{nm}</p><p className="su">{su}</p></div>
      <Spark data={series} w={56} h={26} fillArea />
      <div className="amt" style={{ marginLeft: 8 }}><div className="a num">${FMT(vl, 0)}</div></div>
      <Icon name="chevR" size={16} color="var(--txt-dim)" />
    </div>
  );
}

/* ---------------- WALLET (pesos digitales · wired a Juno) ---------------- */
const TXN_LABEL: Record<string, string> = {
  ISSUANCE: "Depósito recibido (MXNB)",
  REDEMPTION: "Redención a MXN",
  DEPOSIT: "Depósito SPEI",
};

function junoTxnToRow(t: Transaction): Txn {
  const pos = t.transaction_type !== "REDEMPTION";
  return {
    id: Number(t.id) || Math.random(),
    nm: TXN_LABEL[t.transaction_type] ?? t.transaction_type,
    su: `${t.summary_status} · ${new Date(t.created_at).toLocaleDateString("es-MX")}`,
    amt: pos ? Math.abs(t.amount) : -Math.abs(t.amount),
    ic: pos ? "in" : "send",
    pos,
  };
}

export function ScreenWallet({ go }: { go: Go }) {
  const wallet = useWallet();
  const { transactions, refresh: refreshTxns } = useTransactions(25);
  const [modal, setModal] = useState<null | "deposit" | "redeem" | "send">(null);

  // Saldo real on-chain del usuario; si no hay sesión, saldo demo del prototipo.
  const loadingBal = wallet.balanceLoading;
  const liveBalance = wallet.authenticated && wallet.balance > 0;
  const shown = liveBalance ? wallet.balance : 48250.4;
  const refreshBal = wallet.refreshBalance;
  const [intPart, centsPart] = FMT(shown, 2).split(".");

  const liveTxns = transactions.length > 0 ? transactions.map(junoTxnToRow) : TXNS;

  const onSuccess = () => { void refreshBal(); void refreshTxns(); };

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <SubHeader title="Pesos digitales" go={go} back="home"
        action={<button className="icon-btn" onClick={() => go("convertir")}><Icon name="swap" size={20} /></button>} />

      <div className="screen-pad">
        <div className="card glow" style={{ padding: 24, textAlign: "center" }}>
          <p className="eyebrow" style={{ textAlign: "center" }}>Saldo disponible</p>
          {loadingBal ? (
            <div className="skel" style={{ height: 48, width: 200, margin: "16px auto 0" }} />
          ) : (
            <p className="amount num" style={{ fontSize: 46, marginTop: 12 }}>
              ${intPart}<span style={{ opacity: 0.5 }}>.{centsPart}</span>
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14 }}>
            <span className="pos-pill"><Icon name="leaf" size={12} /> {liveBalance ? "MXNB on-chain" : "+$12.40 hoy"}</span>
            <span style={{ fontSize: 13, color: "var(--txt-muted)" }}>{liveBalance ? "Arbitrum · tu wallet" : "9% anual · pagado diario"}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setModal("deposit")}><Icon name="plus" size={18} /> Agregar</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModal("redeem")}><Icon name="send" size={18} /> Enviar</button>
        </div>

        {wallet.enabled && wallet.authenticated && (
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setModal("send")}>
            <Icon name="swap" size={18} /> Transferir MXNB on-chain · sin gas
          </button>
        )}

        <div className="card" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 14, background: "var(--accent-soft)", border: "none" }}>
          <span style={{ width: 44, height: 44, borderRadius: 13, background: "var(--accent)", color: "var(--on-accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="leaf" size={22} />
          </span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: "var(--accent)" }}>Tu saldo trabaja solo</p>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>Has ganado <b className="num" style={{ color: "var(--txt)" }}>$372.18</b> este mes en intereses.</p>
          </div>
        </div>

        <div className="sec-head"><h3>Movimientos</h3><span className="link" onClick={() => onSuccess()}>Actualizar</span></div>
        <div className="card" style={{ padding: "4px 18px" }}>
          <div className="list">{liveTxns.map((t) => <TxnRow key={t.id} t={t} go={go} />)}</div>
        </div>
      </div>
      <div className="scroll-bottom" />

      {modal === "deposit" && <DepositModal onClose={() => setModal(null)} onSuccess={onSuccess} />}
      {modal === "redeem" && <RedeemModal onClose={() => setModal(null)} onSuccess={onSuccess} maxAmount={liveBalance ? wallet.balance : undefined} />}
      {modal === "send" && <SendOnchainModal onClose={() => setModal(null)} />}
    </div>
  );
}
