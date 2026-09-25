import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../../config';
import { authService } from '../../services/authService';

interface TalkGlossaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  onGlossaryUpdated?: (count: number) => void;
}

export function parseGlossaryInput(rawText: string): string[] {
  if (!rawText) return [];
  const chunks = rawText.split(/[\r\n,;]+/);
  const result: string[] = [];

  for (const chunk of chunks) {
    let term = chunk.trim();
    if (!term) continue;
    term = term.replace(/^[\-\*\•\>\#\+\~]+\s*/, '');
    term = term.replace(/^\d+[\.\)\-]\s*/, '');
    term = term.replace(/^["'«“](.*)["'»”]$/, '$1');
    term = term.trim();
    if (term.length >= 2 && term.length <= 80 && !result.includes(term)) {
      result.push(term);
    }
  }
  return result;
}

export const TalkGlossaryModal: React.FC<TalkGlossaryModalProps> = ({
  isOpen,
  onClose,
  roomId,
  onGlossaryUpdated,
}) => {
  const [terms, setTerms] = useState<string[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchGlossary = async () => {
    if (!roomId) return;
    try {
      const res = await authService.authFetch(
        `${BACKEND_URL}/api/rooms/${encodeURIComponent(roomId)}/glossary`
      );
      if (res.ok) {
        const data = await res.json();
        setTerms(data.terms || []);
        onGlossaryUpdated?.(data.terms?.length || 0);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen && roomId) {
      setInputText('');
      void fetchGlossary();
    }
  }, [isOpen, roomId]);

  if (!isOpen) return null;

  const saveGlossary = async (newTerms: string[]) => {
    setIsSaving(true);
    try {
      const res = await authService.authFetch(
        `${BACKEND_URL}/api/rooms/${encodeURIComponent(roomId)}/glossary`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ terms: newTerms }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setTerms(data.terms || []);
        onGlossaryUpdated?.(data.terms?.length || 0);
      }
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const newItems = parseGlossaryInput(inputText);
    if (newItems.length === 0) return;

    const merged = Array.from(new Set([...terms, ...newItems]));
    setInputText('');
    void saveGlossary(merged);
  };

  const handleRemove = (termToRemove: string) => {
    const updated = terms.filter((t) => t !== termToRemove);
    void saveGlossary(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 font-sans animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-2xl max-h-[90vh] bg-[#09090d] border border-zinc-800/90 rounded-lg p-5 sm:p-6 space-y-4 shadow-2xl shadow-black/90 font-mono flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            <h2 className="text-sm font-bold text-white font-mono tracking-wider uppercase">
              Technical Glossary · {roomId.toUpperCase()}
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

        {/* Stage Vocabulary List Box */}
        <div className="space-y-2 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between text-[11px] font-mono shrink-0">
            <span className="text-zinc-400 font-medium">
              Stage Vocabulary {terms.length > 0 && `(${terms.length} active terms)`}
            </span>
            {terms.length > 0 && (
              <button
                type="button"
                onClick={() => void saveGlossary([])}
                className="text-zinc-500 hover:text-red-400 text-[10px] uppercase transition-colors cursor-pointer"
              >
                Clear all
              </button>
            )}
          </div>

          {terms.length === 0 ? (
            <div className="border border-zinc-800/80 border-dashed rounded-xs p-6 text-center text-zinc-600 text-xs bg-zinc-950/30 flex-1 flex flex-col items-center justify-center min-h-[140px]">
              <span>No custom terms registered yet for this stage.</span>
              <span className="text-[11px] text-zinc-700 mt-1">Add brand names, libraries, tech terms, or speaker names below.</span>
            </div>
          ) : (
            <div className="flex flex-wrap content-start gap-1.5 min-h-[140px] max-h-56 overflow-y-auto p-3 border border-zinc-800/80 rounded-xs bg-zinc-950/60 flex-1">
              {terms.map((term) => (
                <span
                  key={term}
                  className="inline-flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 text-zinc-200 px-2.5 py-1 text-xs rounded-xs hover:border-zinc-700 transition-colors"
                >
                  <span className="font-medium">{term}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(term)}
                    className="text-zinc-500 hover:text-red-400 cursor-pointer ml-0.5 text-xs font-bold transition-colors"
                    title={`Remove ${term}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Input Form con altura generosa */}
        <form onSubmit={handleAdd} className="space-y-2.5 pt-3 border-t border-zinc-800/80 shrink-0">
          <div className="space-y-1">
            <label className="text-[11px] font-mono text-zinc-400 block font-medium">
              Add New Terms (supports multi-line paste, comma or newline separated)
            </label>
            <textarea
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Example: Kubernetes, PostgreSQL, FastAPI, Claude, WebRTC, TailwindCSS, Nerdearla..."
              className="w-full bg-zinc-900/90 border border-zinc-800/90 hover:border-zinc-700 focus:border-amber-500 p-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none text-xs font-mono rounded-xs resize-y min-h-[90px] max-h-48 transition-colors"
            />
          </div>
          <div className="flex justify-between items-center pt-1">
            <span className="text-[10px] text-zinc-500 font-mono">
              Press Enter to add, Shift+Enter for new line
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs uppercase cursor-pointer rounded-xs transition-colors"
              >
                Done
              </button>
              <button
                type="submit"
                disabled={isSaving || !inputText.trim()}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase transition-all cursor-pointer disabled:opacity-40 rounded-xs shadow-md shadow-amber-500/20"
              >
                {isSaving ? 'Saving...' : '+ Add Terms'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
