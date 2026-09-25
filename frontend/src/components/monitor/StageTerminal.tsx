import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Trash2, Mic, MicOff, Square, Play, Globe, Lock, Download, ChevronDown, MoreVertical, RotateCcw, AudioLines, Copy, Check, QrCode } from 'lucide-react';
import type { RoomTelemetry, Subtitle } from '../../types';
import { SpeakerLangSelector, type SpeakerLang } from '../common/SpeakerLangSelector';
import { StreamBrandMark } from './StreamBrandMark';
import { StageTelemetryPanel } from './StageTelemetryPanel';
import { AudienceQrModal } from '../modals/AudienceQrModal';

interface StageTerminalProps {
  selectedRoom: string;
  activeRoomData: RoomTelemetry | undefined;
  isSelectedLive: boolean;
  subtitles: Subtitle[];
  roomGlossaryCount?: number;
  onOpenGlossary: () => void;
  onToggleVisibility?: () => void;
  onChangeVisibility?: (makeVisible: boolean) => void;
  onOpenObsStudio?: () => void;
  onOpenAudioConfig?: () => void;
  onStartStream?: () => void;
  onStopStream?: () => void;
  onClearHistory?: () => void;
  onDownloadSrt?: (roomId: string) => void;
  isDownloadingSrt?: boolean;
  speakerLang?: SpeakerLang;
  onSpeakerLangChange?: (lang: SpeakerLang) => void;
  isMicStreaming?: boolean;
  micRoom?: string | null;
  isMicMuted?: boolean;
  onToggleMicMute?: () => void;
  onDeleteStage?: () => void;
  isPending: boolean;
  previewScrollRef: React.RefObject<HTMLDivElement | null>;
}

export const StageTerminal: React.FC<StageTerminalProps> = ({
  selectedRoom,
  activeRoomData,
  isSelectedLive,
  subtitles,
  roomGlossaryCount: _roomGlossaryCount,
  onOpenGlossary,
  onToggleVisibility,
  onChangeVisibility,
  onOpenObsStudio,
  onOpenAudioConfig,
  onStartStream,
  onStopStream,
  onClearHistory,
  onDownloadSrt,
  isDownloadingSrt,
  speakerLang,
  onSpeakerLangChange,
  isMicStreaming,
  micRoom,
  isMicMuted,
  onToggleMicMute,
  onDeleteStage,
  isPending,
  previewScrollRef,
}) => {
  const [fontSizeLevel, setFontSizeLevel] = useState<'normal' | 'large' | 'xl'>('large');
  const [subViewMode, setSubViewMode] = useState<'dual' | 'original' | 'es' | 'other'>('dual');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  const handleCopyAudienceLink = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/?room=${encodeURIComponent(selectedRoom)}`;
      navigator.clipboard.writeText(url).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Auto-scroll suave y anclado al fondo para la consola del operador
  useEffect(() => {
    if (scrollAnchorRef.current) {
      scrollAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [subtitles]);

  // Tamaños de fuente uniformes por nivel para evitar que el texto salte al confirmarse
  const fontClass =
    fontSizeLevel === 'xl'
      ? 'text-lg leading-relaxed'
      : fontSizeLevel === 'large'
        ? 'text-base leading-relaxed'
        : 'text-sm leading-relaxed';

  const transFontClass =
    fontSizeLevel === 'xl'
      ? 'text-sm'
      : fontSizeLevel === 'large'
        ? 'text-xs'
        : 'text-[11px]';

  return (
    <main className="flex-1 bg-black flex flex-col overflow-hidden min-h-0 min-w-0">
      {selectedRoom ? (
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* FILA 1: Identidad de Sala y Control Maestro Global (Barra Superior Completa) */}
          <div className="bg-black border-b border-zinc-800/80 shrink-0 select-none px-4 md:px-6 py-2.5 flex items-center justify-between">
            {/* Sala Activa + Estado de Emisión */}
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-base md:text-lg font-bold font-mono text-white tracking-wide truncate">
                {selectedRoom.toUpperCase()}
              </h1>

              <span className="text-zinc-800 font-mono">·</span>

              {/* Estado de Transmisión (STANDBY / LIVE) con Audio Waveform Dinámico */}
              {isSelectedLive ? (
                <div className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 tracking-wide bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full shadow-[0_0_12px_rgba(245,158,11,0.15)]">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                    <span>LIVE</span>
                  </span>
                  {/* Waveform Visualizer de 8 barras vivas */}
                  <div className="hidden sm:flex items-end gap-0.5 h-4 px-1.5 py-0.5 bg-zinc-950/80 border border-zinc-800/80 rounded-xs" title="Live Audio Signal Active">
                    <span className="w-1 h-3 bg-amber-400/90 rounded-xs animate-waveform-1" />
                    <span className="w-1 h-3.5 bg-amber-400/90 rounded-xs animate-waveform-2" />
                    <span className="w-1 h-2 bg-amber-400/90 rounded-xs animate-waveform-3" />
                    <span className="w-1 h-4 bg-amber-400/90 rounded-xs animate-waveform-4" />
                    <span className="w-1 h-3 bg-amber-400/90 rounded-xs animate-waveform-5" />
                    <span className="w-1 h-3.5 bg-amber-400/90 rounded-xs animate-waveform-6" />
                    <span className="w-1 h-2 bg-amber-400/90 rounded-xs animate-waveform-7" />
                    <span className="w-1 h-3 bg-amber-400/90 rounded-xs animate-waveform-8" />
                  </div>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-zinc-500 tracking-wide bg-zinc-900/50 border border-zinc-800/50 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  <span>STANDBY</span>
                </span>
              )}
            </div>

            {/* Botón Maestro: GO LIVE / STOP STREAM, Copy Link y Menú de Opciones (⁝) */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Botón QR para proyectar / mostrar a la audiencia */}
              <button
                type="button"
                onClick={() => setIsQrModalOpen(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-xs text-xs font-mono transition-all cursor-pointer active:scale-98"
                title="Mostrar código QR de la sala para la audiencia"
              >
                <QrCode className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">QR Sala</span>
              </button>

              {/* Copiar enlace directo de audiencia */}
              <button
                type="button"
                onClick={handleCopyAudienceLink}
                className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-xs text-xs font-mono transition-all cursor-pointer active:scale-98"
                title="Copy public audience link to clipboard"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Share Link</span>
                  </>
                )}
              </button>

              {isSelectedLive && onStopStream ? (
                <button
                  type="button"
                  onClick={onStopStream}
                  disabled={isPending}
                  className="h-9 px-5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-black text-xs md:text-sm tracking-wider uppercase rounded-xs shadow-lg shadow-red-950/70 hover:shadow-red-900/90 transition-all cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-40 active:scale-98"
                  title="Stop session and export SRT"
                >
                  <Square className="w-3.5 h-3.5 fill-current text-white" />
                  <span>Stop Stream</span>
                </button>
              ) : onStartStream ? (
                <button
                  type="button"
                  onClick={onStartStream}
                  disabled={isPending}
                  className="h-9 px-6 bg-gradient-to-r from-amber-400 via-amber-400 to-amber-500 hover:brightness-110 text-black font-black text-xs md:text-sm tracking-wider uppercase rounded-xs shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-40 active:scale-98"
                  title="Start live stream on this stage"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-black" />
                  <span>Go Live</span>
                </button>
              ) : null}

              {/* Menú de opciones de la sala (Tres Puntos: ⁝) */}
              {(onDeleteStage || onClearHistory) && (
                <div className="relative" ref={optionsMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen((prev) => !prev)}
                    disabled={isPending}
                    className={`h-9 w-9 border flex items-center justify-center rounded-xs transition-colors cursor-pointer shrink-0 disabled:opacity-40 ${isMenuOpen
                      ? 'bg-zinc-800 border-zinc-600 text-white'
                      : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white'
                      }`}
                    title="Stage Options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {isMenuOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-zinc-950 border border-zinc-800 rounded-xs shadow-xl py-1 z-50 font-mono text-xs">
                      {onClearHistory && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            onClearHistory();
                          }}
                          disabled={isPending || subtitles.length === 0}
                          className="w-full px-3 py-2 text-left text-zinc-300 hover:bg-zinc-900 hover:text-white flex items-center gap-2 transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                          <span>Clear History</span>
                        </button>
                      )}

                      {onDeleteStage && !isSelectedLive && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsMenuOpen(false);
                            onDeleteStage();
                          }}
                          disabled={isPending}
                          className="w-full px-3 py-2 text-left text-red-400 hover:bg-red-950/30 hover:text-red-300 flex items-center gap-2 transition-colors disabled:opacity-40 cursor-pointer border-t border-zinc-900"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          <span>Delete Stage</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Área Principal: Columna Izquierda (Filas 2 y 3 + Teleprompter) + Columna Derecha (Telemetría) */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 min-w-0 bg-black">

            {/* Columna Izquierda: Fila 2 (Pre-Flight) + Fila 3 (Live Tools) + Teleprompter */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">

              {/* FILA 2: Configuración Pre-Flight (Panel Responsive: Visibility & Speaker) */}
              <div className="px-4 md:px-6 py-2 bg-[#09090d] border-b border-zinc-800/80 shrink-0 select-none font-mono text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                  {/* Tarjeta 1: Visibilidad */}
                  <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800/80 rounded-xs px-3 py-1.5 w-full">
                    <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Visibility:</span>
                    <div className="relative h-7 flex items-center bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xs transition-colors shrink-0">
                      <div className="pointer-events-none absolute left-2 text-zinc-400">
                        {activeRoomData?.is_visible !== false ? (
                          <Globe className="w-3.5 h-3.5 text-zinc-300" />
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-amber-400/90" />
                        )}
                      </div>
                      <select
                        className="appearance-none bg-transparent h-full w-full pl-7.5 pr-6 py-0 text-[11px] font-mono text-zinc-200 font-semibold focus:outline-none cursor-pointer"
                        value={activeRoomData?.is_visible !== false ? 'public' : 'private'}
                        onChange={(e) => {
                          const isPublic = e.target.value === 'public';
                          if (onChangeVisibility) {
                            onChangeVisibility(isPublic);
                          } else if (onToggleVisibility) {
                            onToggleVisibility();
                          }
                        }}
                        disabled={isPending}
                        title="Stage Privacy & Audience Visibility"
                      >
                        <option value="public" className="bg-zinc-950 text-zinc-200">PUBLIC</option>
                        <option value="private" className="bg-zinc-950 text-zinc-200">BACKSTAGE</option>
                      </select>
                      <div className="pointer-events-none absolute right-1.5 text-zinc-500">
                        <ChevronDown className="w-3 h-3" />
                      </div>
                    </div>
                  </div>

                  {/* Tarjeta 2: Idioma Origen */}
                  {speakerLang && onSpeakerLangChange && (
                    <div className="flex items-center justify-between bg-zinc-900/50 border border-zinc-800/80 rounded-xs px-3 py-1.5 w-full">
                      <SpeakerLangSelector value={speakerLang} onChange={onSpeakerLangChange} size="sm" />
                    </div>
                  )}
                </div>
              </div>

              {/* FILA 3: Herramientas Operativas de Transmisión (Panel Grid Responsive: Overlay, Sources, Glossary, SRT, Mic) */}
              <div className="px-4 md:px-6 py-2 bg-[#09090d] border-b border-zinc-800/80 shrink-0 select-none font-mono text-xs">
                <div className={`grid grid-cols-2 ${isMicStreaming && (micRoom === selectedRoom || !micRoom) && onToggleMicMute ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-2 w-full`}>
                  {/* Botón OBS / vMix Overlay */}
                  {onOpenObsStudio && (
                    <button
                      type="button"
                      onClick={onOpenObsStudio}
                      disabled={isPending}
                      className="w-full h-8 px-2.5 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 text-xs font-mono transition-colors cursor-pointer flex items-center justify-center gap-1.5 rounded-xs shadow-xs group disabled:opacity-40"
                      title="Configure OBS Studio & vMix Stream Overlay URL and appearance"
                    >
                      <StreamBrandMark showText={false} />
                      <span className="text-[11px] font-medium text-zinc-300 group-hover:text-zinc-100 truncate">Overlay</span>
                    </button>
                  )}

                  {/* Botón Sources (Configuración de fuentes de audio) */}
                  {onOpenAudioConfig && (
                    <button
                      type="button"
                      onClick={onOpenAudioConfig}
                      disabled={isPending}
                      className="w-full h-8 px-2.5 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 text-xs font-mono transition-colors cursor-pointer flex items-center justify-center gap-1.5 rounded-xs shadow-xs group disabled:opacity-40"
                      title="Configure Audio Input Devices, Microphone, URL or File Source"
                    >
                      <AudioLines className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-colors shrink-0" />
                      <span className="text-[11px] font-medium text-zinc-300 group-hover:text-zinc-100 truncate">Sources</span>
                    </button>
                  )}

                  {/* Glosario Técnico */}
                  <button
                    type="button"
                    onClick={onOpenGlossary}
                    className="w-full h-8 px-2.5 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 font-mono text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 rounded-xs shadow-xs group"
                    title="Open Technical Glossary for this stage"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-colors shrink-0" />
                    <span className="text-[11px] truncate">Glossary</span>
                  </button>

                  {/* Descarga SRT */}
                  {onDownloadSrt && (
                    <button
                      type="button"
                      onClick={() => onDownloadSrt(selectedRoom)}
                      disabled={isPending || isDownloadingSrt}
                      className="w-full h-8 px-2.5 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-zinc-100 font-mono text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 rounded-xs shadow-xs group disabled:opacity-40"
                      title="Download SRT subtitles file for this stage"
                    >
                      <Download className={`w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-colors shrink-0 ${isDownloadingSrt ? 'animate-bounce text-amber-400' : ''}`} />
                      <span className="text-[11px] truncate">SRT</span>
                    </button>
                  )}

                  {/* Toggle mute micrófono */}
                  {isMicStreaming && (micRoom === selectedRoom || !micRoom) && onToggleMicMute && (
                    <button
                      type="button"
                      onClick={onToggleMicMute}
                      disabled={isPending}
                      title={isMicMuted ? 'Resume mic' : 'Mute mic'}
                      className={`w-full h-8 px-2.5 border flex items-center justify-center gap-1.5 rounded-xs transition-all cursor-pointer text-[11px] font-mono disabled:opacity-40 ${
                        isMicMuted
                          ? 'border-red-900/50 bg-red-950/40 text-red-400 hover:bg-red-900/30'
                          : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100'
                      }`}
                    >
                      {isMicMuted ? (
                        <>
                          <MicOff className="w-3.5 h-3.5 text-red-400 shrink-0" />
                          <span className="truncate text-red-300">Muted</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="truncate">Mic Live</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Panel de Revisión en Vivo Delimitado (Teleprompter) */}
              <div className="flex-1 p-3 md:p-4 flex flex-col min-h-0 min-w-0 bg-black overflow-hidden">
                <div className="flex-1 bg-[#0a0a0f] border border-zinc-800/80 rounded-xs flex flex-col min-h-0 overflow-hidden shadow-inner">
                  {/* Barra superior del teleprompter: Estado, conteo y Zoom */}
                  <div className="px-4 md:px-5 py-2.5 bg-zinc-950/90 border-b border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-400 select-none shrink-0">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2 h-2 rounded-full ${isSelectedLive ? 'bg-amber-500 animate-pulse' : 'bg-zinc-700'}`} />
                      <span className="tracking-wider uppercase font-bold text-zinc-300 hidden sm:inline">LIVE TRANSCRIPTION REVIEW</span>
                      
                      {/* Selector de 4 modos de vista para el Administrador */}
                      <div className="inline-flex p-0.5 bg-zinc-900 border border-zinc-800 rounded-xs text-[10px]">
                        <button
                          type="button"
                          onClick={() => setSubViewMode('dual')}
                          className={`px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer font-bold ${
                            subViewMode === 'dual' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                          title="Vista Bilingüe completa (Original + Traducción)"
                        >
                          Dual
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubViewMode('original')}
                          className={`px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer font-bold ${
                            subViewMode === 'original' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                          title="Solo texto original del orador (sin saltos)"
                        >
                          Original
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubViewMode('es')}
                          className={`px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer font-bold ${
                            subViewMode === 'es' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                          title="Solo traducción a Español (sin saltos)"
                        >
                          ES
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubViewMode('other')}
                          className={`px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer font-bold ${
                            subViewMode === 'other' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                          title="Solo traducción EN / PT (sin saltos)"
                        >
                          EN/PT
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 tabular-nums font-mono text-[10px]">LINES: {subtitles.length}</span>

                      {/* Limpiar canvas de revisión */}
                      {onClearHistory && subtitles.length > 0 && (
                        <>
                          <span className="text-zinc-800 select-none">|</span>
                          <button
                            type="button"
                            onClick={onClearHistory}
                            disabled={isPending}
                            className="h-5 px-1.5 text-[10px] font-mono text-zinc-500 hover:text-amber-400 hover:bg-amber-950/30 border border-transparent hover:border-amber-500/30 rounded-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40"
                            title="Clear transcript review canvas"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                            <span>Clear</span>
                          </button>
                        </>
                      )}

                      <span className="text-zinc-800 select-none">|</span>
                      {/* Selector de escala de fuente A- / A+ */}
                      <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xs p-0.5">
                        <button
                          type="button"
                          onClick={() => setFontSizeLevel((prev) => (prev === 'xl' ? 'large' : 'normal'))}
                          disabled={fontSizeLevel === 'normal'}
                          className="h-5 px-1.5 text-[10px] font-mono font-bold text-zinc-400 hover:text-white disabled:opacity-25 cursor-pointer rounded-xs hover:bg-zinc-800 transition-colors"
                          title="Decrease font size"
                        >
                          A-
                        </button>
                        <span className="text-zinc-800 select-none">|</span>
                        <button
                          type="button"
                          onClick={() => setFontSizeLevel((prev) => (prev === 'normal' ? 'large' : 'xl'))}
                          disabled={fontSizeLevel === 'xl'}
                          className="h-5 px-1.5 text-[10px] font-mono font-bold text-zinc-400 hover:text-white disabled:opacity-25 cursor-pointer rounded-xs hover:bg-zinc-800 transition-colors"
                          title="Increase font size"
                        >
                          A+
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Área de visualización de texto con tamaño tipográfico escalable y sin saltos */}
                  <div
                    ref={previewScrollRef}
                    className="flex-1 p-4 md:p-6 overflow-y-auto font-mono select-text space-y-3.5"
                  >
                    {subtitles.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-600 uppercase tracking-widest text-[11px] gap-2 select-none font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
                        <span>{isSelectedLive ? 'LISTENING FOR AUDIO PACKETS...' : 'STANDBY'}</span>
                      </div>
                    ) : (
                      <>
                        {subtitles.map((sub, index) => {
                          const isLast = index === subtitles.length - 1;
                          const isInterim = !sub.is_final;
                          const speakerCode = (sub.speaker_lang || speakerLang || 'es').toUpperCase();
                          const origText = (sub.transcription || sub.original || sub.text || '').trim();
                          const esTranslation = sub.translations?.['es'] || (sub.speaker_lang === 'es' ? origText : '');
                          const otherTranslation = sub.translations?.['en'] || sub.translations?.['pt'] || '';

                          let mainDisplayText = origText;
                          let displayBadge = speakerCode;

                          if (subViewMode === 'es') {
                            mainDisplayText = esTranslation || origText;
                            displayBadge = 'ES';
                          } else if (subViewMode === 'other') {
                            mainDisplayText = otherTranslation || origText;
                            displayBadge = sub.translations?.['en'] ? 'EN' : (sub.translations?.['pt'] ? 'PT' : speakerCode);
                          }

                          return (
                            <div
                              key={`${sub.seq || index}-${sub.timestamp || ''}`}
                              className={`p-3 border rounded-xs transition-all space-y-2 font-mono ${isInterim && isLast
                                ? 'border-amber-500/40 bg-zinc-950/80 shadow-xs'
                                : 'border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700'
                                }`}
                            >
                              {/* Metadatos superiores de la línea: Código de Idioma y Marca Temporal */}
                              <div className="flex items-center justify-between text-[10px] select-none text-zinc-500">
                                <span className="px-1.5 py-0.2 bg-zinc-900 border border-zinc-800 rounded-xs font-bold text-zinc-400">
                                  {displayBadge}
                                </span>
                                <span>
                                  {new Date(sub.timestamp * 1000).toISOString().substr(11, 8)}
                                </span>
                              </div>

                              {/* Texto principal renderizado */}
                              <p
                                className={`${fontClass} tracking-normal ${isInterim && isLast
                                  ? 'text-zinc-100 font-medium'
                                  : 'text-zinc-300 font-normal'
                                  }`}
                              >
                                {mainDisplayText}
                                {isInterim && isLast && (
                                  <span className="inline-block w-1.5 h-[0.85em] bg-amber-400/80 ml-1.5 align-baseline animate-pulse rounded-xs" />
                                )}
                              </p>

                              {/* Pistas traducidas solo si estamos en modo Dual */}
                              {subViewMode === 'dual' && sub.translations && Object.keys(sub.translations).length > 0 && (
                                <div className="space-y-1 pt-0.5">
                                  {Object.entries(sub.translations).map(([lang, transText]) => {
                                    if (!transText || lang.toLowerCase() === (sub.speaker_lang || 'es').toLowerCase()) {
                                      return null;
                                    }
                                    return (
                                      <div key={lang} className="flex items-baseline gap-2">
                                        <span className="px-1.5 py-0.2 bg-zinc-900 border border-zinc-800 rounded-xs text-[9px] font-bold text-zinc-400 uppercase shrink-0">
                                          {lang}
                                        </span>
                                        <span className={`text-zinc-400 font-normal ${transFontClass}`}>
                                          {transText}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <div ref={scrollAnchorRef} className="h-1 w-full" />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Panel Lateral Vertical de Telemetría (Stage Inspector) */}
            <StageTelemetryPanel
              room={selectedRoom}
              telemetry={activeRoomData}
              isLive={isSelectedLive}
              subtitles={subtitles}
              speakerLang={speakerLang}
            />
          </div>
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-zinc-700 uppercase tracking-widest text-[11px] select-none font-mono">
          NO STAGE SELECTED
        </div>
      )}

      {/* Modal QR de Audiencia */}
      <AudienceQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        room={selectedRoom}
      />
    </main>
  );
};
