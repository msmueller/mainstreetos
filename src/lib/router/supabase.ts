/**
 * Lead Router — Supabase service-role client
 *
 * Distinct from `@/lib/supabase/server` which uses the anon key + cookies
 * (auth-aware, RLS-respecting). The Router writes audit rows, reads from
 * the leads/listings cache, and enrolls into sequences — all of which must
 * bypass RLS. Service role is required.
 *
 * SERVER-ONLY. Importing this from a Client Component will leak the service
 * role key into the bundle. Use only in route handlers, server actions,
 * cron handlers, and lib/router/* code.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getRouterSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error('Lead Router: NEXT_PUBLIC_SUPABASE_URL is not set');
  }
  if (!serviceKey) {
    throw new Error('Lead Router: SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  cached = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-router-component': 'lead-router' },
    },
  });

  return cached;
}
