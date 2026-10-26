import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente de Supabase con SERVICE ROLE (solo servidor). Omite RLS, por lo que
// nunca debe exponerse al cliente. Si no hay credenciales, devolvemos null y la
// app cae a localStorage.
let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      // Si Supabase no responde, fallar rápido: el rate-limit de /api/auth/sep10 y
      // todo /api/db/* esperaban ~7 s por consulta y la sesión tardaba en abrir.
      global: {
        fetch: (input, init) => {
          const timeout = AbortSignal.timeout(2_000);
          const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
          return fetch(input, { ...init, signal });
        },
      },
    });
  }
  return cached;
}

export const dbEnabled = () =>
  Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
