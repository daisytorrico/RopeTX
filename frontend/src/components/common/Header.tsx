import React, { useState, useEffect } from 'react';
import { ChevronDown, Radio, Languages } from 'lucide-react';
import { AVAILABLE_ROOMS, AVAILABLE_LANGUAGES, BACKEND_URL } from '../../config';
import { getT, type UiLanguage } from '../../i18n';
import type { RoomOption } from '../../types';
import { RxLogo } from './RxLogo';

export interface HeaderProps {
  currentRoom: string;
  onRoomChange: (room: string) => void;
  subtitleLanguage: string;
  onSubtitleLanguageChange: (lang: string) => void;
  uiLanguage?: UiLanguage;
}

export const Header: React.FC<HeaderProps> = ({
  currentRoom,
  onRoomChange,
  subtitleLanguage,
  onSubtitleLanguageChange,
  uiLanguage = 'es',
}) => {
  const [rooms, setRooms] = useState<RoomOption[]>(AVAILABLE_ROOMS);
  const t = getT(uiLanguage);

  useEffect(() => {
    let isMounted = true;
    const fetchRooms = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/rooms`);
        if (res.ok && isMounted) {
          const data: { id: string; label: string; is_live?: boolean; speaker_lang?: string }[] = await res.json();
          if (Array.isArray(data)) {
            setRooms(data.map((r) => ({
              id: r.id,
              label: r.label,
              is_live: r.is_live,
              speaker_lang: r.speaker_lang,
            })));

            if (data.length > 0) {
              // Si no hay sala seleccionada o la sala actual dejó de existir en el backend
              if (!currentRoom || !data.some((d) => d.id === currentRoom)) {
                const liveRoom = data.find((d) => d.is_live);
                onRoomChange(liveRoom ? liveRoom.id : data[0].id);
              }
            } else if (currentRoom) {
              onRoomChange('');
            }
          }
        }
      } catch {
        // silently maintain current state
      }
    };
    void fetchRooms();
    const interval = setInterval(fetchRooms, 2000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [currentRoom, onRoomChange]);

  const currentRoomObj = rooms.find((r) => r.id === currentRoom);
  const currentSpeakerLang = (currentRoomObj?.speaker_lang || 'es').slice(0, 2).toLowerCase();

  const getSubtitleOptionLabel = (id: string) => {
    if (id === 'dual') {
      const origCode = currentSpeakerLang && currentSpeakerLang !== 'es' ? currentSpeakerLang.toUpperCase() : 'Original';
      return `Bilingüe (${origCode} + Español)`;
    }
    const langCode = id.slice(0, 2).toLowerCase();
    let name = 'Español';
    if (langCode === 'en') name = 'English';
    else if (langCode === 'pt') name = 'Português';

    if (langCode === currentSpeakerLang) {
      return `${name} (Original)`;
    }
    return name;
  };

  return (
    <header className="w-full bg-[#050508]/90 border-b border-zinc-800/80 px-4 sm:px-8 py-3 sm:py-0 sm:h-14 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0 z-30 select-none">
      {/* 1. Marca limpia */}
      <div className="w-full sm:w-auto flex items-center justify-start gap-2.5">
        <RxLogo size={24} className="h-6 w-6 rounded-xs shrink-0 shadow-xs" />
        <span className="text-base font-bold tracking-tight text-white font-mono">RopeTX</span>
      </div>

      {/* 2. Selectores de Sala y Subtítulos */}
      <div className="w-full sm:w-auto flex items-center gap-2 sm:gap-3">
        {/* Selector de Escenario / Sala */}
        <div className="relative flex-1 sm:flex-initial h-9 sm:h-8.5 flex items-center bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 rounded-xs transition-colors min-w-0">
          <div className="pointer-events-none absolute left-2.5 text-zinc-500 shrink-0">
            <Radio className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <select
            value={currentRoom}
            onChange={(e) => onRoomChange(e.target.value)}
            aria-label={t.selectStage}
            disabled={rooms.length === 0}
            className="w-full appearance-none bg-transparent h-full pl-8 pr-7 text-xs font-mono text-zinc-200 font-medium focus:outline-none cursor-pointer truncate disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {rooms.length === 0 ? (
              <option value="" className="bg-zinc-950 text-zinc-500">{t.noRooms}</option>
            ) : (
              rooms.map((room) => (
                <option key={room.id} value={room.id} className="bg-zinc-950 text-zinc-200">
                  {room.is_live ? '● ' : ''}{room.label}{room.is_live ? ' [EN VIVO]' : ''}
                </option>
              ))
            )}
          </select>
          <div className="pointer-events-none absolute right-2.5 text-zinc-500 shrink-0">
            <ChevronDown className="w-3 h-3" />
          </div>
        </div>

        {/* Selector de Pista de Subtítulos */}
        <div className="relative flex-1 sm:flex-initial h-9 sm:h-8.5 flex items-center bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700 rounded-xs transition-colors min-w-0">
          <div className="pointer-events-none absolute left-2.5 text-zinc-500 shrink-0">
            <Languages className="w-3.5 h-3.5 text-amber-400/80" />
          </div>
          <select
            value={subtitleLanguage}
            onChange={(e) => onSubtitleLanguageChange(e.target.value)}
            aria-label={t.subtitlesLabel}
            className="w-full appearance-none bg-transparent h-full pl-8 pr-7 text-xs font-mono text-zinc-200 font-medium focus:outline-none cursor-pointer truncate"
          >
            {AVAILABLE_LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id} className="bg-zinc-950 text-zinc-200">
                {getSubtitleOptionLabel(lang.id)}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 text-zinc-500 shrink-0">
            <ChevronDown className="w-3 h-3" />
          </div>
        </div>
      </div>
    </header>
  );
};

