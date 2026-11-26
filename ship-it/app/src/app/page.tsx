"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONTRACT_ID,
  DEPLOYMENT_LABEL,
  EXPERT,
  NETWORK_PASSPHRASE,
  PRIZE_STROOPS,
  formatXlm,
  explainError,
  prepareClaim,
  readBalance,
  submit,
} from "@/lib/vault";

type Kit = typeof import("@creit.tech/stellar-wallets-kit/sdk").StellarWalletsKit;

type Result =
  | { kind: "ok"; hash: string }
  | { kind: "err"; text: string }
  | null;

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-6)}`;

export default function Page() {
  const kitRef = useRef<Kit | null>(null);
  const [kitReady, setKitReady] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [wrongNetwork, setWrongNetwork] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceErr, setBalanceErr] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);

  // El kit usa APIs del navegador: se carga solo en el cliente.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ StellarWalletsKit }, { Networks }, f, x, a, l] = await Promise.all([
        import("@creit.tech/stellar-wallets-kit/sdk"),
        import("@creit.tech/stellar-wallets-kit/types"),
        import("@creit.tech/stellar-wallets-kit/modules/freighter"),
        import("@creit.tech/stellar-wallets-kit/modules/xbull"),
        import("@creit.tech/stellar-wallets-kit/modules/albedo"),
        import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
      ]);
      if (cancelled) return;
      StellarWalletsKit.init({
        network: Networks.TESTNET,
        modules: [new f.FreighterModule(), new x.xBullModule(), new a.AlbedoModule(), new l.LobstrModule()],
      });
      kitRef.current = StellarWalletsKit;
      setKitReady(true);
    })().catch((e) => setResult({ kind: "err", text: `No se pudo cargar el kit de wallets: ${e}` }));
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshBalance = useCallback(async () => {
    try {
      setBalance(await readBalance());
      setBalanceErr(false);
    } catch {
      setBalanceErr(true);
    }
  }, []);

  useEffect(() => {
    refreshBalance();
    const t = setInterval(refreshBalance, 15_000);
    return () => clearInterval(t);
  }, [refreshBalance]);

  /** Devuelve true si la wallet está en testnet (o no informa su red). */
  const checkNetwork = useCallback(async (): Promise<boolean> => {
    const kit = kitRef.current;
    if (!kit) return false;
    try {
      const { networkPassphrase, network } = await kit.getNetwork();
      const wrong = networkPassphrase && networkPassphrase !== NETWORK_PASSPHRASE ? network || networkPassphrase : null;
      setWrongNetwork(wrong);
      return !wrong;
    } catch {
      // Algunas wallets (p. ej. Albedo) no informan la red; firman con la que se les pide.
      setWrongNetwork(null);
      return true;
    }
  }, []);

  const connect = async () => {
    const kit = kitRef.current;
    if (!kit) return;
    setResult(null);
    try {
      const { address } = await kit.authModal();
      setAddress(address);
      await checkNetwork();
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (!/closed|cancel/i.test(msg)) setResult({ kind: "err", text: explainError(msg) });
    }
  };

  const disconnect = async () => {
    await kitRef.current?.disconnect();
    setAddress(null);
    setWrongNetwork(null);
    setResult(null);
  };

  const claim = async () => {
    const kit = kitRef.current;
    if (!kit || !address) return;
    const clean = code.trim();
    setResult(null);
    try {
      if (!(await checkNetwork())) return;
      setBusy("Simulando…");
      const xdr = await prepareClaim(address, clean);
      setBusy("Firma en tu wallet…");
      const { signedTxXdr } = await kit.signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
        address,
      });
      setBusy("Enviando y esperando confirmación…");
      const hash = await submit(signedTxXdr);
      setResult({ kind: "ok", hash });
      refreshBalance();
    } catch (e) {
      setResult({ kind: "err", text: explainError(String((e as Error)?.message ?? e)) });
    } finally {
      setBusy(null);
    }
  };

  const empty = balance !== null && balance < PRIZE_STROOPS;

  return (
    <main>
      <header>
        <h1>Bóveda Ship-It</h1>
        <p className="sub">
          Escribe el código correcto y la bóveda te manda {formatXlm(PRIZE_STROOPS)}. Red: <b>Stellar testnet</b>.
        </p>
      </header>

      <section className="card">
        <span className="label">Saldo de la bóveda</span>
        <span className="big">{balance === null ? (balanceErr ? "—" : "…") : formatXlm(balance)}</span>
        {balanceErr && <span className="sub">No se pudo leer el saldo. Reintentando…</span>}
        {empty && <div className="msg warn">La bóveda tiene menos de 5555 XLM. Se recargará en breve.</div>}
        <span className="mono">
          Contrato{" "}
          <a href={`${EXPERT}/contract/${CONTRACT_ID}`} target="_blank" rel="noreferrer">
            {CONTRACT_ID}
          </a>
          {DEPLOYMENT_LABEL !== "oficial" && <> · ({DEPLOYMENT_LABEL})</>}
        </span>
      </section>

      <section className="card">
        <span className="label">Wallet</span>
        {address ? (
          <div className="row">
            <span className="mono">{short(address)}</span>
            <button className="ghost" onClick={disconnect} disabled={!!busy}>
              Desconectar
            </button>
          </div>
        ) : (
          <button onClick={connect} disabled={!kitReady}>
            {kitReady ? "Conectar wallet" : "Cargando wallets…"}
          </button>
        )}
        <span className="sub">Freighter, xBull, Albedo o Lobstr, configurada en testnet.</span>
        {wrongNetwork && (
          <div className="msg warn">
            Tu wallet está en <b>{wrongNetwork}</b>. Cámbiala a <b>Testnet</b> y vuelve a intentar.
          </div>
        )}
      </section>

      <section className="card">
        <label className="label" htmlFor="code">
          Código
        </label>
        <input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Escribe el código"
          autoComplete="off"
          spellCheck={false}
          onKeyDown={(e) => e.key === "Enter" && address && code.trim() && !busy && claim()}
        />
        <button onClick={claim} disabled={!address || !code.trim() || !!busy}>
          {busy ?? "Reclamar"}
        </button>
        {!address && <span className="sub">Conecta tu wallet para reclamar.</span>}

        {result?.kind === "ok" && (
          <div className="msg ok">
            ¡Listo! Recibiste {formatXlm(PRIZE_STROOPS)}.
            <br />
            <span className="mono">
              Tx{" "}
              <a href={`${EXPERT}/tx/${result.hash}`} target="_blank" rel="noreferrer">
                {result.hash}
              </a>
            </span>
          </div>
        )}
        {result?.kind === "err" && <div className="msg err">{result.text}</div>}
      </section>

      <footer>
        Solo testnet · sin valor real · hecho por Seyfert Labs para el reto Ship-It de BAF
      </footer>
    </main>
  );
}
