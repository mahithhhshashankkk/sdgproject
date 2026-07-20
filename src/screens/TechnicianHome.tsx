import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { t } from '../lib/i18n';
import { Header, Screen } from '../lib/ui';
import { LangButton } from '../lib/LangButton';
import { CheckCircle2, XCircle, Star, Phone, User, Home, Play, Navigation } from 'lucide-react';

type Complaint = {
  id: string;
  status: string;
  image_url: string | null;
  voice_url: string | null;
  voice_text: string | null;
  farmer_id: string;
  created_at: string;
};

type Job = {
  id: string;
  status: string;
  created_at: string;
  complaint_id: string;
  tech_lat: number | null;
  tech_lng: number | null;
  complaints: Complaint | null;
};

type FarmerInfo = { name: string; phone: string; address: string | null; region: string | null };
type TechnicianRecord = { id: string; availability_status: string; rating: number };
type FarmerRecord = { id: string; user_id: string; address: string | null };
type UserRecord = { id: string; name: string; phone: string; region: string | null };

export default function TechnicianHome() {
  const { user, signOut } = useAuth();
  const lang = user?.language ?? 'en';
  const [tech, setTech] = useState<TechnicianRecord | null>(null);
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [farmers, setFarmers] = useState<Record<string, FarmerInfo>>({});
  const [loading, setLoading] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!user) return;
        const { data: techRow } = await supabase.from('technicians').select('id,availability_status,rating').eq('user_id', user.id).maybeSingle();
        const technician = techRow as TechnicianRecord | null;
        setTech(technician);
        if (technician) {
          await loadJobs(technician.id);
          // Subscribe to new complaints for pending jobs
          const sub = supabase.channel('complaints').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'complaints' }, () => loadJobs(technician.id)).subscribe();
          return () => { sub.unsubscribe(); };
        }
      } catch { /* best-effort */ }
      setLoading(false);
    })();
  }, [user]);

  const loadJobs = async (techId: string) => {
    try {
      // Pending = unassigned complaints (no job yet)
      const { data: unassigned } = await supabase
        .from('complaints')
        .select('id,status,image_url,voice_url,voice_text,farmer_id,created_at')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      const pendingComplaints = (unassigned as Complaint[]) ?? [];

      // Active jobs assigned to this technician
      const { data: jobRows } = await supabase
        .from('jobs')
        .select('id,status,created_at,complaint_id,tech_lat,tech_lng,complaints(id,status,image_url,voice_url,voice_text,farmer_id,created_at)')
        .eq('technician_id', techId)
        .in('status', ['assigned', 'travelling', 'arrived'])
        .order('created_at', { ascending: true });
      const active = (jobRows as unknown as Job[]) ?? [];

      // Build pending jobs from unassigned complaints
      const pending: Job[] = pendingComplaints.map((c) => ({
        id: `pending-${c.id}`, status: 'pending', created_at: c.created_at, complaint_id: c.id,
        tech_lat: null, tech_lng: null, complaints: c,
      }));

      setPendingJobs(pending);
      setActiveJobs(active);

      // Load farmer info for all complaints
      const allComplaints = [...pendingComplaints, ...active.map((j) => j.complaints).filter(Boolean) as Complaint[]];
      const farmerIds = [...new Set(allComplaints.map((c) => c.farmer_id).filter(Boolean))] as string[];
      if (farmerIds.length) {
        const { data: fRows } = await supabase.from('farmers').select('id,user_id,address').in('id', farmerIds);
        const farmerRows = (fRows ?? []) as FarmerRecord[];
        const userIds = [...new Set(farmerRows.map((f) => f.user_id))];
        const { data: uRows } = await supabase.from('users').select('id,name,phone,region').in('id', userIds);
        const users = (uRows ?? []) as UserRecord[];
        const map: Record<string, FarmerInfo> = {};
        farmerRows.forEach((f) => {
          const u = users.find((x) => x.id === f.user_id);
          if (u) map[f.id] = { name: u.name, phone: u.phone, address: f.address, region: u.region };
        });
        setFarmers(map);
      }
    } catch { /* best-effort */ }
    setLoading(false);
  };

  const acceptJob = async (job: Job) => {
    try {
      if (!tech) return;
      await supabase.from('jobs').insert({
        complaint_id: job.complaint_id, technician_id: tech.id, status: 'assigned',
      });
      await supabase.from('complaints').update({ status: 'assigned', assigned_technician_id: tech.id }).eq('id', job.complaint_id);
      setPendingJobs((js) => js.filter((j) => j.id !== job.id));
      await loadJobs(tech.id);
      startTracking(job.complaint_id);
    } catch { /* best-effort */ }
  };

  const rejectJob = async (job: Job) => {
    setPendingJobs((js) => js.filter((j) => j.id !== job.id));
  };

  const startTracking = (_complaintId: string) => {
    if (!navigator.geolocation || !tech) return;
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          await supabase.from('jobs').update({ tech_lat: latitude, tech_lng: longitude }).eq('technician_id', tech.id).in('status', ['assigned', 'travelling']);
        } catch { /* best-effort */ }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  };

  useEffect(() => () => { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current); }, []);

  const advance = async (job: Job) => {
    try {
      const next = job.status === 'assigned' ? 'travelling' : job.status === 'travelling' ? 'arrived' : 'completed';
      const patch: { status: string; completed_at?: string } = { status: next };
      if (next === 'completed') patch.completed_at = new Date().toISOString();
      await supabase.from('jobs').update(patch).eq('id', job.id);
      if (next === 'completed') {
        await supabase.from('complaints').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', job.complaint_id);
        if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (tech) await loadJobs(tech.id);
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

  const playVoice = (url: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    audioRef.current = new Audio(url);
    audioRef.current.play();
  };

  const renderMedia = (complaint: Complaint | null) => {
    if (!complaint) return null;
    return (
      <div className="mt-3 space-y-2">
        {complaint.image_url ? (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">{t(lang, 'farmerPicture')}</p>
            <img src={complaint.image_url} alt="pump" className="w-full rounded-xl shadow-sm" />
          </div>
        ) : null}
        {complaint.voice_url ? (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">{t(lang, 'farmerVoice')}</p>
            <button onClick={() => playVoice(complaint.voice_url!)} className="bg-purple-100 text-purple-700 rounded-xl px-4 py-2 text-sm font-bold flex items-center gap-2 active:scale-95">
              <Play className="w-4 h-4" /> {t(lang, 'play')}
            </button>
          </div>
        ) : null}
        {!complaint.image_url && !complaint.voice_url && (
          <p className="text-xs text-gray-400">{t(lang, 'noMedia')}</p>
        )}
      </div>
    );
  };

  return (
    <Screen>
      <Header title={t(lang, 'todayJobs')} right={
        <div className="flex items-center gap-2">
          <LangButton />
          <button onClick={toggleAvail} className="px-3 py-1 rounded-full text-sm font-semibold bg-white/20">
            {tech?.availability_status === 'available' ? '🟢' : '🟡'}
          </button>
        </div>
      } />

      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex gap-3 text-sm">
          <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full font-semibold">{pendingJobs.length + activeJobs.length} {t(lang, 'repairs')}</span>
        </div>
        {tech && <span className="flex items-center gap-1 text-sm text-gray-600"><Star className="w-4 h-4 text-yellow-500" />{tech.rating}</span>}
      </div>

      <main className="px-4 flex-1 space-y-3 pb-4 overflow-auto">
        {loading && <p className="text-center text-gray-500 py-8">Loading...</p>}

        {!loading && pendingJobs.length > 0 && (
          <div>
            <h2 className="font-bold text-gray-800 mb-2">{t(lang, 'pendingJobs')}</h2>
            {pendingJobs.map((job) => {
              const farmer = job.complaints?.farmer_id ? farmers[job.complaints.farmer_id] : null;
              return (
                <div key={job.id} className="bg-white rounded-2xl p-4 shadow-sm mb-3 border-l-4 border-amber-400">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{job.complaints?.voice_text ?? 'Service request'}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(job.created_at).toLocaleString()}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-800">{t(lang, 'pendingJobs')}</span>
                  </div>
                  {farmer && (
                    <div className="mt-3 bg-amber-50 rounded-xl p-3 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-700"><User className="w-4 h-4 text-amber-600" /> <span className="font-semibold">{farmer.name}</span></div>
                      <div className="flex items-center gap-2 text-sm text-gray-700"><Phone className="w-4 h-4 text-green-600" /> <a href={`tel:${farmer.phone}`} className="font-semibold text-green-700">{farmer.phone}</a></div>
                      {farmer.address && <div className="flex items-start gap-2 text-sm text-gray-700"><Home className="w-4 h-4 text-blue-600 mt-0.5" /> <span>{farmer.address}</span></div>}
                    </div>
                  )}
                  {renderMedia(job.complaints)}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => acceptJob(job)} className="flex-1 bg-green-600 text-white rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-1 active:scale-95">
                      <CheckCircle2 className="w-5 h-5" /> {t(lang, 'acceptJob')}
                    </button>
                    <button onClick={() => rejectJob(job)} className="flex-1 bg-red-500 text-white rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-1 active:scale-95">
                      <XCircle className="w-5 h-5" /> {t(lang, 'rejectJob')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && activeJobs.length > 0 && (
          <div>
            <h2 className="font-bold text-gray-800 mb-2">{t(lang, 'myJobs')}</h2>
            {activeJobs.map((job) => {
              const farmer = job.complaints?.farmer_id ? farmers[job.complaints.farmer_id] : null;
              return (
                <div key={job.id} className="bg-white rounded-2xl p-4 shadow-sm mb-3 border-l-4 border-green-400">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">{job.complaints?.voice_text ?? 'Service request'}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(job.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${job.status === 'assigned' ? 'bg-yellow-100 text-yellow-800' : job.status === 'travelling' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{job.status}</span>
                  </div>
                  {farmer && (
                    <div className="mt-3 bg-amber-50 rounded-xl p-3 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-700"><User className="w-4 h-4 text-amber-600" /> <span className="font-semibold">{farmer.name}</span></div>
                      <div className="flex items-center gap-2 text-sm text-gray-700"><Phone className="w-4 h-4 text-green-600" /> <a href={`tel:${farmer.phone}`} className="font-semibold text-green-700">{farmer.phone}</a></div>
                      {farmer.address && <div className="flex items-start gap-2 text-sm text-gray-700"><Home className="w-4 h-4 text-blue-600 mt-0.5" /> <span>{farmer.address}</span></div>}
                    </div>
                  )}
                  {renderMedia(job.complaints)}
                  {job.tech_lat != null && job.tech_lng != null && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-blue-700">
                      <Navigation className="w-4 h-4" /> {t(lang, 'trackingLive')}
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => advance(job)} className="flex-1 bg-green-600 text-white rounded-xl py-3 text-sm font-bold flex items-center justify-center gap-1 active:scale-95">
                      <CheckCircle2 className="w-5 h-5" /> {job.status === 'assigned' ? 'Start' : job.status === 'travelling' ? 'Arrived' : 'Complete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && pendingJobs.length === 0 && activeJobs.length === 0 && (
          <p className="text-center text-gray-500 py-8">{t(lang, 'noJobsToAccept')}</p>
        )}
      </main>

      <button onClick={() => signOut()} className="m-4 bg-gray-200 text-gray-700 rounded-2xl py-3 font-semibold">{t(lang, 'logout')}</button>
    </Screen>
  );
}
