import React, { useState, useRef } from 'react';
import {
  Mic,
  Upload,
  Play,
  Square,
  Loader2,
  AlertCircle,
  Link2,
} from 'lucide-react';
import { BACKEND_URL } from '../../config';
import { authService } from '../../services/authService';
import type { RoomTelemetry } from '../../types';
import { SpeakerLangSelector, type SpeakerLang } from '../common/SpeakerLangSelector';

interface AudioInjectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  telemetry: RoomTelemetry[];
  selectedRoom: string;
  onSelectRoom: (roomId: string) => void;
  isMicStreaming: boolean;
  startMic: () => Promise<void>;
  stopMic: () => void;
  micRoom: string | null;
  setMicRoom: (room: string | null) => void;
  speakerLang: SpeakerLang;
  setSpeakerLang: (lang: SpeakerLang) => void;
  onStreamStarted: () => Promise<void>;
}

interface DemoAudioItem {
  filename: string;
  size_mb: number;
  format: string;
}

export const AudioInjectionModal: React.FC<AudioInjectionModalProps> = ({
  isOpen,
  onClose,
  telemetry,
  selectedRoom,
  onSelectRoom,
  isMicStreaming,
  startMic,
  stopMic,
  micRoom,
  setMicRoom,
  speakerLang,
  setSpeakerLang,
  onStreamStarted,
}) => {
  const [sourceType, setSourceType] = useState<'file' | 'mic' | 'url' | 'demo'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [demoAudios, setDemoAudios] = useState<DemoAudioItem[]>([]);
  const [selectedDemoFile, setSelectedDemoFile] = useState<string>('charla_prueba.wav');
  const [isUploading, setIsUploading] = useState(false);
  const [isStartingDemo, setIsStartingDemo] = useState(false);
  const [isStartingUrl, setIsStartingUrl] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      authService
        .authFetch(`${BACKEND_URL}/api/demo-audios`)
        .then((res) => res.json())
        .then((data) => {
          if (data?.files && Array.isArray(data.files)) {
            setDemoAudios(data.files);
            if (data.files.length > 0 && (!selectedDemoFile || !data.files.some((f: DemoAudioItem) => f.filename === selectedDemoFile))) {
              setSelectedDemoFile(data.files[0].filename);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  React.useEffect(() => {
    if (isOpen && isMicStreaming) {
      setSourceType('mic');
    }
  }, [isOpen, isMicStreaming]);

  if (!isOpen) return null;

  const currentRoomData = telemetry.find((r) => r.room_id === selectedRoom);
  const isRoomLive = currentRoomData?.status === 'ONLINE' || (isMicStreaming && micRoom === selectedRoom);

  const handleFileValidation = (file: File) => {
    setErrorMessage(null);
    const validExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));

    if (!hasValidExt) {
      setErrorMessage('ERR_FORMAT: Allowed: .mp3, .wav, .m4a, .ogg, .flac');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setStatusMessage(`SELECTED: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setErrorMessage(null);
    setStatusMessage(`STREAMING: ${selectedFile.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await authService.authFetch(
        `${BACKEND_URL}/api/upload-stream/${encodeURIComponent(selectedRoom)}?source_lang=${speakerLang}`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (res.ok) {
        setStatusMessage(`INGEST_OK: Streaming to ${selectedRoom}`);
        await onStreamStarted();
        setTimeout(onClose, 600);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.detail || `ERR_UPLOAD: ${res.status}`);
      }
    } catch {
      setErrorMessage('ERR_CONN: Failed to reach backend');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSimulateDemo = async () => {
    setIsStartingDemo(true);
    setErrorMessage(null);
    setStatusMessage('INITIALIZING_DEMO...');

    try {
      const fileParam = selectedDemoFile ? `&filename=${encodeURIComponent(selectedDemoFile)}` : '';
      const res = await authService.authFetch(
        `${BACKEND_URL}/api/simulate-stream/${encodeURIComponent(selectedRoom)}?source_lang=${speakerLang}${fileParam}`,
        { method: 'POST' }
      );

      if (res.ok) {
        setStatusMessage(`DEMO_ACTIVE: ${selectedRoom}`);
        await onStreamStarted();
        setTimeout(onClose, 600);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.detail || `ERR_DEMO: ${res.status}`);
      }
    } catch {
      setErrorMessage('ERR_CONN: Backend disconnected');
    } finally {
      setIsStartingDemo(false);
    }
  };

  const handleStartUrlStream = async () => {
    if (!streamUrl.trim()) return;
    setIsStartingUrl(true);
    setErrorMessage(null);
    setStatusMessage(`CONNECTING_STREAM_URL: ${streamUrl}...`);

    try {
      const res = await authService.authFetch(
        `${BACKEND_URL}/api/stream-url/${encodeURIComponent(selectedRoom)}?stream_url=${encodeURIComponent(
          streamUrl.trim()
        )}&source_lang=${speakerLang}`,
        { method: 'POST' }
      );

      if (res.ok) {
        setStatusMessage(`URL_STREAM_ACTIVE: ${selectedRoom}`);
        await onStreamStarted();
        setTimeout(onClose, 600);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.detail || `ERR_STREAM_URL: ${res.status}`);
      }
    } catch {
      setErrorMessage('ERR_CONN: Backend disconnected');
    } finally {
      setIsStartingUrl(false);
    }
  };

  const handleToggleMic = async () => {
    if (isMicStreaming) {
      const targetRoom = micRoom || selectedRoom;
      stopMic();
      setMicRoom(null);
      if (targetRoom) {
        try {
          await authService.authFetch(
            `${BACKEND_URL}/api/stop-stream/${encodeURIComponent(targetRoom)}`,
            { method: 'POST' }
          );
        } catch {}
      }
      await onStreamStarted();
      onClose();
    } else {
      setMicRoom(selectedRoom);
      await startMic();
      await onStreamStarted();
      setTimeout(onClose, 600);
    }
  };

  const handleStopActiveStream = async () => {
    setIsStopping(true);
    setErrorMessage(null);
    try {
      if (isMicStreaming && (micRoom === selectedRoom || !micRoom)) {
        stopMic();
        setMicRoom(null);
      }
      const res = await authService.authFetch(
        `${BACKEND_URL}/api/stop-stream/${encodeURIComponent(selectedRoom)}`,
        { method: 'POST' }
      );
      if (res.ok) {
        setStatusMessage(`STREAM_STOPPED: ${selectedRoom}`);
        await onStreamStarted();
        setTimeout(onClose, 400);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMessage(err.detail || 'ERR_STOP');
      }
    } catch {
      setErrorMessage('ERR_CONN: Backend disconnected');
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md font-sans animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#09090d] border border-zinc-800/90 rounded-lg p-5 sm:p-6 space-y-5 shadow-2xl shadow-black/90">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
            <h2 className="text-sm font-bold text-white font-mono tracking-wider uppercase">
              Audio Source Setup
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

        {/* Row 1: Target Room & Speaker Language */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Target Room */}
          <div className="space-y-1.5">
            <label htmlFor="target-channel-select" className="text-[11px] font-mono text-zinc-400 block font-medium">
              Target Stage
            </label>
            <select
              id="target-channel-select"
              value={selectedRoom}
              onChange={(e) => onSelectRoom(e.target.value)}
              disabled={isRoomLive || telemetry.length === 0}
              className="w-full bg-zinc-900/90 border border-zinc-800/90 hover:border-zinc-700 px-3 py-2 text-zinc-100 text-xs font-mono rounded-xs outline-none focus:border-amber-500 cursor-pointer disabled:opacity-40 transition-colors"
            >
              {telemetry.length === 0 ? (
                <option value="">No stages configured</option>
              ) : (
                telemetry.map((r) => (
                  <option key={r.room_id} value={r.room_id} className="bg-zinc-950 text-zinc-200">
                    {r.room_id.toUpperCase()} {r.status === 'ONLINE' ? '● [LIVE]' : '[STANDBY]'}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Speaker Language */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-zinc-400 block font-medium">
              Speaker Language
            </label>
            <div className="pt-0.5">
              <SpeakerLangSelector value={speakerLang} onChange={setSpeakerLang} size="sm" />
            </div>
          </div>
        </div>

        {/* Row 2: Source Type Segmented Control (FILE | MIC | URL) — DEMO tiene su botón dedicado abajo */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-950 border border-zinc-800/80 rounded-xs font-mono select-none">
          <button
            type="button"
            onClick={() => setSourceType('file')}
            className={`py-2 px-2 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-xs ${
              sourceType === 'file'
                ? 'bg-zinc-800/90 text-amber-400 shadow-sm border border-zinc-700/80'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>FILE</span>
          </button>

          <button
            type="button"
            onClick={() => setSourceType('mic')}
            className={`py-2 px-2 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-xs ${
              sourceType === 'mic'
                ? 'bg-zinc-800/90 text-amber-400 shadow-sm border border-zinc-700/80'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>MIC</span>
          </button>

          <button
            type="button"
            onClick={() => setSourceType('url')}
            className={`py-2 px-2 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-xs ${
              sourceType === 'url'
                ? 'bg-zinc-800/90 text-amber-400 shadow-sm border border-zinc-700/80'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>URL</span>
          </button>
        </div>

        {/* Row 3: Active Source Area (Fixed Height Container) */}
        <div className="h-36 w-full p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xs flex items-center justify-center overflow-hidden">
          {sourceType === 'demo' && (
            <div className="w-full h-full flex flex-col justify-center space-y-2 px-2">
              <div className="flex items-center justify-between">
                <label htmlFor="demo-audio-select" className="text-[11px] font-mono text-zinc-400 font-medium">
                  Test Audio Track
                </label>
                <span className="text-[10px] font-mono text-zinc-500">
                  {demoAudios.length > 0 ? `${demoAudios.length} Available` : 'Default Track'}
                </span>
              </div>
              <select
                id="demo-audio-select"
                value={selectedDemoFile}
                onChange={(e) => setSelectedDemoFile(e.target.value)}
                disabled={isRoomLive}
                className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-amber-500 px-3 py-2 text-zinc-100 text-xs font-mono rounded-xs transition-colors cursor-pointer outline-none"
              >
                {demoAudios.length === 0 ? (
                  <option value="charla_prueba.wav">charla_prueba.wav (Default Tech Talk)</option>
                ) : (
                  demoAudios.map((file) => (
                    <option key={file.filename} value={file.filename} className="bg-zinc-950 text-zinc-200">
                      {file.filename} ({file.size_mb} MB · {file.format})
                    </option>
                  ))
                )}
              </select>
              <p className="text-[10px] text-zinc-500 font-mono">
                Select any pre-recorded audio from <code className="text-zinc-400">backend/test_audio/</code>.
              </p>
            </div>
          )}

          {sourceType === 'file' && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileValidation(file);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`w-full h-full border border-dashed rounded-xs text-center cursor-pointer transition-colors flex flex-col items-center justify-center p-3 ${
                isDragging
                  ? 'border-amber-500 bg-amber-500/5'
                  : selectedFile
                  ? 'border-zinc-700 bg-zinc-900/40'
                  : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/20 hover:bg-zinc-900/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,.flac,.aac"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileValidation(file);
                }}
              />
              <Upload className="w-5 h-5 mx-auto mb-1.5 text-zinc-500" />
              <div className="text-xs font-mono text-zinc-200 font-medium truncate max-w-[90%]">
                {selectedFile ? selectedFile.name : 'Drag and drop an audio file or click to browse'}
              </div>
              <div className="text-[10px] font-mono text-zinc-500 mt-1">
                MP3, WAV, M4A, OGG, FLAC
              </div>
            </div>
          )}

          {sourceType === 'mic' && (
            <div className="w-full h-full flex flex-col items-center justify-center text-center space-y-2">
              <div className="inline-flex p-2.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
                <Mic className={`w-5 h-5 ${isMicStreaming ? 'text-red-500 animate-pulse' : 'text-amber-400'}`} />
              </div>
              <div className="text-xs font-mono text-zinc-200 font-medium">
                {isMicStreaming ? 'Microphone active streaming live' : 'Local browser microphone input'}
              </div>
            </div>
          )}

          {sourceType === 'url' && (
            <div className="w-full h-full flex flex-col justify-center space-y-2 px-2">
              <label htmlFor="stream-url-input" className="text-[11px] font-mono text-zinc-400 block font-medium">
                Stream / Radio URL
              </label>
              <input
                id="stream-url-input"
                type="text"
                value={streamUrl}
                onChange={(e) => setStreamUrl(e.target.value)}
                placeholder="https://.../live.m3u8, rtmp://..., rtsp://..., or web radio URL"
                className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-amber-500 p-2.5 text-zinc-100 placeholder:text-zinc-600 focus:outline-none text-xs font-mono rounded-xs transition-colors"
              />
            </div>
          )}
        </div>

        {/* Feedback / Error Area */}
        <div className="min-h-[22px] flex items-center">
          {errorMessage && (
            <div className="w-full p-2 bg-red-950/30 border border-red-800/60 text-red-400 text-xs font-mono flex items-center gap-2 rounded-xs animate-in fade-in duration-100">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
          )}

          {statusMessage && !errorMessage && (
            <div className="text-xs font-mono text-amber-400 flex items-center gap-2 animate-in fade-in duration-100">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span className="truncate">{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Action Buttons: Standalone Demo Selector on Left + Cancel & Start/Stop Controls on Right */}
        <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-zinc-800/80 font-mono">
          {/* Botón Demo Selector aislado: Si se borra, los botones de la derecha se mantienen alineados naturalmente */}
          <div>
            <button
              type="button"
              onClick={() => setSourceType('demo')}
              className={`px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 rounded-xs border ${
                sourceType === 'demo'
                  ? 'bg-zinc-800/90 text-amber-400 border-amber-500/50 shadow-sm'
                  : 'bg-zinc-950 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
              }`}
              title="Select demo test audio"
            >
              <Play className="w-3.5 h-3.5 text-amber-400" />
              <span>DEMO</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 text-xs uppercase cursor-pointer rounded-xs transition-colors"
            >
              Cancel
            </button>

          {sourceType === 'demo' && (
            isRoomLive ? (
              <button
                type="button"
                onClick={handleStopActiveStream}
                disabled={isStopping}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase transition-all cursor-pointer flex items-center gap-1.5 rounded-xs shadow-md shadow-red-950/40"
              >
                {isStopping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-current" />}
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSimulateDemo}
                disabled={isStartingDemo}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 rounded-xs shadow-md shadow-amber-500/20"
              >
                {isStartingDemo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>Start</span>
              </button>
            )
          )}

          {sourceType === 'file' && (
            isRoomLive ? (
              <button
                type="button"
                onClick={handleStopActiveStream}
                disabled={isStopping}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase transition-all cursor-pointer flex items-center gap-1.5 rounded-xs shadow-md shadow-red-950/40"
              >
                {isStopping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-current" />}
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFileUpload}
                disabled={!selectedFile || isUploading}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 rounded-xs shadow-md shadow-amber-500/20"
              >
                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>Start</span>
              </button>
            )
          )}

          {sourceType === 'mic' && (
            <button
              type="button"
              onClick={handleToggleMic}
              className={`px-5 py-2 font-bold text-xs uppercase transition-all cursor-pointer flex items-center gap-1.5 rounded-xs ${
                isMicStreaming
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-950/40'
                  : 'bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/20'
              }`}
            >
              {isMicStreaming ? <Square className="w-3.5 h-3.5 fill-current" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isMicStreaming ? 'Stop' : 'Start'}</span>
            </button>
          )}

          {sourceType === 'url' && (
            isRoomLive ? (
              <button
                type="button"
                onClick={handleStopActiveStream}
                disabled={isStopping}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase transition-all cursor-pointer flex items-center gap-1.5 rounded-xs shadow-md shadow-red-950/40"
              >
                {isStopping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5 fill-current" />}
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartUrlStream}
                disabled={!streamUrl.trim() || isStartingUrl}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1.5 rounded-xs shadow-md shadow-amber-500/20"
              >
                {isStartingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                <span>Start</span>
              </button>
            )
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
