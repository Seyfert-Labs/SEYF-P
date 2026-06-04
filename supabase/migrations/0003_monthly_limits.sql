-- ============================================================
-- Reyf — límites mensuales de depósito y retiro por usuario.
-- Acumula el monto usado por periodo (YYYY-MM) para topar a 20,000 MXN
-- mensuales cada uno. Acceso: SOLO server-side (service role). RLS bloqueado.
-- Ejecuta este archivo en el SQL Editor de Supabase.
-- ============================================================

create table if not exists public.monthly_limits (
  wallet_address text not null references public.profiles(wallet_address) on delete cascade,
  period         text not null,              -- 'YYYY-MM'
  deposit        numeric not null default 0, -- MXN depositados (Agregar) en el periodo
  withdraw       numeric not null default 0, -- MXN retirados (a banco) en el periodo
  updated_at     timestamptz not null default now(),
  primary key (wallet_address, period)
);

alter table public.monthly_limits enable row level security;
