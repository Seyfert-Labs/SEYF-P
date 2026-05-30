// Servicio de cliente para interactuar con las APIs de Juno / Bitso Business
// a través de los route handlers internos (/api/juno/*).
// Integración v1.0.0 — ver INTEGRATION.md

import { backendConfig, buildApiUrl } from '@/config/backend';
import type {
  ApiResponse,
  MXNBBalance,
  BankAccount,
  Transaction,
  CLABEDetails,
  RegisterBankParams,
  RedeemParams,
  WithdrawalParams,
  MockDepositParams,
} from '@/types/juno';

export class JunoService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = buildApiUrl(endpoint);
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...backendConfig.defaultHeaders, ...options.headers },
      });
      const data = (await response.json()) as ApiResponse<T>;
      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }
      return data;
    } catch (error) {
      console.error(`Error en petición a ${endpoint}:`, error);
      throw error;
    }
  }

  // ---------------- Issuance / CLABE ----------------

  /** CLABEs de depósito asociadas a la cuenta. */
  async getAccountDetails(): Promise<CLABEDetails[]> {
    const res = await this.makeRequest<{ response?: CLABEDetails[] } | CLABEDetails[]>(
      backendConfig.endpoints.accountDetails,
    );
    const payload = res.payload as { response?: CLABEDetails[] } | undefined;
    return payload?.response ?? (Array.isArray(res.payload) ? res.payload : []);
  }

  /** Crea una CLABE única (AUTO_PAYMENT) para el usuario. */
  async createUserClabe(): Promise<{ clabe: string; type: string }> {
    const res = await this.makeRequest<{ clabe: string; type: string }>(
      backendConfig.endpoints.createClabe,
      { method: 'POST' },
    );
    return res.payload!;
  }

  /** Simula un depósito SPEI (stage/test) que dispara la emisión de MXNB. */
  async createMockDeposit(params: MockDepositParams): Promise<unknown> {
    const res = await this.makeRequest(backendConfig.endpoints.mockDeposit, {
      method: 'POST',
      body: JSON.stringify({ ...params, amount: String(params.amount) }),
    });
    return res.payload;
  }

  // ---------------- Balance / transacciones ----------------

  /** Lista de balances de la plataforma. */
  async getBalance(): Promise<MXNBBalance[]> {
    const res = await this.makeRequest<{ balances?: MXNBBalance[] } | MXNBBalance[]>(
      backendConfig.endpoints.balance,
    );
    const payload = res.payload as { balances?: MXNBBalance[] } | undefined;
    return payload?.balances ?? (Array.isArray(res.payload) ? res.payload : []);
  }

  /** Balance puntual de MXNB. */
  async getMXNBBalance(): Promise<number> {
    const balances = await this.getBalance();
    const mxnb = balances.find((b) => b.asset === 'mxnbj' || b.asset === 'mxnb');
    return mxnb?.balance ?? 0;
  }

  /** Historial de transacciones (issuance / redemption / deposit). */
  async getTransactions(params?: {
    limit?: number;
    offset?: number;
    status?: string;
    type?: string;
  }): Promise<Transaction[]> {
    const qs = new URLSearchParams();
    if (params?.limit) qs.append('limit', String(params.limit));
    if (params?.offset) qs.append('offset', String(params.offset));
    if (params?.status) qs.append('status', params.status);
    if (params?.type) qs.append('type', params.type);
    const endpoint = qs.toString()
      ? `${backendConfig.endpoints.transactions}?${qs.toString()}`
      : backendConfig.endpoints.transactions;
    const res = await this.makeRequest<Transaction[]>(endpoint);
    return res.payload ?? [];
  }

  // ---------------- Redención ----------------

  /** Cuentas bancarias registradas para redención. */
  async getBankAccounts(): Promise<BankAccount[]> {
    const res = await this.makeRequest<BankAccount[]>(backendConfig.endpoints.bankAccounts);
    return res.payload ?? [];
  }

  /** Registra una nueva cuenta bancaria destino. */
  async registerBankAccount(params: RegisterBankParams): Promise<BankAccount> {
    const res = await this.makeRequest<BankAccount>(backendConfig.endpoints.registerBank, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.payload!;
  }

  /** Redime MXNB → MXN (SPEI). */
  async redeemMXNB(params: RedeemParams): Promise<Transaction> {
    const res = await this.makeRequest<Transaction>(backendConfig.endpoints.redeem, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.payload!;
  }

  /** Retiro on-chain de MXNB a una wallet. */
  async sendOnchainWithdrawal(params: WithdrawalParams): Promise<unknown> {
    const res = await this.makeRequest(backendConfig.endpoints.withdrawal, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return res.payload;
  }

  // ---------------- Utilidades ----------------

  async healthCheck(): Promise<boolean> {
    try {
      const res = await this.makeRequest(backendConfig.endpoints.health);
      return res.success;
    } catch {
      return false;
    }
  }

  /** Resumen completo de la cuenta (balance + txns + bancos + clabes). */
  async getAccountSummary() {
    const [balance, recentTransactions, bankAccounts, clabes] = await Promise.all([
      this.getMXNBBalance(),
      this.getTransactions({ limit: 10 }),
      this.getBankAccounts(),
      this.getAccountDetails(),
    ]);
    return { balance, recentTransactions, bankAccounts, clabes };
  }

  // ---------------- Helpers estáticos ----------------

  /** Valida una CLABE mexicana (18 dígitos + dígito verificador). */
  static validateCLABE(clabe: string): boolean {
    if (!/^\d{18}$/.test(clabe)) return false;
    const weights = [3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7, 1, 3, 7];
    let sum = 0;
    for (let i = 0; i < 17; i++) sum += (parseInt(clabe[i], 10) * weights[i]) % 10;
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(clabe[17], 10);
  }

  static formatMXNB(amount: number): string {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  static formatCLABE(clabe: string): string {
    if (clabe.length !== 18) return clabe;
    return clabe.replace(/(\d{4})(\d{4})(\d{4})(\d{6})/, '$1 $2 $3 $4');
  }
}

export const junoService = new JunoService();
