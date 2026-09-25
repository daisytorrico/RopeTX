import React, { useState, useEffect, useCallback } from 'react';
import { Globe } from 'lucide-react';
import { Header } from './components/common/Header';
import { SubtitleDisplay } from './components/audience/SubtitleDisplay';
import { StreamOverlay } from './components/audience/StreamOverlay';
import { Monitor } from './components/monitor/Monitor';
import { useAudienceSSE } from './hooks/useAudienceSSE';
import { type UiLanguage } from './i18n';

export const App: React.FC = () => {
  // Detección de ruta y parámetros de consulta
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const search = typeof window !== 'undefined' ? window.location.search : '';

  const urlParams =
    typeof window !== 'undefined'
      ? new URLSearchParams(search)
      : new URLSearchParams();

  const isMonitorPath = pathname.startsWith('/monitor');

  // Práctica estándar de seguridad (OWASP): Sanitización inmediata de la URL.
  useEffect(() => {
    if (typeof window !== 'undefined' && urlParams.has('token')) {
      urlParams.delete('token');
      const cleanSearch = urlParams.toString();
      const cleanUrl = pathname + (cleanSearch ? `?${cleanSearch}` : '');
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [pathname, urlParams]);

  const isOverlay = pathname.startsWith('/overlay') || search.includes('overlay=true');
  const initialRoom = urlParams.get('room') || '';

  const initialSubLang = urlParams.get('subtitles') || urlParams.get('lang');
  const defaultSubtitleLanguage =
    initialSubLang === 'en' || initialSubLang === 'en-or' || initialSubLang === 'en-tr'
      ? 'en'
      : initialSubLang === 'pt' || initialSubLang === 'pt-tr'
        ? 'pt'
        : ((localStorage.getItem('ropetx_sub_lang') || 'es').slice(0, 2));

  const initialUiLang = (urlParams.get('ui') || urlParams.get('uiLang')) as UiLanguage | null;
  const defaultUiLanguage: UiLanguage =
    initialUiLang === 'en' || initialUiLang === 'es'
      ? initialUiLang
      : ((localStorage.getItem('ropetx_ui_lang') as UiLanguage) || 'es');

  const [currentRoom, setCurrentRoom] = useState<string>(initialRoom);
  const [subtitleLanguage, setSubtitleLanguage] = useState<string>(defaultSubtitleLanguage);
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(defaultUiLanguage);

  const handleRoomChange = useCallback((newRoom: string) => {
    setCurrentRoom(newRoom);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        if (newRoom) {
          url.searchParams.set('room', newRoom);
        } else {
          url.searchParams.delete('room');
        }
        window.history.replaceState({}, document.title, url.toString());
      } catch {}
    }
  }, []);

  const handleSubtitleLanguageChange = useCallback((newLang: string) => {
    setSubtitleLanguage(newLang);
    try {
      localStorage.setItem('ropetx_sub_lang', newLang);
    } catch {
      // ignore
    }
  }, []);

  const handleUiLanguageChange = useCallback((newLang: UiLanguage) => {
    setUiLanguage(newLang);
    try {
      localStorage.setItem('ropetx_ui_lang', newLang);
    } catch {
      // ignore
    }
  }, []);

  // Audiencia en tiempo real vía SSE (solo activo en vista pública y overlay si hay sala seleccionada).
  // El Monitor (/monitor) sigue en WebSocket aparte: necesita mandar controles al backend, SSE es unidireccional.
  const { isConnected, isLive, subtitles } = useAudienceSSE({
    room: currentRoom,
    enabled: !isMonitorPath && Boolean(currentRoom),
  });

  // Fondo transparente para modo overlay OBS/vMix
  useEffect(() => {
    if (isOverlay) {
      document.body.style.backgroundColor = 'transparent';
    } else {
      document.body.style.backgroundColor = '#000000';
    }
  }, [isOverlay]);

  // 1. RUTA /monitor: Consola Técnica con Autenticación JWT y Centro de Ingesta
  if (isMonitorPath) {
    return (
      <div className="relative min-h-screen bg-black text-zinc-100">
        <Monitor />
      </div>
    );
  }

  // 2. RUTA /overlay: Capa gráfica transparente para OBS Studio y vMix
  if (isOverlay) {
    const overlayLang = urlParams.get('subtitles') || urlParams.get('lang') || subtitleLanguage;
    const theme = (urlParams.get('theme') || 'dark') as 'dark' | 'clean' | 'clean-light' | 'lowerthird' | 'glass' | 'neon' | 'light';
    const size = (urlParams.get('size') || 'lg') as 'sm' | 'md' | 'lg' | 'xl';
    const pos = (urlParams.get('pos') || 'bottom') as 'bottom' | 'top' | 'middle';
    const anim = (urlParams.get('animate') || 'fade') as 'slide' | 'fade' | 'none';
    const align = (urlParams.get('align') || 'center') as 'center' | 'left';
    const maxL = parseInt(urlParams.get('maxlines') || '2', 10);
    const timeoutSec = urlParams.has('timeout') ? parseFloat(urlParams.get('timeout') || '6') : 6;
    const showBadge = urlParams.get('badge') === 'false' ? false : (urlParams.get('badge') === 'true' ? true : undefined);

    return (
      <div className="w-screen h-screen bg-transparent overflow-hidden">
        <StreamOverlay
          subtitles={subtitles}
          language={overlayLang}
          theme={theme}
          size={size}
          pos={pos}
          maxLines={isNaN(maxL) ? 2 : Math.min(3, Math.max(1, maxL))}
          animate={anim}
          room={currentRoom}
          timeoutSec={isNaN(timeoutSec) ? 6 : timeoutSec}
          align={align}
          showBadge={showBadge}
        />
      </div>
    );
  }

  // 3. RUTA /: Vista Oficial de la Audiencia (Experiencia Limpia & Accesible)
  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col selection:bg-orange-500/20 selection:text-orange-300 font-sans relative">
      <Header
        currentRoom={currentRoom}
        onRoomChange={handleRoomChange}
        subtitleLanguage={subtitleLanguage}
        onSubtitleLanguageChange={handleSubtitleLanguageChange}
        uiLanguage={uiLanguage}
      />

      {/* Área de subtítulos — sin footer de página */}
      <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        <SubtitleDisplay
          subtitles={subtitles}
          isConnected={isConnected}
          isLive={isLive}
          currentRoom={currentRoom}
          subtitleLanguage={subtitleLanguage}
          uiLanguage={uiLanguage}
        />
      </div>

      {/* 4. Switcher de idioma de la página (UI) accesible y flotante en la esquina inferior */}
      <div className="fixed bottom-3 left-3 sm:bottom-4 sm:left-5 z-30 select-none">
        <button
          type="button"
          onClick={() => handleUiLanguageChange(uiLanguage === 'es' ? 'en' : 'es')}
          className="h-7 sm:h-8 px-2.5 flex items-center gap-1.5 bg-zinc-950/90 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80 hover:border-zinc-700 rounded-full shadow-md transition-all cursor-pointer text-xs font-mono"
          title={uiLanguage === 'es' ? 'Switch interface to English' : 'Cambiar interfaz a Español'}
          aria-label={uiLanguage === 'es' ? 'Switch interface to English' : 'Cambiar interfaz a Español'}
        >
          <Globe className="w-3.5 h-3.5 text-zinc-400" />
          <span className="uppercase text-[11px] font-bold text-zinc-300">{uiLanguage}</span>
        </button>
      </div>
    </div>
  );
};

export default App;