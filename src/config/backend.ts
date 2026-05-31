// Configuración del cliente para los route handlers internos de Juno (/api/juno/*).
// En Next.js las rutas son relativas al mismo origen, así que por defecto no se
// necesita ninguna URL externa. NEXT_PUBLIC_BACKEND_URL permite apuntar a otro host.

function getBackendUrl(): string {
  return (process.env.NEXT_PUBLIC_BACKEND_URL ?? '').trim().replace(/\/$/, '');
}

export const backendConfig = {
  baseUrl: getBackendUrl(),
  endpoints: {
    // Issuance (minteo)
    accountDetails: '/api/juno/account-details',
    createClabe: '/api/juno/create-clabe',
    mockDeposit: '/api/juno/mock-deposit',
    // Balance y transacciones
    balance: '/api/juno/balance',
    transactions: '/api/juno/transactions',
    // Redención
    bankAccounts: '/api/juno/bank-accounts',
    registerBank: '/api/juno/register-bank',
    redeem: '/api/juno/redeem',
    // On-chain
    withdrawal: '/api/juno/withdrawal',
    fundWallet: '/api/juno/fund-wallet',
    welcomeBonus: '/api/juno/welcome-bonus',
    // Utilidades
    health: '/api/juno/health',
    webhook: '/api/juno/webhook',
  },
  timeout: 30000,
  defaultHeaders: { 'Content-Type': 'application/json' },
} as const;

/** Construye la URL completa para un endpoint (relativa al mismo origen si no hay baseUrl). */
export function buildApiUrl(endpoint: string): string {
  return `${backendConfig.baseUrl}${endpoint}`;
}

export type { ApiResponse, MXNBBalance, BankAccount, Transaction, CLABEDetails } from '@/types/juno';
