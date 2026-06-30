"use client";

// Conexión "just-in-time" de la wallet Stellar (Pollar).
//
// En vez de un botón "Conectar wallet" suelto (redundante, ya que el usuario
// inició sesión con Privy), la wallet Stellar se conecta EN EL MOMENTO de la
// acción de dinero (abonar/retirar/…): se presenta como una confirmación de
// seguridad de la operación. Reusa el mismo OTP headless de Pollar del KYC.
//
// Uso:
//   const { ensureConnected } = useStellarConnect();
//   onClick={async () => { if (await ensureConnected("abonar a tu bóveda")) setAction("abonar"); }}
//
// `ensureConnected` resuelve true cuando la wallet queda conectada (o ya lo
// estaba, o el riel Stellar no aplica), y false si el usuario cancela.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useSeyfStellarWallet } from "@/lib/seyf/use-seyf-stellar-wallet";
import { useWallet } from "@/components/wallet/WalletContext";
import { STELLAR_VAULTS_ENABLED } from "@/lib/defindex/vaults";
import { waitForPollarSession } from "@/lib/pollar/client-api";
import { fundStellarWallet } from "@/lib/seyf/use-ensure-stellar-funding";
import { Portal } from "./Portal";
import { Icon } from "./ui";

type Ctx = { connected: boolean; ensureConnected: (intent?: string) => Promise<boolean> };

const StellarConnectCtx = createContext<Ctx>({
  connected: false,
  ensureConnected: async () => true,
});

export const useStellarConnect = () => useContext(StellarConnectCtx);

export function StellarConnectProvider({ children }: { children: ReactNode }) {
  const stellar = useSeyfStellarWallet();
  const wallet = useWallet();
  const connected = Boolean(stellar.authenticated && stellar.publicKey);

  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState("operar");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const activationDoneRef = useRef(false);

  const ensureConnected = useCallback(
    (label?: string): Promise<boolean> => {
      // El gate solo aplica al riel Stellar con Pollar configurado.
      if (!STELLAR_VAULTS_ENABLED || !stellar.enabled) return Promise.resolve(true);
      if (connected) return Promise.resolve(true);
      const mail = wallet.email || "";
      setIntent(label || "operar");
      setEmail(mail);
      setCode("");
      setActivateError(null);
      activationDoneRef.current = false;
      setOpen(true);
      if (mail) void stellar.sendCode(mail); // auto-envía el código si hay correo
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
      });
    },
    [connected, stellar, wallet.email],
  );

  // Tras OTP: esperar token + wallet en Pollar antes de abrir el modal de abono.
  useEffect(() => {
    if (!open || !connected || activationDoneRef.current) return;
    let cancelled = false;
    activationDoneRef.current = true;
    setActivating(true);
    setActivateError(null);
    void (async () => {
      try {
        await waitForPollarSession(stellar.getClient, { timeoutMs: 20_000 });
        if (cancelled) return;
        // Fondea la wallet con XLM (testnet) para que pueda pagar las fees de las
        // firmas (trustline, depósitos a bóvedas). Idempotente y no bloqueante:
        // si falla, el depósito reintenta el fondeo más adelante.
        if (stellar.publicKey) await fundStellarWallet(stellar.publicKey);
        if (cancelled) return;
        resolverRef.current?.(true);
        resolverRef.current = null;
        setOpen(false);
      } catch (e) {
        if (cancelled) return;
        activationDoneRef.current = false;
        setActivateError(e instanceof Error ? e.message : "No se pudo activar tu wallet Stellar");
        resolverRef.current?.(false);
        resolverRef.current = null;
      } finally {
        if (!cancelled) setActivating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, connected, stellar.getClient, stellar.publicKey]);

  const cancel = () => {
    resolverRef.current?.(false);
    resolverRef.current = null;
    setOpen(false);
  };

  const busy = stellar.phase === "sending" || stellar.phase === "verifying" || activating;
  // Solo mostrar la UI de "ingresa código" si el código FUE enviado exitosamente
  // (o estamos en verificación / activación). Si hubo error ANTES de enviar, mostrar "Enviar código".
  const codeSent = stellar.phase === "code" || stellar.phase === "verifying" || activating ||
    (stellar.phase === "error" && stellar.codeSentOnce);

  return (
    <StellarConnectCtx.Provider value={{ connected, ensureConnected }}>
      {children}
      {open && (
        <Portal>
          <div className="modal-overlay" onClick={busy ? undefined : cancel}>
            <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="modal-grab" />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon name="lock" size={20} color="var(--accent)" />
                <p className="modal-title" style={{ margin: 0 }}>Confirma tu operación</p>
              </div>
              <p className="modal-sub" style={{ marginTop: 8 }}>
                Estás por <b style={{ color: "var(--txt)" }}>{intent}</b>. Para firmar de forma segura en
                Stellar, ingresa el código que enviamos a {email ? <b style={{ color: "var(--txt)" }}>{email}</b> : "tu correo"}.
              </p>

              {!email && (
                <>
                  <span className="field-label" style={{ marginTop: 14 }}>Correo</span>
                  <input
                    className="input"
                    type="email"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </>
              )}

              {!codeSent ? (
                <>
                  {stellar.phase === "error" && stellar.error && (
                    <div style={{ margin: "12px 0 0", padding: "10px 12px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid var(--neg)", display: "flex", alignItems: "flex-start", gap: 8 }}>
                      <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="info" size={16} color="var(--neg)" /></span>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--neg)", lineHeight: 1.45 }}>{stellar.error}</p>
                    </div>
                  )}
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 16, width: "100%" }}
                    disabled={busy || !email}
                    onClick={() => void stellar.sendCode(email)}
                  >
                    {busy ? <span className="spin" /> : stellar.phase === "error" ? "Reintentar" : "Enviar código"}
                  </button>
                </>
              ) : (
                <>
                  <span className="field-label" style={{ marginTop: 16 }}>Código de verificación</span>
                  <input
                    className="input"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  {stellar.phase === "error" && stellar.error && (
                    <p style={{ margin: "8px 2px 0", fontSize: 12, color: "var(--neg)" }}>{stellar.error}</p>
                  )}
                  {activateError && (
                    <p style={{ margin: "8px 2px 0", fontSize: 12, color: "var(--neg)" }}>{activateError}</p>
                  )}
                  {activating && (
                    <p style={{ margin: "8px 2px 0", fontSize: 12, color: "var(--txt-muted)", display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="spin" style={{ width: 14, height: 14 }} />
                      Activando tu wallet Stellar…
                    </p>
                  )}
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 14, width: "100%" }}
                    disabled={busy || code.trim().length < 4}
                    onClick={() => {
                      setActivateError(null);
                      activationDoneRef.current = false;
                      void stellar.verifyCode(code.trim());
                    }}
                  >
                    {stellar.phase === "verifying" || activating ? <span className="spin" /> : "Verificar y continuar"}
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ marginTop: 10, width: "100%" }}
                    disabled={busy}
                    onClick={() => email && void stellar.sendCode(email)}
                  >
                    Reenviar código
                  </button>
                </>
              )}

              <button className="btn btn-ghost" style={{ marginTop: 10, width: "100%" }} disabled={busy} onClick={cancel}>
                Cancelar
              </button>
            </div>
          </div>
        </Portal>
      )}
    </StellarConnectCtx.Provider>
  );
}
