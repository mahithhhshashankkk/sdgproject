import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { t } from '../lib/i18n';
import { useVoice, speak } from '../lib/voice';
import { IconTile, Screen, StatusDot, BigButton, Header } from '../lib/ui';
import {
  Siren, ShoppingCart, Wrench, CalendarClock, ShieldCheck, Phone, Sprout, Mic, Sun, Bell, Cloud, CloudRain, Truck, Package,
} from 'lucide-react';

const LANG_BADGE: Record<string, string> = { en: 'EN', kn: 'ಕನ್ನಡ', te: 'తె', hi: 'हि', ta: 'த' };

type Maintenance = { last_cleaning: string | null; last_battery_check: string | null; amc_expiry: string | null };
type Weather = { forecast: string; rain_expected: boolean };
type Scheme = { id: string; name: string; description: string | null; subsidy_percent: number | null; region: string | null; eligibility: string | null };
type FarmerRecord = { id: string };

const daysUntil = (d: string | null) => (d ? Math.round((new Date(d).getTime() - Date.now()) / 86400000) : null);

export default function FarmerHome({ onSos, onChangeLang }: {
  onSos: () => void; onChangeLang: () => void;
}) {
  const { user, signOut } = useAuth();
  const lang = user?.language ?? 'en';
  const voice = useVoice(lang);
  const [maint, setMaint] = useState<Maintenance | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [view, setView] = useState<'home' | 'subsidy' | 'install' | 'service' | 'warranty'>('home');
  const [schemes, setSchemes] = useState<Scheme[]>([]);

  useEffect(() => {
    speak(`${t(lang, 'hello')} ${user?.name ?? ''}. ${t(lang, 'howHelp')}`, lang);
    (async () => {
      try {
        const { data: farmer } = await supabase.from('farmers').select('id').eq('user_id', user!.id).maybeSingle();
        if (farmer) {
          const { data: m } = await supabase.from('maintenance_schedules').select('last_cleaning,last_battery_check,amc_expiry').eq('farmer_id', (farmer as FarmerRecord).id).maybeSingle();
          if (m) setMaint(m as Maintenance);
          const region = user?.region ?? 'Kolar';
          const { data: w } = await supabase.from('weather_alerts').select('forecast,rain_expected').eq('region', region).order('date', { ascending: false }).limit(1).maybeSingle();
          if (w) setWeather(w as Weather);
        }
        const { data: s } = await supabase.from('govt_schemes').select('*');
        setSchemes((s as Scheme[]) ?? []);
      } catch { /* data is best-effort; UI still renders */ }
    })();
  }, [user, lang]);

  const onMic = () => {
    if (voice.listening) voice.stop();
    else voice.start();
  };

  useEffect(() => {
    if (!voice.transcript) return;
    const txt = voice.transcript.toLowerCase();
    if (/not working|broken|stop|sos|repair/.test(txt)) onSos();
    else if (/install|new pump|buy/.test(txt)) setView('install');
    else if (/service|maintain/.test(txt)) setView('service');
    else if (/subsidy|scheme|govt|government/.test(txt)) setView('subsidy');
    voice.setTranscript('');
  }, [voice.transcript]);

  const cleaning = daysUntil(maint?.last_cleaning ? new Date(maint.last_cleaning).toISOString() : null);
  const battery = daysUntil(maint?.last_battery_check ? new Date(maint.last_battery_check).toISOString() : null);
  const amc = daysUntil(maint?.amc_expiry ?? null);

  // ---- Subsidy view ----
  if (view === 'subsidy') return (
    <Screen>
      <Header title={t(lang, 'govtSchemes')} onBack={() => setView('home')} />
      <div className="flex-1 p-4 space-y-3 overflow-auto">
        {schemes.length === 0 && <p className="text-center text-gray-500">{t(lang, 'noSchemes')}</p>}
        {schemes.map((s) => (
          <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-bold text-gray-800">{s.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{s.description}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {s.subsidy_percent != null && <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full">{t(lang, 'subsidyPercent')}: {s.subsidy_percent}%</span>}
              {s.region && <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">{s.region}</span>}
            </div>
            {s.eligibility && <p className="text-xs text-gray-500 mt-2">{t(lang, 'eligibility')}: {s.eligibility}</p>}
          </div>
        ))}
      </div>
    </Screen>
  );

  // ---- Install ticket view ----
  if (view === 'install') return <InstallForm lang={lang} onDone={() => setView('home')} kind="install" />;

  // ---- Service ticket view ----
  if (view === 'service') return <InstallForm lang={lang} onDone={() => setView('home')} kind="service" />;

  // ---- Warranty view ----
  if (view === 'warranty') return (
    <Screen>
      <Header title={t(lang, 'warranty')} onBack={() => setView('home')} />
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <ShieldCheck className="w-20 h-20 text-green-500" />
        <p className="text-lg font-semibold text-gray-800">{t(lang, 'warrantyInfo')} {maint?.amc_expiry ?? '—'}</p>
        <BigButton onClick={() => setView('home')} color="bg-green-600">{t(lang, 'done')}</BigButton>
      </div>
    </Screen>
  );

  // ---- Home ----
  return (
    <Screen>
      <header className="bg-amber-500 text-white px-4 py-4 flex items-center gap-3 shadow-md">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><Sun className="w-6 h-6" /></div>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold leading-tight">SuryaSetu</h1>
          <p className="text-sm text-white/90">{t(lang, 'hello')}, {user?.name ?? ''}</p>
        </div>
        <button onClick={onChangeLang} className="px-3 h-10 flex items-center justify-center rounded-full bg-white/20 text-sm font-semibold active:scale-95">{LANG_BADGE[lang] ?? 'EN'}</button>
        <button onClick={() => signOut()} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20" aria-label="Logout"><span className="text-lg">⏻</span></button>
      </header>

      <div className="px-4 py-4 flex flex-col items-center gap-2">
        <p className="text-gray-700 text-lg font-semibold text-center">{t(lang, 'howHelp')}</p>
        <button onClick={onMic} className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform ${voice.listening ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} aria-label="Voice input">
          <Mic className="w-12 h-12 text-white" />
        </button>
        <p className="text-sm text-gray-500">{voice.listening ? t(lang, 'listening') : t(lang, 'tapMic')}</p>
        {voice.transcript && <p className="text-sm text-gray-700 italic">"{voice.transcript}"</p>}
      </div>

      {/* Weather indicator */}
      <div className={`mx-4 mb-3 rounded-2xl p-3 flex items-center gap-3 ${weather?.rain_expected ? 'bg-blue-100' : 'bg-green-100'}`}>
        {weather?.rain_expected ? <CloudRain className="w-7 h-7 text-blue-600" /> : <Cloud className="w-7 h-7 text-green-600" />}
        <p className="text-sm font-semibold text-gray-800">{weather?.rain_expected ? t(lang, 'rainAlert') : weather?.forecast ?? t(lang, 'noRain')}</p>
      </div>

      <main className="px-4 pb-4 grid grid-cols-2 gap-3">
        <button onClick={onSos} className="col-span-2 bg-red-500 text-white rounded-2xl p-5 flex items-center justify-center gap-3 min-h-[64px] active:scale-95 transition-transform shadow-md">
          <Siren className="w-7 h-7" /><span className="text-xl font-extrabold">{t(lang, 'sos')}</span>
        </button>
        <IconTile icon={<ShoppingCart className="w-8 h-8" />} label={t(lang, 'buyPump')} onClick={() => setView('install')} color="bg-blue-100" />
        <IconTile icon={<Wrench className="w-8 h-8" />} label={t(lang, 'bookService')} onClick={() => setView('service')} color="bg-green-100" />
        <IconTile icon={<CalendarClock className="w-8 h-8" />} label={t(lang, 'maintenance')} onClick={() => setView('service')} color="bg-yellow-100" />
        <IconTile icon={<ShieldCheck className="w-8 h-8" />} label={t(lang, 'warranty')} onClick={() => setView('warranty')} color="bg-teal-100" />
        <IconTile icon={<Sprout className="w-8 h-8" />} label={t(lang, 'subsidy')} onClick={() => setView('subsidy')} color="bg-lime-100" />
        <IconTile icon={<Phone className="w-8 h-8" />} label={t(lang, 'callSupport')} onClick={() => window.location.href = 'tel:1800200300'} color="bg-orange-100" />
      </main>

      {/* Logistics services */}
      <section className="px-4 pb-2">
        <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><Truck className="w-5 h-5 text-amber-600" /> {t(lang, 'logistics')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <IconTile icon={<Package className="w-8 h-8" />} label={t(lang, 'installation')} onClick={() => setView('install')} color="bg-indigo-100" />
          <IconTile icon={<Wrench className="w-8 h-8" />} label={t(lang, 'generalService')} onClick={() => setView('service')} color="bg-rose-100" />
        </div>
      </section>

      <section className="px-4 pb-6">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="w-5 h-5 text-amber-600" /><h2 className="font-bold text-gray-800">{t(lang, 'notifications')}</h2>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <StatusDot color={amc && amc > 0 ? 'green' : 'red'} />
          <span className="font-semibold text-gray-800">{t(lang, 'pumpHealthy')}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <StatusCard color={cleaning && cleaning > 0 ? 'green' : 'yellow'} label={t(lang, 'nextCleaning')} value={cleaning != null ? `${cleaning} ${t(lang, 'days')}` : '—'} />
          <StatusCard color={battery && battery > 0 ? 'green' : 'yellow'} label={t(lang, 'nextBattery')} value={battery != null ? `${battery} ${t(lang, 'days')}` : '—'} />
          <StatusCard color={amc && amc > 0 ? 'green' : 'red'} label={t(lang, 'amc')} value={amc != null ? (amc > 0 ? `${amc} ${t(lang, 'days')}` : t(lang, 'expired')) : '—'} />
        </div>
      </section>
    </Screen>
  );
}

function StatusCard({ color, label, value }: { color: 'green' | 'yellow' | 'red' | 'blue'; label: string; value: string }) {
  const bg = { green: 'bg-green-50 border-green-400', yellow: 'bg-yellow-50 border-yellow-400', red: 'bg-red-50 border-red-400', blue: 'bg-blue-50 border-blue-400' }[color];
  return (
    <div className={`${bg} border-l-4 rounded-r-xl p-3 flex flex-col gap-1`}>
      <StatusDot color={color} />
      <span className="text-xs text-gray-600 font-medium">{label}</span>
      <span className="text-sm font-bold text-gray-800">{value}</span>
    </div>
  );
}

// Simple ticket form for install / service. Writes to install_requests (install) or complaints (service).
function InstallForm({ lang, onDone, kind }: { lang: string; onDone: () => void; kind: 'install' | 'service' }) {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [acres, setAcres] = useState('');
  const [model, setModel] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (kind === 'install') {
        await supabase.from('install_requests').insert({
          farmer_name: name, phone, region: user?.region ?? null,
          acres: acres ? Number(acres) : null, pump_model: model || null, status: 'new',
        });
      } else {
        const { data: farmer } = await supabase.from('farmers').select('id').eq('user_id', user!.id).maybeSingle();
        if (farmer) await supabase.from('complaints').insert({
          farmer_id: (farmer as FarmerRecord).id, status: 'open', priority: 'normal',
          voice_text: `Service request by ${name}`, category: 'general',
        });
      }
      setDone(true);
    } catch { setDone(true); }
    setBusy(false);
  };

  if (done) return (
    <Screen>
      <Header title={kind === 'install' ? t(lang, 'installation') : t(lang, 'generalService')} onBack={onDone} />
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <ShieldCheck className="w-16 h-16 text-green-500" />
        <p className="text-lg font-semibold text-gray-800">{kind === 'install' ? t(lang, 'ticketRaised') : t(lang, 'serviceBooked')}</p>
        <BigButton onClick={onDone} color="bg-green-600">{t(lang, 'done')}</BigButton>
      </div>
    </Screen>
  );

  return (
    <Screen>
      <Header title={kind === 'install' ? t(lang, 'installation') : t(lang, 'generalService')} onBack={onDone} />
      <div className="flex-1 p-4 flex flex-col gap-4 max-w-md mx-auto w-full">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t(lang, 'yourName')} className="px-4 py-4 rounded-2xl border-2 border-amber-200 focus:border-amber-500 outline-none text-lg" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t(lang, 'phoneNo')} inputMode="tel" className="px-4 py-4 rounded-2xl border-2 border-amber-200 focus:border-amber-500 outline-none text-lg" />
        {kind === 'install' && <>
          <input value={acres} onChange={(e) => setAcres(e.target.value)} placeholder={t(lang, 'acresLand')} inputMode="decimal" className="px-4 py-4 rounded-2xl border-2 border-amber-200 focus:border-amber-500 outline-none text-lg" />
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={t(lang, 'pumpModel')} className="px-4 py-4 rounded-2xl border-2 border-amber-200 focus:border-amber-500 outline-none text-lg" />
        </>}
        <BigButton onClick={submit} disabled={busy || !name || !phone} color="bg-green-600">{busy ? '...' : t(lang, 'submit')}</BigButton>
      </div>
    </Screen>
  );
}
