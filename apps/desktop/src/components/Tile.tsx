// System Settings-style colored icon tile.
import { Icon, type IconName } from "./Icons";

export type TileColor = "blue" | "orange" | "graphite" | "purple" | "green" | "indigo" | "pink" | "gray" | "teal" | "red" | "yellow";

const COLORS: Record<TileColor, string> = {
  blue: "linear-gradient(180deg,#4aa3ff,#0a6cf5)",
  orange: "linear-gradient(180deg,#ffb340,#ff8c00)",
  graphite: "linear-gradient(180deg,#6d6d72,#3a3a3f)",
  purple: "linear-gradient(180deg,#c586f5,#9b45e6)",
  green: "linear-gradient(180deg,#5fd478,#2fb04d)",
  indigo: "linear-gradient(180deg,#7d86ff,#4f56e6)",
  pink: "linear-gradient(180deg,#ff7aa8,#f0357a)",
  gray: "linear-gradient(180deg,#a8a8ad,#7a7a80)",
  teal: "linear-gradient(180deg,#5fd3e8,#1fb2cf)",
  red: "linear-gradient(180deg,#ff6b5f,#ea3b2e)",
  yellow: "linear-gradient(180deg,#ffd451,#f0b400)",
};

export function Tile({ color, icon, size = 22 }: { color: TileColor; icon: IconName; size?: number }) {
  return (
    <span className="tile" style={{ width: size, height: size, borderRadius: Math.round(size * 0.27), background: COLORS[color] }}>
      <Icon name={icon} size={Math.round(size * 0.62)} />
    </span>
  );
}
