export function ProgressRing({
  size = 16,
  stroke = 2,
  progress,
  spinning = false,
  className = "",
}: {
  size?: number;
  stroke?: number;
  progress?: number;
  spinning?: boolean;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = spinning ? c * 0.72 : progress === undefined ? c : c * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={`${spinning ? "animate-spin" : ""} ${className}`} aria-hidden>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line" opacity={0.6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="stroke-accent transition-[stroke-dashoffset] duration-300"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </g>
    </svg>
  );
}
