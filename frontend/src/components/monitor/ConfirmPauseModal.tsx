import React from 'react';

interface ConfirmPauseModalProps {
  isOpen: boolean;
  stageId: string | null;
  isCurrentlyVisible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmPauseModal: React.FC<ConfirmPauseModalProps> = ({
  isOpen,
  stageId,
  isCurrentlyVisible,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !stageId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 font-sans animate-in fade-in duration-150 select-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="visibility-dialog-title"
        className="w-full max-w-sm bg-[#09090d] border border-zinc-800/90 rounded-lg p-5 space-y-4 shadow-2xl shadow-black/90 font-mono text-xs"
      >
        <div className="flex items-center gap-2.5 border-b border-zinc-800/80 pb-3">
          <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
          <h2 id="visibility-dialog-title" className="text-sm font-bold text-white font-mono tracking-wider uppercase">
            Stage Visibility
          </h2>
        </div>

        <div className="text-zinc-400 text-xs leading-relaxed">
          <strong className="text-white font-mono">{stageId}</strong> will remain active in the pipeline, but will become <span className="text-amber-400 font-bold">{isCurrentlyVisible ? 'hidden (Backstage)' : 'public to the audience'}</span>.
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/80">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs uppercase cursor-pointer rounded-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold uppercase transition-all cursor-pointer rounded-xs shadow-md shadow-amber-500/20 text-xs"
          >
            {isCurrentlyVisible ? 'Move to Backstage' : 'Make Public'}
          </button>
        </div>
      </div>
    </div>
  );
};
