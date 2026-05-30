'use client';

// Hooks de React para conectar la UI con el servicio Juno.
// Integración v1.0.0 — ver INTEGRATION.md

import { useCallback, useEffect, useState } from 'react';
import { junoService } from '@/services/junoService';
import type {
  BankAccount,
  Transaction,
  CLABEDetails,
  RegisterBankParams,
  MockDepositParams,
} from '@/types/juno';

interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Error de conexión con Juno';
}

/** Balance de MXNB, con recarga manual. */
export function useMXNBBalance() {
  const [state, setState] = useState<AsyncState<number>>({
    data: 0,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const balance = await junoService.getMXNBBalance();
      setState({ data: balance, loading: false, error: null });
    } catch (e) {
      setState({ data: 0, loading: false, error: errMessage(e) });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { balance: state.data, ...state, refresh };
}

/** Historial de transacciones de la plataforma. */
export function useTransactions(limit = 25) {
  const [state, setState] = useState<AsyncState<Transaction[]>>({
    data: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const txns = await junoService.getTransactions({ limit });
      setState({ data: txns, loading: false, error: null });
    } catch (e) {
      setState({ data: [], loading: false, error: errMessage(e) });
    }
  }, [limit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { transactions: state.data, ...state, refresh };
}

/** Cuentas bancarias registradas para redención. */
export function useBankAccounts() {
  const [state, setState] = useState<AsyncState<BankAccount[]>>({
    data: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const accounts = await junoService.getBankAccounts();
      setState({ data: accounts, loading: false, error: null });
    } catch (e) {
      setState({ data: [], loading: false, error: errMessage(e) });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { bankAccounts: state.data, ...state, refresh };
}

/** CLABEs de depósito de la cuenta. */
export function useAccountClabes() {
  const [state, setState] = useState<AsyncState<CLABEDetails[]>>({
    data: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const clabes = await junoService.getAccountDetails();
      setState({ data: clabes, loading: false, error: null });
    } catch (e) {
      setState({ data: [], loading: false, error: errMessage(e) });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { clabes: state.data, ...state, refresh };
}

/** Estado de una acción puntual (submit de un botón). */
export function useJunoAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TResult | null>(null);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const r = await fn(...args);
        setResult(r);
        return r;
      } catch (e) {
        setError(errMessage(e));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [fn],
  );

  return { run, loading, error, result, reset: () => { setError(null); setResult(null); } };
}

// Acciones listas para usar en botones:
export const junoActions = {
  createClabe: () => junoService.createUserClabe(),
  mockDeposit: (params: MockDepositParams) => junoService.createMockDeposit(params),
  registerBank: (params: RegisterBankParams) => junoService.registerBankAccount(params),
  redeem: (amount: number, destination_bank_account_id: string) =>
    junoService.redeemMXNB({ amount, destination_bank_account_id }),
};
