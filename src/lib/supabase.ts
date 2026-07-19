import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Env vars are inlined by Vite at build time. If missing (e.g. .env not present
// during a deploy build), fall back to the project's public anon credentials so
// the app always works without manual env var setup. The anon key is public-safe
// — access is protected by Row Level Security policies in the database.
const url = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://fawjzgiijkvvfhinizak.supabase.co';
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhd2p6Z2lpamt2dmZoaW5pemFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNDMyNzMsImV4cCI6MjA5OTkxOTI3M30.JzP0m7nknLZv_IUits5_UUyNfX7TPKXQjmFTR2__hDw';

export const supabase: SupabaseClient = createClient(url, anonKey, {
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
