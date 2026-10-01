// The bottom bar: a collapsible legend and the System / Light / Dark theme switch.
// Both choices are remembered between runs.

export type Theme = "system" | "light" | "dark";

const THEMES: readonly Theme[] = ["system", "light", "dark"];

export const THEME_KEY = "converter.theme"; // also read by the inline script in index.html
export const LEGEND_KEY = "converter.legendOpen";

/** Where preferences are kept; a small interface so tests can pass an in-memory store. */
export interface Prefs {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** localStorage, degrading to "nothing remembered" when it is unavailable. */
export const browserPrefs: Prefs = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // not remembered; the choice still applies for this run
    }
  },
};

/** The saved theme, or "system" when nothing (or something unknown) is saved. */
export function readTheme(prefs: Prefs): Theme {
  const saved = prefs.get(THEME_KEY);
  return THEMES.find((t) => t === saved) ?? "system";
}

/** "system" removes data-theme so the CSS follows prefers-color-scheme; light/dark force it. */
export function applyTheme(doc: Document, theme: Theme): void {
  const root = doc.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.dataset.theme = theme;
  for (const button of doc.querySelectorAll<HTMLElement>("[data-theme-choice]")) {
    button.setAttribute("aria-pressed", String(button.dataset.themeChoice === theme));
  }
}

/** Applies the saved theme and wires the switch. `onChange` also runs for the initial theme. */
export function initTheme(doc: Document, prefs: Prefs, onChange?: (theme: Theme) => void): void {
  const set = (theme: Theme) => {
    applyTheme(doc, theme);
    onChange?.(theme);
  };
  set(readTheme(prefs));
  for (const button of doc.querySelectorAll<HTMLElement>("[data-theme-choice]")) {
    button.addEventListener("click", () => {
      const theme = readThemeChoice(button);
      prefs.set(THEME_KEY, theme);
      set(theme);
    });
  }
}

function readThemeChoice(button: HTMLElement): Theme {
  return THEMES.find((t) => t === button.dataset.themeChoice) ?? "system";
}

/** Shows or hides the legend body; the bar line stays. */
export function setLegendOpen(doc: Document, open: boolean): void {
  const toggle = doc.querySelector<HTMLElement>("#legend-toggle");
  const body = doc.querySelector<HTMLElement>("#legend-body");
  if (!toggle || !body) return;
  toggle.setAttribute("aria-expanded", String(open));
  toggle.textContent = `${open ? "▾" : "▸"} Legend`;
  body.hidden = !open;
}

/** Restores the legend state (expanded on the first run) and wires the toggle. */
export function initLegend(doc: Document, prefs: Prefs): void {
  let open = prefs.get(LEGEND_KEY) !== "false";
  setLegendOpen(doc, open);
  doc.querySelector("#legend-toggle")?.addEventListener("click", () => {
    open = !open;
    prefs.set(LEGEND_KEY, String(open));
    setLegendOpen(doc, open);
  });
}
