import { useAuth } from '../lib/auth';
import type { Role } from '../lib/supabase';
import { Screen } from '../lib/ui';
import { Sun, Sprout, Wrench, Store, ShieldCheck } from 'lucide-react';

const ROLES: { role: Role; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { role: 'farmer', label: 'Farmer', desc: 'Voice-first pump service', icon: <Sprout className="w-8 h-8" />, color: 'bg-green-500' },
  { role: 'technician', label: 'Technician', desc: 'Today\'s jobs & routing', icon: <Wrench className="w-8 h-8" />, color: 'bg-blue-500' },
  { role: 'vendor', label: 'Vendor', desc: 'Inventory & orders', icon: <Store className="w-8 h-8" />, color: 'bg-orange-500' },
  { role: 'admin', label: 'Admin', desc: 'Operations & analytics', icon: <ShieldCheck className="w-8 h-8" />, color: 'bg-teal-600' },
];

export default function RolePicker() {
  const { signInAs } = useAuth();
  return (
    <Screen className="items-center justify-center px-6">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
            <Sun className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-extrabold text-amber-600 tracking-tight">SuryaSetu</h1>
          <p className="text-gray-600 text-center text-sm">India's Smart Solar Pump Service Ecosystem</p>
        </div>
        <div className="w-full grid grid-cols-2 gap-4">
          {ROLES.map((r) => (
            <button
              key={r.role}
              onClick={() => signInAs(r.role)}
              className={`${r.color} text-white rounded-2xl p-5 flex flex-col items-center gap-2 min-h-[140px] active:scale-95 transition-transform shadow-md`}
            >
              {r.icon}
              <span className="text-lg font-extrabold">{r.label}</span>
              <span className="text-xs text-white/90 text-center leading-tight">{r.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </Screen>
  );
}
