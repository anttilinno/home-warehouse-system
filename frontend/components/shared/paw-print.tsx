interface PawPrintProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function PawPrint({ size = 24, className, style }: PawPrintProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {/* Main pad */}
      <ellipse cx="12" cy="17" rx="4.5" ry="3.5" />
      {/* Top-left toe */}
      <ellipse cx="6.5" cy="10" rx="2" ry="2.5" transform="rotate(-15 6.5 10)" />
      {/* Top-right toe */}
      <ellipse cx="17.5" cy="10" rx="2" ry="2.5" transform="rotate(15 17.5 10)" />
      {/* Inner-left toe */}
      <ellipse cx="9" cy="7.5" rx="1.8" ry="2.3" transform="rotate(-5 9 7.5)" />
      {/* Inner-right toe */}
      <ellipse cx="15" cy="7.5" rx="1.8" ry="2.3" transform="rotate(5 15 7.5)" />
    </svg>
  );
}
