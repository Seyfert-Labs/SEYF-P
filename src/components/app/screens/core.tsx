"use client";

/* UTONOMA — pantallas core: Onboarding, Home, Wallet (wired a Juno) */
import React, { useEffect, useState } from "react";
import { Icon, Spark } from "../ui";
import { TopBar, SubHeader, TxnRow, PendingTxnRow } from "../shared";
import { ALLOC, TXNS, FMT, type Txn } from "../data";
import type { Go } from "../nav";
import { useWallet } from "@/components/wallet/WalletContext";
import { useOnchainTxns } from "@/hooks/useOnchain";
import { usePendingTxns } from "@/hooks/usePendingTxns";
import { useVaults } from "@/hooks/useVaults";
import type { OnchainTransfer } from "@/lib/chain";
import { DepositModal } from "../modals/DepositModal";
import { RedeemModal } from "../modals/RedeemModal";
import { SendOnchainModal } from "../modals/SendOnchainModal";
import { WelcomeBonus } from "../WelcomeBonus";
import { RiskQuizBanner, OnboardingQuiz } from "../RiskQuiz";
import { LiquidityAdvanceModal } from "../LiquidityAdvanceModal";
import { loadRiskProfile, planById } from "../data";
import { Portal } from "../Portal";
import { ClabeCard } from "../ClabeCard";
import { ProjectionCard } from "../ProjectionCard";

/* ---------------- ONBOARDING ---------------- */
// Fases: 0 = Hero, 1 = Quiz de perfil (5 preguntas full-screen)
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState(0);

  if (phase === 0)
    return (
      <div className="onb screen-enter">
        <div className="logo-mark brand">R</div>
        <div className="onb-hero">
          <h1>Tu retiro, con el <em>doble de rendimiento</em> que tu Afore.</h1>
          <p className="sub">Instrumentos soberanos diversificados, liquidez sin penalización y cero comisiones sobre tu saldo.</p>
          <div style={{ marginTop: 30 }}>
            <div className="feat"><span className="tk"><Icon name="leaf" size={15} /></span><span className="tx">8–14% anual según tu perfil de riesgo</span></div>
            <div className="feat"><span className="tk"><Icon name="globe" size={15} /></span><span className="tx">CETES, Treasuries, Tesouro, KTB coreanos</span></div>
            <div className="feat"><span className="tk"><Icon name="shield" size={15} /></span><span className="tx">0% de comisión sobre tu saldo</span></div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button className="btn btn-primary" onClick={() => setPhase(1)}>Comenzar gratis</button>
          <button className="btn btn-ghost" onClick={onDone}>Ya tengo cuenta</button>
        </div>
      </div>
    );

  // Fase 1: quiz full-screen — al terminar llama a onDone (trigger login)
  return <OnboardingQuiz onDone={onDone} />;
}


/* ---------------- HOME (patrimonio + balance MXNB en vivo) ---------------- */
export function ScreenHome({ go }: { go: Go }) {
  const [hide, setHide] = useState(false);
  const [modal, setModal] = useState<null | "deposit" | "send" | "redeem" | "advance">(null);
  const wallet = useWallet();
  const homeTxns = useOnchainTxns(wallet.address);
  const pend = usePendingTxns(wallet.address);
  const { vaults, totalSaved } = useVaults(wallet.address);
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

  // Con sesión iniciada mostramos datos reales: Pesos digitales = saldo MXNB
  // on-chain del usuario; las demás categorías aún no tienen integración → $0.
  const realData = wallet.enabled && wallet.authenticated;
  const pesos = realData ? wallet.balance : ALLOC[0].vl;
  const alloc = ALLOC.map((a) => {
    if (a.key === "pesos") return { ...a, vl: pesos };
    return realData ? { ...a, vl: 0 } : a;
  });
  const total = alloc.reduce((s, a) => s + a.vl, 0);

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <TopBar go={go} />
      <div className="screen-pad">

        {/* ── 1. HERO: balance + quick row ── */}
        <div className="card glow" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p className="eyebrow">Saldo disponible</p>
            <button className="icon-btn" style={{ width: 24, height: 24, background: "none", border: "none" }} onClick={() => setHide(!hide)}>
              <Icon name="eye" size={16} color="var(--txt-dim)" />
            </button>
          </div>
          <p className="amount num" style={{ marginTop: 8 }}>
            {hide ? "••••••" : <><span>${FMT(pesos, 2).split(".")[0]}</span><span className="cents">.{FMT(pesos, 2).split(".")[1]}</span></>}
            <span className="cur">MXN</span>
          </p>
          {totalSaved > 0 && (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--txt-muted)" }}>
              + <span className="num" style={{ color: "var(--accent)", fontWeight: 700 }}>${FMT(totalSaved, 0)}</span> en ahorro
            </p>
          )}

          <div className="quick-row" style={{ marginTop: 18, gap: 6 }}>
            <button className="quick" onClick={() => setModal("deposit")}><span className="ic"><Icon name="plus" /></span><span className="tx">Agregar</span></button>
            <button className="quick" onClick={() => setModal("send")}><span className="ic"><Icon name="send" /></span><span className="tx">Enviar</span></button>
            <button className="quick" onClick={() => setModal("redeem")}><span className="ic"><Icon name="recv" /></span><span className="tx">Retirar</span></button>
            <button className="quick" onClick={() => setModal("advance")}><span className="ic"><Icon name="bolt" /></span><span className="tx">Adelanto</span></button>
          </div>
        </div>

        <WelcomeBonus />

        {/* ── 2. MOVIMIENTOS ── */}
        <div className="sec-head" style={{ marginTop: 22 }}>
          <h3>Movimientos recientes</h3>
          <span className="link" onClick={() => go("wallet")}>Ver todo</span>
        </div>
        <div className="card" style={{ padding: "4px 18px" }}>
          {realData ? (
            pend.pending.length === 0 && homeTxns.txns.length === 0 ? (
              homeTxns.loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "18px 0" }}>
                  <span className="spin" style={{ color: "var(--accent)" }} />
                </div>
              ) : (
                <p style={{ padding: "16px 4px", fontSize: 13, color: "var(--txt-muted)", textAlign: "center" }}>
                  Aún no tienes movimientos. Agrega fondos para empezar.
                </p>
              )
            ) : (
              <div className="list">
                {pend.pending.map((p) => <PendingTxnRow key={p.id} p={p} />)}
                {homeTxns.txns.slice(0, 3).map(onchainToRow).map((t) => <TxnRow key={t.id} t={t} go={go} />)}
              </div>
            )
          ) : (
            <div className="list">{TXNS.slice(0, 3).map((t) => <TxnRow key={t.id} t={t} go={go} />)}</div>
          )}
        </div>

        {/* ── 3. PROYECCIÓN (colapsable) ── */}
        <div style={{ marginTop: 18 }}>
          <ProjectionCard current={totalSaved} apy={profileApy} />
        </div>

        {/* ── 4. AHORRO — solo si tiene bóveda activa ── */}
        {totalSaved > 0 && (
          <>
            <div className="sec-head" style={{ marginTop: 22 }}><h3>Mi ahorro</h3></div>
            <div className="card" style={{ padding: "6px 18px" }}>
              <AcctRow go={go} to="bovedas" ic="vault" nm="Bóveda de retiro" su={`${FMT(weightedApy, 1)}% anual`} vl={totalSaved} series={[30, 32, 31, 34, 36, 38, 37, 40]} />
            </div>
          </>
        )}

        {/* Quiz solo si no completó onboarding */}
        {!loadRiskProfile() && <RiskQuizBanner go={go} />}

      </div>
      <div className="scroll-bottom" />

      {modal === "deposit" && <Portal><DepositModal onClose={() => setModal(null)} onSuccess={() => { refreshBal(); homeTxns.refresh(); }} /></Portal>}
      {modal === "send" && <Portal><SendOnchainModal onClose={() => setModal(null)} onSuccess={() => { refreshBal(); homeTxns.refresh(); }} /></Portal>}
      {modal === "redeem" && <Portal><RedeemModal onClose={() => setModal(null)} onSuccess={() => { refreshBal(); homeTxns.refresh(); }} maxAmount={realData ? wallet.balance : undefined} /></Portal>}
      {modal === "advance" && <Portal><LiquidityAdvanceModal saved={totalSaved} apy={weightedApy} onClose={() => setModal(null)} /></Portal>}
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

/* ---------------- WALLET (pesos digitales · MXNB on-chain) ---------------- */
function onchainToRow(t: OnchainTransfer, i: number): Txn {
  const pos = t.direction === "in";
  return {
    id: i + 1,
    nm: pos ? "Dinero recibido" : "Dinero enviado",
    su: t.timestamp
      ? new Date(t.timestamp).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
      : "Confirmando…",
    amt: pos ? t.value : -t.value,
    ic: pos ? "in" : "send",
    pos,
  };
}

export function ScreenWallet({ go }: { go: Go }) {
  const wallet = useWallet();
  const { txns: onchainTxns, loading: loadingTxns, refresh: refreshTxns } = useOnchainTxns(wallet.address);
  const pend = usePendingTxns(wallet.address);
  const [modal, setModal] = useState<null | "deposit" | "redeem" | "send">(null);

  useEffect(() => {
    pend.reconcile(onchainTxns);
  }, [onchainTxns, pend.reconcile]);

  const realMode = wallet.enabled && wallet.authenticated;
  // Con sesión: saldo real on-chain (aunque sea $0). Sin sesión: saldo demo.
  const loadingBal = wallet.balanceLoading;
  const shown = realMode ? wallet.balance : 48250.4;
  const refreshBal = wallet.refreshBalance;
  const [intPart, centsPart] = FMT(shown, 2).split(".");

  const liveTxns = realMode ? onchainTxns.map(onchainToRow) : TXNS;

  const onSuccess = () => { void refreshBal(); void refreshTxns(); };

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
            <p className="amount num" style={{ fontSize: 46, marginTop: 12 }}>
              ${intPart}<span style={{ opacity: 0.5 }}>.{centsPart}</span>
            </p>
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

        {realMode && (
          <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setModal("redeem")}>
            <Icon name="recv" size={18} /> Retirar a mi banco (SPEI)
          </button>
        )}

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
          {realMode && pend.pending.length === 0 && loadingTxns && liveTxns.length === 0 ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "18px 0" }}><span className="spin" style={{ color: "var(--accent)" }} /></div>
          ) : realMode && pend.pending.length === 0 && liveTxns.length === 0 ? (
            <p style={{ padding: "16px 4px", fontSize: 13, color: "var(--txt-muted)", textAlign: "center" }}>Aún no tienes movimientos.</p>
          ) : (
            <div className="list">
              {realMode && pend.pending.map((p) => <PendingTxnRow key={p.id} p={p} />)}
              {liveTxns.map((t) => <TxnRow key={t.id} t={t} go={go} />)}
            </div>
          )}
        </div>
      </div>
      <div className="scroll-bottom" />

      {modal === "deposit" && <Portal><DepositModal onClose={() => setModal(null)} onSuccess={onSuccess} /></Portal>}
      {modal === "redeem" && <Portal><RedeemModal onClose={() => setModal(null)} onSuccess={onSuccess} maxAmount={realMode ? wallet.balance : undefined} /></Portal>}
      {modal === "send" && <Portal><SendOnchainModal onClose={() => setModal(null)} onSuccess={onSuccess} /></Portal>}
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
            Depósito mínimo: <b style={{ color: "var(--txt)" }}>$500 MXN</b>. Sin comisión por conversión a MXNB.
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
