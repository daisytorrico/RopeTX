import React, { useEffect, useState } from 'react';
import { FileText, Download, RefreshCw, Trash2 } from 'lucide-react';
import { BACKEND_URL } from '../../config';
import { authService } from '../../services/authService';

interface ExportedFile {
  filename: string;
  size_bytes: number;
  modified_time: string;
  server_path: string;
}

interface ExportsResponse {
  exports_dir: string;
  total_files: number;
  files: ExportedFile[];
}

interface ExportsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportsModal: React.FC<ExportsModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<ExportsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExports = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authService.authFetch(`${BACKEND_URL}/api/exports`);
      if (res.ok) {
        const json: ExportsResponse = await res.json();
        setData(json);
      } else {
        setError(`ERR_QUERY: ${res.status}`);
      }
    } catch {
      setError('ERR_CONNECTION');
    } finally {
      setIsLoading(false);
    }
  };

  const [fileToConfirm, setFileToConfirm] = useState<string | null>(null);
  const [isConfirmingPurge, setIsConfirmingPurge] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      void fetchExports();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const downloadFile = async (filename: string) => {
    setError(null);
    try {
      const relativeUrl = `/api/download-srt-file/${encodeURIComponent(filename)}`;
      let res = await authService.authFetch(relativeUrl);
      if (!res.ok && BACKEND_URL) {
        res = await authService.authFetch(
          `${BACKEND_URL}/api/download-srt-file/${encodeURIComponent(filename)}`
        );
      }
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        setError('Download failed: File not available on server');
      }
    } catch {
      setError('Connection error while downloading file');
    }
  };

  const executeDeleteFile = async (filename: string) => {
    setFileToConfirm(null);
    setDeletingFile(filename);
    setError(null);
    try {
      const res = await authService.authFetch(
        `${BACKEND_URL}/api/exports/${encodeURIComponent(filename)}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                total_files: Math.max(0, prev.total_files - 1),
                files: prev.files.filter((f) => f.filename !== filename),
              }
            : null
        );
      } else {
        setError(`Error ${res.status} deleting file`);
      }
    } catch {
      setError('Could not connect to server to delete file');
    } finally {
      setDeletingFile(null);
    }
  };

  const executeClearAllFiles = async () => {
    setIsConfirmingPurge(false);
    setIsClearingAll(true);
    setError(null);
    try {
      const res = await authService.authFetch(`${BACKEND_URL}/api/exports`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setData((prev) => (prev ? { ...prev, total_files: 0, files: [] } : null));
      } else {
        setError(`Error ${res.status} purging files`);
      }
    } catch {
      setError('Connection error while purging files');
    } finally {
      setIsClearingAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md font-sans animate-in fade-in duration-150 select-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="exports-dialog-title"
        className="w-full max-w-xl bg-[#09090d] border border-zinc-800/90 rounded-lg p-5 sm:p-6 space-y-4 shadow-2xl shadow-black/90 font-mono flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            <h2 id="exports-dialog-title" className="text-sm font-bold text-white font-mono tracking-wider uppercase">
              SRT Archives & Exports
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchExports}
              disabled={isLoading || isClearingAll}
              title="Refresh files"
              className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 cursor-pointer rounded-xs hover:bg-zinc-800/60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 cursor-pointer rounded-xs hover:bg-zinc-800/60"
              title="Close"
            >
              <span className="font-mono text-xs font-bold px-1.5">[ESC]</span>
            </button>
          </div>
        </div>

        {/* Directory Bar */}
        <div className="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xs flex items-center justify-between text-[11px] text-zinc-400">
          <div className="space-y-0.5 truncate pr-2">
            <div>
              <span className="text-zinc-500 font-bold">DIRECTORY: </span>
              <code className="text-zinc-300 font-mono">{data?.exports_dir || 'backend/exports/'}</code>
            </div>
          </div>

          {data && data.files.length > 0 && (
            isConfirmingPurge ? (
              <div className="flex items-center gap-2 bg-red-950/60 border border-red-800 px-2.5 py-1 rounded-xs shrink-0">
                <span className="text-[11px] text-red-300 font-bold">Purge all?</span>
                <button
                  type="button"
                  onClick={() => setIsConfirmingPurge(false)}
                  className="px-2 py-0.5 border border-zinc-700 bg-zinc-900 text-zinc-300 text-[10px] uppercase rounded-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeClearAllFiles}
                  disabled={isClearingAll}
                  className="px-2.5 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[10px] uppercase font-bold rounded-xs cursor-pointer shadow-xs"
                >
                  {isClearingAll ? 'Purging...' : 'Confirm'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingPurge(true)}
                disabled={isClearingAll}
                className="border border-zinc-800 hover:border-red-900 hover:text-red-400 text-zinc-500 text-[10px] px-2 py-1 uppercase rounded-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                title="Delete all archive files"
              >
                <Trash2 className="w-3 h-3" />
                <span>{isClearingAll ? 'Purging...' : 'Purge All'}</span>
              </button>
            )
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-2.5 bg-red-950/30 border border-red-800/60 text-red-400 text-xs font-mono rounded-xs">
            {error}
          </div>
        )}

        {/* Files List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[160px] max-h-[340px] pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-36 text-zinc-600 font-mono text-xs">
              SCANNING ARCHIVE STORAGE...
            </div>
          ) : !data?.files || data.files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 text-zinc-600 space-y-1 border border-zinc-800/80 border-dashed rounded-xs bg-zinc-950/30">
              <span className="text-xs font-bold">NO EXPORTED SRT FILES FOUND</span>
              <span className="text-[10px] text-zinc-500">Files appear automatically upon stream completion.</span>
            </div>
          ) : (
            data.files.map((file) => {
              const isDeleting = deletingFile === file.filename;
              return (
                <div
                  key={file.filename}
                  className="flex items-center justify-between p-3 border border-zinc-800/80 bg-zinc-950/60 hover:border-zinc-700 rounded-xs transition-colors"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold text-zinc-200 text-xs truncate">{file.filename}</div>
                      <div className="text-[10px] text-zinc-500 flex items-center gap-2">
                        <span className="tabular-nums">{(file.size_bytes / 1024).toFixed(1)} KB</span>
                        <span>·</span>
                        <span className="tabular-nums">{new Date(file.modified_time).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <button
                      type="button"
                      onClick={() => downloadFile(file.filename)}
                      className="border border-zinc-800 hover:border-amber-500 hover:text-amber-400 text-zinc-300 px-2.5 py-1 text-[11px] uppercase rounded-xs transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </button>
                    {fileToConfirm === file.filename ? (
                      <div className="flex items-center gap-1.5 bg-red-950/40 border border-red-900 px-2 py-0.5 rounded-xs">
                        <span className="text-[10px] text-red-300 font-bold">Delete?</span>
                        <button
                          type="button"
                          onClick={() => setFileToConfirm(null)}
                          className="border border-zinc-800 bg-zinc-900 text-zinc-300 px-1.5 py-0.5 text-[10px] uppercase rounded-xs cursor-pointer"
                        >
                          No
                        </button>
                        <button
                          type="button"
                          onClick={() => executeDeleteFile(file.filename)}
                          disabled={isDeleting}
                          className="bg-red-600 hover:bg-red-500 text-white px-2 py-0.5 text-[10px] uppercase font-bold rounded-xs cursor-pointer shadow-xs"
                        >
                          {isDeleting ? '...' : 'Yes'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setFileToConfirm(file.filename)}
                        disabled={isDeleting}
                        title="Delete file"
                        className="border border-zinc-900 hover:border-red-900/80 hover:text-red-400 text-zinc-600 p-1.5 uppercase rounded-xs transition-colors cursor-pointer flex items-center"
                      >
                        <Trash2 className={`w-3.5 h-3.5 ${isDeleting ? 'animate-pulse text-red-500' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-500">
          <div>TOTAL: <span className="text-zinc-300 font-bold tabular-nums">{data?.total_files || 0}</span> ARCHIVES</div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs uppercase cursor-pointer rounded-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
