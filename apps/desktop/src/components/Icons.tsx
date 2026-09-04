// Line icons drawn after SF Symbols (1.5px round strokes, 24 grid). `fill` variants are used for
// severity glyphs the way the native prototype does (hierarchical rendering = two opacities).
export type IconName =
  | "grid" | "triangle" | "triangle-fill" | "path" | "shippingbox" | "waveform" | "cable" | "internaldrive" | "cpu" | "clock-arrow"
  | "terminal" | "search" | "box" | "gear" | "sparkles" | "wrench" | "wrench-screwdriver" | "git" | "key" | "diff" | "sliders"
  | "check" | "check-circle-fill" | "info-circle-fill" | "x" | "chevron" | "chevron-down" | "info" | "undo" | "uturn-circle" | "play"
  | "folder" | "refresh" | "shield" | "lock-shield" | "lock" | "eye" | "stethoscope" | "sidebar-left" | "sidebar-right" | "sun" | "moon"
  | "half-circle" | "checklist" | "alert" | "home" | "activity" | "network" | "drive" | "chip" | "clock" | "heart";

const P: Record<IconName, string> = {
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  triangle: "M12 9v4m0 4h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  "triangle-fill": "M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  path: "M5 5h3v3H5zM16 16h3v3h-3zM8 6.5h4a4 4 0 0 1 4 4v1a4 4 0 0 0 4 4",
  shippingbox: "M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8M7.5 5.5l9 5",
  waveform: "M3 12h3l2-6 3 12 3-9 2 3h5",
  cable: "M12 3v6m-3 0h6l-1 4h-4l-1-4Zm3 4v8m-2 0h4v2h-4z",
  internaldrive: "M4 13.5h16v5H4zM6 13.5 8 6h8l2 7.5M7.5 16h.01M10 16h.01",
  cpu: "M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3M6 6h12v12H6zM9 9h6v6H9z",
  "clock-arrow": "M4 11a8 8 0 1 1 2.3 5.7M4 5v6h6M12 8v4l3 2",
  terminal: "M4 5h16v14H4zM7 9l3 3-3 3m5 0h5",
  search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm9 16-4.3-4.3",
  box: "M21 8 12 3 3 8v8l9 5 9-5V8ZM3 8l9 5 9-5M12 13v8",
  gear: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm7.4 3.5.1-1.4 2-1.5-2-3.4-2.4.9a8 8 0 0 0-2.4-1.4l-.4-2.5h-4l-.4 2.5a8 8 0 0 0-2.4 1.4L5 5.7 3 9.1l2 1.5v2.8l-2 1.5 2 3.4 2.4-.9a8 8 0 0 0 2.4 1.4l.4 2.5h4l.4-2.5a8 8 0 0 0 2.4-1.4l2.4.9 2-3.4-2-1.5Z",
  sparkles: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8ZM5 16l.6 1.4L7 18l-1.4.6L5 20l-.6-1.4L3 18l1.4-.6Z",
  wrench: "M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-2-2 6.3-6.3a4 4 0 0 1-5-5L14.7 6.3ZM3 21l6-6",
  "wrench-screwdriver": "M14.5 5.5a3.5 3.5 0 0 0 4 4L21 12l-2 2-7-7 2.5-1.5ZM4 20l7-7M4 20v-3l3-3 3 3-3 3H4Z",
  git: "M6 3v12m0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm12-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 0v2a4 4 0 0 1-4 4h-4",
  key: "M15 3a6 6 0 1 1-5.7 7.9L3 17.2V21h4v-3h3v-3h2.3A6 6 0 0 1 15 3Zm1 5h.01",
  diff: "M12 4v16M5 10l7-6 7 6M5 14l7 6 7-6",
  sliders: "M4 7h10m4 0h2M4 17h4m4 0h8M14 5v4m-6 6v4",
  check: "M5 12.5 10 17.5 19 7",
  "check-circle-fill": "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.5 14L6 11.5l1.4-1.4 3.1 3.1 6.1-6.1L18 8.5l-7.5 7.5Z",
  "info-circle-fill": "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4ZM13 17h-2v-6h2v6Z",
  x: "M6 6l12 12M18 6 6 18",
  chevron: "M9 6l6 6-6 6",
  "chevron-down": "M6 9l6 6 6-6",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-9v5m0-8.5h.01",
  undo: "M9 14 4 9l5-5M4 9h9a6 6 0 0 1 0 12h-3",
  "uturn-circle": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2-6 -3-3 3-3M7 12h6a3 3 0 0 1 0 6h-1",
  play: "M7 5v14l12-7Z",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
  refresh: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
  shield: "M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z",
  "lock-shield": "M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Zm-2.5 8.5V10a2.5 2.5 0 0 1 5 0v1.5M9 11.5h6v4H9z",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5zM12 15v3",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  stethoscope: "M6 3v6a4 4 0 0 0 8 0V3M4 3h4m4 0h4M10 13v3a4 4 0 0 0 8 0v-3m0 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  "sidebar-left": "M4 5h16v14H4zM9 5v14M6 8h1m-1 3h1",
  "sidebar-right": "M4 5h16v14H4zM15 5v14",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10-1.4-1.4 1.4m0 10 1.4 1.4M5.6 18.4 7 17",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z",
  "half-circle": "M12 3a9 9 0 1 0 0 18V3Zm0 0a9 9 0 0 1 0 18",
  checklist: "M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17M11 6h9m-9 6h9m-9 6h9",
  alert: "M12 9v4m0 4h.01M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  home: "M3 11.5 12 4l9 7.5M5 10v10h14V10",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  network: "M12 3v5m0 8v5M5 12h14M7 8l5 4 5-4M7 16l5-4 5 4",
  drive: "M4 14h16v5H4zM6 14 8 5h8l2 9M7.5 16.5h.01m2.5 0h.01",
  chip: "M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3M6 6h12v12H6zM9 9h6v6H9z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z",
};

const FILLED: IconName[] = ["triangle-fill", "check-circle-fill", "info-circle-fill", "play"];

export function Icon({ name, size, className, title, style }: { name: IconName; size?: number; className?: string; title?: string; style?: React.CSSProperties }) {
  const s = size ?? 16;
  const filled = FILLED.includes(name);
  return (
    <svg className={`icon ${className ?? ""}`} style={style} width={s} height={s} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <path d={P[name]} />
      {name === "triangle-fill" && <path d="M12 9v4m0 3.5h.01" stroke="#fff" strokeWidth={2} strokeLinecap="round" fill="none" />}
    </svg>
  );
}
