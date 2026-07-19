import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Screen } from '../lib/ui';
import { Sun, Check } from 'lucide-react';

const LANGS = [
  { code: 'kn', label: 'ಕನ್ನಡ', sub: 'Kannada' },
  { code: 'te', label: 'తెలుగు', sub: 'Telugu' },
  { code: 'ta', label: 'தமிழ்', sub: 'Tamil' },
  { code: 'hi', label: 'हिन्दी', sub: 'Hindi' },
  { code: 'en', label: 'English', sub: 'English' },
];

export default function FarmerLanguage({ onDone }: { onDone: () => void }) {
  const { setLang } = useAuth();
  const [picked, setPicked] = useState<string | null>(null);

  const choose = (code: string) => {
    setPicked(code);
    setLang(code);
  };

  return (
    <Screen className="items-center justify-center px-6">
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
            <Sun className="w-12 h-12 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-extrabold text-amber-600 tracking-tight">SuryaSetu</h1>
          <p className="text-gray-700 text-lg font-semibold text-center">Choose your language</p>
          <p className="text-gray-500 text-sm text-center">ಕನ್ನಡ · తెలుగు · தமிழ் · हिन्दी · English</p>
        </div>

        <div className="w-full flex flex-col gap-3">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => choose(l.code)}
              className={`w-full rounded-2xl py-5 px-6 flex items-center justify-between min-h-[72px] active:scale-95 transition-transform shadow-sm border-2 ${picked === l.code ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-gray-800 border-amber-200'}`}
            >
              <span className="flex flex-col items-start">
                <span className="text-2xl font-bold leading-tight">{l.label}</span>
                <span className={`text-sm ${picked === l.code ? 'text-white/80' : 'text-gray-500'}`}>{l.sub}</span>
              </span>
              {picked === l.code && <Check className="w-7 h-7" />}
            </button>
          ))}
        </div>

        <button
          onClick={onDone}
          disabled={!picked}
          className="w-full bg-green-600 text-white rounded-2xl py-5 text-xl font-extrabold min-h-[64px] active:scale-95 transition-transform shadow-md disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </Screen>
  );
}
