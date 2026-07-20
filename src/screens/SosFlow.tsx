import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { t } from '../lib/i18n';
import { BigButton, Header, Screen } from '../lib/ui';
import { Camera, Mic, CheckCircle2, Play, Square, Send, RotateCcw, Image as ImageIcon } from 'lucide-react';

type Step = 'choose' | 'photo' | 'voice' | 'sending' | 'done';
type FarmerRecord = { id: string };

export default function SosFlow({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const lang = user?.language ?? 'en';
  const [step, setStep] = useState<Step>('choose');

  // Photo state
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Voice state
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max = 800;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });

  const onPhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setPhotoData(compressed);
    setPhotoPreview(compressed);
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((tr) => tr.stop());
      };
      mr.start();
      mediaRecRef.current = mr;
      setRecording(true);
    } catch {
      setRecording(false);
    }
  };

  const stopRec = () => {
    mediaRecRef.current?.stop();
    setRecording(false);
  };

  const playAudio = () => {
    if (!audioUrl) return;
    if (!audioElRef.current) audioElRef.current = new Audio(audioUrl);
    audioElRef.current.onended = () => setPlaying(false);
    audioElRef.current.play();
    setPlaying(true);
  };

  const stopAudio = () => {
    audioElRef.current?.pause();
    audioElRef.current = null;
    setPlaying(false);
  };

  const uploadFile = async (bucketPath: string, data: Blob, contentType: string) => {
    const { data: up, error } = await supabase.storage.from('media').upload(bucketPath, data, { contentType, upsert: true });
    if (error) throw error;
    return supabase.storage.from('media').getPublicUrl(up.path).data.publicUrl;
  };

  const sendPhoto = async () => {
    if (!photoData || !user) return;
    setStep('sending');
    try {
      const blob = await (await fetch(photoData)).blob();
      const path = `photos/${user.id}-${Date.now()}.jpg`;
      const imageUrl = await uploadFile(path, blob, 'image/jpeg');
      await createComplaint({ image_url: imageUrl, voice_text: 'Photo complaint' });
      setStep('done');
    } catch { setStep('done'); }
  };

  const sendVoice = async () => {
    if (!audioBlob || !user) return;
    setStep('sending');
    try {
      const path = `voice/${user.id}-${Date.now()}.webm`;
      const voiceUrl = await uploadFile(path, audioBlob, 'audio/webm');
      await createComplaint({ voice_url: voiceUrl, voice_text: 'Voice complaint' });
      setStep('done');
    } catch { setStep('done'); }
  };

  const createComplaint = async (extra: { image_url?: string; voice_url?: string; voice_text: string }) => {
    const { data: farmer } = await supabase.from('farmers').select('id').eq('user_id', user!.id).maybeSingle();
    if (!farmer) return;
    const row: Record<string, unknown> = {
      farmer_id: (farmer as FarmerRecord).id,
      status: 'open',
      priority: 'sos',
      category: 'general',
      voice_text: extra.voice_text,
    };
    if (extra.image_url) row.image_url = extra.image_url;
    if (extra.voice_url) row.voice_url = extra.voice_url;
    await supabase.from('complaints').insert(row);
  };

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  return (
    <Screen>
      <Header title={t(lang, 'sos')} onBack={step === 'choose' ? onDone : () => setStep('choose')} />
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">

        {step === 'choose' && (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            <p className="text-lg font-semibold text-gray-800 text-center">{t(lang, 'howHelp')}</p>
            <BigButton onClick={() => setStep('photo')} color="bg-blue-600">
              <span className="flex items-center justify-center gap-2"><Camera className="w-6 h-6" /> {t(lang, 'uploadPicture')}</span>
            </BigButton>
            <BigButton onClick={() => setStep('voice')} color="bg-amber-500">
              <span className="flex items-center justify-center gap-2"><Mic className="w-6 h-6" /> {t(lang, 'recordVoice')}</span>
            </BigButton>
          </div>
        )}

        {step === 'photo' && (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            <p className="text-lg font-semibold text-gray-800">{t(lang, 'uploadPicture')}</p>
            {photoPreview ? (
              <img src={photoPreview} alt="preview" className="w-full max-w-xs rounded-2xl shadow-md" />
            ) : (
              <label className="w-full max-w-xs h-48 border-2 border-dashed border-amber-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer bg-amber-50 active:scale-95">
                <ImageIcon className="w-10 h-10 text-amber-400" />
                <span className="text-sm text-gray-500">{t(lang, 'uploadPicture')}</span>
                <input type="file" accept="image/*" capture="environment" onChange={onPhotoSelect} className="hidden" />
              </label>
            )}
            {photoPreview && (
              <div className="flex gap-3 w-full">
                <button onClick={() => { setPhotoPreview(null); setPhotoData(null); }} className="flex-1 bg-gray-200 text-gray-700 rounded-2xl py-3 font-bold flex items-center justify-center gap-1 active:scale-95">
                  <RotateCcw className="w-5 h-5" /> {t(lang, 'retake')}
                </button>
                <button onClick={sendPhoto} disabled={!photoData} className="flex-1 bg-green-600 text-white rounded-2xl py-3 font-bold flex items-center justify-center gap-1 active:scale-95 disabled:opacity-50">
                  <Send className="w-5 h-5" /> {t(lang, 'send')}
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'voice' && (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            <p className="text-lg font-semibold text-gray-800">{t(lang, 'recordVoice')}</p>
            <button onClick={recording ? stopRec : startRec} className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform ${recording ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}>
              {recording ? <Square className="w-10 h-10 text-white" /> : <Mic className="w-12 h-12 text-white" />}
            </button>
            <p className="text-sm text-gray-500">{recording ? t(lang, 'stopRecording') : t(lang, 'startRecording')}</p>
            {audioUrl && !recording && (
              <div className="flex flex-col items-center gap-3 w-full">
                <p className="text-sm font-semibold text-gray-700">{t(lang, 'preview')}</p>
                <div className="flex gap-3 w-full">
                  <button onClick={playing ? stopAudio : playAudio} className="flex-1 bg-blue-100 text-blue-700 rounded-2xl py-3 font-bold flex items-center justify-center gap-1 active:scale-95">
                    {playing ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />} {playing ? t(lang, 'stop') : t(lang, 'play')}
                  </button>
                  <button onClick={() => { setAudioBlob(null); setAudioUrl(null); stopAudio(); }} className="flex-1 bg-gray-200 text-gray-700 rounded-2xl py-3 font-bold flex items-center justify-center gap-1 active:scale-95">
                    <RotateCcw className="w-5 h-5" /> {t(lang, 'reRecord')}
                  </button>
                </div>
                <button onClick={sendVoice} disabled={!audioBlob} className="w-full bg-green-600 text-white rounded-2xl py-4 font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50">
                  <Send className="w-5 h-5" /> {t(lang, 'send')}
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'sending' && (
          <div className="flex flex-col items-center gap-3 text-gray-700">
            <div className="w-12 h-12 border-4 border-amber-300 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-lg font-semibold">{t(lang, 'sending')}</p>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <p className="text-lg font-semibold text-gray-800">{t(lang, 'pictureSent')}</p>
            <BigButton onClick={onDone} color="bg-green-600">{t(lang, 'done')}</BigButton>
          </div>
        )}
      </div>
    </Screen>
  );
}
