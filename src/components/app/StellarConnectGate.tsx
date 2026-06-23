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
import { useReyfStellarWallet } from "@/lib/reyf/use-reyf-stellar-wallet";
import { useWallet } from "@/components/wallet/WalletContext";
import { STELLAR_VAULTS_ENABLED } from "@/lib/defindex/vaults";
import { Portal } from "./Portal";
import { Icon } from "./ui";

type Ctx = { connected: boolean; ensureConnected: (intent?: string) => Promise<boolean> };

const StellarConnectCtx = createContext<Ctx>({
  connected: false,
  ensureConnected: async () => true,
});

export const useStellarConnect = () => useContext(StellarConnectCtx);

export function StellarConnectProvider({ children }: { children: ReactNode }) {
  const stellar = useReyfStellarWallet();
  const wallet = useWallet();
  const connected = Boolean(stellar.authenticated && stellar.publicKey);

  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState("operar");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const ensureConnected = useCallback(
    (label?: string): Promise<boolean> => {
      // El gate solo aplica al riel Stellar con Pollar configurado.
      if (!STELLAR_VAULTS_ENABLED || !stellar.enabled) return Promise.resolve(true);
      if (connected) return Promise.resolve(true);
      const mail = wallet.email || "";
      setIntent(label || "operar");
      setEmail(mail);
      setCode("");
      setOpen(true);
      if (mail) void stellar.sendCode(mail); // auto-envía el código si hay correo
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
      });
    },
    [connected, stellar, wallet.email],
  );

  // En cuanto Pollar queda autenticado, resuelve y cierra.
  useEffect(() => {
    if (open && connected) {
      resolverRef.current?.(true);
      resolverRef.current = null;
      setOpen(false);
    }
  }, [open, connected]);

  const cancel = () => {
    resolverRef.current?.(false);
    resolverRef.current = null;
    setOpen(false);
  };

  const busy = stellar.phase === "sending" || stellar.phase === "verifying";
  const codeSent = stellar.phase === "code" || stellar.phase === "verifying" || stellar.phase === "error";

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
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 16, width: "100%" }}
                  disabled={busy || !email}
                  onClick={() => void stellar.sendCode(email)}
                >
                  {busy ? <span className="spin" /> : "Enviar código"}
                </button>
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
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: 14, width: "100%" }}
                    disabled={busy || code.trim().length < 4}
                    onClick={() => void stellar.verifyCode(code.trim())}
                  >
                    {stellar.phase === "verifying" ? <span className="spin" /> : "Verificar y firmar"}
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
