"use client";

/* SEYF — shell de la app: router + tab bar (responsivo, sin marco de teléfono) */
import React, { useCallback, useState } from "react";
import { Icon } from "./ui";
import type { Go, Screen } from "./nav";
import { Onboarding, ScreenHome, ScreenWallet } from "./screens/core";
import {
  ScreenBonos,
  ScreenBondDetail,
  ScreenVaults,
  ScreenVaultDetail,
  ScreenConvert,
} from "./screens/invest";
import { ScreenCard, ScreenProfile } from "./screens/account";

const TABS: { id: string; ic: string; lb: string; screen: Screen; match: Screen[] }[] = [
  { id: "inicio", ic: "home", lb: "Inicio", screen: "home", match: ["home", "wallet", "convertir", "cambio", "notifs", "txn"] },
  { id: "invertir", ic: "invest", lb: "Invertir", screen: "bonos", match: ["bonos", "bono"] },
  { id: "bovedas", ic: "vault", lb: "Bóvedas", screen: "bovedas", match: ["bovedas", "boveda"] },
  { id: "tarjeta", ic: "card", lb: "Tarjeta", screen: "card", match: ["card"] },
  { id: "perfil", ic: "user", lb: "Perfil", screen: "perfil", match: ["perfil"] },
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

export default function SeyfApp() {
  const [entered, setEntered] = useState(false);
  const [route, setRoute] = useState<{ screen: Screen; ctx: unknown }>({ screen: "home", ctx: null });

  const go = useCallback<Go>((screen, ctx = null) => {
    setRoute({ screen, ctx });
    requestAnimationFrame(() => {
      const el = document.querySelector(".screen");
      if (el) el.scrollTop = 0;
    });
  }, []);

  const SCREENS: Record<Screen, React.ReactNode> = {
    home: <ScreenHome go={go} />,
    wallet: <ScreenWallet go={go} />,
    bonos: <ScreenBonos go={go} />,
    bono: <ScreenBondDetail go={go} ctx={route.ctx} />,
    bovedas: <ScreenVaults go={go} />,
    boveda: <ScreenVaultDetail go={go} ctx={route.ctx} />,
    card: <ScreenCard go={go} />,
    perfil: <ScreenProfile go={go} />,
    convertir: <ScreenConvert go={go} />,
    cambio: <ScreenConvert go={go} />,
    notifs: <ScreenProfile go={go} />,
    txn: <ScreenWallet go={go} />,
  };

  const showTabs = !["bono", "boveda", "convertir", "cambio", "txn"].includes(route.screen);

  return (
    <div className="app-shell">
      <div className="uto-root style-expresivo" key={route.screen}>
        {!entered ? (
          <Onboarding onDone={() => setEntered(true)} />
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
