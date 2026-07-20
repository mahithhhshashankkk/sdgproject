import { createContext, useContext, useState, type ReactNode } from 'react';
import type { DbUser, Role } from './supabase';

// Local demo auth (no Supabase auth). Picks a seeded user per role so dashboards
// load real data. signOut returns to the role picker.

const DEMO_USERS: Record<Role, DbUser> = {
  farmer: { id: 'a0000000-0000-0000-0000-000000000002', role: 'farmer', phone: '+919000000002', language: 'en', region: 'Kolar', name: 'Ravi Kumar', created_at: '' },
  technician: { id: 'a0000000-0000-0000-0000-000000000004', role: 'technician', phone: '+919000000004', language: 'en', region: 'Kolar', name: 'Manjunath', created_at: '' },
  vendor: { id: 'a0000000-0000-0000-0000-000000000006', role: 'vendor', phone: '+919000000006', language: 'en', region: 'Bengaluru', name: 'GreenSolar Co', created_at: '' },
  admin: { id: 'a0000000-0000-0000-0000-000000000001', role: 'admin', phone: '+919000000001', language: 'en', region: 'Karnataka', name: 'Admin Ramesh', created_at: '' },
};

type AuthState = {
  user: DbUser | null;
  loading: boolean;
  signInAs: (role: Role) => void;
  setLang: (lang: string) => void;
  signOut: () => void;
};

const Ctx = createContext<AuthState | undefined>(undefined);

export const useAuth = () => {
  const auth = useContext(Ctx);
  if (!auth) throw new Error('useAuth must be used within an AuthProvider');
  return auth;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DbUser | null>(null);
  const setLang = (lang: string) => setUser((u) => (u ? { ...u, language: lang } : u));
  return (
    <Ctx.Provider value={{ user, loading: false, signInAs: (r) => setUser(DEMO_USERS[r]), setLang, signOut: () => setUser(null) }}>
      {children}
    </Ctx.Provider>
  );
}

export type { Role };
