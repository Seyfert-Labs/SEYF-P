"use client";

/* Pestaña Adelanto: explica en tres líneas qué es y monta la misma pantalla
   de /retiro (`AdelantoScreen` sobre `seyf_advance`, verificada en mainnet).
   Aquí solo cambia la presentación; cotizar, pedir y repagar no se tocan. */
import { useCallback, useState } from "react";
import { Icon } from "../ui";
import { AvatarButton } from "../shared";
import type { Go } from "../nav";
import { AdvanceBolt } from "../SavingsArt";
import { Portal } from "../Portal";
import { DepositModal } from "../modals/DepositModal";
import { useRetiroCtx } from "../RetiroContext";
import AdelantoScreen from "@/components/retiro/AdelantoScreen";

export function ScreenAdvance({ go }: { go: Go }) {
  const [deposit, setDeposit] = useState(false);
  const goTo = useCallback(
    (tab: "fondear" | "ahorro" | "adelanto") => {
      if (tab === "ahorro") go("bovedas");
      else if (tab === "fondear") setDeposit(true);
    },
    [go],
  );
  const ctx = useRetiroCtx(goTo);

  return (
    <div className="screen screen-enter">
      <div className="safe-top" />
      <div className="app-head" style={{ paddingTop: 4 }}>
        <p className="name">Adelanto</p>
        <div className="head-actions">
          <button className="icon-btn" onClick={() => go("notifs")} aria-label="Notificaciones">
            <Icon name="bell" size={20} />
          </button>
          <AvatarButton go={go} />
        </div>
      </div>
      <div className="screen-pad">
        <div className="hero-v2 lime">
          <div className="adv-hero">
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="eyebrow">Adelanto de rendimiento</p>
              <p style={{ margin: "8px 0 0", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
                Recibe hoy lo que tu ahorro va a ganar.
              </p>
            </div>
            <AdvanceBolt size={92} />
          </div>
          <div className="adv-points">
            <div><span className="n">1</span>Elige el plazo y ve cuánto recibes antes de firmar.</div>
            <div><span className="n">2</span>Tu capital no se toca: solo queda apartado mientras tanto.</div>
            <div><span className="n">3</span>Se paga solo con el rendimiento, o lo repagas cuando quieras.</div>
          </div>
        </div>

        {ctx ? (
          <AdelantoScreen ctx={ctx} />
        ) : (
          <div className="card" style={{ marginTop: 16 }}><div className="skel" style={{ height: 80 }} /></div>
        )}
      </div>
      <div className="scroll-bottom" />
      {deposit && (
        <Portal>
          <DepositModal onClose={() => setDeposit(false)} onGoSavings={() => go("bovedas")} />
        </Portal>
      )}
    </div>
  );
}
