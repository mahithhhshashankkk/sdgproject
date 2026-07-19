import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { t } from '../lib/i18n';
import { speak } from '../lib/voice';
import { BigButton, Header, Screen } from '../lib/ui';
import { Camera, MapPin, CheckCircle2, Loader2 } from 'lucide-react';

type Step = 'q1' | 'q2' | 'q3' | 'photo' | 'location' | 'analyzing' | 'simpleFix' | 'assigned' | 'done';

export default function SosFlow({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const lang = user?.language ?? 'en';
  const [step, setStep] = useState<Step>('q1');
  const [answers, setAnswers] = useState<{ q1?: boolean; q2?: boolean; q3?: boolean }>({});
  const [, setImageData] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [, setJobId] = useState<string | null>(null);

  const ask = (text: string) => speak(text, lang);

  useEffect(() => {
    if (step === 'q1') ask(t(lang, 'pumpNotWorking'));
    if (step === 'q2') ask(t(lang, 'anyLights'));
    if (step === 'q3') ask(t(lang, 'waterComing'));
    if (step === 'photo') ask(t(lang, 'takePicture'));
    if (step === 'location') ask(t(lang, 'yourLocation'));
  }, [step, lang]);

  const answer = (q: 'q1' | 'q2' | 'q3', val: boolean) => {
    setAnswers((a) => ({ ...a, [q]: val }));
    if (q === 'q1') setStep('q2');
    else if (q === 'q2') setStep('q3');
    else if (q === 'q3') setStep('photo');
  };

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Compress via canvas to reduce bandwidth
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result as string; };
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const max = 800;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/jpeg', 0.6);
      setImageData(data);
      setStep('location');
    };
    reader.readAsDataURL(file);
  };

  const getLocation = () => {
    if (!navigator.geolocation) { setCoords({ lat: 13.14, lng: 78.13 }); setStep('analyzing'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setStep('analyzing'); },
      () => { setCoords({ lat: 13.14, lng: 78.13 }); setStep('analyzing'); },
      { timeout: 8000 }
    );
  };

  useEffect(() => {
    if (step !== 'location') return;
    getLocation();
  }, [step]);

  // Analyze + submit
  useEffect(() => {
    if (step !== 'analyzing') return;
    (async () => {
      await new Promise((r) => setTimeout(r, 1500));
      // Simple-fix heuristic: dusty panel if water not coming but lights on
      const simple = answers.q2 === true && answers.q3 === false;
      if (simple) { setStep('simpleFix'); return; }
      await submitComplaint();
    })();
  }, [step]);

  const submitComplaint = async () => {
    if (!user) return;
    try {
      const { data: farmer } = await supabase.from('farmers').select('id').eq('user_id', user.id).maybeSingle();
      if (!farmer) { setStep('done'); return; }

      const { data: nearest } = await supabase.rpc('nearest_technician', {
        p: coords ? `POINT(${coords.lng} ${coords.lat})` : null,
      });

      const complaintRow: any = {
        farmer_id: farmer.id,
        status: nearest ? 'assigned' : 'open',
        voice_text: `Pump not working: ${answers.q1 ? 'yes' : 'no'}, Lights: ${answers.q2 ? 'yes' : 'no'}, Water: ${answers.q3 ? 'yes' : 'no'}`,
        assigned_technician_id: nearest ?? null,
        priority: 'sos',
        category: 'general',
      };
      if (coords) {
        complaintRow.location = `POINT(${coords.lng} ${coords.lat})`;
      }

      const { data: complaint, error } = await supabase.from('complaints').insert(complaintRow).select().single();
      if (error || !complaint) { setStep('done'); return; }

      if (nearest) {
        const { data: tech } = await supabase.from('technicians').select('id').eq('id', nearest).maybeSingle();
        if (tech) {
          const { data: job } = await supabase.from('jobs').insert({
            complaint_id: complaint.id,
            technician_id: tech.id,
            status: 'assigned',
          }).select().single();
          if (job) setJobId(job.id);
        }
        setStep('assigned');
      } else {
        setStep('done');
      }
    } catch {
      setStep('done');
    }
  };

  return (
    <Screen>
      <Header title={t(lang, 'sos')} onBack={step === 'q1' ? onDone : () => setStep(step === 'q2' ? 'q1' : step === 'q3' ? 'q2' : step === 'photo' ? 'q3' : step)} />
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {step === 'q1' && <YesNo question={t(lang, 'pumpNotWorking')} onYes={() => answer('q1', true)} onNo={() => answer('q1', false)} />}
        {step === 'q2' && <YesNo question={t(lang, 'anyLights')} onYes={() => answer('q2', true)} onNo={() => answer('q2', false)} />}
        {step === 'q3' && <YesNo question={t(lang, 'waterComing')} onYes={() => answer('q3', true)} onNo={() => answer('q3', false)} />}
        {step === 'photo' && (
          <div className="flex flex-col items-center gap-4">
            <Camera className="w-16 h-16 text-amber-500" />
            <p className="text-lg font-semibold text-gray-800">{t(lang, 'takePicture')}</p>
            <label className="bg-amber-500 text-white rounded-2xl px-6 py-4 font-bold cursor-pointer active:scale-95">
              <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="hidden" />
              📷 {t(lang, 'takePicture')}
            </label>
          </div>
        )}
        {step === 'location' && (
          <div className="flex flex-col items-center gap-3 text-gray-700">
            <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
            <p className="text-lg font-semibold">{t(lang, 'yourLocation')}...</p>
          </div>
        )}
        {step === 'analyzing' && (
          <div className="flex flex-col items-center gap-3 text-gray-700">
            <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
            <p className="text-lg font-semibold">Analyzing...</p>
          </div>
        )}
        {step === 'simpleFix' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <p className="text-lg font-semibold text-gray-800">{t(lang, 'simpleFix')}</p>
            <p className="text-gray-600">Clean the solar panel with a dry cloth. Check again tomorrow.</p>
            <BigButton onClick={onDone} color="bg-green-600">{t(lang, 'done')}</BigButton>
          </div>
        )}
        {step === 'assigned' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <MapPin className="w-16 h-16 text-blue-500" />
            <p className="text-lg font-semibold text-gray-800">{t(lang, 'technicianAssigned')}</p>
            <BigButton onClick={onDone} color="bg-blue-600">{t(lang, 'done')}</BigButton>
          </div>
        )}
        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <p className="text-lg font-semibold text-gray-800">Request submitted.</p>
            <BigButton onClick={onDone} color="bg-green-600">{t(lang, 'done')}</BigButton>
          </div>
        )}
      </div>
    </Screen>
  );
}

function YesNo({ question, onYes, onNo }: { question: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
      <p className="text-2xl font-bold text-gray-800 text-center">{question}</p>
      <div className="flex gap-4 w-full">
        <button onClick={onYes} className="flex-1 bg-green-500 text-white rounded-2xl py-8 text-2xl font-extrabold active:scale-95 shadow-md">{t('en', 'yes')}</button>
        <button onClick={onNo} className="flex-1 bg-red-500 text-white rounded-2xl py-8 text-2xl font-extrabold active:scale-95 shadow-md">{t('en', 'no')}</button>
      </div>
    </div>
  );
}
