export interface Subtitle {
  id: string;
  seq?: number;
  speaker_lang?: string;
  transcription?: string;
  translations?: Record<string, string>;
  text: string;
  original?: string;
  is_final?: boolean;
  translation_error?: boolean;
  timestamp: number;
}

/**
 * Obtiene el texto adecuado según el idioma solicitado por el usuario o el overlay.
 * Resuelve de forma transparente transcripción nativa vs traducción, sin mezclar idiomas.
 */
export function getSubtitleContent(sub: Subtitle, requestedLanguage: string): string {
  if (requestedLanguage === 'dual' || requestedLanguage === 'bilingual') {
    const orig = (sub.transcription || sub.original || sub.text || '').trim();
    const sp = (sub.translations?.['es'] || (sub.speaker_lang === 'es' ? orig : '')).trim();
    if (orig && sp && orig.toLowerCase() !== sp.toLowerCase()) {
      return `${orig}\n${sp}`;
    }
    return sp || orig;
  }

  const isOriginal = requestedLanguage === 'original';
  const originalText = (sub.transcription || sub.original || '').trim();

  // Si pide audio original, devolver la transcripción directa del orador
  if (isOriginal) {
    return originalText || (sub.text || '').trim();
  }

  // Normalizar código destino ('es-tr' -> 'es', 'pt-tr' -> 'pt', 'en-tr' -> 'en')
  const targetCode = requestedLanguage.startsWith('es') ? 'es'
                   : requestedLanguage.startsWith('pt') ? 'pt'
                   : requestedLanguage.startsWith('en') ? 'en'
                   : requestedLanguage;

  // Si el orador habló en ese mismo idioma (ej: orador en español y usuario pide español):
  if (sub.speaker_lang === targetCode) {
    return originalText || (sub.text || '').trim();
  }

  // Si hay traducción en el diccionario de traducciones:
  if (sub.translations && sub.translations[targetCode]) {
    const translated = sub.translations[targetCode].trim();
    // Si la traducción no es vacía y no es idéntica al fallback erróneo en otro idioma
    if (translated) {
      return translated;
    }
  }

  // Si el usuario eligió un idioma diferente al del orador y aún no llegó la traducción
  // (o hubo error), NUNCA mostrar el texto en el idioma incorrecto.
  return '';
}

/**
 * Helper unificado para acumular, actualizar y ordenar subtítulos en vivo.
 * Evita la duplicación de código entre WebSocket y SSE.
 */
export function mergeSubtitleList(
  prev: Subtitle[],
  incoming: Subtitle,
  maxSubtitles: number = 4
): Subtitle[] {
  let updated: Subtitle[];
  const existingIdx = prev.findIndex((s) => s.id === incoming.id);

  if (existingIdx !== -1) {
    updated = [...prev];
    updated[existingIdx] = {
      ...updated[existingIdx],
      seq: incoming.seq ?? updated[existingIdx].seq,
      speaker_lang: incoming.speaker_lang || updated[existingIdx].speaker_lang,
      transcription: incoming.transcription || updated[existingIdx].transcription,
      translations: { ...(updated[existingIdx].translations || {}), ...(incoming.translations || {}) },
      text: incoming.text || updated[existingIdx].text,
      original: incoming.original || updated[existingIdx].original,
      is_final: incoming.is_final ?? updated[existingIdx].is_final,
      translation_error: incoming.translation_error ?? updated[existingIdx].translation_error,
      timestamp: incoming.timestamp || updated[existingIdx].timestamp,
    };
  } else {
    const lastIdx = prev.length - 1;
    if (lastIdx >= 0 && !prev[lastIdx].is_final) {
      updated = [...prev];
      updated[lastIdx] = incoming;
    } else {
      updated = [...prev.slice(-(maxSubtitles - 1)), incoming];
    }
  }

  // Filtrar cualquier interim huérfano anterior que haya quedado en el historial
  return updated.filter((item, idx, arr) => {
    if (idx < arr.length - 1 && !item.is_final) {
      return false;
    }
    return true;
  });
}

export type RoomStatus = 'ONLINE' | 'IDLE';

export interface RoomTelemetry {
  room_id: string;
  status: RoomStatus;
  audience_count: number;
  latency_ms: number;
  has_srt: boolean;
  srt_file?: string;
  is_visible?: boolean;
}

export interface StatusApiResponse {
  telemetry: RoomTelemetry[];
  total_active_streams: number;
}

export interface RoomOption {
  id: string;
  label: string;
  is_live?: boolean;
  is_visible?: boolean;
  speaker_lang?: string;
}

export interface LanguageOption {
  id: string;
  label: string;
}
