import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { t } from '../lib/i18n';
import { Header, Screen, BigButton } from '../lib/ui';
import { Navigation, MapPin, Clock, Star, CheckCircle2, User, Phone } from 'lucide-react';

type Job = {
  id: string;
  status: string;
  tech_lat: number | null;
  tech_lng: number | null;
  technician_id: string;
  complaints: { farmer_id: string; status: string } | null;
};

type TechnicianInfo = { id: string; rating: number; availability_status: string; users: { name: string; phone: string } | null };

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

  useEffect(() => {
    (async () => {
      try {
        if (!user) return;
        const { data: farmer } = await supabase.from('farmers').select('id').eq('user_id', user.id).maybeSingle();
        if (!farmer) return;
        const farmerId = (farmer as { id: string }).id;
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

  // Poll job updates for live GPS tracking
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

  return (
    <Screen>
      <Header title={t(lang, 'trackTech')} onBack={onDone} />
      <div className="flex-1 flex flex-col items-center gap-6 p-6 max-w-md mx-auto w-full">
        <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center">
          <Navigation className="w-12 h-12 text-blue-600 animate-pulse" />
        </div>
        <p className="text-lg font-semibold text-gray-800 text-center">
          {job ? t(lang, 'techEnRoute') : t(lang, 'noJobsToAccept')}
        </p>

        {job && (
          <div className="w-full bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{t(lang, 'techLocation')}</p>
                <p className="font-bold text-gray-800">
                  {job.tech_lat != null ? `${job.tech_lat.toFixed(4)}, ${job.tech_lng?.toFixed(4)}` : '—'}
                </p>
              </div>
            </div>

            {distance != null && (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Navigation className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t(lang, 'km')} {t(lang, 'away')}</p>
                  <p className="font-bold text-gray-800">{distance.toFixed(1)} {t(lang, 'km')}</p>
                </div>
              </div>
            )}

            {eta != null && (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{t(lang, 'eta')}</p>
                  <p className="font-bold text-gray-800">{eta} {t(lang, 'min')}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <p className="text-sm font-semibold text-green-700">{t(lang, 'trackingLive')}</p>
            </div>
          </div>
        )}

        {tech?.users && (
          <div className="w-full bg-amber-50 rounded-2xl p-4 flex items-center gap-3">
            <User className="w-8 h-8 text-amber-600" />
            <div className="flex-1">
              <p className="font-semibold text-gray-800">{tech.users.name}</p>
              <a href={`tel:${tech.users.phone}`} className="text-sm text-green-700 font-semibold flex items-center gap-1">
                <Phone className="w-3 h-3" /> {tech.users.phone}
              </a>
            </div>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="font-bold text-gray-800">{tech.rating}</span>
            </div>
          </div>
        )}
      </div>
    </Screen>
  );
}
