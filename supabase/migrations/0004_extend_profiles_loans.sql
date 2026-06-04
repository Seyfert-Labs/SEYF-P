-- Campos de perfil completo (US-02, US-09)
alter table public.profiles add column if not exists risk_profile text;
alter table public.profiles add column if not exists full_name   text;
alter table public.profiles add column if not exists phone       text;

-- Préstamos de liquidez (US-08)
create table if not exists public.liquidity_loans (
  id               uuid primary key default gen_random_uuid(),
  wallet_address   text not null references public.profiles(wallet_address) on delete cascade,
  amount_mxn       numeric not null,
  collateral_mxnb  numeric not null,
  apr              numeric not null default 15,
  status           text not null default 'active',  -- active | repaid | liquidated
  created_at       timestamptz not null default now(),
  repaid_at        timestamptz
);
create index if not exists liquidity_loans_wallet_idx on public.liquidity_loans(wallet_address, created_at desc);
alter table public.liquidity_loans enable row level security;
