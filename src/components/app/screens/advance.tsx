"use client";

/* Pestaña Adelanto: explica en tres líneas qué es y monta la misma pantalla
   de /retiro (`AdelantoScreen` sobre `seyf_advance`, verificada en mainnet).
   Aquí solo cambia la presentación; cotizar, pedir y repagar no se tocan. */
import { useCallback, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Icon } from "../ui";
import { Seyf3D } from "@/components/brand/Seyf3D";
import { AvatarButton } from "../shared";
import type { Go } from "../nav";
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
  const reduced = useReducedMotion();

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
        {/* Héroe verde, hermano del de la bóveda: halo que respira y la moneda flotando. */}
        <div className="adv-banner">
          <motion.div
            aria-hidden
            className="ah-halo"
            animate={reduced ? undefined : { scale: [1, 1.18, 1], opacity: [0.45, 0.9, 0.45] }}
            transition={reduced ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="ah-coin"
            animate={reduced ? undefined : { y: [0, -6, 0] }}
            transition={reduced ? undefined : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <Seyf3D kind="hourglass" size={128} style={{ background: "none" }} />
          </motion.div>
          <p className="ah-k">Adelanto de rendimiento</p>
          <p className="ah-t">Cobra hoy los intereses de tu ahorro.</p>
          <p className="ah-s">Sin tocar tu capital. Se paga solo con lo que tu ahorro va generando.</p>
        </div>
        <div className="adv-steps">
          <div><span className="n">1</span><p><b>Elige el plazo</b>Ves el monto exacto antes de confirmar.</p></div>
          <div><span className="n">2</span><p><b>Tu ahorro sigue rindiendo</b>Queda apartado como garantía, sin moverse.</p></div>
          <div><span className="n">3</span><p><b>Se paga solo</b>Con tus intereses, o lo repagas antes si quieres.</p></div>
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
