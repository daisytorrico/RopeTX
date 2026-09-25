import React from 'react';
import { ExternalLink, Users, Lock } from 'lucide-react';
import type { RoomTelemetry } from '../../types';

interface StageListProps {
  telemetry: RoomTelemetry[];
  selectedRoom: string;
  onSelectRoom: (roomId: string) => void;
  onCloseMobile?: () => void;
  onDeleteStage?: (roomId: string) => void;
  onStartStream?: (roomId: string) => void;
  onStopStream?: (roomId: string) => void;
  onDownloadSrt?: (roomId: string) => void;
  onCopyOverlayUrl?: (roomId: string) => void;
  copiedUrl?: string | null;
  pendingRoom?: string | null;
  isDownloadingSrt?: boolean;
  isMicStreaming?: boolean;
  micRoom?: string | null;
}

export const StageList: React.FC<StageListProps> = ({
  telemetry,
  selectedRoom,
  onSelectRoom,
  onCloseMobile,
}) => {
  return (
    <aside className="w-full h-full bg-black flex flex-col shrink-0 select-none overflow-hidden border-r border-zinc-800/80">
      {/* Header del selector de salas */}
      <div className="px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">
          Stages
        </span>
        <span className="px-1.5 py-0.5 rounded-xs bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-mono">
          {telemetry.length}
        </span>
      </div>

      {/* Lista de salas */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
        {telemetry.length === 0 ? (
          <div className="p-8 text-center text-zinc-600 text-[11px] flex flex-col items-center justify-center gap-2 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
            <span>No stages configured</span>
          </div>
        ) : (
          telemetry.map((room) => {
            const isSelected = selectedRoom === room.room_id;
            const isLive = room.status === 'ONLINE';
            const isBackstage = room.is_visible === false;

            return (
              <div
                key={room.room_id}
                onClick={() => {
                  onSelectRoom(room.room_id);
                  if (onCloseMobile) onCloseMobile();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelectRoom(room.room_id);
                    if (onCloseMobile) onCloseMobile();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Select stage ${room.room_id}`}
                title={isBackstage ? `${room.room_id.toUpperCase()} (Backstage - Hidden from audience)` : room.room_id.toUpperCase()}
                className={`group px-3 py-2.5 rounded-lg transition-all duration-200 ease-out cursor-pointer flex items-center justify-between gap-2.5 select-none active:scale-[0.98] ${
                  isSelected
                    ? 'bg-zinc-800/90 border border-zinc-700/90 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_4px_16px_rgba(0,0,0,0.5)] translate-x-1'
                    : isBackstage && !isLive
                    ? 'bg-transparent border border-transparent hover:bg-zinc-900/50 hover:border-zinc-800/50 text-zinc-500 hover:text-zinc-400 opacity-60 hover:opacity-100 hover:translate-x-0.5'
                    : 'bg-transparent border border-transparent hover:bg-zinc-900/60 hover:border-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:translate-x-0.5'
                }`}
              >
                {/* Lado izquierdo: Ecualizador animado / Indicador dinámico + Nombre de Sala */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-4 h-4 flex items-center justify-center shrink-0">
                    {isLive ? (
                      /* Mini ecualizador saltarín para sala en vivo */
                      <div className="flex items-end gap-[2px] h-3.5">
                        <span className="w-[3px] bg-amber-400 rounded-full animate-eq-1 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                        <span className="w-[3px] bg-amber-400 rounded-full animate-eq-2 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                        <span className="w-[3px] bg-amber-400 rounded-full animate-eq-3 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                      </div>
                    ) : (
                      /* Punto estático — sin onda cuando no transmite */
                      <span className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                        isSelected
                          ? 'bg-white shadow-[0_0_4px_rgba(255,255,255,0.4)]'
                          : 'bg-zinc-600 group-hover:bg-zinc-400 group-hover:scale-125'
                      }`} />
                    )}
                  </div>

                  <span
                    className={`font-mono text-xs truncate tracking-wide transition-colors ${
                      isSelected
                        ? 'font-bold text-white'
                        : isLive
                        ? 'font-semibold text-amber-300'
                        : isBackstage
                        ? 'font-normal text-zinc-500 italic'
                        : 'font-normal text-zinc-400 group-hover:text-zinc-100'
                    }`}
                  >
                    {room.room_id.toUpperCase()}
                  </span>

                  {isBackstage && (
                    <span title="Backstage (Hidden from audience)">
                      <Lock className="w-3 h-3 text-zinc-600 shrink-0" />
                    </span>
                  )}
                </div>

                {/* Lado derecho: Audiencia interactiva + Enlace sin etiquetas */}
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[10px] font-mono transition-colors ${
                      isSelected ? 'text-zinc-200' : 'text-zinc-500 group-hover:text-zinc-400'
                    }`}
                    title="Current audience"
                  >
                    <Users className="w-3 h-3 text-zinc-500 group-hover:rotate-12 transition-transform duration-300" />
                    <span className="tabular-nums font-semibold">
                      {room.audience_count}
                    </span>
                  </span>

                  <a
                    href={`/?room=${encodeURIComponent(room.room_id)}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={`cursor-pointer p-1.5 inline-flex items-center rounded-md transition-all duration-150 hover:scale-110 active:scale-95 ${
                      isSelected
                        ? 'text-zinc-300 hover:text-white hover:bg-zinc-700/80'
                        : 'text-zinc-600 hover:text-zinc-200 hover:bg-zinc-800/60'
                    }`}
                    title="Open public audience view"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
