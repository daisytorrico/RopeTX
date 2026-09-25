import React from 'react';
import { Languages, Sparkles } from 'lucide-react';

export type SpeakerLang = 'auto' | 'es' | 'en' | 'pt';

interface SpeakerLangSelectorProps {
  value: SpeakerLang;
  onChange: (lang: SpeakerLang) => void;
  size?: 'sm' | 'md';
}

const LANGUAGES: { id: SpeakerLang; label: string; short: string }[] = [
  { id: 'auto', label: 'Auto Detect', short: 'AUTO' },
  { id: 'es', label: 'Spanish', short: 'ES' },
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'pt', label: 'Portuguese', short: 'PT' },
];

export const SpeakerLangSelector: React.FC<SpeakerLangSelectorProps> = ({
  value,
  onChange,
  size = 'md',
}) => {
  if (size === 'sm') {
    return (
      <div className="flex items-center justify-between w-full">
        <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Speaker:</span>
        <div className="inline-flex p-0.5 bg-zinc-950 border border-zinc-800/90 rounded-xs">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onChange(l.id)}
              className={`px-2 py-0.5 text-[10px] font-mono font-bold transition-all uppercase rounded-xs cursor-pointer ${
                value === l.id
                  ? 'bg-zinc-800 text-amber-400 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title={`Speaker Language: ${l.label}`}
            >
              {l.short}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-1.5 pt-1">
      {LANGUAGES.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => onChange(l.id)}
          className={`py-1.5 px-2 text-xs font-bold border transition-colors cursor-pointer flex items-center justify-center gap-1 rounded-xs ${
            value === l.id
              ? 'bg-orange-500 text-black border-orange-400 font-extrabold'
              : 'bg-black text-zinc-400 border-zinc-800 hover:border-zinc-700'
          }`}
        >
          {l.id === 'auto' ? <Sparkles className="w-3.5 h-3.5" /> : <Languages className="w-3.5 h-3.5" />}
          <span>{l.short}</span>
        </button>
      ))}
    </div>
  );
};
