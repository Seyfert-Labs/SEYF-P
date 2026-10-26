"use client";

/* SEYF — mockup fiel de la app para la landing.
   Usa las MISMAS clases de la app (card, quick, lrow, tabbar… de globals.css)
   dibujadas a 390px de ancho, como un iPhone real, y escaladas al tamaño del
   celular. Tres pantallas: depósito SPEI (Inicio), conversión y bóvedas (Ahorro).
   Pura ilustración: datos fijos, sin hooks de wallet ni llamadas a la API. */
import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flag, Icon } from "@/components/app/ui";
import { GrowingAmount } from "@/components/app/GrowingAmount";
import { useI18n } from "./i18n";

const EASE = [0.22, 1, 0.36, 1] as const;
const W = 390;
const H = 844;

function StatusBar() {
  return (
    <div className="am-status">
      <span className="num">9:41</span>
      <span className="am-island" />
      <span className="am-status-ic">
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" y="0" width="3" height="11" rx="1" /></svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor"><path d="M7.5 2.2c2.1 0 4 .8 5.4 2.1l1.1-1.1A9.2 9.2 0 007.5.6 9.2 9.2 0 001 3.2l1.1 1.1a7.6 7.6 0 015.4-2.1zm0 3.1c1.2 0 2.4.5 3.2 1.3l1.1-1.1a6.1 6.1 0 00-8.6 0l1.1 1.1c.8-.8 2-1.3 3.2-1.3zm0 3.1c-.4 0-.8.2-1.1.5L7.5 10l1.1-1.1c-.3-.3-.7-.5-1.1-.5z" /></svg>
        <span className="am-batt"><i /></span>
      </span>
    </div>
  );
}

function TabBar({ active }: { active: "inicio" | "ahorro" | "tarjeta" }) {
  const { t } = useI18n();
  const tabs = [
    { id: "inicio", ic: "home" },
    { id: "ahorro", ic: "vault" },
    { id: "tarjeta", ic: "card" },
  ] as const;
  return (
    <div className="tabbar am-tabbar">
      {tabs.map((tab) => (
        <span key={tab.id} className={`tab${tab.id === active ? " active" : ""}`}>
          <Icon name={tab.ic} size={24} stroke={tab.id === active ? 2.4 : 2} />
          <span className="lb">{t.mock.tabs[tab.id]}</span>
        </span>
      ))}
    </div>
  );
}

function Head({ title }: { title?: string }) {
  const { t } = useI18n();
  return (
    <div className="app-head">
      {title ? (
        <p className="name">{title}</p>
      ) : (
        <div>
          <p className="greet">{t.mock.greet}</p>
          <p className="name">Diego Robles</p>
        </div>
      )}
      <div className="head-actions">
        <span className="icon-btn"><Icon name="bell" size={20} /></span>
        <span className="am-avatar">DR</span>
      </div>
    </div>
  );
}

/* ---------- 1. Inicio: llega un depósito SPEI ---------- */
function ScreenDeposit() {
  const { t } = useI18n();
  return (
    <>
      <Head />
      {/* notificación que cae desde arriba */}
      <motion.div
        className="am-toast"
        initial={{ y: -90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6, ease: EASE }}
      >
        <span className="am-toast-ic"><Icon name="recv" size={18} /></span>
        <div style={{ flex: 1 }}>
          <p className="am-toast-ti">{t.mock.toastTi}</p>
          <p className="am-toast-su">{t.mock.toastSu}</p>
        </div>
        <span className="num am-pos">+$5,000</span>
      </motion.div>
      <div className="am-pad">
        <div className="card glow" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p className="eyebrow">{t.mock.total}</p>
            <Icon name="eye" size={16} color="var(--txt-dim)" />
          </div>
          <div style={{ marginTop: 14 }}>
            <GrowingAmount base={590050.4} apy={9} size={50} align="left" id="am-home" />
          </div>
          <div style={{ display: "flex", gap: 24, marginTop: 14 }}>
            <div className="am-split"><span><i style={{ background: "var(--accent)" }} /> {t.mock.available}</span><b className="num">$125,400</b></div>
            <div className="am-split"><span><i style={{ background: "var(--accent-2)" }} /> {t.mock.inVault}</span><b className="num" style={{ color: "#c4b5fd" }}>$464,650</b></div>
          </div>
          <div className="quick-row" style={{ marginTop: 18, gap: 6 }}>
            {[
              { ic: "plus", tx: t.mock.quick[0] },
              { ic: "send", tx: t.mock.quick[1] },
              { ic: "bolt", tx: t.mock.quick[2] },
            ].map((q, i) => (
              <span className={`quick${i === 0 ? " am-pulse" : ""}`} key={q.tx}><span className="ic"><Icon name={q.ic} /></span><span className="tx">{q.tx}</span></span>
            ))}
            <span className="quick"><span className="ic" style={{ fontSize: 20, letterSpacing: 2, fontWeight: 800 }}>···</span><span className="tx">{t.mock.quick[3]}</span></span>
          </div>
        </div>
        <div className="am-sec">{t.mock.recent}</div>
        <div className="card" style={{ padding: "4px 18px" }}>
          <motion.div className="lrow am-new" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1, duration: 0.5, ease: EASE }}>
            <div className="ava" style={{ color: "var(--accent)" }}><Icon name="bank" size={20} /></div>
            <div className="mid"><p className="ti">{t.mock.deposit}</p><p className="su">{t.mock.today} · 9:41</p></div>
            <div className="amt"><div className="a num am-pos">+$5,000.00</div></div>
          </motion.div>
          <div className="lrow">
            <div className="ava" style={{ color: "#c4b5fd" }}><Icon name="leaf" size={20} /></div>
            <div className="mid"><p className="ti">{t.mock.dailyYield}</p><p className="su">{t.mock.yesterday}</p></div>
            <div className="amt"><div className="a num am-pos">+$143.26</div></div>
          </div>
          <div className="lrow">
            <div className="ava"><Icon name="cup" size={20} /></div>
            <div className="mid"><p className="ti">{t.mock.coffee}</p><p className="su">{t.mock.yesterday} · {t.mock.card}</p></div>
            <div className="amt"><div className="a num">−$68.00</div></div>
          </div>
        </div>
      </div>
      <TabBar active="inicio" />
    </>
  );
}

/* ---------- 2. Convertir a dólar digital ---------- */
function ScreenConvert() {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDone(true), 1900);
    return () => clearTimeout(id);
  }, []);
  return (
    <>
      <div className="app-head" style={{ paddingTop: 4 }}>
        <span className="icon-btn"><Icon name="chevL" size={20} /></span>
        <p className="name" style={{ fontSize: 17 }}>{t.mock.convert}</p>
        <span style={{ width: 42 }} />
      </div>
      <div className="am-pad">
        <div className="card am-fx">
          <p className="eyebrow">{t.mock.pay}</p>
          <div className="am-fx-row">
            <span className="num am-fx-amt">1,000.00</span>
            <span className="am-cur"><Flag code="mx" cls="sm" /> MXN</span>
          </div>
          <p className="am-fx-hint">{t.mock.availableAmt}</p>
        </div>
        <div className="am-swap"><Icon name="swap" size={18} /></div>
        <div className="card am-fx">
          <p className="eyebrow">{t.mock.receive}</p>
          <div className="am-fx-row">
            <span className="num am-fx-amt" style={{ color: "var(--accent)" }}>57.48</span>
            <span className="am-cur"><span className="am-usdc">$</span> USDC</span>
          </div>
          <p className="am-fx-hint">{t.mock.usdcHint}</p>
        </div>
        <div className="card" style={{ padding: "6px 18px", marginTop: 14 }}>
          <div className="am-kv"><span>{t.mock.rate}</span><b className="num">1 USD = 17.40 MXN</b></div>
          <div className="am-kv"><span>{t.mock.fee}</span><b className="num am-pos">$0.00</b></div>
          <div className="am-kv"><span>{t.mock.arrives}</span><b>{t.mock.seconds}</b></div>
        </div>
        <div className={`am-cta${done ? " ok" : ""}`}>
          {done ? <><Icon name="check" size={18} stroke={2.6} /> {t.mock.done} · 57.48 USDC</> : t.mock.convertCta}
        </div>
      </div>
      <AnimatePresence>
        {done && (
          <motion.div className="am-done" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: EASE }}>
            <Icon name="check" size={30} stroke={3} />
          </motion.div>
        )}
      </AnimatePresence>
      <TabBar active="inicio" />
    </>
  );
}

/* ---------- 3. Ahorro: bóvedas con meta ---------- */
function Ring({ pct, color }: { pct: number; color: string }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <svg width="50" height="50" viewBox="0 0 50 50" style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx="25" cy="25" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="5" />
      <motion.circle
        cx="25" cy="25" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - pct / 100) }}
        transition={{ duration: 1.2, delay: 0.3, ease: EASE }}
      />
    </svg>
  );
}

function ScreenVaults() {
  const { t } = useI18n();
  // a la derecha, lo ganado en el mes (no una tasa fija)
  const vaults = [
    { name: t.mock.vaults[0], amt: "$32,000", goal: "$50,000", pct: 64, gain: "+$281", color: "var(--accent-2)" },
    { name: t.mock.vaults[1], amt: "$18,500", goal: "$20,000", pct: 92, gain: "+$139", color: "var(--accent)" },
    { name: t.mock.vaults[2], amt: "$84,000", goal: "$300,000", pct: 28, gain: "+$756", color: "#5BD6C0" },
  ];
  return (
    <>
      <Head title={t.mock.savings} />
      <div className="am-pad">
        <div className="card glow" style={{ padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p className="eyebrow">{t.mock.inVaults}</p>
            <span className="am-chip"><Icon name="leaf" size={12} /> {t.mock.dailyChip}</span>
          </div>
          <div style={{ marginTop: 14 }}>
            <GrowingAmount base={464650} apy={10.4} size={46} align="left" color="#c4b5fd" id="am-vaults" />
          </div>
          <p className="am-fx-hint" style={{ marginTop: 8 }}>{t.mock.earnedMonth}</p>
        </div>
        <div className="am-sec">{t.mock.goals}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {vaults.map((v, i) => (
            <motion.div
              key={i}
              className="card am-vault"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1, duration: 0.5, ease: EASE }}
            >
              <Ring pct={v.pct} color={v.color} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="am-v-ti">{v.name}</p>
                <p className="am-v-su"><span className="num">{v.amt}</span> {t.mock.of} {v.goal}</p>
              </div>
              <span className="num am-pos" style={{ fontSize: 14, fontWeight: 800 }}>{v.gain}<small style={{ fontWeight: 600, opacity: 0.7 }}>{t.mock.perMonth}</small></span>
            </motion.div>
          ))}
        </div>
      </div>
      <TabBar active="ahorro" />
    </>
  );
}

export default function AppMock({ screen }: { screen: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.72);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / W));
    ro.observe(host);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="am-host" ref={hostRef}>
      <div className="am-canvas style-expresivo" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        <StatusBar />
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={screen}
            className="am-screen"
            // sin filter: blur dentro de un padre escalado deja el texto borroso
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            {screen === 0 ? <ScreenDeposit /> : screen === 1 ? <ScreenConvert /> : <ScreenVaults />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
