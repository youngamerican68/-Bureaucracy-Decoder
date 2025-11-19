import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

// Client-side Supabase client (uses anon key)
export function createBrowserClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}

// Server-side Supabase client (uses service role key for admin operations)
export function createServerClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables for server client');
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Singleton for server-side usage
let serverClient: SupabaseClient<Database> | null = null;

export function getServerClient(): SupabaseClient<Database> {
  if (!serverClient) {
    serverClient = createServerClient();
  }
  return serverClient;
}
