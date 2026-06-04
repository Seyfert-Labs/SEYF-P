"use client";

/* SEYF — shell de la app: router + tab bar (responsivo, sin marco de teléfono).
   Gating por sesión: onboarding → login (Privy) → app. */
import React, { useCallback, useState } from "react";
import { Icon } from "./ui";
import type { Go, Screen } from "./nav";
import { Onboarding, ScreenHome, ScreenWallet, DepositOnboarding } from "./screens/core";
import { ScreenVaults, ScreenVaultDetail, ScreenConvert } from "./screens/invest";
import { ScreenCard, ScreenProfile, ScreenNotifs } from "./screens/account";
import { useWallet } from "@/components/wallet/WalletContext";

const TABS: { id: string; ic: string; lb: string; screen: Screen; match: Screen[] }[] = [
  { id: "inicio", ic: "home", lb: "Inicio", screen: "home", match: ["home", "wallet", "notifs", "txn"] },
  { id: "ahorro", ic: "vault", lb: "Ahorro", screen: "bovedas", match: ["bovedas", "boveda"] },
  { id: "tarjeta", ic: "card", lb: "Tarjeta", screen: "card", match: ["card"] },
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
        <div className="logo-mark brand" style={{ marginBottom: 18 }}>S</div>
        <span className="spin" style={{ color: "var(--accent)" }} />
      </div>
    </div>
  );
}

const DEPOSIT_KEY = "reyf_seen_deposit";

export default function ReyfApp() {
  const wallet = useWallet();
  const [enteredDemo, setEnteredDemo] = useState(false);
  const [route, setRoute] = useState<{ screen: Screen; ctx: unknown }>({ screen: "home", ctx: null });
  const [seenDeposit, setSeenDeposit] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(DEPOSIT_KEY) === "1";
  });

  const go = useCallback<Go>((screen, ctx = null) => {
    setRoute({ screen, ctx });
    requestAnimationFrame(() => {
      const el = document.querySelector(".screen");
      if (el) el.scrollTop = 0;
    });
  }, []);

  const dismissDeposit = () => {
    try { window.localStorage.setItem(DEPOSIT_KEY, "1"); } catch {}
    setSeenDeposit(true);
  };

  // Con Privy: gatear por sesión real. Sin Privy: flujo demo local.
  const showApp = wallet.enabled ? wallet.authenticated : enteredDemo;
  const onEnter = wallet.enabled ? wallet.login : () => setEnteredDemo(true);

  if (wallet.enabled && !wallet.ready) return <Splash />;

  const SCREENS: Record<Screen, React.ReactNode> = {
    home: <ScreenHome go={go} />,
    wallet: <ScreenWallet go={go} />,
    bovedas: <ScreenVaults go={go} />,
    boveda: <ScreenVaultDetail go={go} ctx={route.ctx} />,
    card: <ScreenCard go={go} />,
    convertir: <ScreenConvert go={go} />,
    cambio: <ScreenConvert go={go} />,
    perfil: <ScreenProfile go={go} />,
    recompensas: <ScreenProfile go={go} />,
    notifs: <ScreenNotifs go={go} />,
    txn: <ScreenWallet go={go} />,
  };

  const showTabs = !["boveda", "convertir", "cambio", "txn"].includes(route.screen);

  // Primera vez post-login: mostrar pantalla de depósito antes del dashboard
  const showDepositScreen = showApp && !seenDeposit;

  return (
    <div className="app-shell">
      <div className="uto-root style-expresivo" key={showApp ? (showDepositScreen ? "deposit-onb" : route.screen) : "onb"}>
        {!showApp ? (
          <Onboarding onDone={onEnter} />
        ) : showDepositScreen ? (
          <DepositOnboarding onDone={dismissDeposit} />
        ) : (
          <>
            {SCREENS[route.screen] || SCREENS.home}
            {showTabs && <TabBar screen={route.screen} go={go} />}
          </>
        )}
      </div>
    </div>
  );
}
