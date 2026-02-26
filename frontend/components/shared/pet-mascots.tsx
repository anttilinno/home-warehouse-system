interface MascotProps {
  size?: number;
  className?: string;
}

export function PuppyMascot({ size = 80, className }: MascotProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Face */}
      <circle cx="40" cy="42" r="24" fill="currentColor" opacity="0.15" />
      <circle cx="40" cy="42" r="24" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      {/* Left ear (floppy) */}
      <path
        d="M18 30c-3-12 2-20 8-18s6 14 4 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.3"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Right ear (floppy) */}
      <path
        d="M62 30c3-12-2-20-8-18s-6 14-4 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.3"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Eyes */}
      <circle cx="33" cy="38" r="3" fill="currentColor" opacity="0.5" />
      <circle cx="47" cy="38" r="3" fill="currentColor" opacity="0.5" />
      {/* Eye shine */}
      <circle cx="34" cy="37" r="1" fill="white" opacity="0.8" />
      <circle cx="48" cy="37" r="1" fill="white" opacity="0.8" />
      {/* Nose */}
      <ellipse cx="40" cy="46" rx="3.5" ry="2.5" fill="currentColor" opacity="0.4" />
      {/* Mouth */}
      <path
        d="M37 50c1.5 2 4.5 2 6 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
      {/* Tongue */}
      <path
        d="M40 50c0 0-1 3.5 0 4.5s2 0 2-1c0-1-1-3.5-1-3.5"
        fill="currentColor"
        opacity="0.2"
      />
    </svg>
  );
}

export function KittenMascot({ size = 80, className }: MascotProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Face */}
      <circle cx="40" cy="44" r="22" fill="currentColor" opacity="0.15" />
      <circle cx="40" cy="44" r="22" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      {/* Left ear (pointed) */}
      <path
        d="M22 32L16 10l14 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.3"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Right ear (pointed) */}
      <path
        d="M58 32l6-22-14 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.3"
        fill="currentColor"
        fillOpacity="0.1"
      />
      {/* Eyes */}
      <ellipse cx="33" cy="40" rx="3.5" ry="4" fill="currentColor" opacity="0.5" />
      <ellipse cx="47" cy="40" rx="3.5" ry="4" fill="currentColor" opacity="0.5" />
      {/* Pupils (cat-like slits) */}
      <ellipse cx="33" cy="40" rx="1.2" ry="3.5" fill="white" opacity="0.6" />
      <ellipse cx="47" cy="40" rx="1.2" ry="3.5" fill="white" opacity="0.6" />
      {/* Nose */}
      <path
        d="M38.5 48l1.5 2 1.5-2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.4"
        fill="currentColor"
        fillOpacity="0.3"
      />
      {/* Whiskers left */}
      <line x1="15" y1="44" x2="30" y2="46" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <line x1="16" y1="48" x2="30" y2="48" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <line x1="17" y1="52" x2="30" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      {/* Whiskers right */}
      <line x1="65" y1="44" x2="50" y2="46" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <line x1="64" y1="48" x2="50" y2="48" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      <line x1="63" y1="52" x2="50" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.2" />
      {/* Mouth */}
      <path
        d="M37 51c1.5 1.5 4.5 1.5 6 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  );
}
