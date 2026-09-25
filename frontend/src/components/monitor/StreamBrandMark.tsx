import React from 'react';

interface StreamBrandMarkProps {
  className?: string;
  showText?: boolean;
}

const OBS_LOGO_PATH =
  'M12,24C5.383,24,0,18.617,0,12S5.383,0,12,0s12,5.383,12,12S18.617,24,12,24z M12,1.109 C5.995,1.109,1.11,5.995,1.11,12C1.11,18.005,5.995,22.89,12,22.89S22.89,18.005,22.89,12C22.89,5.995,18.005,1.109,12,1.109z M6.182,5.99c0.352-1.698,1.503-3.229,3.05-3.996c-0.269,0.273-0.595,0.483-0.844,0.78c-1.02,1.1-1.48,2.692-1.199,4.156c0.355,2.235,2.455,4.06,4.732,4.028c1.765,0.079,3.485-0.937,4.348-2.468c1.848,0.063,3.645,1.017,4.7,2.548 c0.54,0.799,0.962,1.736,0.991,2.711c-0.342-1.295-1.202-2.446-2.375-3.095c-1.135-0.639-2.529-0.802-3.772-0.425c-1.56,0.448-2.849,1.723-3.293,3.293c-0.377,1.25-0.216,2.628,0.377,3.772c-0.825,1.429-2.315,2.449-3.932,2.756c-1.244,0.261-2.551,0.059-3.709-.464c1.036,0.302,2.161,0.355,3.191-.011c1.381-.457,2.522-1.567,3.024-2.935c0.556-1.49,0.345-3.261-.591-4.54c-0.7-1.007-1.803-1.717-3.002-1.969c-0.38-.068-.764-.098-1.148-.134c-.611-1.231-.834-2.66-.528-3.996L6.182,5.99z';

/**
 * Official OBS Studio Pinwheel Icon (Black/Dark with white swirl or monochrome)
 */
export const ObsIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg viewBox="0 0 24 24" role="img" aria-label="OBS Studio" className={`fill-current ${className}`}>
    <path d={OBS_LOGO_PATH} />
  </svg>
);

/**
 * Official vMix 3x3 Matrix Grid Logo (Blue matrix with top-right green & bottom-left orange)
 */
export const VmixIcon: React.FC<{ className?: string }> = ({ className = 'w-3 h-3' }) => (
  <svg viewBox="0 0 24 24" role="img" aria-label="vMix" className={className} fill="none">
    {/* Row 1 */}
    <rect x="1" y="1" width="6" height="6" rx="1" fill="#1e73be" />
    <rect x="9" y="1" width="6" height="6" rx="1" fill="#1e73be" />
    <rect x="17" y="1" width="6" height="6" rx="1" fill="#38a638" />
    {/* Row 2 */}
    <rect x="1" y="9" width="6" height="6" rx="1" fill="#1e73be" />
    <rect x="9" y="9" width="6" height="6" rx="1" fill="#1e73be" />
    <rect x="17" y="9" width="6" height="6" rx="1" fill="#1e73be" />
    {/* Row 3 */}
    <rect x="1" y="17" width="6" height="6" rx="1" fill="#f39200" />
    <rect x="9" y="17" width="6" height="6" rx="1" fill="#1e73be" />
    <rect x="17" y="17" width="6" height="6" rx="1" fill="#1e73be" />
  </svg>
);

export const StreamBrandMark: React.FC<StreamBrandMarkProps> = ({ className = '', showText = true }) => (
  <span className={`inline-flex items-center gap-1.5 ${className}`} aria-label="OBS Studio and vMix">
    <span className="flex items-center gap-1">
      {/* OBS Badge: Black/Zinc neutral with white swirl */}
      <span className="flex items-center justify-center w-4 h-4 rounded-xs bg-zinc-900 border border-zinc-700 text-zinc-100" title="OBS Studio">
        <ObsIcon className="w-2.5 h-2.5" />
      </span>
      {/* vMix Badge: Official 3x3 Matrix */}
      <span className="flex items-center justify-center w-4 h-4 rounded-xs bg-zinc-900 border border-zinc-700 p-0.5" title="vMix">
        <VmixIcon className="w-2.5 h-2.5" />
      </span>
    </span>
    {showText && (
      <span className="text-[10px] font-mono font-bold tracking-tight text-zinc-300">
        OBS<span className="text-zinc-500 font-normal">/</span>vMix
      </span>
    )}
  </span>
);