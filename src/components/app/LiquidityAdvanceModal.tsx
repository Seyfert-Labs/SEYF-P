"use client";

/* Adelanto de rendimiento sobre el ahorro para el retiro (contrato `seyf_advance`
   en Stellar). Cotizar (1–30 días), pedir, ver el bloqueo, repagar y liquidar.
   El adelanto sale de la tesorería del contrato, nunca del capital: las acciones
   del vault quedan bloqueadas hasta repagar o hasta que el rendimiento cubra el
   adelanto. Misma lógica que /retiro (verificada en mainnet), en el modal de la app. */
import { useCallback } from "react";
import { Icon } from "./ui";
import AdelantoScreen from "@/components/retiro/AdelantoScreen";
import { useRetiroCtx } from "./RetiroContext";

export function LiquidityAdvanceModal({
  onClose,
  onGoSavings,
}: {
  onClose: () => void;
  /** Sin ahorro todavía: cierra y lleva a la bóveda. */
  onGoSavings?: () => void;
}) {
  const goTo = useCallback(
    (tab: "fondear" | "ahorro" | "adelanto") => {
      if (tab === "adelanto") return;
      onClose();
      onGoSavings?.();
    },
    [onClose, onGoSavings],
  );
  const ctx = useRetiroCtx(goTo);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <p className="modal-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="bolt" size={22} color="var(--accent)" /> Adelanto de rendimiento
        </p>
        <p className="modal-sub" style={{ marginTop: 6, lineHeight: 1.5 }}>
          Recibe hoy parte de lo que tu ahorro va a rendir. Tu capital no se toca.
        </p>

        {ctx ? (
          <AdelantoScreen ctx={ctx} />
        ) : (
          <div className="card" style={{ marginTop: 14 }}><div className="skel" style={{ height: 80 }} /></div>
        )}

        <button className="btn btn-ghost" style={{ marginTop: 18 }} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
