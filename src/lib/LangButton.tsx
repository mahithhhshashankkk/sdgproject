import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { t } from '../lib/i18n';
import { Check, Globe, X } from 'lucide-react';

const LANGS = [
  { code: 'kn', label: 'ಕನ್ನಡ', sub: 'Kannada' },
  { code: 'te', label: 'తెలుగు', sub: 'Telugu' },
  { code: 'ta', label: 'தமிழ்', sub: 'Tamil' },
  { code: 'hi', label: 'हिन्दी', sub: 'Hindi' },
  { code: 'en', label: 'English', sub: 'English' },
];

export const LANG_BADGE: Record<string, string> = { en: 'EN', kn: 'ಕನ', te: 'తె', hi: 'हि', ta: 'த' };

export function LangButton({ className = '' }: { className?: string }) {
  const { user, setLang } = useAuth();
  const lang = user?.language ?? 'en';
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className={`px-3 h-10 flex items-center gap-1.5 justify-center rounded-full bg-white/20 text-sm font-semibold active:scale-95 ${className}`}>
        <Globe className="w-4 h-4" />
        {LANG_BADGE[lang] ?? 'EN'}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">{t(lang, 'chooseLanguage')}</h2>
              <button onClick={() => setOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="flex flex-col gap-2">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => { setLang(l.code); setOpen(false); }}
                  className={`w-full rounded-2xl py-4 px-5 flex items-center justify-between active:scale-95 transition-transform border-2 ${lang === l.code ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-gray-800 border-amber-200'}`}
                >
                  <span className="flex flex-col items-start">
                    <span className="text-xl font-bold leading-tight">{l.label}</span>
                    <span className={`text-sm ${lang === l.code ? 'text-white/80' : 'text-gray-500'}`}>{l.sub}</span>
                  </span>
                  {lang === l.code && <Check className="w-6 h-6" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
