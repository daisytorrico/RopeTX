import React, { useState, useEffect } from 'react';
import type { RoomTelemetry, Subtitle } from '../../types';
import type { SpeakerLang } from '../common/SpeakerLangSelector';

interface StageTelemetryPanelProps {
  room: string;
  telemetry: RoomTelemetry | undefined;
  isLive: boolean;
  subtitles: Subtitle[];
  speakerLang?: SpeakerLang;
}

export const StageTelemetryPanel: React.FC<StageTelemetryPanelProps> = ({
  telemetry,
  isLive,
  subtitles,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    let interval: any = null;
    if (isLive) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLive]);

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const totalWords = subtitles.reduce((acc, sub) => {
    const words = sub.text.trim().split(/\s+/).filter(Boolean).length;
    return acc + words;
  }, 0);

  const latencyMs = telemetry?.latency_ms || 0;

  return (
    <aside className="w-44 md:w-48 bg-black border-l border-zinc-800/80 flex flex-col shrink-0 select-none font-mono text-xs">
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-800/80 text-[10px] text-zinc-500 uppercase tracking-wider font-semibold flex items-center justify-between">
        <span>Telemetry</span>
      </div>

      {/* Métricas Directas y Sin Relleno */}
      <div className="p-2.5 space-y-2 flex-1 overflow-y-auto">
        {/* Uptime */}
        <div className="px-2.5 py-2 bg-zinc-950 border border-zinc-800/80 rounded-xs">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-0.5">
            Uptime
          </span>
          <span className="text-lg font-bold tracking-tight text-white tabular-nums">
            {isLive ? formatUptime(elapsedSeconds) : '00:00'}
          </span>
        </div>

        {/* Latency */}
        <div className="px-2.5 py-2 bg-zinc-950 border border-zinc-800/80 rounded-xs">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-0.5">
            Latency
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                !isLive || latencyMs === 0
                  ? 'bg-zinc-700'
                  : latencyMs > 500
                  ? 'bg-red-400'
                  : latencyMs > 250
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
            />
            <span className="text-lg font-bold tracking-tight text-white tabular-nums">
              {isLive && latencyMs > 0 ? `${latencyMs}ms` : '--'}
            </span>
          </div>
        </div>

        {/* Audio */}
        <div className="px-2.5 py-2 bg-zinc-950 border border-zinc-800/80 rounded-xs">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-0.5">
            Audio Signal
          </span>
          <div className="flex items-center gap-2">
            {isLive ? (
              <div className="inline-flex items-end gap-0.5 h-3">
                <span className="w-1 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
                <span className="w-1 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
                <span className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" />
                <span className="w-1 h-1 bg-emerald-400 rounded-full animate-bounce" />
              </div>
            ) : (
              <span className="w-2 h-2 rounded-full bg-zinc-700 shrink-0" />
            )}
            <span className="text-[11px] font-bold text-zinc-200 truncate">
              {isLive ? '16kHz Live' : 'No Signal'}
            </span>
          </div>
        </div>

        {/* Audience */}
        <div className="px-2.5 py-2 bg-zinc-950 border border-zinc-800/80 rounded-xs">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-0.5">
            Audience
          </span>
          <span className="text-lg font-bold tracking-tight text-white tabular-nums">
            {telemetry?.audience_count ?? 0}
            <span className="text-[10px] text-zinc-500 font-normal ml-1">viewers</span>
          </span>
        </div>

        {/* Transcript Volume */}
        <div className="px-2.5 py-2 bg-zinc-950 border border-zinc-800/80 rounded-xs">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-0.5">
            Volume
          </span>
          <div className="flex items-baseline justify-between text-[11px] text-zinc-300 font-medium">
            <span>{subtitles.length} lines</span>
            <span className="text-zinc-600">·</span>
            <span>{totalWords > 999 ? `${(totalWords / 1000).toFixed(1)}k` : totalWords} w</span>
          </div>
        </div>

        {/* Ingest & Remote Support */}
        <div className="px-2.5 py-2 bg-zinc-950 border border-zinc-800/80 rounded-xs space-y-1">
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">
            Ingest / Remote
          </span>
          <div className="flex items-center justify-between text-[10px] text-zinc-300">
            <span className="text-zinc-500">Source</span>
            <span className="font-semibold text-zinc-200 truncate ml-1">Line-In 3.5mm</span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-zinc-300">
            <span className="text-zinc-500">Support</span>
            <span className="text-amber-400/90 font-mono font-medium ml-1">RustDesk Ready</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
