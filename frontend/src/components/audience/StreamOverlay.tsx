/**
 * StreamOverlay — Capa de subtítulos de producción para OBS Studio / vMix / Streamlabs
 *
 * Uso como Browser Source:
 *   http://localhost:5173/overlay?room=SALA&subtitles=es-tr&theme=dark&size=lg&pos=bottom&timeout=6
 *
 * Parámetros de URL:
 *   subtitles  es-tr | en-or | pt-tr        (idioma de subtítulos)
 *   theme      dark | clean | lowerthird | glass | neon (tema visual)
 *   size       sm | md | lg | xl             (tamaño de texto)
 *   pos        bottom | top | middle         (posición vertical)
 *   maxlines   1 | 2 | 3                    (líneas visibles, default 2)
 *   animate    slide | fade | none           (tipo de animación)
 *   timeout    segundos de inactividad antes de ocultar (default 6, 0 = nunca)
 *   align      center | left                 (alineación del texto)
 *   badge      true | false                  (mostrar badge de estado)
 */
import React, { useEffect, useRef, useState } from 'react';
import { type Subtitle, getSubtitleContent } from '../../types';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type Theme = 'dark' | 'clean' | 'clean-light' | 'white' | 'yellow' | 'black' | 'lowerthird' | 'glass' | 'neon' | 'light';
export type Size  = 'sm' | 'md' | 'lg' | 'xl';
export type Pos   = 'bottom' | 'top' | 'middle';
export type Anim  = 'slide' | 'fade' | 'none';
export type Align = 'center' | 'left';

export interface StreamOverlayProps {
  subtitles: Subtitle[];
  language?: string;
  theme?: Theme;
  size?: Size;
  pos?: Pos;
  maxLines?: number;
  animate?: Anim;
  room?: string;
  timeoutSec?: number;
  align?: Align;
  showBadge?: boolean;
}

// ─── Configuración visual por tema (Sin fondo, texto flotante de alta legibilidad) ───

const THEMES: Record<string, {
  container: string;
  box: string;
  text: string;
  interim: string;
  shadow: string;
  dot: string;
}> = {
  white: {
    container: '',
    box: 'bg-transparent border-none max-w-3xl md:max-w-4xl px-4 py-2 text-center',
    text: 'text-white font-bold tracking-normal drop-shadow-[0_2px_4px_rgba(0,0,0,1)] drop-shadow-[0_0_10px_rgba(0,0,0,0.95)]',
    interim: 'text-zinc-200 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]',
    shadow: '',
    dot: 'bg-amber-500',
  },
  clean: {
    container: '',
    box: 'bg-transparent border-none max-w-3xl md:max-w-4xl px-4 py-2 text-center',
    text: 'text-white font-bold tracking-normal drop-shadow-[0_2px_4px_rgba(0,0,0,1)] drop-shadow-[0_0_10px_rgba(0,0,0,0.95)]',
    interim: 'text-zinc-200 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]',
    shadow: '',
    dot: 'bg-amber-500',
  },
  yellow: {
    container: '',
    box: 'bg-transparent border-none max-w-3xl md:max-w-4xl px-4 py-2 text-center',
    text: 'text-amber-300 font-bold tracking-normal drop-shadow-[0_2px_4px_rgba(0,0,0,1)] drop-shadow-[0_0_10px_rgba(0,0,0,0.95)]',
    interim: 'text-amber-200/80 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]',
    shadow: '',
    dot: 'bg-amber-400',
  },
  black: {
    container: '',
    box: 'bg-transparent border-none max-w-3xl md:max-w-4xl px-4 py-2 text-center',
    text: 'text-zinc-950 font-bold tracking-normal drop-shadow-[0_1px_3px_rgba(255,255,255,0.9)]',
    interim: 'text-zinc-700',
    shadow: '',
    dot: 'bg-zinc-950',
  },
  'clean-light': {
    container: '',
    box: 'bg-transparent border-none max-w-3xl md:max-w-4xl px-4 py-2 text-center',
    text: 'text-zinc-950 font-bold tracking-normal drop-shadow-[0_1px_3px_rgba(255,255,255,0.9)]',
    interim: 'text-zinc-700',
    shadow: '',
    dot: 'bg-zinc-950',
  },
  dark: {
    container: '',
    box: 'bg-black/85 backdrop-blur-xs border border-white/10 rounded-sm shadow-[0_4px_24px_rgba(0,0,0,0.85)] px-5 py-2.5 max-w-3xl md:max-w-4xl inline-block text-center',
    text: 'text-white font-medium tracking-normal',
    interim: 'text-zinc-300',
    shadow: 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]',
    dot: 'bg-amber-500',
  },
  lowerthird: {
    container: 'left-0 right-0 bottom-0 !px-0',
    box: 'w-full max-w-none bg-gradient-to-r from-zinc-950/95 via-zinc-900/95 to-zinc-950/95 border-t-2 border-amber-500 rounded-none shadow-[0_-8px_30px_rgba(0,0,0,0.9)] px-8 md:px-16 py-3.5 text-center',
    text: 'text-white font-medium tracking-normal',
    interim: 'text-zinc-300',
    shadow: 'drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]',
    dot: 'bg-amber-500',
  },
  glass: {
    container: '',
    box: 'bg-white/10 backdrop-blur-md border border-white/20 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.7)] px-6 py-3 max-w-3xl md:max-w-4xl text-center',
    text: 'text-white font-medium',
    interim: 'text-white/80',
    shadow: 'drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]',
    dot: 'bg-amber-400',
  },
  neon: {
    container: '',
    box: 'bg-black/90 border border-[#00ff87]/30 rounded-lg shadow-[0_0_20px_rgba(0,255,135,0.3)] px-6 py-3 max-w-3xl md:max-w-4xl text-center',
    text: 'text-[#00ff87] font-semibold',
    interim: 'text-[#00cc6a]',
    shadow: 'drop-shadow-[0_0_12px_rgba(0,255,135,0.5)]',
    dot: 'bg-[#00ff87]',
  },
  light: {
    container: '',
    box: 'bg-white/95 border border-zinc-300 rounded-md shadow-[0_4px_20px_rgba(0,0,0,0.25)] px-6 py-3 max-w-3xl md:max-w-4xl text-center',
    text: 'text-zinc-950 font-medium',
    interim: 'text-zinc-600',
    shadow: 'drop-shadow-[0_1px_4px_rgba(0,0,0,0.15)]',
    dot: 'bg-amber-600',
  },
};

// ─── Configuración de tamaños calibrados a estándares de broadcast ─────────────

const SIZES: Record<Size, { text: string; subText: string }> = {
  sm: { text: 'text-base md:text-lg',   subText: 'text-xs md:text-sm' },
  md: { text: 'text-lg md:text-xl',     subText: 'text-sm md:text-base' },
  lg: { text: 'text-xl md:text-2xl',    subText: 'text-base md:text-lg' },
  xl: { text: 'text-2xl md:text-3xl',   subText: 'text-lg md:text-xl' },
};

// ─── Posiciones verticales ────────────────────────────────────────────────────

const POSITIONS: Record<Pos, string> = {
  bottom: 'bottom-6 md:bottom-10',
  top:    'top-6 md:top-10',
  middle: 'top-1/2 -translate-y-1/2',
};

// ─── Lógica de selección de texto multitrack ────────────────────────────────
function selectText(subtitle: Subtitle, language: string): string {
  return getSubtitleContent(subtitle, language);
}

// ─── Componente principal ─────────────────────────────────────────────────────

export const StreamOverlay: React.FC<StreamOverlayProps> = ({
  subtitles,
  language = 'es-tr',
  theme    = 'dark',
  size     = 'lg',
  pos      = 'bottom',
  maxLines = 2,
  animate  = 'fade',
  room     = '',
  timeoutSec = 6,
  align    = 'center',
  showBadge,
}) => {
  const th   = THEMES[theme] ?? THEMES.dark;
  const sz   = SIZES[size]   ?? SIZES.lg;
  const yPos = theme === 'lowerthird' ? '' : (POSITIONS[pos] ?? POSITIONS.bottom);

  // Filtrar subtítulos que tienen contenido válido
  const validLines = subtitles
    .filter((s) => Boolean(selectText(s, language)))
    .slice(-maxLines);

  const lastSub   = validLines[validLines.length - 1];
  const lastText  = lastSub ? selectText(lastSub, language) : '';
  const isInterim = lastSub ? !lastSub.is_final : false;
  const hasData   = Boolean(lastText);

  // ── Auto-clear / Inactivity Fade-out ────────────────────────────────────────
  // En transmisiones en vivo, cuando el orador hace silencio, los subtítulos deben
  // desaparecer suavemente para no dejar texto congelado en pantalla.
  const [isTimedOut, setIsTimedOut] = useState<boolean>(false);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasData) return;

    // Reset timeout en cada cambio de texto
    setIsTimedOut(false);

    if (timeoutSec > 0) {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = setTimeout(() => {
        setIsTimedOut(true);
      }, timeoutSec * 1000);
    }

    return () => {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    };
  }, [lastText, timeoutSec, hasData]);

  // Si no hay datos, o se ocultó por timeout
  const isVisible = hasData && !isTimedOut;

  // Determinar si se muestra el badge
  const displayBadge = showBadge !== undefined
    ? showBadge
    : (theme !== 'clean' && Boolean(room));

  const textAlignClass = align === 'left' ? 'text-left' : 'text-center';
  const flexAlignClass = align === 'left' ? 'items-start' : 'items-center';

  return (
    <div
      className={`fixed left-0 right-0 ${yPos} ${th.container} flex ${align === 'left' ? 'justify-start md:pl-16' : 'justify-center'} px-6 pointer-events-none select-none z-50 transition-all duration-500 ease-out ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
      }`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={`
          w-full ${th.box}
          transition-all duration-300 ease-out
          ${animate === 'slide'
            ? isVisible
              ? 'translate-y-0 opacity-100'
              : 'translate-y-4 opacity-0'
            : animate === 'fade'
            ? isVisible ? 'opacity-100' : 'opacity-0'
            : 'opacity-100'
          }
        `}
      >
        {/* Badge superior de broadcast (en temas con caja) */}
        {displayBadge && (
          <div className={`flex items-center gap-2 mb-2 pb-1.5 border-b ${theme === 'light' ? 'border-zinc-200' : 'border-white/10'} ${align === 'left' ? 'justify-start' : 'justify-between'}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${th.dot} ${isInterim ? 'animate-pulse' : ''}`} />
              <span className={`text-[10px] font-mono font-bold tracking-widest uppercase ${theme === 'light' ? 'text-zinc-600' : 'text-white/60'}`}>
                {isInterim ? 'LIVE TRANSCRIBING' : 'LIVE'} · {room.toUpperCase()}
              </span>
            </div>
            <span className={`text-[10px] font-mono tracking-widest uppercase px-1.5 py-0.5 rounded ${theme === 'light' ? 'bg-zinc-200 text-zinc-700' : 'bg-white/10 text-white/70'}`}>
              {language === 'en-or' ? 'EN' : language === 'pt-tr' ? 'PT' : 'ES'}
            </span>
          </div>
        )}

        {/* Líneas de subtítulos */}
        <div className={`flex flex-col gap-1.5 ${flexAlignClass} font-sans`}>
          {/* Líneas anteriores visibles */}
          {validLines.slice(0, -1).map((sub) => {
            const t = selectText(sub, language);
            if (!t) return null;
            return (
              <p
                key={sub.id}
                className={`
                  leading-snug font-medium tracking-normal
                  ${sz.subText} ${th.interim} ${th.shadow} ${textAlignClass}
                  opacity-75 transition-all duration-200
                `}
              >
                {t}
              </p>
            );
          })}

          {/* Línea activa actual */}
          {lastText && (
            lastText.includes('\n') ? (
              <div className="space-y-0.5">
                <p
                  className={`
                    leading-snug font-normal tracking-normal
                    ${sz.subText} ${th.interim} ${th.shadow} ${textAlignClass}
                    opacity-80
                  `}
                >
                  {lastText.split('\n')[0]}
                </p>
                <p
                  className={`
                    leading-snug font-semibold tracking-normal
                    ${sz.text} ${isInterim ? th.interim : th.text} ${th.shadow} ${textAlignClass}
                    transition-colors duration-200
                  `}
                >
                  {lastText.split('\n')[1]}
                </p>
              </div>
            ) : (
              <p
                className={`
                  leading-snug font-semibold tracking-normal
                  ${sz.text} ${isInterim ? th.interim : th.text} ${th.shadow} ${textAlignClass}
                  transition-colors duration-200
                `}
              >
                {lastText}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
};

