import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { t } from '../lib/i18n';
import { Header, Screen, BigButton } from '../lib/ui';
import { Navigation, MapPin, Star, CheckCircle2, User, Phone, Bike } from 'lucide-react';

type Job = {
  id: string;
  status: string;
  tech_lat: number | null;
  tech_lng: number | null;
  technician_id: string;
  complaints: { farmer_id: string; status: string } | null;
};

type TechnicianInfo = { id: string; rating: number; availability_status: string; users: { name: string; phone: string } | null };
type FarmerRecord = { id: string };

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function FarmerTrack({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const lang = user?.language ?? 'en';
  const [job, setJob] = useState<Job | null>(null);
  const [tech, setTech] = useState<TechnicianInfo | null>(null);
  const [farmerLoc, setFarmerLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [eta, setEta] = useState<number | null>(null);
  const [phase, setPhase] = useState<'tracking' | 'completed' | 'rated'>('tracking');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [progress, setProgress] = useState(0);
  const prevDistRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!user) return;
        const { data: farmer } = await supabase.from('farmers').select('id').eq('user_id', user.id).maybeSingle();
        if (!farmer) return;
        const farmerId = (farmer as FarmerRecord).id;
        const { data: complaint } = await supabase.from('complaints').select('id').eq('farmer_id', farmerId).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (!complaint) return;
        const complaintId = (complaint as { id: string }).id;
        const { data: jobRow } = await supabase.from('jobs').select('id,status,tech_lat,tech_lng,technician_id,complaints(farmer_id,status)').eq('complaint_id', complaintId).order('created_at', { ascending: false }).limit(1).maybeSingle();
        const j = jobRow as unknown as Job | null;
        if (!j) return;
        setJob(j);
        if (j.status === 'completed') setPhase('completed');
        const { data: techRow } = await supabase.from('technicians').select('id,rating,availability_status,users(name,phone)').eq('id', j.technician_id).maybeSingle();
        setTech(techRow as unknown as TechnicianInfo | null);
      } catch { /* best-effort */ }
    })();

    navigator.geolocation?.getCurrentPosition(
      (pos) => setFarmerLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true }
    );
  }, [user]);

  useEffect(() => {
    if (!job || phase !== 'tracking') return;
    const interval = setInterval(async () => {
      try {
        const { data: j } = await supabase.from('jobs').select('id,status,tech_lat,tech_lng').eq('id', job.id).maybeSingle();
        const updated = j as unknown as Job | null;
        if (updated) {
          setJob({ ...job, ...updated });
          if (updated.status === 'completed') setPhase('completed');
          if (updated.tech_lat != null && updated.tech_lng != null && farmerLoc) {
            const d = haversineKm(farmerLoc.lat, farmerLoc.lng, updated.tech_lat, updated.tech_lng);
            setDistance(d);
            setEta(Math.max(1, Math.round((d / 30) * 60)));
            const prev = prevDistRef.current;
            if (prev != null && prev > 0) {
              const moved = Math.max(0, prev - d);
              setProgress((p) => Math.min(100, p + (moved / prev) * 100));
            }
            prevDistRef.current = d;
          }
        }
      } catch { /* best-effort */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [job, farmerLoc, phase]);

  const submitRating = async () => {
    if (!tech || rating === 0) return;
    try {
      const newRating = Math.round(((tech.rating || 0) + rating) / 2);
      await supabase.from('technicians').update({ rating: newRating }).eq('id', tech.id);
    } catch { /* best-effort */ }
    setPhase('rated');
  };

  if (phase === 'rated') return (
    <Screen>
      <Header title={t(lang, 'rateTechnician')} onBack={onDone} />
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <CheckCircle2 className="w-16 h-16 text-green-500" />
        <p className="text-lg font-semibold text-gray-800">{t(lang, 'ratingSubmitted')}</p>
        <BigButton onClick={onDone} color="bg-green-600">{t(lang, 'done')}</BigButton>
      </div>
    </Screen>
  );

  if (phase === 'completed' || job?.status === 'completed') return (
    <Screen>
      <Header title={t(lang, 'technicianProfile')} onBack={onDone} />
      <div className="flex-1 flex flex-col items-center gap-6 p-6 max-w-md mx-auto w-full">
        <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center">
          <User className="w-12 h-12 text-amber-600" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800">{tech?.users?.name ?? 'Technician'}</h2>
          {tech?.users?.phone && (
            <a href={`tel:${tech.users.phone}`} className="flex items-center justify-center gap-1 text-sm text-green-700 font-semibold mt-1">
              <Phone className="w-4 h-4" /> {tech.users.phone}
            </a>
          )}
          <div className="flex items-center justify-center gap-1 mt-2">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            <span className="font-bold text-gray-800">{tech?.rating ?? '—'}</span>
          </div>
        </div>
        <div className="w-full">
          <p className="text-center text-lg font-semibold text-gray-800 mb-3">{t(lang, 'rateService')}</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                onMouseEnter={() => setHoverRating(n)}
                onMouseLeave={() => setHoverRating(0)}
                className="active:scale-95 transition-transform"
              >
                <Star className={`w-10 h-10 ${(hoverRating || rating) >= n ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
              </button>
            ))}
          </div>
        </div>
        <BigButton onClick={submitRating} disabled={rating === 0} color="bg-green-600">{t(lang, 'submitRating')}</BigButton>
      </div>
    </Screen>
  );

  // Rapido-style tracking UI
  const techMarkerPos = job?.tech_lat != null && job?.tech_lng != null && farmerLoc
    ? {
        // Map technician position relative to farmer on a simplified grid
        x: 50 + ((job.tech_lng - farmerLoc.lng) * 500),
        y: 50 - ((job.tech_lat - farmerLoc.lat) * 500),
      }
    : null;

  return (
    <Screen>
      <Header title={t(lang, 'trackTech')} onBack={onDone} />
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full">
        {/* Map area */}
        <div className="relative bg-gradient-to-b from-green-50 to-green-100 h-64 overflow-hidden">
          {/* Grid lines for map feel */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute left-0 right-0 top-1/4 h-px bg-gray-400" />
            <div className="absolute left-0 right-0 top-2/4 h-px bg-gray-400" />
            <div className="absolute left-0 right-0 top-3/4 h-px bg-gray-400" />
            <div className="absolute top-0 bottom-0 left-1/4 w-px bg-gray-400" />
            <div className="absolute top-0 bottom-0 left-2/4 w-px bg-gray-400" />
            <div className="absolute top-0 bottom-0 left-3/4 w-px bg-gray-400" />
          </div>

          {/* Route line from farmer (bottom) to tech marker */}
          {techMarkerPos && (
            <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
              <line
                x1="50%" y1="85%" 
                x2={`${Math.max(5, Math.min(95, techMarkerPos.x))}%`} 
                y2={`${Math.max(5, Math.min(95, techMarkerPos.y))}%`}
                stroke="#3b82f6" strokeWidth="3" strokeDasharray="8 4"
              />
            </svg>
          )}

          {/* Farmer marker (bottom center) */}
          <div className="absolute" style={{ left: '50%', top: '85%', transform: 'translate(-50%, -50%)' }}>
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-green-600 border-4 border-white shadow-lg flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-green-700 bg-white/90 px-2 py-0.5 rounded-full whitespace-nowrap">You</span>
            </div>
          </div>

          {/* Technician marker (moving) */}
          {techMarkerPos ? (
            <div 
              className="absolute transition-all duration-[4500ms] ease-linear"
              style={{ 
                left: `${Math.max(5, Math.min(95, techMarkerPos.x))}%`, 
                top: `${Math.max(5, Math.min(95, techMarkerPos.y))}%`, 
                transform: 'translate(-50%, -50%)' 
              }}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-blue-600 border-4 border-white shadow-lg flex items-center justify-center animate-pulse">
                  <Bike className="w-6 h-6 text-white" />
                </div>
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-blue-700 bg-white/90 px-2 py-0.5 rounded-full whitespace-nowrap">
                  {tech?.users?.name?.split(' ')[0] ?? 'Tech'}
                </span>
                {/* Pulsing ring */}
                <span className="absolute inset-0 rounded-full bg-blue-400/40 animate-ping" />
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <Navigation className="w-8 h-8 animate-pulse" />
                <span className="text-sm font-medium">{t(lang, 'techEnRoute')}</span>
              </div>
            </div>
          )}
        </div>

        {/* Status timeline */}
        <div className="bg-white px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            {[
              { icon: CheckCircle2, label: t(lang, 'jobAccepted'), active: true, done: true },
              { icon: Navigation, label: t(lang, 'techEnRoute'), active: phase === 'tracking', done: false },
              { icon: MapPin, label: t(lang, 'techArrived'), active: false, done: false },
            ].map((step, i, arr) => (
              <div key={i} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${step.done ? 'bg-green-500' : step.active ? 'bg-blue-500' : 'bg-gray-200'}`}>
                    <step.icon className={`w-5 h-5 ${step.done || step.active ? 'text-white' : 'text-gray-400'}`} />
                  </div>
                  <span className={`text-[10px] font-semibold ${step.done || step.active ? 'text-gray-800' : 'text-gray-400'}`}>{step.label}</span>
                </div>
                {i < arr.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${step.done ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Info cards */}
        <div className="flex-1 p-4 space-y-3">
          {distance != null && (
            <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-green-100 flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{t(lang, 'km')} {t(lang, 'away')}</p>
                  <p className="text-lg font-bold text-gray-800">{distance.toFixed(1)} {t(lang, 'km')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{t(lang, 'eta')}</p>
                <p className="text-lg font-bold text-amber-600">{eta} {t(lang, 'min')}</p>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {distance != null && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">{t(lang, 'trackingLive')}</span>
                <span className="text-sm font-bold text-blue-600">{Math.round(progress)}%</span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-[4500ms] ease-linear" style={{ width: `${Math.max(5, progress)}%` }} />
              </div>
            </div>
          )}

          {/* Technician card */}
          {tech?.users && (
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-gray-800">{tech.users.name}</p>
                  <div className="flex items-center gap-2">
                    <a href={`tel:${tech.users.phone}`} className="text-sm text-green-700 font-semibold flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {tech.users.phone}
                    </a>
                    <span className="text-gray-300">·</span>
                    <span className="flex items-center gap-0.5">
                      <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm font-bold text-gray-800">{tech.rating}</span>
                    </span>
                  </div>
                </div>
                <a href={`tel:${tech.users.phone}`} className="w-11 h-11 rounded-full bg-green-500 flex items-center justify-center active:scale-95 transition-transform">
                  <Phone className="w-5 h-5 text-white" />
                </a>
              </div>
            </div>
          )}

          {/* Live tracking badge */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-semibold text-green-700">{t(lang, 'trackingLive')}</span>
          </div>
        </div>
      </div>
    </Screen>
  );
}
