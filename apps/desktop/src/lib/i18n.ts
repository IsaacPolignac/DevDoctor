// Interface language for the web-technology app. English strings are the keys; translations
// live in apps/i18n/strings.json and are generated into i18n.generated.ts (scripts/gen-i18n.py).
// Text produced by the diagnostic engine (issue titles, explanations) stays in English.
import { TRANSLATIONS } from "./i18n.generated";

export type Language = "system" | "en" | "fr" | "es" | "zh-Hans";
export const LANGUAGES: { id: Language; label: string }[] = [
  { id: "system", label: "System" },
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
  { id: "es", label: "Español" },
  { id: "zh-Hans", label: "中文" },
];
const STORAGE_KEY = "devdoctor.language";

function readStored(): Language {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as Language | null;
    return v && LANGUAGES.some((l) => l.id === v) ? v : "system";
  } catch {
    return "system";
  }
}

function resolve(choice: Language): Exclude<Language, "system"> {
  if (choice !== "system") return choice;
  const prefs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]).map((l) => l.toLowerCase());
  for (const p of prefs) {
    if (p.startsWith("fr")) return "fr";
    if (p.startsWith("es")) return "es";
    if (p.startsWith("zh")) return "zh-Hans";
    if (p.startsWith("en")) return "en";
  }
  return "en";
}

export const languageChoice: Language = readStored();
export const activeLanguage = resolve(languageChoice);
const table: Record<string, string> = activeLanguage === "en" ? {} : (TRANSLATIONS[activeLanguage] ?? {});

/** Translates an interface string; `{name}` placeholders are replaced from `vars`. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = table[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Persists the choice and reloads so every module-level string is rebuilt in the new language. */
export function setLanguage(choice: Language, persist?: (v: Language) => Promise<unknown>): void {
  try { localStorage.setItem(STORAGE_KEY, choice); } catch { /* private mode */ }
  const done = () => location.reload();
  if (persist) persist(choice).then(done, done); else done();
}

/** Applies a language stored in the engine settings when the browser has no local choice yet. */
export function adoptStoredLanguage(fromSettings: unknown): void {
  if (typeof fromSettings !== "string" || !LANGUAGES.some((l) => l.id === fromSettings)) return;
  try {
    if (localStorage.getItem(STORAGE_KEY)) return;
    localStorage.setItem(STORAGE_KEY, fromSettings);
    if (resolve(fromSettings as Language) !== activeLanguage) location.reload();
  } catch { /* ignore */ }
}

/** BCP-47 tag for Intl formatting. */
export const intlLocale = activeLanguage === "zh-Hans" ? "zh-Hans" : activeLanguage;
