-- =============================================================================
-- REYF — Script único para Supabase (Postgres)
-- =============================================================================
--
-- PARA TU COLABORADOR:
--   1. Abrir https://supabase.com → proyecto Reyf → SQL Editor → New query
--   2. Pegar TODO este archivo y pulsar Run (o Ctrl/Cmd + Enter)
--   3. Debe terminar sin errores. Es idempotente: se puede ejecutar varias veces.
--   4. Verificar al final la consulta de comprobación (lista de tablas).
--
-- REQUISITOS EN LA APP (.env):
--   NEXT_PUBLIC_USE_SUPABASE=true
--   SUPABASE_URL=...
--   SUPABASE_SERVICE_ROLE_KEY=...   (solo servidor, nunca en el cliente)
--
-- NO SE USA REDIS / UPSTASH. Toda la persistencia vive aquí.
--
-- MONEY TIMER (saldo que “crece” en la UI):
--   • NO guardamos el número cada segundo en la base de datos.
--   • Guardamos vaults.balance (saldo real) y vaults.updated_at (ancla temporal).
--   • La app calcula en pantalla:
--       valor = balance + balance × (APY/100) × (ahora − updated_at)
--   • Tras cada abono o retiro on-chain la app actualiza balance y updated_at.
--   • Columnas clave: vaults.balance, vaults.apy, vaults.updated_at,
--     vaults.plan_id, vaults.strategy_id (estrategia DeFindex: CETES/USDC/XLM).
--
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- A) ESQUEMA BASE (perfiles, bóvedas, CLABE, bancos, bono, transacciones)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  wallet_address          text primary key,
  embedded_wallet_address text,
  email                   text,
  privy_did               text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles(email);

create table if not exists public.deposit_clabes (
  clabe          text primary key,
  wallet_address text not null references public.profiles(wallet_address) on delete cascade,
  type           text not null default 'AUTO_PAYMENT',
  created_at     timestamptz not null default now()
);
create index if not exists deposit_clabes_wallet_idx on public.deposit_clabes(wallet_address);

create table if not exists public.bank_accounts (
  id                    text primary key,
  wallet_address        text not null references public.profiles(wallet_address) on delete cascade,
  tag                   text not null,
  clabe                 text not null,
  recipient_legal_name  text,
  ownership             text not null default 'THIRD_PARTY',
  created_at            timestamptz not null default now()
);
create index if not exists bank_accounts_wallet_idx on public.bank_accounts(wallet_address);

-- Bóvedas de ahorro. `updated_at` = ancla del money timer (ver cabecera).
create table if not exists public.vaults (
  id             text primary key,
  wallet_address text not null references public.profiles(wallet_address) on delete cascade,
  name           text not null,
  goal           numeric not null default 0,
  balance        numeric not null default 0,
  apy            numeric not null default 0,
  color          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists vaults_wallet_idx on public.vaults(wallet_address);

create table if not exists public.bonus_claims (
  wallet_address text primary key references public.profiles(wallet_address) on delete cascade,
  amount         numeric not null,
  tx_id          text,
  claimed_at     timestamptz not null default now()
);

create table if not exists public.transactions (
  id             uuid primary key default gen_random_uuid(),
  wallet_address text not null references public.profiles(wallet_address) on delete cascade,
  kind           text not null,
  amount         numeric not null,
  status         text not null default 'pending',
  tx_hash        text,
  created_at     timestamptz not null default now()
);
create index if not exists transactions_wallet_idx on public.transactions(wallet_address, created_at desc);


-- ─────────────────────────────────────────────────────────────────────────────
-- B) CONVERSIONES FX (Bitso) + LÍMITES MENSUALES
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.conversions (
  id             text primary key,
  wallet_address text not null references public.profiles(wallet_address) on delete cascade,
  from_code      text not null,
  to_code        text not null,
  amount_from    numeric not null,
  amount_to      numeric not null,
  oid            text,
  created_at     timestamptz not null default now()
);
create index if not exists conversions_wallet_idx on public.conversions(wallet_address, created_at desc);

alter table public.conversions add column if not exists status text not null default 'completed';
alter table public.conversions add column if not exists kind   text;

create unique index if not exists conversions_oid_uniq
  on public.conversions(oid) where oid is not null;
create index if not exists conversions_status_idx on public.conversions(status);

create table if not exists public.monthly_limits (
  wallet_address text not null references public.profiles(wallet_address) on delete cascade,
  period         text not null,
  deposit        numeric not null default 0,
  withdraw       numeric not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (wallet_address, period)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- C) PERFIL EXTENDIDO + PRÉSTAMOS DE LIQUIDEZ
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles add column if not exists risk_profile text;
alter table public.profiles add column if not exists full_name   text;
alter table public.profiles add column if not exists phone       text;
alter table public.profiles add column if not exists stellar_public_key text;

create table if not exists public.liquidity_loans (
  id               uuid primary key default gen_random_uuid(),
  wallet_address   text not null references public.profiles(wallet_address) on delete cascade,
  amount_mxn       numeric not null,
  collateral_mxnb  numeric not null,
  apr              numeric not null default 15,
  status           text not null default 'active',
  created_at       timestamptz not null default now(),
  repaid_at        timestamptz
);
create index if not exists liquidity_loans_wallet_idx on public.liquidity_loans(wallet_address, created_at desc);


-- ─────────────────────────────────────────────────────────────────────────────
-- D) BÓVEDAS DeFindex + KYC / ONBOARDING (antes en Redis — ahora aquí)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.vaults add column if not exists plan_id     text;
alter table public.vaults add column if not exists strategy_id text;

comment on column public.vaults.balance is
  'Saldo persistido de la bóveda. Se actualiza en abonos/retiros y sync on-chain.';
comment on column public.vaults.updated_at is
  'Ancla del money timer: la UI deriva el crecimiento desde este timestamp.';
comment on column public.vaults.plan_id is
  'Plan DeFindex: conservador | moderado | balanceado';
comment on column public.vaults.strategy_id is
  'Estrategia DeFindex: cetes | usdc | xlm';

create table if not exists public.kyc_state (
  customer_id               text not null,
  wallet_public_key         text not null,
  status                    text not null,
  approved_at               timestamptz,
  current_rejection_reason  text,
  last_event_id             text,
  updated_at                timestamptz not null default now(),
  primary key (customer_id, wallet_public_key)
);
create index if not exists kyc_state_wallet_idx on public.kyc_state (wallet_public_key);

create table if not exists public.onboarding_sessions (
  wallet_public_key text primary key,
  customer_id       text not null,
  bank_account_id   text not null,
  updated_at        timestamptz not null default now()
);

create table if not exists public.kyc_agreements (
  customer_id       text not null,
  wallet_public_key text not null,
  accepted          boolean not null default false,
  accepted_at       timestamptz,
  updated_at        timestamptz not null default now(),
  primary key (customer_id, wallet_public_key)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- E) RATE LIMITS, LOCKS ONRAMP, ADELANTOS (antes en Redis — ahora aquí)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.rate_limit_buckets (
  bucket_key  text primary key,
  hits        int not null default 0,
  expires_at  timestamptz not null
);
create index if not exists rate_limit_buckets_expires_idx on public.rate_limit_buckets (expires_at);

create table if not exists public.advance_sessions (
  customer_id text primary key,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.onramp_locks (
  customer_id text primary key,
  expires_at  timestamptz not null
);
create index if not exists onramp_locks_expires_idx on public.onramp_locks (expires_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- F) ROW LEVEL SECURITY — solo el servidor (service role) accede
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles           enable row level security;
alter table public.deposit_clabes     enable row level security;
alter table public.bank_accounts      enable row level security;
alter table public.vaults             enable row level security;
alter table public.bonus_claims       enable row level security;
alter table public.transactions       enable row level security;
alter table public.conversions        enable row level security;
alter table public.monthly_limits     enable row level security;
alter table public.liquidity_loans    enable row level security;
alter table public.kyc_state          enable row level security;
alter table public.onboarding_sessions enable row level security;
alter table public.kyc_agreements     enable row level security;
alter table public.rate_limit_buckets enable row level security;
alter table public.advance_sessions   enable row level security;
alter table public.onramp_locks       enable row level security;


-- ─────────────────────────────────────────────────────────────────────────────
-- G) COMPROBACIÓN — debe listar todas las tablas anteriores
-- ─────────────────────────────────────────────────────────────────────────────

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
  and table_name in (
    'profiles', 'deposit_clabes', 'bank_accounts', 'vaults', 'bonus_claims',
    'transactions', 'conversions', 'monthly_limits', 'liquidity_loans',
    'kyc_state', 'onboarding_sessions', 'kyc_agreements',
    'rate_limit_buckets', 'advance_sessions', 'onramp_locks'
  )
order by table_name;

-- Columnas del money timer en vaults (debe mostrar balance, apy, updated_at, plan_id, strategy_id):
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'vaults'
order by ordinal_position;
