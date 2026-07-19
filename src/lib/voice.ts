import { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API wrapper. Browser-native, no external dependency.
// Works best in Chrome/Edge. Gracefully degrades where unsupported.

type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionResultsLike = {
  length: number;
  [index: number]: { [index: number]: SpeechRecognitionResultLike };
};
type SpeechRecognitionEventLike = { results: SpeechRecognitionResultsLike };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechRecognitionWindow = Window & typeof globalThis & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function getRecognition(): SpeechRecognitionLike | null {
  const speechWindow = window as SpeechRecognitionWindow;
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  return Recognition ? new Recognition() : null;
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
    r.onresult = (event) => {
      let txt = '';
      for (let i = 0; i < event.results.length; i++) txt += event.results[i][0].transcript;
      setTranscript(txt);
    };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recRef.current = r;
    return () => {
      try { r.stop(); } catch { /* Recognition may already be stopped. */ }
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
    try { r.start(); setListening(true); } catch { /* Recognition may already be running. */ }
  }, []);

  const stop = useCallback(() => {
    const r = recRef.current;
    if (!r) return;
    try { r.stop(); } catch { /* Recognition may already be stopped. */ }
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
  try { window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch { /* Speech synthesis can be unavailable at runtime. */ }
}
