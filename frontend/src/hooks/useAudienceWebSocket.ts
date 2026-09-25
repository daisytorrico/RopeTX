import { useState, useEffect, useRef } from 'react';
import { WS_BACKEND_URL } from '../config';
import { authService } from '../services/authService';
import type { Subtitle } from '../types';
import { mergeSubtitleList } from '../types';

export interface UseAudienceWebSocketOptions {
  room: string;
  enabled?: boolean;
  role?: 'audience' | 'monitor';
  maxSubtitles?: number;
}

export function useAudienceWebSocket(
  optionsOrRoom: string | UseAudienceWebSocketOptions
) {
  const options: UseAudienceWebSocketOptions =
    typeof optionsOrRoom === 'string' ? { room: optionsOrRoom } : optionsOrRoom;

  const {
    room,
    enabled = true,
    role = 'audience',
    maxSubtitles = 4,
  } = options;

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [lastReceivedAt, setLastReceivedAt] = useState<number | null>(null);
  const [asrStatus, setAsrStatus] = useState<'available' | 'unavailable'>('available');
  const [isSimulated, setIsSimulated] = useState<boolean>(false);

  // Idioma detectado automáticamente por el ASR (solo se llena si source_lang='auto')
  const [detectedSourceLang, setDetectedSourceLang] = useState<string | null>(null);

  const [prevRoom, setPrevRoom] = useState<string>(room);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const retryAttemptRef = useRef<number>(0);
  const lastRenderRef = useRef<number>(0); // Referencia para throttling visual

  // Reiniciar subtítulos al cambiar de sala según la recomendación oficial de React
  if (prevRoom !== room) {
    setPrevRoom(room);
    setIsLive(false);
    setSubtitles([]);
    setLastReceivedAt(null);
    setAsrStatus('available');
    setIsSimulated(false);
    setDetectedSourceLang(null);
  }

  useEffect(() => {
    let isCleanedUp = false;
    if (!enabled) {
      return;
    }

    const connect = () => {
      if (isCleanedUp) return;

      const token = authService.getAccessToken();
      const tokenParam = role === 'monitor' && token ? `&token=${encodeURIComponent(token)}` : '';
      const wsUrl = `${WS_BACKEND_URL}/ws/audience/${encodeURIComponent(room)}?role=${role}${tokenParam}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isCleanedUp) {
          ws.close();
          return;
        }
        setIsConnected(true);
        retryAttemptRef.current = 0;
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);

          // Sincronización reactiva del estado de la sala (LIVE / STANDBY)
          if (data.type === 'room_state' || (data.type === 'status' && typeof data.is_live === 'boolean')) {
            setIsLive(Boolean(data.is_live));
            return;
          }

          // Mensajes de estado técnico del backend
          if (data.type === 'status') {
            if (data.code === 'asr_unavailable') {
              setAsrStatus('unavailable');
            } else if (data.code === 'language_detected' && data.effective_source) {
              // El ASR detectó automáticamente el idioma del orador
              setDetectedSourceLang(data.effective_source as string);
            }
            return;
          }

          if (data.type === 'clear' || data.type === 'clear_history') {
            setSubtitles([]);
            setLastReceivedAt(null);
            return;
          }

          if (data.simulated) {
            setIsSimulated(true);
          }

          // Validación estricta: el mensaje debe tener `text` con contenido real.
          // Los mensajes sin text (text='') son artefactos técnicos - no se muestran.
          // El campo `original` solo se preserva para la opción 'en-or' del selector.
          const textVal = typeof data.text === 'string' ? data.text.trim() : '';
          const origVal = typeof data.original === 'string' ? data.original.trim() : '';

          // Descartar mensajes vacíos
          if (!textVal && !origVal) return;

          const isFinal = Boolean(data.is_final);

          // Throttling visual: limitamos a 10 FPS (100ms) los textos parciales. Los finales pasan siempre.
          const now = Date.now();
          if (!isFinal && now - lastRenderRef.current < 100) {
            return; // Descartamos este frame para no saturar el DOM
          }
          lastRenderRef.current = now;

          setAsrStatus('available');
          setLastReceivedAt(Date.now());

          const msgId = data.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const seq = typeof data.seq === 'number' ? data.seq : undefined;
          const transError = Boolean(data.translation_error);
          const speakerLang = data.speaker_lang || data.language;
          const transcription = typeof data.transcription === 'string' ? data.transcription.trim() : origVal;
          const translations = data.translations || {};

          const incomingItem: Subtitle = {
            id: msgId,
            seq,
            speaker_lang: speakerLang,
            transcription: transcription,
            translations: translations,
            text: textVal,
            original: origVal,
            is_final: isFinal,
            translation_error: transError,
            timestamp: data.timestamp || Date.now(),
          };

          setSubtitles((prev) => mergeSubtitleList(prev, incomingItem, maxSubtitles));
        } catch {
          if (typeof event.data === 'string' && event.data.trim()) {
            setLastReceivedAt(Date.now());
            setSubtitles((prev) => [
              ...prev.slice(-(maxSubtitles - 1)),
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                text: event.data.trim(),
                timestamp: Date.now(),
              },
            ]);
          }
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (!isCleanedUp) {
          // Reconexión con backoff 1s, 2s, 4s, tope 8s
          const delay = Math.min(8000, 1000 * Math.pow(2, retryAttemptRef.current));
          retryAttemptRef.current += 1;
          reconnectTimeoutRef.current = window.setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        setIsConnected(false);
      };
    };

    connect();

    return () => {
      isCleanedUp = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [room, enabled, role, maxSubtitles]);

  const resetAsrStatus = () => {
    setAsrStatus('available');
  };

  return {
    isConnected,
    isLive,
    subtitles,
    lastReceivedAt,
    asrStatus,
    isSimulated,
    detectedSourceLang,
    resetAsrStatus,
  };
}