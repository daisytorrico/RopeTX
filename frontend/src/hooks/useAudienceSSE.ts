import { useState, useEffect, useRef } from 'react';
import { BACKEND_URL } from '../config';
import type { Subtitle } from '../types';
import { mergeSubtitleList } from '../types';

export interface UseAudienceSSEOptions {
  room: string;
  enabled?: boolean;
  maxSubtitles?: number;
}

/**
 * Reemplazo directo de useAudienceWebSocket para la vista de audiencia (no monitor).
 * Misma forma de salida, así SubtitleDisplay y cualquier componente que ya lo use
 * no necesitan cambiar. La diferencia interna es el transporte: SSE en vez de WS,
 * con reconexión nativa del navegador (Last-Event-ID) manejada por el backend.
 *
 * El filtrado por idioma NO pasa por acá: el objeto Subtitle completo (text,
 * original, translations, speaker_lang) viaja siempre entero, y quien decide
 * qué mostrar es getSubtitleContent() en el componente, igual que con el WS.
 */
export function useAudienceSSE(optionsOrRoom: string | UseAudienceSSEOptions) {
  const options: UseAudienceSSEOptions =
    typeof optionsOrRoom === 'string' ? { room: optionsOrRoom } : optionsOrRoom;

  const { room, enabled = true, maxSubtitles = 4 } = options;

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [lastReceivedAt, setLastReceivedAt] = useState<number | null>(null);
  const [asrStatus, setAsrStatus] = useState<'available' | 'unavailable'>('available');
  const [isSimulated] = useState<boolean>(false);
  const [detectedSourceLang] = useState<string | null>(null); // solo llega a monitores hoy, no a audiencia

  const [prevRoom, setPrevRoom] = useState<string>(room);
  const sourceRef = useRef<EventSource | null>(null);
  const lastRenderRef = useRef<number>(0);

  if (prevRoom !== room) {
    setPrevRoom(room);
    setIsLive(false);
    setSubtitles([]);
    setLastReceivedAt(null);
    setAsrStatus('available');
  }

  useEffect(() => {
    if (!enabled || !room) return;

    const url = `${BACKEND_URL}/sse/audience/${encodeURIComponent(room)}`;
    const source = new EventSource(url);
    sourceRef.current = source;

    source.onopen = () => setIsConnected(true);

    source.addEventListener('clear', () => {
      setSubtitles([]);
      setLastReceivedAt(null);
    });

    source.addEventListener('status', (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data);
        if (data && typeof data.is_live === 'boolean') {
          setIsLive(Boolean(data.is_live));
        }
      } catch {}
    });

    source.addEventListener('subtitle', (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data);

        if (data.type === 'room_state' || (data.type === 'status' && typeof data.is_live === 'boolean')) {
          setIsLive(Boolean(data.is_live));
          return;
        }

        if (data.type === 'clear' || data.type === 'clear_history') {
          setSubtitles([]);
          setLastReceivedAt(null);
          return;
        }

        const textVal = typeof data.text === 'string' ? data.text.trim() : '';
        const origVal = typeof data.original === 'string' ? data.original.trim() : '';
        if (!textVal && !origVal) return;

        const isFinal = Boolean(data.is_final);

        // Mismo throttling visual que la versión WebSocket: 10 FPS para interims
        const now = Date.now();
        if (!isFinal && now - lastRenderRef.current < 100) return;
        lastRenderRef.current = now;

        setAsrStatus('available');
        setIsLive(true);
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
      } catch (err) {
        console.error('Error al parsear evento SSE:', err);
      }
    });

    // Ping de keepalive del backend (cada ~15s); confirma que la conexión sigue viva
    source.addEventListener('ping', () => setIsConnected(true));

    source.onerror = () => {
      // EventSource reintenta solo con backoff propio del navegador.
      // readyState CONNECTING = reintentando; CLOSED = se dio por vencido (raro, solo tras cerrar explícito).
      setIsConnected(source.readyState === EventSource.OPEN);
    };

    return () => {
      source.close();
      sourceRef.current = null;
      setIsConnected(false);
    };
  }, [room, enabled, maxSubtitles]);

  const resetAsrStatus = () => setAsrStatus('available');

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