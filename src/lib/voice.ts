import { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API wrapper. Browser-native, no external dependency.
// Works best in Chrome/Edge. Gracefully degrades where unsupported.

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognition(): SpeechRecognitionLike | null {
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function useVoice(lang: string) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const r = getRecognition();
    if (!r) {
      setSupported(false);
      return;
    }
    r.continuous = false;
    r.interimResults = true;
    r.onresult = (e: any) => {
      let txt = '';
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setTranscript(txt);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recRef.current = r;
    return () => {
      try { r.stop(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (recRef.current) {
      // Map our lang codes to BCP-47
      const map: Record<string, string> = { en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN', ta: 'ta-IN' };
      recRef.current.lang = map[lang] ?? 'en-IN';
    }
  }, [lang]);

  const start = useCallback(() => {
    setTranscript('');
    const r = recRef.current;
    if (!r) return;
    try { r.start(); setListening(true); } catch {}
  }, []);

  const stop = useCallback(() => {
    const r = recRef.current;
    if (!r) return;
    try { r.stop(); } catch {}
    setListening(false);
  }, []);

  return { listening, transcript, supported, start, stop, setTranscript };
}

export function speak(text: string, lang: string) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  const map: Record<string, string> = { en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN', ta: 'ta-IN' };
  u.lang = map[lang] ?? 'en-IN';
  u.rate = 0.9;
  try { window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch {}
}
