"use client";

/* Modal "Agregar dinero": activa la cuenta Stellar del usuario (cuenta + línea
   de USDC, patrocinadas por SEYF) y muestra su dirección con QR para recibir
   USDC por la red Stellar. Es el mismo flujo de /retiro, verificado en mainnet.
   SPEI directo llega después (rampa MXN). */
import { useCallback } from "react";
import { Icon } from "../ui";
import FondearScreen from "@/components/retiro/FondearScreen";
import { useRetiroCtx } from "../RetiroContext";

export function DepositModal({
  onClose,
  onSuccess,
  onGoSavings,
}: {
  onClose: () => void;
  onSuccess?: () => void;
  /** "Ahorrar mis USDC": cierra el modal y lleva a Ahorro. */
  onGoSavings?: () => void;
}) {
  const goTo = useCallback(
    (tab: "fondear" | "ahorro" | "adelanto") => {
      if (tab === "fondear") return;
      onSuccess?.();
      onClose();
      onGoSavings?.();
    },
    [onClose, onSuccess, onGoSavings],
  );
  const ctx = useRetiroCtx(goTo);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-grab" />
        <div className="sheet-head">
          <span className="ic"><Icon name="recv" size={22} /></span>
          <div style={{ minWidth: 0 }}>
            <p className="modal-title" style={{ margin: 0 }}>Agregar dinero</p>
            <p className="modal-sub" style={{ margin: "2px 0 0" }}>Recibe dólares digitales (USDC) y ponlos a rendir.</p>
          </div>
        </div>

        {ctx ? (
          <FondearScreen ctx={ctx} />
        ) : (
          <div className="card" style={{ marginTop: 14 }}><div className="skel" style={{ height: 80 }} /></div>
        )}

        <div className="card" style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "var(--surface-2)" }}>
          <Icon name="bank" size={20} color="var(--txt-muted)" />
          <p style={{ margin: 0, flex: 1, fontSize: "var(--t-xs)", color: "var(--txt-muted)" }}>
            Depósito con pesos por <b style={{ color: "var(--txt)" }}>SPEI</b>
          </p>
          <span className="chip" style={{ cursor: "default" }}>Próximamente</span>
        </div>

        <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
