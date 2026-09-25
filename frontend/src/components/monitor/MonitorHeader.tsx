import React from 'react';
import { LogOut, AlertCircle, Archive, Plus, Layers } from 'lucide-react';
import { RxLogo } from '../common/RxLogo';

/** Header operacional minimalista de la consola /monitor */
interface MonitorHeaderProps {
  actionStatus: string | null;
  errorMsg: string | null;
  micError: string | null;
  onOpenExports: () => void;
  onOpenNewStage: () => void;
  onLogout: () => void;
  onToggleMobileStages?: () => void;
  isMobileStagesOpen?: boolean;
  stagesCount?: number;
}

export const MonitorHeader: React.FC<MonitorHeaderProps> = ({
  actionStatus,
  errorMsg,
  micError,
  onOpenExports,
  onOpenNewStage,
  onLogout,
  onToggleMobileStages,
  isMobileStagesOpen,
  stagesCount,
}) => {
  return (
    <>
      <header className="border-b border-zinc-800/80 bg-black px-4 sm:px-6 h-12 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-3">
          {/* Botón de Stages para Mobile (< sm) */}
          {onToggleMobileStages && (
            <button
              type="button"
              onClick={onToggleMobileStages}
              className={`sm:hidden border text-xs px-2.5 h-8 transition-colors rounded-xs cursor-pointer inline-flex items-center gap-1.5 font-mono ${
                isMobileStagesOpen
                  ? 'border-zinc-700 bg-zinc-800 text-zinc-100'
                  : 'border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
              title="Open stage selector"
            >
              <Layers className="w-3.5 h-3.5 text-zinc-400" />
              <span>Stages{stagesCount !== undefined ? ` (${stagesCount})` : ''}</span>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <RxLogo size={24} className="h-6 w-6 rounded-xs shrink-0 shadow-xs" />
            <span className="text-sm font-bold tracking-tight text-white font-mono">RopeTX</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenExports}
            className="border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-800/80 hover:text-zinc-100 text-zinc-300 px-3 h-8 transition-colors text-xs rounded-xs cursor-pointer inline-flex items-center gap-1.5 font-mono"
            title="SRT archives and exports"
          >
            <Archive className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Archives</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewStage}
            className="border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-800/80 hover:text-zinc-100 text-zinc-300 px-3 h-8 transition-colors text-xs rounded-xs cursor-pointer inline-flex items-center gap-1.5 font-mono"
            title="Create new stage"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">New stage</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            title="Sign out"
            className="h-8 w-8 border border-zinc-800/80 bg-zinc-900/40 hover:bg-red-950/40 hover:border-red-900/60 hover:text-red-400 text-zinc-400 transition-colors cursor-pointer flex items-center justify-center rounded-xs"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {actionStatus && !errorMsg && !micError && (
        <div className="bg-black border-b border-zinc-900 px-4 h-8 flex items-center gap-2 text-amber-400 text-[11px] shrink-0 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <span>{actionStatus}</span>
        </div>
      )}

      {(errorMsg || micError) && (
        <div className="bg-black border-b border-zinc-900 px-4 h-8 flex items-center gap-2 text-red-400 text-[11px] shrink-0 font-mono">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{errorMsg || micError}</span>
        </div>
      )}
    </>
  );
};
