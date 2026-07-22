// ============================================================
// Tipos compartidos de la API de Dynerox (OpenAPI 3.0).
// On-ramp / off-ramp fiat <-> cripto.
// Stage: https://api-stage.dynerox.com  ·  Prod: https://api.dynerox.com
// Derivados de api-1.json (Dynerox API v1.0.0).
// Los DTOs InstructionLegFromDto / InstructionLegToDto NO venían definidos en
// el spec; las formas de abajo se CONFIRMARON contra stage (2026-07-21):
// `currency` y `network` son strings planos, no objetos anidados.
// ============================================================

export type DyneroxInstructionStatus =
  | 'pending_identity'
  | 'pending_authorization'
  | 'active'
  | 'inactive';

// Enum REAL confirmado contra stage (2026-07-21): el 400 de POST /webhooks
// los lista. Los eventos que estaban inferidos antes (order.created,
// order.failed, identity.approved/rejected) NO existen.
export type DyneroxWebhookEvent =
  | 'user.created'
  | 'route.created'
  | 'kyc.completed'
  | 'transfer.completed'
  | 'order.completed';

/** Estado de verificación de una CLABE beneficiaria. */
export type DyneroxBankVerificationStatus =
  | 'pending'
  | 'in_progress'
  | 'verified'
  | 'verification_failed'
  | 'manual_review';

// --- Users ---
export interface DyneroxCreateUser {
  first_name: string;
  middle_name?: string;
  last_name: string;
  second_last_name?: string;
  email: string;
  curp: string;
  /** Formato internacional E.164 obligatorio, p.ej. "+525555555555". */
  phone?: string;
}

export interface DyneroxUser {
  user_id?: string;
  id?: string;
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  second_last_name?: string | null;
  email?: string;
  curp?: string;
  gender?: string | null;
  /** El alta NO devuelve authorization_url: nace en false y se verifica aparte. */
  is_verified?: boolean;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: unknown;
}

// --- Networks & currencies ---
export interface DyneroxNetwork {
  name: string;
  display_name?: string;
  [k: string]: unknown;
}

export interface DyneroxCurrency {
  symbol: string;
  name?: string;
  [k: string]: unknown;
}

export interface DyneroxCurrenciesResponse {
  network: string;
  network_display_name?: string;
  currencies: DyneroxCurrency[];
}

// --- Beneficiary (CLABE) accounts ---
export interface DyneroxCreateBankAccount {
  user_id?: string;
  /** 18 dígitos, con dígito verificador válido: la API rechaza CLABEs mal formadas. */
  clabe: string;
  currency: string; // p.ej. "MXN"
  network: string; // p.ej. "SPEI"
}

/** Respuesta de POST /beneficiary-accounts — resuelve titular e institución. */
export interface DyneroxBankAccount {
  success?: boolean;
  bank_account_id: string;
  clabe: string;
  beneficiary_name?: string;
  institution_name?: string;
  institution_code?: string;
  verification_status?: DyneroxBankVerificationStatus;
  created_at?: string;
  [k: string]: unknown;
}

/** Respuesta de GET /banks/clabe/{clabe} — lookup de banco sin crear nada. */
export interface DyneroxBankLookup {
  success?: boolean;
  account_prefix?: string;
  bank_name?: string;
  bank_code?: string;
}

// --- Routes / Instructions ---
// Lado origen. Para on-ramp SPEI->cripto:
//   { currency: "mxn", network: "spei" }
// Se espera que la respuesta devuelva una CLABE de depósito — aún SIN confirmar,
// porque stage rechaza la creación de rutas (ver README).
export interface DyneroxLegFrom {
  /** Símbolo plano, p.ej. "mxn" / "USDC". */
  currency: string;
  /** Nombre plano de la red, p.ej. "spei" / "solana" / "ethereum". */
  network: string;
  account?: string;
  // Posible CLABE de depósito que devuelve Dynerox para el on-ramp:
  clabe?: string;
  [k: string]: unknown;
}

export interface DyneroxLegTo {
  currency: string;
  network: string;
  account?: string; // dirección on-chain del destinatario
  bank_account_id?: string;
  clabe?: string;
  beneficiary_name?: string;
  institution_name?: string;
  institution_code?: string;
  [k: string]: unknown;
}

export interface DyneroxCreateInstruction {
  user_id?: string;
  from: DyneroxLegFrom;
  to: DyneroxLegTo;
}

export interface DyneroxInstruction {
  route_id: string;
  status: DyneroxInstructionStatus;
  authorization_url: string;
  from: DyneroxLegFrom;
  to: DyneroxLegTo;
  created_at: string;
  updated_at: string;
}

// --- Webhooks ---
export interface DyneroxCreateWebhook {
  url: string;
  events: DyneroxWebhookEvent[];
}

export interface DyneroxWebhook {
  webhook_id: string;
  /** Prefijo `whs_`. Solo se devuelve al crearlo — guardar en DYNEROX_WEBHOOK_SECRET. */
  secret: string;
  events: DyneroxWebhookEvent[];
  created_at?: string;
  updated_at?: string;
}
