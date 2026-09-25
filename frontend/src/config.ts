import type { RoomOption, LanguageOption } from './types';

const isBrowser = typeof window !== 'undefined';
const isDev = import.meta.env.DEV;

// 1. BACKEND_URL (HTTP / REST)
// Si se define VITE_BACKEND_URL (ej. en Docker o build), se usa esa URL.
// En DEV usa http://localhost:8000
// En Producción en un dominio real (ej. https://nerdearla.app) se adapta automáticamente al origen actual
export const BACKEND_URL: string =
  import.meta.env.VITE_BACKEND_URL ||
  (isDev ? 'http://localhost:8000' : (isBrowser ? window.location.origin : ''));

// 2. WS_BACKEND_URL (WebSockets)
// Si se define VITE_WS_BACKEND_URL, se usa esa URL.
// En DEV usa ws://localhost:8000
// En Producción usa automáticamente wss:// (si es HTTPS) o ws:// (si es HTTP) con el host del dominio publicado
export const WS_BACKEND_URL: string =
  import.meta.env.VITE_WS_BACKEND_URL ||
  (isDev
    ? 'ws://localhost:8000'
    : (isBrowser
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
        : 'ws://localhost:8000'));

export const ADMIN_SECRET_TOKEN: string =
  import.meta.env.VITE_ADMIN_TOKEN || 'AdminSecret2026';

export const AVAILABLE_ROOMS: RoomOption[] = [];

export const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { id: 'es', label: 'Español' },
  { id: 'dual', label: 'Bilingüe (Original + Español)' },
  { id: 'en', label: 'English' },
  { id: 'pt', label: 'Português' },
];
