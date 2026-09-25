import React from 'react';
import { Globe, Lock } from 'lucide-react';

interface NewStageModalProps {
  isOpen: boolean;
  roomInput: string;
  isPublic: boolean;
  error: string | null;
  onChangeInput: (val: string) => void;
  onChangeIsPublic: (val: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export const NewStageModal: React.FC<NewStageModalProps> = ({
  isOpen,
  roomInput,
  isPublic,
  error,
  onChangeInput,
  onChangeIsPublic,
  onSubmit,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md font-sans animate-in fade-in duration-150 select-none">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm bg-[#09090d] border border-zinc-800/90 rounded-lg p-5 sm:p-6 space-y-4 shadow-2xl shadow-black/90 font-mono"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            <h2 className="text-sm font-bold text-white font-mono tracking-wider uppercase">
              Create New Stage
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

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-zinc-400 block font-medium">
              Stage Identifier
            </label>
            <input
              type="text"
              autoFocus
              value={roomInput}
              onChange={(e) => onChangeInput(e.target.value)}
              placeholder="e.g.: main-stage, track-1"
              className="w-full bg-zinc-900/90 border border-zinc-800/90 hover:border-zinc-700 focus:border-amber-500 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:outline-none text-xs font-mono rounded-xs transition-colors"
            />
            {error && (
              <div className="text-red-400 text-[11px] mt-1">{error}</div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-zinc-400 block font-medium">
              Audience Visibility
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-950 border border-zinc-800/80 rounded-xs font-mono">
              <button
                type="button"
                onClick={() => onChangeIsPublic(false)}
                className={`py-2 px-2 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-xs ${
                  !isPublic
                    ? 'bg-zinc-800/90 text-amber-400 shadow-sm border border-zinc-700/80'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Backstage</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeIsPublic(true)}
                className={`py-2 px-2 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-xs ${
                  isPublic
                    ? 'bg-zinc-800/90 text-amber-400 shadow-sm border border-zinc-700/80'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Public</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs uppercase cursor-pointer rounded-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!roomInput.trim()}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase transition-all cursor-pointer disabled:opacity-40 rounded-xs shadow-md shadow-amber-500/20"
            >
              Create Stage
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
