import React, { useState, useMemo } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface ObsOverlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: string;
}

export const ObsOverlayModal: React.FC<ObsOverlayModalProps> = ({
  isOpen,
  onClose,
  room,
}) => {
  const [subLanguage, setSubLanguage] = useState<'es-tr' | 'en-or' | 'pt-tr' | 'dual'>('es-tr');
  const [textColor, setTextColor] = useState<'white' | 'yellow' | 'black'>('white');
  const [copied, setCopied] = useState<boolean>(false);

  // Generate URL for OBS / vMix Browser Source (Fondo 100% transparente, solo texto)
  const overlayUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}/overlay`;
    const params = new URLSearchParams();
    if (room) params.set('room', room);
    params.set('subtitles', subLanguage);
    params.set('theme', textColor);
    params.set('pos', 'bottom');
    params.set('badge', 'false');

    return `${base}?${params.toString()}`;
  }, [room, subLanguage, textColor]);

  const handleCopy = () => {
    void navigator.clipboard.writeText(overlayUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md font-sans animate-in fade-in duration-150 select-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stream-overlay-title"
        className="w-full max-w-lg bg-[#09090d] border border-zinc-800/90 rounded-lg p-5 sm:p-6 space-y-4 shadow-2xl shadow-black/90 font-mono"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            <h2 id="stream-overlay-title" className="text-sm font-bold text-white font-mono tracking-wider uppercase">
              Broadcast Overlay
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 cursor-pointer rounded-xs hover:bg-zinc-800/60"
            title="Close"
          >
            <span className="font-mono text-xs font-bold px-1.5">[ESC]</span>
          </button>
        </div>

        {/* Form: Stage, Language & Text Color */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-zinc-400 block font-medium">
              Stage
            </label>
            <div className="w-full bg-zinc-900/90 border border-zinc-800/90 px-2.5 py-2 text-zinc-100 text-xs font-mono rounded-xs truncate">
              {room ? room.toUpperCase() : 'NO STAGE'}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-mono text-zinc-400 block font-medium" htmlFor="overlay-language">
              Language
            </label>
            <select
              id="overlay-language"
              value={subLanguage}
              onChange={(e) => setSubLanguage(e.target.value as any)}
              className="w-full bg-zinc-900/90 border border-zinc-800/90 hover:border-zinc-700 px-2 py-2 text-zinc-100 text-xs font-mono rounded-xs outline-none focus:border-amber-500 cursor-pointer transition-colors"
            >
              <option value="es-tr" className="bg-zinc-950 text-zinc-200">Spanish (ES)</option>
              <option value="dual" className="bg-zinc-950 text-zinc-200">Bilingual (Original + ES)</option>
              <option value="en-or" className="bg-zinc-950 text-zinc-200">English (EN)</option>
              <option value="pt-tr" className="bg-zinc-950 text-zinc-200">Portuguese (PT)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-mono text-zinc-400 block font-medium">
              Text Color
            </label>
            <select
              value={textColor}
              onChange={(e) => setTextColor(e.target.value as any)}
              className="w-full bg-zinc-900/90 border border-zinc-800/90 hover:border-zinc-700 px-2 py-2 text-zinc-100 text-xs font-mono rounded-xs outline-none focus:border-amber-500 cursor-pointer transition-colors font-bold text-amber-400"
            >
              <option value="white" className="bg-zinc-950 text-white font-bold">White (Blanco)</option>
              <option value="yellow" className="bg-zinc-950 text-amber-400 font-bold">Yellow (Amarillo)</option>
              <option value="black" className="bg-zinc-950 text-zinc-400 font-bold">Black (Negro)</option>
            </select>
          </div>
        </div>

        {/* Live Overlay Preview (Sin fondo, texto flotante directo) */}
        <div className="p-4 bg-zinc-950 border border-zinc-800/80 rounded-xs h-24 flex items-center justify-center relative overflow-hidden">
          <div className="absolute top-1.5 left-2.5 text-[9px] font-mono text-zinc-600 uppercase tracking-wider">
            Live Preview (Transparent Background)
          </div>
          <div
            className={`font-sans font-bold text-sm sm:text-base text-center transition-colors ${
              textColor === 'yellow'
                ? 'text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] drop-shadow-[0_0_10px_rgba(0,0,0,0.95)]'
                : textColor === 'black'
                ? 'text-zinc-950 drop-shadow-[0_1px_3px_rgba(255,255,255,0.9)]'
                : 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,1)] drop-shadow-[0_0_10px_rgba(0,0,0,0.95)]'
            }`}
          >
            {subLanguage === 'en-or'
              ? 'Welcome to the live conference session.'
              : subLanguage === 'pt-tr'
              ? 'Bem-vindos à palestra ao vivo.'
              : 'Bienvenidos a la conferencia en vivo.'}
          </div>
        </div>

        {/* Row 3: Direct Link & Copy */}
        <div className="space-y-2 pt-2 border-t border-zinc-800/80">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="font-bold text-zinc-300 uppercase tracking-wider">
              Browser Source URL
            </span>
            <a
              href={overlayUrl}
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
            >
              <span>Test link</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={overlayUrl}
              aria-label="Stream overlay link"
              className="flex-1 min-w-0 bg-zinc-900/90 border border-zinc-800/90 text-zinc-300 text-xs px-3 py-2 rounded-xs select-all focus:outline-none font-mono"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`px-4 py-2 font-extrabold text-xs uppercase rounded-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/20'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer info & Cancel */}
        <div className="flex items-center justify-between pt-2 text-[11px] text-zinc-500 border-t border-zinc-800/80">
          <span>In OBS: Browser Source · 1920 × 1080</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs uppercase cursor-pointer rounded-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
