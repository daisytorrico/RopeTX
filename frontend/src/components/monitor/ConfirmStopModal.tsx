import React from 'react';

interface ConfirmStopModalProps {
  isOpen: boolean;
  stageId: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmStopModal: React.FC<ConfirmStopModalProps> = ({
  isOpen,
  stageId,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !stageId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-sans animate-in fade-in duration-150 select-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stop-dialog-title"
        className="w-full max-w-sm bg-[#09090d] border border-zinc-800/90 rounded-lg p-5 space-y-4 shadow-2xl shadow-black/90 font-mono text-xs"
      >
        <div className="flex items-center gap-2.5 border-b border-zinc-800/80 pb-3">
          <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
          <h2 id="stop-dialog-title" className="text-sm font-bold text-white font-mono tracking-wider uppercase">
            Stop Live Stream
          </h2>
        </div>

        <div className="text-zinc-400 text-xs leading-relaxed">
          Stop active stream on stage <strong className="text-white font-mono">{stageId}</strong>? Audio processing will end and the final SRT archive will be saved.
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
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold uppercase transition-all cursor-pointer rounded-xs shadow-md shadow-red-950/40 text-xs"
          >
            Stop Stream
          </button>
        </div>
      </div>
    </div>
  );
};