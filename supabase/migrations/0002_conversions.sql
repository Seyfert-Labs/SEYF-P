-- ============================================================
-- Reyf — conversiones de divisas (FX vía Bitso), por usuario.
-- El swap MXNB ↔ USDT/EUR/… ocurre en la cuenta Bitso (off-chain),
-- así que no aparece en el ledger on-chain. Lo persistimos aquí para
-- listarlo en Movimientos y derivar el saldo por-usuario en divisas.
-- Acceso: SOLO server-side con la SERVICE ROLE KEY. RLS bloqueado.
-- Ejecuta este archivo en el SQL Editor de Supabase.
-- ============================================================

create table if not exists public.conversions (
  id             text primary key,                    -- id de cliente (c_<ts>) u oid
  wallet_address text not null references public.profiles(wallet_address) on delete cascade,
  from_code      text not null,                       -- código UI origen (p.ej. MXN)
  to_code        text not null,                       -- código UI destino (p.ej. USDT)
  amount_from    numeric not null,
  amount_to      numeric not null,
  oid            text,                                -- order id de Bitso
  created_at     timestamptz not null default now()
);
create index if not exists conversions_wallet_idx on public.conversions(wallet_address, created_at desc);

alter table public.conversions enable row level security;
