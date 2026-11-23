import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEnabled = Boolean(url && key);

let client: SupabaseClient | null = null;

/** Import dinámico: si no hay credenciales, el SDK ni siquiera se descarga. */
export async function getSupabase(): Promise<SupabaseClient | null> {
  if (!supabaseEnabled) return null;
  if (client) return client;
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}
