-- Reemplaza Upstash Redis: rate limits, locks onramp y sesiones de adelanto.
-- Idempotente — ejecutar en SQL Editor de Supabase después de 20260625.

-- Rate limiting (ventana deslizante por bucket_key)
create table if not exists public.rate_limit_buckets (
  bucket_key  text primary key,
  hits        int not null default 0,
  expires_at  timestamptz not null
);
create index if not exists rate_limit_buckets_expires_idx on public.rate_limit_buckets (expires_at);

-- Sesión de adelanto de liquidez por customer Etherfuse
create table if not exists public.advance_sessions (
  customer_id text primary key,
  payload     jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Lock distribuido para evitar órdenes onramp concurrentes
create table if not exists public.onramp_locks (
  customer_id text primary key,
  expires_at  timestamptz not null
);
create index if not exists onramp_locks_expires_idx on public.onramp_locks (expires_at);

alter table public.rate_limit_buckets enable row level security;
alter table public.advance_sessions    enable row level security;
alter table public.onramp_locks        enable row level security;
