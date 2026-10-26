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
        {/* Encabezado limpio: una idea, al centro; tres pasos cortos debajo. */}
        <div className="adv-top">
          <AdvanceBolt size={64} />
          <p className="at-k" style={{ marginTop: 6 }}>Adelanto de rendimiento</p>
          <p className="at-t">Recibe hoy lo que tu ahorro va a ganar.</p>
        </div>
        <div className="adv-steps">
          <div><span className="n">1</span><p><b>Elige plazo</b>Ves cuánto recibes antes de firmar.</p></div>
          <div><span className="n">2</span><p><b>Capital intacto</b>Solo queda apartado mientras tanto.</p></div>
          <div><span className="n">3</span><p><b>Se paga solo</b>Con el rendimiento, o repagas cuando quieras.</p></div>
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
