import { useState, useRef, useCallback } from 'react';
import { WS_BACKEND_URL } from '../config';

interface UseAudioStreamerOptions {
  room: string;
  sourceLang?: string;
}

export function useAudioStreamer({
  room,
  sourceLang = 'es',
}: UseAudioStreamerOptions) {
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<AudioWorkletNode | null>(null);

  const stopStreaming = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.port.onmessage = null;
      try {
        processorRef.current.disconnect();
      } catch { }
      processorRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch { }
      sourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch { }
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => { });
      audioContextRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      } catch { }
      wsRef.current = null;
    }

    setIsStreaming(false);
    setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (!mediaStreamRef.current) return;
    const audioTracks = mediaStreamRef.current.getAudioTracks();
    if (audioTracks.length === 0) return;

    const newMuted = !isMuted;
    audioTracks.forEach((track) => {
      track.enabled = !newMuted;
    });
    setIsMuted(newMuted);
  }, [isMuted]);

  const startStreaming = useCallback(async () => {
    setAudioError(null);

    try {
      // 1. Solicitar acceso al micrófono
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Conectar al WebSocket — solo mandamos el idioma del orador.
      // La traducción a todos los idiomas destino la resuelve el backend.
      const wsUrl = `${WS_BACKEND_URL}/ws/stream/${encodeURIComponent(room)}?source_lang=${encodeURIComponent(sourceLang)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = (e) => reject(e);
      });

      ws.onclose = () => stopStreaming();
      ws.onerror = () => stopStreaming();

      // 3. Procesar audio a PCM 16-bit Mono vía AudioWorklet
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      await audioCtx.audioWorklet.addModule('/audio-processor.js');
      const workletNode = new AudioWorkletNode(audioCtx, 'audio-processor');
      processorRef.current = workletNode;

      workletNode.port.onmessage = (event) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        try {
          ws.send(event.data);
        } catch {
          stopStreaming();
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioCtx.destination);

      setIsStreaming(true);
      setIsMuted(false);
    } catch (err) {
      stopStreaming();
      const message = err instanceof Error ? err.message : 'Could not access microphone or connect to streaming server';
      setAudioError(message);
    }
  }, [room, sourceLang, stopStreaming]);

  return {
    isStreaming,
    isMuted,
    audioError,
    startStreaming,
    stopStreaming,
    toggleMute,
  };
}