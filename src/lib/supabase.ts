import { createClient } from '@supabase/supabase-js';

// A placeholder client lets the UI render when deployment variables are not configured.
// Real environment values take precedence unchanged whenever they are supplied.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'missing-supabase-anon-key';

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

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
