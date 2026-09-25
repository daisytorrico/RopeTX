import React from 'react';

interface RxLogoProps {
  className?: string;
  size?: number;
}

export const RxLogo: React.FC<RxLogoProps> = ({ className = 'w-8 h-8', size = 32 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="RopeTX Logo"
    >
      <defs>
        {/* Gradiente azul principal */}
        <linearGradient id="rx-blue-grad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="45%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>

        {/* Gradiente secundario para profundidad del empotrado */}
        <linearGradient id="rx-accent-grad" x1="20" y1="8" x2="44" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="70%" stopColor="#1e40af" />
          <stop offset="100%" stopColor="#172554" />
        </linearGradient>

        {/* Sombra de relieve interior para el efecto empotrado */}
        <filter id="rx-inset-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.6" />
        </filter>
      </defs>

      {/* Contenedor base oscuro con micro-borde azul */}
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="12"
        fill="#0b0d14"
        stroke="rgba(59, 130, 246, 0.25)"
        strokeWidth="1.5"
      />

      {/* Letra R empotrada e interbloqueada */}
      {/* Columna vertical de la R */}
      <rect
        x="10"
        y="12"
        width="5"
        height="24"
        rx="2.5"
        fill="url(#rx-blue-grad)"
      />

      {/* Bucle superior de la R */}
      <path
        d="M13 12H23C27.4183 12 31 15.134 31 19C31 22.866 27.4183 26 23 26H13V12Z"
        fill="url(#rx-blue-grad)"
        fillRule="evenodd"
        clipRule="evenodd"
      />
      {/* Hueco interior del bucle de la R */}
      <path
        d="M15 16.5H22C24.2091 16.5 26 17.6193 26 19C26 20.3807 24.2091 21.5 22 21.5H15V16.5Z"
        fill="#0b0d14"
      />

      {/* Letra X entrelazada / empotrada con la pata de la R */}
      {/* Diagonal descendente principal (pata de la R extendida hacia la X) */}
      <path
        d="M20 23.5L34.5 36C35.6046 36.9538 37.2882 36.8398 38.242 35.7352C39.1958 34.6307 39.0818 32.947 37.9772 31.9932L23.5 19.5L20 23.5Z"
        fill="url(#rx-blue-grad)"
        filter="url(#rx-inset-shadow)"
      />

      {/* Diagonal ascendente de la X que cruza y se empotra por detrás/delante */}
      <path
        d="M37.5 13.5C38.6046 14.4538 38.7186 16.1374 37.7648 17.242L28.8 27.6L25 24.2L33.9648 13.7648C34.9186 12.6602 36.6022 12.5462 37.5 13.5Z"
        fill="url(#rx-accent-grad)"
      />
      <path
        d="M23.5 33.8L18.7352 39.2352C17.7814 40.3398 16.0978 40.4538 14.9932 39.5C13.8887 38.5462 13.7747 36.8626 14.7285 35.758L19.5 30.3L23.5 33.8Z"
        fill="url(#rx-accent-grad)"
      />

      {/* Micro-nodo luminoso de interconexión en el cruce central */}
      <circle cx="27" cy="25" r="1.5" fill="#93c5fd" opacity="0.9" />
    </svg>
  );
};
