import { createBrowserClient } from "@supabase/ssr";
import { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function createClient() {
  if (client) return client;

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return client;
}

// FORCE usage of 127.0.0.1 to avoid Windows localhost issues
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000').replace('localhost', '127.0.0.1');

