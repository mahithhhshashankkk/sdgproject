import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { t } from '../lib/i18n';
import { Header, Screen } from '../lib/ui';
import { Camera, PenLine, CheckCircle2, Wrench, Star, Phone, User, Home } from 'lucide-react';

type Job = {
  id: string;
  status: string;
  created_at: string;
  complaint_id: string;
  complaints: { voice_text: string | null; farmer_id: string } | null;
};

type FarmerInfo = { name: string; phone: string; address: string | null; region: string | null };

export default function TechnicianHome() {
  const { user, signOut } = useAuth();
  const lang = user?.language ?? 'en';
  const [tech, setTech] = useState<{ id: string; availability_status: string; rating: number } | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [farmers, setFarmers] = useState<Record<string, FarmerInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (!user) return;
        const { data: techRow } = await supabase.from('technicians').select('id,availability_status,rating').eq('user_id', user.id).maybeSingle();
        setTech(techRow as any);
        if (techRow) {
          const { data: jobRows } = await supabase
            .from('jobs')
            .select('id,status,created_at,complaint_id,complaints(voice_text,farmer_id)')
            .eq('technician_id', (techRow as any).id)
            .in('status', ['assigned', 'travelling', 'arrived'])
            .order('created_at', { ascending: true });
          const js = (jobRows as unknown as Job[]) ?? [];
          setJobs(js);
          const ids = [...new Set(js.map((j) => j.complaints?.farmer_id).filter(Boolean))] as string[];
          if (ids.length) {
            const { data: fRows } = await supabase.from('farmers').select('id,user_id,address').in('id', ids);
            const uids = [...new Set((fRows ?? []).map((f: any) => f.user_id))] as string[];
            const { data: uRows } = await supabase.from('users').select('id,name,phone,region').in('id', uids);
            const map: Record<string, FarmerInfo> = {};
            (fRows ?? []).forEach((f: any) => {
              const u = (uRows ?? []).find((x: any) => x.id === f.user_id) as any;
              if (u) map[f.id] = { name: u.name, phone: u.phone, address: f.address, region: u.region };
            });
            setFarmers(map);
          }
        }
      } catch { /* best-effort */ }
      setLoading(false);
    })();
  }, [user]);

  const advance = async (job: Job) => {
    try {
      const next = job.status === 'assigned' ? 'travelling' : job.status === 'travelling' ? 'arrived' : 'completed';
      const patch: any = { status: next };
      if (next === 'completed') patch.completed_at = new Date().toISOString();
      await supabase.from('jobs').update(patch).eq('id', job.id);
      if (next === 'completed') {
        await supabase.from('complaints').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', job.complaint_id);
      }
      setJobs((js) => js.filter((j) => j.id !== job.id));
    } catch { /* best-effort */ }
  };

  const toggleAvail = async () => {
    try {
      if (!tech) return;
      const next = tech.availability_status === 'available' ? 'busy' : 'available';
      await supabase.from('technicians').update({ availability_status: next }).eq('id', tech.id);
      setTech({ ...tech, availability_status: next });
    } catch { /* best-effort */ }
  };

  return (
    <Screen>
      <Header title={t(lang, 'todayJobs')} right={
        <button onClick={toggleAvail} className="px-3 py-1 rounded-full text-sm font-semibold bg-white/20">
          {tech?.availability_status === 'available' ? '🟢' : '🟡'}
        </button>
      } />
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex gap-3 text-sm">
          <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-semibold">{jobs.length} {t(lang, 'repairs')}</span>
        </div>
        {tech && <span className="flex items-center gap-1 text-sm text-gray-600"><Star className="w-4 h-4 text-yellow-500" />{tech.rating}</span>}
      </div>

      <main className="px-4 flex-1 space-y-3 pb-4">
        {loading && <p className="text-center text-gray-500 py-8">Loading...</p>}
        {!loading && jobs.length === 0 && <p className="text-center text-gray-500 py-8">{t(lang, 'noJobs')}</p>}
        {jobs.map((job) => {
          const farmer = job.complaints?.farmer_id ? farmers[job.complaints.farmer_id] : null;
          return (
            <div key={job.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{job.complaints?.voice_text ?? 'Service request'}</p>
                  <p className="text-xs text-gray-500 mt-1">{new Date(job.created_at).toLocaleString()}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${job.status === 'assigned' ? 'bg-yellow-100 text-yellow-800' : job.status === 'travelling' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{job.status}</span>
              </div>

              {/* Farmer details */}
              {farmer && (
                <div className="mt-3 bg-amber-50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-2 text-sm text-gray-700"><User className="w-4 h-4 text-amber-600" /> <span className="font-semibold">{farmer.name}</span></div>
                  <div className="flex items-center gap-2 text-sm text-gray-700"><Phone className="w-4 h-4 text-green-600" /> <a href={`tel:${farmer.phone}`} className="font-semibold text-green-700">{farmer.phone}</a></div>
                  {farmer.address && <div className="flex items-start gap-2 text-sm text-gray-700"><Home className="w-4 h-4 text-blue-600 mt-0.5" /> <span>{farmer.address}</span></div>}
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <button onClick={() => advance(job)} className="flex-1 bg-green-600 text-white rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-1 active:scale-95">
                  <CheckCircle2 className="w-5 h-5" /> {job.status === 'assigned' ? 'Start' : job.status === 'travelling' ? 'Arrived' : 'Complete'}
                </button>
                <button className="bg-blue-100 text-blue-700 rounded-xl px-3 py-3 flex items-center justify-center active:scale-95"><Camera className="w-5 h-5" /></button>
                <button className="bg-purple-100 text-purple-700 rounded-xl px-3 py-3 flex items-center justify-center active:scale-95"><PenLine className="w-5 h-5" /></button>
                <button className="bg-orange-100 text-orange-700 rounded-xl px-3 py-3 flex items-center justify-center active:scale-95"><Wrench className="w-5 h-5" /></button>
              </div>
            </div>
          );
        })}
      </main>

      <button onClick={() => signOut()} className="m-4 bg-gray-200 text-gray-700 rounded-2xl py-3 font-semibold">{t(lang, 'logout')}</button>
    </Screen>
  );
}
