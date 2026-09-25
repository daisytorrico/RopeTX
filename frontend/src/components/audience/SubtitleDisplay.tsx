import React, { useState, useEffect, useRef } from 'react';
import { Maximize2, Minimize2, Radio } from 'lucide-react';
import { type Subtitle, getSubtitleContent } from '../../types';
import { getT, type UiLanguage } from '../../i18n';

export interface SubtitleDisplayProps {
  subtitles: Subtitle[];
  isConnected: boolean;
  isLive?: boolean;
  currentRoom: string;
  subtitleLanguage?: string;
  uiLanguage?: UiLanguage;
}

type FontSize = 'sm' | 'md' | 'lg' | 'xl';

export const SubtitleDisplay: React.FC<SubtitleDisplayProps> = ({
  subtitles,
  isConnected: _isConnected,
  isLive = false,
  currentRoom,
  subtitleLanguage = 'es-tr',
  uiLanguage = 'es',
}) => {
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    return (localStorage.getItem('ropetx_font_size') as FontSize) || 'lg';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const t = getT(uiLanguage);

  const fontSizesOrder: FontSize[] = ['sm', 'md', 'lg', 'xl'];

  const decreaseFontSize = () => {
    const currentIndex = fontSizesOrder.indexOf(fontSize);
    if (currentIndex > 0) {
      const next = fontSizesOrder[currentIndex - 1];
      setFontSize(next);
      try {
        localStorage.setItem('ropetx_font_size', next);
      } catch {}
    }
  };

  const increaseFontSize = () => {
    const currentIndex = fontSizesOrder.indexOf(fontSize);
    if (currentIndex < fontSizesOrder.length - 1) {
      const next = fontSizesOrder[currentIndex + 1];
      setFontSize(next);
      try {
        localStorage.setItem('ropetx_font_size', next);
      } catch {}
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    } catch {}
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Filtrar los subtítulos que realmente tienen contenido para el idioma seleccionado
  const visibleSubtitles = subtitles
    .map((sub, index) => ({
      sub,
      text: getSubtitleContent(sub, subtitleLanguage),
      isLastActive: index === subtitles.length - 1,
      isInterim: !sub.is_final,
    }))
    .filter((item) => item.text.length > 0);

  const hasVisibleSubtitles = visibleSubtitles.length > 0;

  // Auto-scroll suave y anclado al fondo
  useEffect(() => {
    if (scrollAnchorRef.current) {
      scrollAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [subtitles]);

  // Tipografía responsiva y consistente
  const fontStyles: Record<FontSize, { active: string; history: string; leading: string }> = {
    sm: {
      active: 'text-lg sm:text-xl md:text-2xl font-medium',
      history: 'text-sm sm:text-base md:text-lg font-normal',
      leading: 'leading-relaxed',
    },
    md: {
      active: 'text-xl sm:text-2xl md:text-3xl font-medium',
      history: 'text-base sm:text-lg md:text-xl font-normal',
      leading: 'leading-relaxed',
    },
    lg: {
      active: 'text-2xl sm:text-3xl md:text-4xl font-semibold',
      history: 'text-lg sm:text-xl md:text-2xl font-normal',
      leading: 'leading-snug',
    },
    xl: {
      active: 'text-3xl sm:text-4xl md:text-5xl font-bold',
      history: 'text-xl sm:text-2xl md:text-3xl font-normal',
      leading: 'leading-tight',
    },
  };

  const currentStyle = fontStyles[fontSize] || fontStyles.lg;

  return (
    <main className="relative flex flex-col flex-1 items-center justify-center px-4 sm:px-8 py-6 w-full max-w-5xl mx-auto min-h-[80dvh] select-text">
      {/* Botones de control discretos y flotantes (Sin ocupar espacio de cabecera) */}
      <div className="absolute top-2 right-2 sm:right-4 z-20 flex items-center bg-zinc-900/60 hover:bg-zinc-900/90 border border-zinc-800/80 rounded-full px-2 py-1 shadow-sm backdrop-blur-md transition-all select-none gap-1">
        <button
          type="button"
          onClick={decreaseFontSize}
          disabled={fontSize === 'sm'}
          className="h-6 px-1.5 text-xs font-mono font-bold text-zinc-400 hover:text-white disabled:opacity-25 transition-colors cursor-pointer"
          title="Reducir tamaño de letra"
        >
          A-
        </button>
        <span className="text-zinc-700 text-xs">|</span>
        <button
          type="button"
          onClick={increaseFontSize}
          disabled={fontSize === 'xl'}
          className="h-6 px-1.5 text-xs font-mono font-bold text-zinc-400 hover:text-white disabled:opacity-25 transition-colors cursor-pointer"
          title="Aumentar tamaño de letra"
        >
          A+
        </button>
        <span className="text-zinc-700 text-xs">|</span>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="h-6 w-6 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer rounded-full"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Escenario Central de Subtítulos */}
      <div className="w-full flex-1 flex flex-col justify-center my-auto py-8 sm:py-12">
        {!currentRoom ? (
          /* Estado: No hay sala seleccionada */
          <div className="flex flex-col items-center justify-center py-16 gap-3 select-none text-center px-4 animate-in fade-in duration-300">
            <Radio className="w-7 h-7 text-zinc-600 mb-1" />
            <p className="text-sm font-mono text-zinc-400">{t.noActiveRoom}</p>
          </div>
        ) : !hasVisibleSubtitles ? (
          /* Estado: Sala conectada esperando audio */
          <div className="flex flex-col items-center justify-center py-16 gap-3 select-none text-center px-4 animate-in fade-in duration-300">
            <div className={`w-12 h-12 rounded-full border flex items-center justify-center mb-1 shadow-inner ${
              isLive
                ? 'bg-amber-950/20 border-amber-500/40 text-amber-400'
                : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }`}>
              <Radio className={`w-5 h-5 ${isLive ? 'text-amber-400 animate-pulse' : 'text-zinc-500'}`} />
            </div>
            <p className={`text-xs font-mono uppercase tracking-widest font-medium ${
              isLive ? 'text-amber-400/90' : 'text-zinc-500'
            }`}>
              {isLive
                ? '● TRANSMISIÓN EN VIVO // ESCUCHANDO AL ORADOR...'
                : (t.waitingTitle || 'EN ESPERA // LISTENING TO STAGE')}
            </p>
          </div>
        ) : (
          /* Estado: Subtítulos en Vivo */
          <div className="w-full flex flex-col justify-end space-y-5 sm:space-y-7">
            {visibleSubtitles.map(({ sub, text, isLastActive, isInterim }) => (
              <div
                key={sub.id}
                className={`transition-all duration-300 ease-out ${
                  isLastActive
                    ? 'opacity-100 transform translate-y-0'
                    : 'opacity-40 hover:opacity-75 transform -translate-y-0.5'
                }`}
              >
                {text.includes('\n') ? (
                  <div className="space-y-1">
                    <p className="text-zinc-400/80 text-sm sm:text-base md:text-lg font-normal tracking-tight font-sans">
                      {text.split('\n')[0]}
                    </p>
                    <p
                      className={`${currentStyle.leading} tracking-tight ${
                        isLastActive
                          ? isInterim
                            ? `${currentStyle.active} text-amber-200/90`
                            : `${currentStyle.active} text-white`
                          : `${currentStyle.history} text-zinc-300`
                      }`}
                    >
                      {text.split('\n')[1]}
                      {isLastActive && (
                        <span
                          className={`inline-block w-1.5 md:w-2 h-[0.85em] ml-2 align-baseline rounded-xs ${
                            isInterim
                              ? 'bg-amber-400/80 animate-pulse'
                              : 'bg-amber-500'
                          }`}
                        />
                      )}
                    </p>
                  </div>
                ) : (
                  <p
                    className={`${currentStyle.leading} tracking-tight ${
                      isLastActive
                        ? isInterim
                          ? `${currentStyle.active} text-zinc-300/90`
                          : `${currentStyle.active} text-white`
                        : `${currentStyle.history} text-zinc-400`
                    }`}
                  >
                    {text}
                    {isLastActive && (
                      <span
                        className={`inline-block w-1.5 md:w-2 h-[0.85em] ml-2 align-baseline rounded-xs ${
                          isInterim
                            ? 'bg-amber-400/80 animate-pulse'
                            : 'bg-amber-500'
                        }`}
                      />
                    )}
                  </p>
                )}
              </div>
            ))}
            <div ref={scrollAnchorRef} className="h-1 w-full" />
          </div>
        )}
      </div>
    </main>
  );
};


