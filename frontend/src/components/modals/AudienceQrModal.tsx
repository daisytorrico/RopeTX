import React, { useState } from 'react';
import { X, Copy, Check, QrCode, ExternalLink } from 'lucide-react';

interface AudienceQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: string;
}

export const AudienceQrModal: React.FC<AudienceQrModalProps> = ({
  isOpen,
  onClose,
  room,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generar URL para la audiencia: si estamos en localhost, usar la IP de red local
  // para que los celulares puedan acceder vía la misma red WiFi
  const rawOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  // Si estamos en localhost, intentar usar la IP de red local del .env o mantener el origin real
  const VITE_PUBLIC_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PUBLIC_URL) || '';
  const origin = VITE_PUBLIC_URL || rawOrigin;
  const audienceUrl = `${origin}/?room=${encodeURIComponent(room)}`;
  // Generador de QR vectorial limpio y de alta resolución
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(audienceUrl)}&margin=10&color=ffffff&bgcolor=09090b`;

  const handleCopy = () => {
    navigator.clipboard.writeText(audienceUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-[#09090b] border border-zinc-800 rounded-xl max-w-sm w-full p-6 space-y-5 shadow-2xl shadow-black relative text-center select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2 text-left">
            <QrCode className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider">
              QR de Audiencia
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white p-1 transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sala actual */}
        <div className="space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">
            Escenario Conectado
          </span>
          <span className="text-base font-bold font-mono text-amber-400 tracking-wide">
            {room.toUpperCase()}
          </span>
        </div>

        {/* Contenedor del QR */}
        <div className="flex flex-col items-center justify-center p-3 bg-zinc-950 border border-zinc-800/90 rounded-lg">
          <img
            src={qrImageUrl}
            alt={`QR Code para ${room}`}
            className="w-56 h-56 rounded-md shadow-inner object-contain"
            loading="eager"
          />
          <p className="text-[11px] font-mono text-zinc-400 mt-2.5">
            Escaneá para abrir los subtítulos en tu celular
          </p>
        </div>

        {/* URL y Botones */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs font-mono text-zinc-300">
            <span className="truncate flex-1 text-left select-all">{audienceUrl}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="text-zinc-400 hover:text-white p-1 transition-colors cursor-pointer shrink-0"
              title="Copiar enlace"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 py-2 bg-amber-400 hover:bg-amber-300 text-black font-bold font-mono text-xs rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Copiar Link'}</span>
            </button>
            <a
              href={audienceUrl}
              target="_blank"
              rel="noreferrer"
              className="py-2 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-mono text-xs rounded transition-all flex items-center justify-center"
              title="Abrir en pestaña nueva"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
