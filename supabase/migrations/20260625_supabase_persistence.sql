-- Persistencia completa en Supabase (reemplaza Upstash Redis para KYC).
-- Idempotente: se puede correr varias veces sin error.

-- 1) Bóvedas: persistir la estrategia DeFindex elegida (CETES/USDC/XLM) y su plan.
--    Antes se descartaban y se re-infería del nombre → una bóveda USDC/XLM podía
--    re-mapearse a CETES. `balance` y `updated_at` ya existen: `updated_at` ancla
--    el "money timer" (el saldo se deriva: saldo + saldo·APY·(now - updated_at)).
alter table public.vaults add column if not exists plan_id text;
alter table public.vaults add column if not exists strategy_id text;

-- 2) KYC: estado de verificación por (customer Etherfuse, wallet Stellar).
--    Reemplaza el almacenamiento en Redis. `last_event_id` + `updated_at`
--    permiten dedup y orden de eventos del webhook.
create table if not exists public.kyc_state (
  customer_id text not null,
  wallet_public_key text not null,
  status text not null,
  approved_at timestamptz,
  current_rejection_reason text,
  last_event_id text,
  updated_at timestamptz not null default now(),
  primary key (customer_id, wallet_public_key)
);
create index if not exists kyc_state_wallet_idx on public.kyc_state (wallet_public_key);

-- 3) Sesión de onboarding Etherfuse (wallet Stellar → customer_id Etherfuse).
--    La lee /api/reyf/kyc/status para resolver el KYC. Reemplaza Redis.
create table if not exists public.onboarding_sessions (
  wallet_public_key text primary key,
  customer_id text not null,
  bank_account_id text not null,
  updated_at timestamptz not null default now()
);

-- 4) Aceptación de acuerdos del KYC. Reemplaza Redis.
create table if not exists public.kyc_agreements (
  customer_id text not null,
  wallet_public_key text not null,
  accepted boolean not null default false,
  accepted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (customer_id, wallet_public_key)
);

-- 5) Enlace de la wallet Stellar (Pollar) al perfil del usuario.
alter table public.profiles add column if not exists stellar_public_key text;
