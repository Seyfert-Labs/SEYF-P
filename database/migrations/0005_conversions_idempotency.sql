-- ============================================================
-- SEYF — endurecimiento del ledger de conversiones (FX vía Bitso).
-- Hace la conversión orquestada en /api/convert ATÓMICA e IDEMPOTENTE:
--   • status: 'pending' al iniciar, 'completed' al confirmar la orden Bitso.
--     Un reintento con la misma `id` (idempotency key del cliente) NO coloca
--     una segunda orden: ve la fila pending/completed y corta.
--   • kind: sentido del swap ('forward' = MXN→divisa, 'inverse' = divisa→MXN).
--   • índice único en `oid`: una misma orden de Bitso no puede registrarse dos
--     veces (idempotencia por oid, defensa en profundidad).
-- Acceso: SOLO server-side (service role). RLS sigue bloqueado.
-- Ejecuta este archivo en el SQL Editor de Supabase.
-- ============================================================

alter table public.conversions add column if not exists status text not null default 'completed';
alter table public.conversions add column if not exists kind   text;

-- Una orden de Bitso (oid) se registra una sola vez.
create unique index if not exists conversions_oid_uniq
  on public.conversions(oid) where oid is not null;

-- Consultas de reconciliación: agregados por activo sobre filas liquidadas.
create index if not exists conversions_status_idx
  on public.conversions(status);
