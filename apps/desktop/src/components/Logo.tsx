// The DevDoctor mark: a pulse line on a blue squircle (same drawing as the app icon).
export function Logo({ size = 54 }: { size?: number }) {
  const r = size * 0.24;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" style={{ flex: "none", filter: "drop-shadow(0 3px 6px rgba(10,108,245,0.28))" }}>
      <defs>
        <linearGradient id="dd-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#66b3ff" /><stop offset="0.55" stopColor="#1f7ff9" /><stop offset="1" stopColor="#085ce6" /></linearGradient>
        <radialGradient id="dd-glow" cx="0.5" cy="-0.1" r="0.8"><stop offset="0" stopColor="#fff" stopOpacity="0.35" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx={r} fill="url(#dd-body)" />
      <rect x="2" y="2" width="60" height="60" rx={r} fill="url(#dd-glow)" />
      <rect x="3" y="3" width="58" height="58" rx={r - 1} fill="none" stroke="#fff" strokeOpacity="0.22" strokeWidth="1" />
      <polyline points="14,33 25,33 30,19 38,47 44,25 47.5,33 50,33" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.2))" }} />
    </svg>
  );
}
