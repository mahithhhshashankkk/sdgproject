import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { t } from '../lib/i18n';
import { Header, Screen } from '../lib/ui';
import { Users, Wrench, AlertCircle, Clock, CheckCircle2, Sprout, ShoppingCart, Package } from 'lucide-react';

type Ticket = { id: string; sector: 'farmer' | 'vendor'; type: string; raisedBy: string; status: string; date: string };

export default function AdminHome() {
  const { user, signOut } = useAuth();
  const lang = user?.language ?? 'en';
  const [metrics, setMetrics] = useState({ farmers: 0, techs: 0, complaints: 0, pending: 0, completed: 0, installs: 0 });
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tab, setTab] = useState<'all' | 'farmer' | 'vendor'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ count: farmers }, { count: techs }, { count: complaints }, { count: pending }, { count: completed }, { count: installs }] = await Promise.all([
        supabase.from('farmers').select('id', { count: 'exact', head: true }),
        supabase.from('technicians').select('id', { count: 'exact', head: true }),
        supabase.from('complaints').select('id', { count: 'exact', head: true }),
        supabase.from('complaints').select('id', { count: 'exact', head: true }).in('status', ['open', 'assigned', 'in_progress']),
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('install_requests').select('id', { count: 'exact', head: true }),
      ]);
      setMetrics({ farmers: farmers ?? 0, techs: techs ?? 0, complaints: complaints ?? 0, pending: pending ?? 0, completed: completed ?? 0, installs: installs ?? 0 });

      // Gather tickets from complaints (farmer sector) and install_requests (vendor sector)
      const { data: cRows } = await supabase.from('complaints').select('id,status,created_at,voice_text,farmer_id').order('created_at', { ascending: false }).limit(50);
      const farmerIds = [...new Set((cRows ?? []).map((c: any) => c.farmer_id).filter(Boolean))] as string[];
      const { data: fRows } = await supabase.from('farmers').select('id,user_id').in('id', farmerIds);
      const uids = [...new Set((fRows ?? []).map((f: any) => f.user_id))] as string[];
      const { data: uRows } = await supabase.from('users').select('id,name').in('id', uids);
      const fName = (fid: string) => {
        const f = (fRows ?? []).find((x: any) => x.id === fid);
        const u = (uRows ?? []).find((x: any) => x.id === f?.user_id) as any;
        return u?.name ?? 'Unknown farmer';
      };
      const cTickets: Ticket[] = (cRows ?? []).map((c: any) => ({
        id: c.id, sector: 'farmer', type: t(lang, 'complaints'), raisedBy: fName(c.farmer_id),
        status: c.status, date: c.created_at,
      }));

      const { data: iRows } = await supabase.from('install_requests').select('id,farmer_name,status,created_at').order('created_at', { ascending: false }).limit(50);
      const iTickets: Ticket[] = (iRows ?? []).map((i: any) => ({
        id: i.id, sector: 'vendor', type: t(lang, 'installReqs'), raisedBy: i.farmer_name,
        status: i.status, date: i.created_at,
      }));

      setTickets([...cTickets, ...iTickets].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setLoading(false);
    })();
  }, [user, lang]);

  const shown = tickets.filter((tk) => tab === 'all' || tk.sector === tab);
  const statusColor = (s: string) =>
    s === 'resolved' || s === 'completed' || s === 'installed' ? 'bg-emerald-100 text-emerald-700'
    : s === 'accepted' || s === 'assigned' || s === 'in_progress' || s === 'travelling' || s === 'arrived' ? 'bg-blue-100 text-blue-700'
    : s === 'rejected' || s === 'cancelled' ? 'bg-red-100 text-red-700'
    : 'bg-amber-100 text-amber-700';

  return (
    <Screen className="bg-slate-50">
      <Header title="SuryaSetu · Admin" />
      <div className="px-4 py-3 grid grid-cols-6 gap-2">
        <Metric icon={<Sprout className="w-5 h-5" />} value={metrics.farmers} label={t(lang, 'totalFarmers')} color="bg-emerald-50 text-emerald-700 border border-emerald-200" />
        <Metric icon={<Wrench className="w-5 h-5" />} value={metrics.techs} label={t(lang, 'activeTech')} color="bg-blue-50 text-blue-700 border border-blue-200" />
        <Metric icon={<AlertCircle className="w-5 h-5" />} value={metrics.complaints} label={t(lang, 'complaints')} color="bg-orange-50 text-orange-700 border border-orange-200" />
        <Metric icon={<Clock className="w-5 h-5" />} value={metrics.pending} label={t(lang, 'pendingRepairs')} color="bg-amber-50 text-amber-700 border border-amber-200" />
        <Metric icon={<CheckCircle2 className="w-5 h-5" />} value={metrics.completed} label={t(lang, 'completedJobs')} color="bg-teal-50 text-teal-700 border border-teal-200" />
        <Metric icon={<ShoppingCart className="w-5 h-5" />} value={metrics.installs} label={t(lang, 'installReqs')} color="bg-indigo-50 text-indigo-700 border border-indigo-200" />
      </div>

      <div className="px-4 flex gap-2 mb-3">
        {([['all', t(lang, 'allTickets')], ['farmer', t(lang, 'complaints')], ['vendor', t(lang, 'installReqs')]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === k ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{label}</button>
        ))}
      </div>

      <main className="px-4 flex-1 space-y-2 pb-4">
        {loading && <p className="text-center text-slate-400 py-8">Loading...</p>}
        {!loading && shown.length === 0 && <p className="text-center text-slate-400 py-8">{t(lang, 'noTickets')}</p>}
        {shown.map((tk) => (
          <div key={tk.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tk.sector === 'farmer' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                {tk.sector === 'farmer' ? <Sprout className="w-5 h-5" /> : <Package className="w-5 h-5" />}
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm">{tk.raisedBy}</p>
                <p className="text-xs text-slate-500">{tk.type} · {new Date(tk.date).toLocaleString()}</p>
              </div>
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusColor(tk.status)}`}>{tk.status}</span>
          </div>
        ))}
      </main>

      <button onClick={() => signOut()} className="m-4 bg-slate-200 text-slate-700 rounded-2xl py-3 font-semibold">{t(lang, 'logout')}</button>
    </Screen>
  );
}

function Metric({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <div className={`${color} rounded-xl p-2 flex flex-col items-center gap-1`}>
      {icon}
      <span className="text-lg font-extrabold">{value}</span>
      <span className="text-[9px] font-semibold text-center leading-tight">{label}</span>
    </div>
  );
}
