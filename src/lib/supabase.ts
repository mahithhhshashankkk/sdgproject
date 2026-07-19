import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Env vars are inlined by Vite at build time. If missing (e.g. .env not present
// during a deploy build), fall back to empty strings so the module never crashes
// on import — the app renders and shows a config message instead of a blank page.
const url = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

export const supabase: SupabaseClient = url && anonKey
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : (null as any);

export const supabaseReady = Boolean(url && anonKey);

export type Role = 'farmer' | 'technician' | 'vendor' | 'admin';

export type DbUser = {
  id: string;
  role: Role;
  phone: string;
  language: string;
  region: string | null;
  name: string;
  created_at: string;
};
