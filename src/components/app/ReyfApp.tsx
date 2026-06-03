"use client";

/* SEYF — shell de la app: router + tab bar (responsivo, sin marco de teléfono).
   Gating por sesión: onboarding → login (Privy) → app. */
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
import { ScreenMercado, ScreenProductDetail, ScreenComprar, ScreenVender, ScreenCompras, ScreenVentas } from "./screens/market";
import { ScreenCard, ScreenProfile } from "./screens/account";
import { useWallet } from "@/components/wallet/WalletContext";

const TABS: { id: string; ic: string; lb: string; screen: Screen; match: Screen[] }[] = [
  { id: "inicio", ic: "home", lb: "Inicio", screen: "home", match: ["home", "wallet", "convertir", "cambio", "notifs", "txn", "bonos", "bono", "compras", "ventas"] },
  { id: "ahorro", ic: "vault", lb: "Ahorro", screen: "bovedas", match: ["bovedas", "boveda"] },
  { id: "tarjeta", ic: "card", lb: "Tarjeta", screen: "card", match: ["card"] },
  { id: "perfil", ic: "user", lb: "Perfil", screen: "perfil", match: ["perfil", "recompensas"] },
  // Mercado (Central de Abastos) oculto del menú por ahora — rutas activas, accesible por código.
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

export default function ReyfApp() {
  const wallet = useWallet();
  const [enteredDemo, setEnteredDemo] = useState(false);
  const [route, setRoute] = useState<{ screen: Screen; ctx: unknown }>({ screen: "home", ctx: null });

  const go = useCallback<Go>((screen, ctx = null) => {
    setRoute({ screen, ctx });
    requestAnimationFrame(() => {
      const el = document.querySelector(".screen");
      if (el) el.scrollTop = 0;
    });
  }, []);

  // Con Privy: gatear por sesión real. Sin Privy: flujo demo local.
  const showApp = wallet.enabled ? wallet.authenticated : enteredDemo;
  const onEnter = wallet.enabled ? wallet.login : () => setEnteredDemo(true);

  if (wallet.enabled && !wallet.ready) return <Splash />;

  const SCREENS: Record<Screen, React.ReactNode> = {
    home: <ScreenHome go={go} />,
    wallet: <ScreenWallet go={go} />,
    bonos: <ScreenBonos go={go} />,
    bono: <ScreenBondDetail go={go} ctx={route.ctx} />,
    bovedas: <ScreenVaults go={go} />,
    boveda: <ScreenVaultDetail go={go} ctx={route.ctx} />,
    mercado: <ScreenMercado go={go} />,
    producto: <ScreenProductDetail go={go} ctx={route.ctx} />,
    comprar: <ScreenComprar go={go} ctx={route.ctx} />,
    vender: <ScreenVender go={go} />,
    altaNegocio: <ScreenVender go={go} />,
    card: <ScreenCard go={go} />,
    perfil: <ScreenProfile go={go} />,
    compras: <ScreenCompras go={go} />,
    ventas: <ScreenVentas go={go} />,
    negocios: <ScreenVender go={go} />,
    recompensas: <ScreenProfile go={go} />,
    convertir: <ScreenConvert go={go} />,
    cambio: <ScreenConvert go={go} />,
    notifs: <ScreenProfile go={go} />,
    txn: <ScreenWallet go={go} />,
  };

  const showTabs = !["bono", "boveda", "producto", "comprar", "vender", "convertir", "cambio", "txn"].includes(route.screen);

  return (
    <div className="app-shell">
      <div className="uto-root style-expresivo" key={showApp ? route.screen : "onb"}>
        {!showApp ? (
          <Onboarding onDone={onEnter} />
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
