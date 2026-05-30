// Tipos compartidos para la integración Juno / Bitso Business (MXNB).
// Fuente: https://docs.bitso.com / https://docs.buildwithjuno.com
// Integración v1.0.0 — ver INTEGRATION.md

/** Respuesta estándar de los route handlers internos (/api/juno/*). */
export interface ApiResponse<T = unknown> {
  success: boolean;
  payload?: T;
  error?: {
    message: string;
    code?: string | number;
    details?: unknown;
  };
  metadata?: {
    timestamp: string;
    [key: string]: unknown;
  };
}

/** Balance de un activo en la plataforma Juno (mxnbj / mxn). */
export interface MXNBBalance {
  asset: string;
  balance: number;
}

/** Cuenta bancaria (CLABE) registrada para redenciones. */
export interface BankAccount {
  id: string;
  tag: string;
  recipient_legal_name: string;
  clabe: string;
  ownership: 'COMPANY_OWNED' | 'THIRD_PARTY';
}

/** Movimiento de la plataforma (issuance / redemption / deposit). */
export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  transaction_type: 'ISSUANCE' | 'REDEMPTION' | 'DEPOSIT';
  summary_status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  created_at: string;
  updated_at: string;
}

/** CLABE de depósito (AUTO_PAYMENT) asociada a la cuenta. */
export interface CLABEDetails {
  clabe: string;
  type: 'AUTO_PAYMENT';
  status: 'ENABLED' | 'DISABLED';
  deposit_minimum_amount: number | null;
  deposit_maximum_amounts: {
    operation: number | null;
    daily: number | null;
    weekly: number | null;
    monthly: number | null;
  };
  created_at: string;
  updated_at: string | null;
}

/** Parámetros para registrar una cuenta bancaria destino. */
export interface RegisterBankParams {
  tag: string;
  recipient_legal_name: string;
  clabe: string;
  ownership: 'COMPANY_OWNED' | 'THIRD_PARTY';
}

/** Parámetros para redimir MXNB → MXN (transferencia SPEI). */
export interface RedeemParams {
  amount: number;
  destination_bank_account_id: string;
}

/** Parámetros para un retiro on-chain de MXNB. */
export interface WithdrawalParams {
  address: string;
  amount: string | number;
  asset: string;
  blockchain: string;
  compliance: Record<string, unknown>;
}

/** Parámetros para simular un depósito SPEI (solo entorno stage/test). */
export interface MockDepositParams {
  amount: number | string;
  receiver_clabe: string;
  receiver_name: string;
  sender_name: string;
}
