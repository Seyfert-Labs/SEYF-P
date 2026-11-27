"use client";

/* SEYF — shell de la app: router + tab bar (responsivo, sin marco de teléfono).
   Gating por sesión: onboarding → login (Pollar: correo + código) → app. */
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { Icon } from "./ui";
import type { Go, Screen } from "./nav";
import { Onboarding, ScreenHome, ScreenWallet, ScreenTxnDetail } from "./screens/core";
import { ScreenVaults, ScreenVaultDetail, ScreenConvert, ScreenConvertSoon } from "./screens/invest";
import { SPEI_ENABLED } from "@/lib/rails";
import { ScreenProfile, ScreenNotifs } from "./screens/account";
import { ScreenAdvance } from "./screens/advance";
import "./app-v2.css";
import { ScreenKyc } from "./screens/kyc";
import { ScreenAssetDetail } from "./screens/asset-detail";
import { ScreenLogin } from "./screens/login";
import { RetiroProvider, useAppRetiro } from "./RetiroContext";
import { useWallet } from "@/components/wallet/WalletContext";
import { sep10DeviceNotEnrolled } from "@/lib/stellar/sep10-client";
import { haptic } from "@/lib/haptics";

const TABS: { id: string; ic: string; lb: string; screen: Screen; match: Screen[] }[] = [
  { id: "inicio", ic: "home", lb: "Inicio", screen: "home", match: ["home", "wallet", "notifs", "txn"] },
  { id: "ahorro", ic: "vault", lb: "Ahorro", screen: "bovedas", match: ["bovedas", "boveda"] },
  { id: "adelanto", ic: "bolt", lb: "Adelanto", screen: "adelanto", match: ["adelanto"] },
];

function TabBar({ screen, go }: { screen: Screen; go: Go }) {
  return (
    <nav className="tabbar tabbar-v3" aria-label="Secciones">
      {TABS.map((t) => {
        const active = t.match.includes(screen);
        return (
          <button key={t.id} className={`tab ${active ? "active" : ""}`} onClick={() => { if (!active) haptic(); go(t.screen); }} aria-current={active ? "page" : undefined} aria-label={t.lb}>
            {/* píldora blanca compartida: se desliza a la pestaña nueva (layoutId) */}
            {active && <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <Icon name={t.ic} size={21} stroke={active ? 2.4 : 2} />
            <span className="lb">{t.lb}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Splash() {
  return (
    <div className="app-shell">
      <div className="uto-root style-expresivo" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="splash-v2" role="status" aria-label="Cargando">
          <svg viewBox="0 0 344.5 396" width="64" height="74" aria-hidden>
            <g transform="translate(-132.1,-103.5)" fill="none" strokeWidth="43.5" strokeLinecap="round">
              <path className="v" stroke="#8357F5" d="M 274.71 288.69 A 75.4 75.4 0 1 1 221.50 364.67" />
              <path className="l" stroke="#CDFC4A" d="M 275.29 331.32 A 75.4 75.4 0 1 1 328.51 255.34" />
            </g>
          </svg>
          <span className="sp-bar"><i /></span>
        </div>
      </div>
    </div>
  );
}

/* Sin conexión (metro, elevador, mala señal): se avisa arriba en vez de que
   los saldos y las firmas fallen en silencio. */
const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};
function OfflineBanner() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div className="offline-bar" role="alert">
      <Icon name="info" size={15} /> Sin conexión. Tus saldos pueden no estar al día.
    </div>
  );
}

/** Aviso mientras se abre la sesión SEP-10 (sin ella no se lee ni se firma el ahorro). */
function SessionBanner({ raised }: { raised: boolean }) {
  const app = useAppRetiro();
  const sessionOk = app?.sep10.state === "ok";

  if (!app || sessionOk) return null;
  const notEnrolled = app.sep10.state === "error" && sep10DeviceNotEnrolled();
  const state = app.sep10.state;
  return (
    <div className={`session-card${raised ? " raised" : ""}${state === "error" ? " err" : ""}`} role="status">
      {notEnrolled ? (
        <>
          <span className="sc-ic"><Icon name="shield" size={18} /></span>
          <div className="sc-copy">
            <p className="sc-t">Autoriza este navegador</p>
            <p className="sc-s">Tu cuenta se creó en otro navegador. Confírmalo con tu passkey o tu correo.</p>
          </div>
          <button className="btn btn-primary sc-btn" onClick={() => void app.sep10.retry()}>Autorizar</button>
        </>
      ) : app.sep10.state === "pending" ? (
        <>
          <span className="sc-ic"><span className="spin" /></span>
          <div className="sc-copy"><p className="sc-t">Abriendo tu sesión segura…</p></div>
        </>
      ) : (
        <>
          <span className="sc-ic"><Icon name="info" size={18} /></span>
          <div className="sc-copy"><p className="sc-t">No se pudo abrir tu sesión segura.</p></div>
          <button className="btn btn-ghost sc-btn" onClick={() => void app.sep10.retry()}>Reintentar</button>
        </>
      )}
    </div>
  );
}

export default function SeyfApp() {
  const wallet = useWallet();
  const [loggingIn, setLoggingIn] = useState(false);
  const [route, setRoute] = useState<{ screen: Screen; ctx: unknown }>({ screen: "home", ctx: null });

  // Cada pantalla entra al historial del navegador: así el botón o gesto de
  // "atrás" del celular regresa a la pantalla anterior en vez de cerrar la app.
  // El `ctx` puede no ser clonable, por eso vive en memoria y el historial solo
  // guarda su índice.
  const entries = useRef<{ screen: Screen; ctx: unknown }[]>([{ screen: "home", ctx: null }]);

  const scrollTop = () =>
    requestAnimationFrame(() => {
      const el = document.querySelector(".screen");
      if (el) el.scrollTop = 0;
    });

  const go = useCallback<Go>((screen, ctx = null) => {
    setRoute({ screen, ctx });
    entries.current.push({ screen, ctx });
    window.history.pushState({ seyf: entries.current.length - 1 }, "");
    scrollTop();
  }, []);

  useEffect(() => {
    window.history.replaceState({ ...(window.history.state ?? {}), seyf: 0 }, "");
    const onPop = (e: PopStateEvent) => {
      const idx = (e.state as { seyf?: number } | null)?.seyf;
      const entry = idx != null ? entries.current[idx] : undefined;
      setRoute(entry ?? { screen: "home", ctx: null });
      scrollTop();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Gatear por la sesión real de Pollar: sin wallet Stellar no hay app.
  const showApp = wallet.authenticated;
  const onEnter = () => setLoggingIn(true);

  if (!wallet.ready) return <Splash />;

  const SCREENS: Record<Screen, React.ReactNode> = {
    home: <ScreenHome go={go} />,
    wallet: <ScreenWallet go={go} />,
    bovedas: <ScreenVaults go={go} />,
    boveda: <ScreenVaultDetail go={go} ctx={route.ctx} />,
    adelanto: <ScreenAdvance go={go} />,
    // La conversión depende de la rampa SPEI: en mainnet aún es "próximamente".
    convertir: SPEI_ENABLED ? <ScreenConvert go={go} /> : <ScreenConvertSoon go={go} />,
    cambio: SPEI_ENABLED ? <ScreenConvert go={go} /> : <ScreenConvertSoon go={go} />,
    perfil: <ScreenProfile go={go} />,
    recompensas: <ScreenProfile go={go} />,
    kyc: <ScreenKyc go={go} />,
    notifs: <ScreenNotifs go={go} />,
    txn: <ScreenTxnDetail go={go} ctx={route.ctx} />,
    activo: <ScreenAssetDetail go={go} ctx={route.ctx} />,
  };

  const showTabs = !["boveda", "convertir", "cambio", "txn", "kyc", "activo"].includes(route.screen);

  // RetiroProvider fuera del div con `key`: así no se remonta (ni relee la red) al navegar.
  return (
    <RetiroProvider>
    <div className="app-shell">
      <div className="uto-root style-expresivo" key={showApp ? route.screen : "onb"}>
        {!showApp ? (
          loggingIn ? <ScreenLogin onBack={() => setLoggingIn(false)} /> : <Onboarding onDone={onEnter} />
        ) : (
          <>
            <OfflineBanner />
            <SessionBanner raised={showTabs} />
            {SCREENS[route.screen] || SCREENS.home}
            {showTabs && <TabBar screen={route.screen} go={go} />}
          </>
        )}
      </div>
    </div>
    </RetiroProvider>
  );
}
