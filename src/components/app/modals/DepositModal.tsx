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
        <p className="modal-title">Agregar dinero</p>
        <p className="modal-sub" style={{ marginTop: 4 }}>
          Tu cuenta recibe USDC (dólar digital 1:1) por la red Stellar. Desde ahí lo mandas a tu bóveda.
        </p>

        {ctx ? (
          <FondearScreen ctx={ctx} />
        ) : (
          <div className="card" style={{ marginTop: 14 }}><div className="skel" style={{ height: 80 }} /></div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <span className="chip"><Icon name="bank" size={12} /> Depósito por SPEI · próximamente</span>
        </div>

        <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
