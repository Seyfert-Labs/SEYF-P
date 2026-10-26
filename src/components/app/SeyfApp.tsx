"use client";

/* SEYF — shell de la app: router + tab bar (responsivo, sin marco de teléfono).
   Gating por sesión: onboarding → login (Pollar: correo + código) → app. */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePollar } from "@pollar/react";
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

const TABS: { id: string; ic: string; lb: string; screen: Screen; match: Screen[] }[] = [
  { id: "inicio", ic: "home", lb: "Inicio", screen: "home", match: ["home", "wallet", "notifs", "txn"] },
  { id: "ahorro", ic: "vault", lb: "Ahorro", screen: "bovedas", match: ["bovedas", "boveda"] },
  { id: "adelanto", ic: "bolt", lb: "Adelanto", screen: "adelanto", match: ["adelanto"] },
];

function TabBar({ screen, go }: { screen: Screen; go: Go }) {
  return (
    <div className="tabbar">
      {TABS.map((t) => {
        const active = t.match.includes(screen);
        return (
          <button key={t.id} className={`tab ${active ? "active" : ""}`} onClick={() => go(t.screen)}>
            <Icon name={t.ic} size={24} stroke={active ? 2.4 : 2} />
            <span className="lb">{t.lb}</span>
          </button>
        );
      })}
    </div>
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

/** Aviso mientras se abre la sesión SEP-10 (sin ella no se lee ni se firma el ahorro). */
function SessionBanner() {
  const app = useAppRetiro();
  // Wallets Turnkey de Pollar no firman nada (ni la sesión) hasta tener un método
  // de recuperación: passkey, otro dispositivo o correo con código.
  const { recoveryLocked, openRecoveryModal } = usePollar();
  const wasLocked = useRef(recoveryLocked);
  const retry = app?.sep10.retry;
  const sessionOk = app?.sep10.state === "ok";
  useEffect(() => {
    // Al terminar de configurar la recuperación, reintenta la sesión sola.
    if (wasLocked.current && !recoveryLocked && !sessionOk) void retry?.();
    wasLocked.current = recoveryLocked;
  }, [recoveryLocked, sessionOk, retry]);

  if (!app || sessionOk) return null;
  if (recoveryLocked) {
    return (
      <div style={{ position: "fixed", left: 0, right: 0, top: 0, zIndex: 50, padding: "10px 16px", display: "flex", justifyContent: "center", pointerEvents: "none" }}>
        <div className="alert alert-info" style={{ margin: 0, maxWidth: 440, display: "flex", alignItems: "center", gap: 10, pointerEvents: "auto" }}>
          <span style={{ flex: 1 }}>Protege tu cuenta para continuar: agrega una passkey o tu correo para recuperarla.</span>
          <button className="chip" onClick={openRecoveryModal}>Proteger mi cuenta</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: "fixed", left: 0, right: 0, top: 0, zIndex: 50, padding: "10px 16px", display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div className={`alert ${app.sep10.state === "error" ? "alert-error" : "alert-info"}`} style={{ margin: 0, maxWidth: 440, display: "flex", alignItems: "center", gap: 10, pointerEvents: "auto" }}>
        {app.sep10.state === "pending" ? (
          <>
            <span className="spin" /> Abriendo tu sesión segura…
          </>
        ) : (
          <>
            No se pudo abrir tu sesión segura.
            <button className="chip" onClick={() => void app.sep10.retry()}>Reintentar</button>
          </>
        )}
      </div>
    </div>
  );
}

export default function SeyfApp() {
  const wallet = useWallet();
  const [loggingIn, setLoggingIn] = useState(false);
  const [route, setRoute] = useState<{ screen: Screen; ctx: unknown }>({ screen: "home", ctx: null });

  const go = useCallback<Go>((screen, ctx = null) => {
    setRoute({ screen, ctx });
    requestAnimationFrame(() => {
      const el = document.querySelector(".screen");
      if (el) el.scrollTop = 0;
    });
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
            <SessionBanner />
            {SCREENS[route.screen] || SCREENS.home}
            {showTabs && <TabBar screen={route.screen} go={go} />}
          </>
        )}
      </div>
    </div>
    </RetiroProvider>
  );
}
