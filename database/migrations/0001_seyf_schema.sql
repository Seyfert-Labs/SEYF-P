-- ============================================================
-- SEYF — esquema de base de datos (Supabase / Postgres)
-- Persiste lo que antes vivía en localStorage, por usuario
-- (identificado por la dirección de su smart wallet).
--
-- Acceso: SOLO server-side con la SERVICE ROLE KEY (los route
-- handlers de Next.js). RLS está habilitado y bloqueado: el
-- cliente nunca toca Supabase directamente.
-- Ejecuta este archivo en el SQL Editor de Supabase.
-- ============================================================

-- Perfil de usuario (una fila por smart wallet)
create table if not exists public.profiles (
  wallet_address          text primary key,   -- smart wallet (ERC-4337) del usuario
  embedded_wallet_address text,                -- wallet embebida de Privy (EOA, signer)
  email                   text,                -- correo con el que inició sesión
  privy_did               text,                -- id de usuario de Privy
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles(email);

-- CLABEs de depósito (AUTO_PAYMENT) por usuario
create table if not exists public.deposit_clabes (
  clabe          text primary key,
  wallet_address text not null references public.profiles(wallet_address) on delete cascade,
  type           text not null default 'AUTO_PAYMENT',
  created_at     timestamptz not null default now()
);
create index if not exists deposit_clabes_wallet_idx on public.deposit_clabes(wallet_address);

-- Cuentas bancarias destino para retiros (redeem) por usuario
create table if not exists public.bank_accounts (
  id                    text primary key,            -- id de Juno
  wallet_address        text not null references public.profiles(wallet_address) on delete cascade,
  tag                   text not null,
  clabe                 text not null,
  recipient_legal_name  text,
  ownership             text not null default 'THIRD_PARTY',
  created_at            timestamptz not null default now()
);
create index if not exists bank_accounts_wallet_idx on public.bank_accounts(wallet_address);

-- Bóvedas de ahorro por usuario
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

-- Reclamo del bono de bienvenida (una vez por usuario)
create table if not exists public.bonus_claims (
  wallet_address text primary key references public.profiles(wallet_address) on delete cascade,
  amount         numeric not null,
  tx_id          text,
  claimed_at     timestamptz not null default now()
);

-- Bitácora de transacciones (opcional · ledger persistente)
create table if not exists public.transactions (
  id             uuid primary key default gen_random_uuid(),
  wallet_address text not null references public.profiles(wallet_address) on delete cascade,
  kind           text not null,                       -- deposit | send | redeem | bonus
  amount         numeric not null,
  status         text not null default 'pending',     -- pending | completed | failed
  tx_hash        text,
  created_at     timestamptz not null default now()
);
create index if not exists transactions_wallet_idx on public.transactions(wallet_address, created_at desc);

-- ------------------------------------------------------------
-- RLS: habilitado y bloqueado. Solo la service role (servidor)
-- accede, ya que esa key omite RLS. Sin políticas públicas =
-- el cliente con anon key no puede leer/escribir nada.
-- ------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.deposit_clabes  enable row level security;
alter table public.bank_accounts   enable row level security;
alter table public.vaults          enable row level security;
alter table public.bonus_claims    enable row level security;
alter table public.transactions    enable row level security;
