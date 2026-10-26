-- =============================================================================
-- SEYF — esquema de Supabase (Postgres) para la versión full Stellar
-- =============================================================================
--
-- CÓMO DESPLEGARLO EN UN PROYECTO NUEVO
--   1. supabase.com → New project (región cercana a Vercel iad1: us-east-1).
--   2. SQL Editor → New query → pegar TODO este archivo → Run.
--      Es idempotente: se puede correr varias veces sin romper nada.
--   3. Revisar el resultado de la comprobación final (sección G).
--   4. En Vercel (Production y Preview) y en .env.local:
--        SUPABASE_URL=https://<ref>.supabase.co
--        SUPABASE_SERVICE_ROLE_KEY=<service_role>   (solo servidor, nunca NEXT_PUBLIC_)
--        NEXT_PUBLIC_USE_SUPABASE=true
--      y volver a desplegar (las variables se leen en build/arranque).
--
-- CONCILIADO CON EL CÓDIGO (src/lib/supabase/db.ts, 2026-10-26)
--   • Cada tabla y columna de aquí la lee o escribe db.ts; nada más.
--   • `wallet_address` es la cuenta Stellar (G…) de la sesión SEP-10:
--     /api/db/* exige wallet === sub de la sesión (src/lib/stellar/db-auth.ts).
--   • Se quitaron restos del riel EVM que ya nadie usa: liquidity_loans y
--     profiles.stellar_public_key. `embedded_wallet_address` y `privy_did` se
--     conservan porque getProfile() todavía los selecciona.
--
-- DATOS DEL PROYECTO ANTERIOR
--   Sin acceso al proyecto viejo no hay forma de copiar sus filas. Lo que se
--   pierde es solo metadata: nombres de bóvedas, perfil, CLABEs/bancos de
--   prueba e historial de conversiones. El dinero vive on-chain: el saldo del
--   vault USDC se vuelve a leer de Stellar y, si no hay bóveda guardada, la app
--   crea "Ahorro para el retiro" sola (useStellarVaults).
--   Si algún día recuperan acceso: Database → Backups, o
--     pg_dump --data-only --schema=public "<url-vieja>" | psql "<url-nueva>"
--
-- MONEY TIMER
--   No se guarda el saldo cada segundo: vaults.balance + vaults.updated_at son
--   el ancla y la UI calcula balance × APY × (ahora − updated_at).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- A) PERFIL Y BÓVEDAS
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  wallet_address          text primary key,          -- cuenta Stellar G…
  embedded_wallet_address text,
  email                   text,
  privy_did               text,                       -- legado; getProfile lo lee
  risk_profile            text,
  full_name               text,
  phone                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
-- Por si el proyecto ya tenía la versión vieja de la tabla.
alter table public.profiles add column if not exists risk_profile text;
alter table public.profiles add column if not exists full_name    text;
alter table public.profiles add column if not exists phone        text;
create index if not exists profiles_email_idx on public.profiles(email);

-- Bóvedas: metadata (nombre, meta) + ancla del money timer. El saldo real es on-chain.
create table if not exists public.vaults (
  id             text primary key,                    -- v_<timestamp>, lo genera el cliente
  wallet_address text not null references public.profiles(wallet_address) on delete cascade,
  name           text not null,
  goal           numeric not null default 0,
  balance        numeric not null default 0,
  apy            numeric not null default 0,
  color          text,
  plan_id        text,                                -- conservador | moderado | balanceado
  strategy_id    text,                                -- cetes | usdc | xlm
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.vaults add column if not exists plan_id     text;
alter table public.vaults add column if not exists strategy_id text;
create index if not exists vaults_wallet_idx on public.vaults(wallet_address);

comment on column public.vaults.balance    is 'Último saldo leído on-chain. Se reescribe al abonar/retirar y al sincronizar.';
comment on column public.vaults.updated_at is 'Ancla del money timer: la UI deriva el crecimiento desde aquí.';


-- ─────────────────────────────────────────────────────────────────────────────
-- B) RAMPA SPEI (CLABEs, bancos, bono, ledger) — detrás de SPEI_ENABLED
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.deposit_clabes (
  clabe          text primary key,
  wallet_address text not null references public.profiles(wallet_address) on delete cascade,
  type           text not null default 'AUTO_PAYMENT',
  created_at     timestamptz not null default now()
);
create index if not exists deposit_clabes_wallet_idx on public.deposit_clabes(wallet_address);

create table if not exists public.bank_accounts (
  id                   text primary key,
  wallet_address       text not null references public.profiles(wallet_address) on delete cascade,
  tag                  text not null,
  clabe                text not null,
  recipient_legal_name text,
  ownership            text not null default 'THIRD_PARTY',
  created_at           timestamptz not null default now()
);
create index if not exists bank_accounts_wallet_idx on public.bank_accounts(wallet_address);

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
-- C) CONVERSIONES FX + LÍMITES MENSUALES
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.conversions (
  id             text primary key,                    -- id idempotente del cliente
  wallet_address text not null references public.profiles(wallet_address) on delete cascade,
  from_code      text not null,
  to_code        text not null,
  amount_from    numeric not null,
  amount_to      numeric not null,
  oid            text,
  status         text not null default 'completed',   -- pending | completed
  kind           text,                                -- forward | inverse
  created_at     timestamptz not null default now()
);
alter table public.conversions add column if not exists status text not null default 'completed';
alter table public.conversions add column if not exists kind   text;
create index if not exists conversions_wallet_idx on public.conversions(wallet_address, created_at desc);
create index if not exists conversions_status_idx on public.conversions(status);
create unique index if not exists conversions_oid_uniq on public.conversions(oid) where oid is not null;

create table if not exists public.monthly_limits (
  wallet_address text not null references public.profiles(wallet_address) on delete cascade,
  period         text not null,                       -- YYYY-MM
  deposit        numeric not null default 0,
  withdraw       numeric not null default 0,
  updated_at     timestamptz not null default now(),
  primary key (wallet_address, period)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- D) KYC Y ONBOARDING (Etherfuse)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.kyc_state (
  customer_id              text not null,
  wallet_public_key        text not null,
  status                   text not null,
  approved_at              timestamptz,
  current_rejection_reason text,
  last_event_id            text,
  updated_at               timestamptz not null default now(),
  primary key (customer_id, wallet_public_key)
);
create index if not exists kyc_state_wallet_idx on public.kyc_state(wallet_public_key);

-- customer_id y bank_account_id son permanentes por usuario: no regenerar por sesión.
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
-- E) RATE LIMITS, LOCKS Y SESIONES DE ADELANTO (antes Redis)
-- ─────────────────────────────────────────────────────────────────────────────

-- Lo usa el rate-limit de /api/auth/sep10: si esta tabla falta, abrir sesión tarda.
create table if not exists public.rate_limit_buckets (
  bucket_key text primary key,
  hits       int not null default 0,
  expires_at timestamptz not null
);
create index if not exists rate_limit_buckets_expires_idx on public.rate_limit_buckets(expires_at);

create table if not exists public.advance_sessions (
  customer_id text primary key,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists public.onramp_locks (
  customer_id text primary key,
  expires_at  timestamptz not null
);
create index if not exists onramp_locks_expires_idx on public.onramp_locks(expires_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- F) SEGURIDAD — solo el servidor (service_role) entra
-- ─────────────────────────────────────────────────────────────────────────────
-- RLS activo y SIN políticas: anon/authenticated no leen ni escriben nada por la
-- Data API; service_role omite RLS. Además se retiran los grants por si acaso.

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','vaults','deposit_clabes','bank_accounts','bonus_claims','transactions',
    'conversions','monthly_limits','kyc_state','onboarding_sessions','kyc_agreements',
    'rate_limit_buckets','advance_sessions','onramp_locks'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- G) COMPROBACIÓN — deben salir las 14 tablas con rls = true
-- ─────────────────────────────────────────────────────────────────────────────

select c.relname as tabla, c.relrowsecurity as rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in (
    'profiles','vaults','deposit_clabes','bank_accounts','bonus_claims','transactions',
    'conversions','monthly_limits','kyc_state','onboarding_sessions','kyc_agreements',
    'rate_limit_buckets','advance_sessions','onramp_locks'
  )
order by c.relname;
