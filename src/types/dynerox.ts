// ============================================================
// Tipos compartidos de la API de Dynerox (OpenAPI 3.0).
// On-ramp / off-ramp fiat <-> cripto.
// Stage: https://api-stage.dynerox.com  ·  Prod: https://api.dynerox.com
// Derivados de api-1.json (Dynerox API v1.0.0).
// NOTA: los DTOs InstructionLegFromDto / InstructionLegToDto NO venían
// definidos en el spec; las formas de abajo se infieren de los `example`
// de la respuesta y deben confirmarse contra stage (ver /api/dynerox/probe).
// ============================================================

export type DyneroxInstructionStatus =
  | 'pending_identity'
  | 'pending_authorization'
  | 'active'
  | 'inactive';

export type DyneroxWebhookEvent =
  | 'user.created'
  | 'order.created'
  | 'order.failed'
  | 'identity.approved'
  | 'identity.rejected';

// --- Users ---
export interface DyneroxCreateUser {
  first_name: string;
  middle_name?: string;
  last_name: string;
  second_last_name?: string;
  email: string;
  curp: string;
  phone?: string;
}

export interface DyneroxUser {
  user_id?: string;
  id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  curp?: string;
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
  clabe: string;
  currency: string; // p.ej. "MXN"
  network: string; // p.ej. "SPEI"
}

// --- Routes / Instructions ---
// Lado origen. Para on-ramp SPEI->cripto esperamos algo tipo
// { currency: { symbol: "mxn" }, network: { name: "spei" } } y que la
// respuesta devuelva una CLABE de depósito. A CONFIRMAR en stage.
export interface DyneroxLegFrom {
  currency: DyneroxCurrency;
  network: DyneroxNetwork;
  account?: string;
  // Posible CLABE de depósito que devuelve Dynerox para el on-ramp:
  clabe?: string;
  [k: string]: unknown;
}

export interface DyneroxLegTo {
  currency: DyneroxCurrency;
  network: DyneroxNetwork;
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
  secret: string;
  events: DyneroxWebhookEvent[];
  createdAt: string;
  updatedAt: string;
}
