// @vitest-environment happy-dom
/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from "vitest";
import indexHtml from "../../index.html?raw";
import { LEGEND_KEY, THEME_KEY, initLegend, initTheme, readTheme, type Prefs } from "../../src/ui/chrome";

/** In-memory preferences with the same interface as localStorage-backed browserPrefs. */
function memoryPrefs(initial: Record<string, string> = {}): Prefs & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, get: (k) => data[k] ?? null, set: (k, v) => void (data[k] = v) };
}

/** Loads the real page's <main> markup (not the head, so no stylesheet fetch) into the test document. */
function loadPage(): void {
  document.body.innerHTML = indexHtml.match(/<main[\s\S]*<\/main>/)![0];
  document.documentElement.removeAttribute("data-theme");
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const pressed = () =>
  [...document.querySelectorAll<HTMLElement>("[data-theme-choice]")]
    .filter((b) => b.getAttribute("aria-pressed") === "true")
    .map((b) => b.dataset.themeChoice);

beforeEach(loadPage);

describe("page markup", () => {
  it("has no placeholder in the input", () => {
    expect($<HTMLTextAreaElement>("#input").hasAttribute("placeholder")).toBe(false);
  });

  it("has the legend with its toggle and the three-way theme switch", () => {
    expect($("#legend-body").textContent).toContain("Scales");
    expect($("#legend-toggle").getAttribute("aria-controls")).toBe("legend-body");
    expect([...document.querySelectorAll<HTMLElement>("[data-theme-choice]")].map((b) => b.dataset.themeChoice)).toEqual([
      "system",
      "light",
      "dark",
    ]);
  });
});

describe("legend", () => {
  it("is expanded on the first run", () => {
    initLegend(document, memoryPrefs());
    expect($("#legend-toggle").getAttribute("aria-expanded")).toBe("true");
    expect($("#legend-body").hidden).toBe(false);
  });

  it("collapses to the bar line and remembers it", () => {
    const prefs = memoryPrefs();
    initLegend(document, prefs);
    $("#legend-toggle").click();
    expect($("#legend-toggle").getAttribute("aria-expanded")).toBe("false");
    expect($("#legend-toggle").textContent).toBe("▸ Legend");
    expect($("#legend-body").hidden).toBe(true);
    expect(prefs.data[LEGEND_KEY]).toBe("false");

    $("#legend-toggle").click();
    expect($("#legend-body").hidden).toBe(false);
    expect(prefs.data[LEGEND_KEY]).toBe("true");
  });

  it("restores the collapsed state", () => {
    initLegend(document, memoryPrefs({ [LEGEND_KEY]: "false" }));
    expect($("#legend-body").hidden).toBe(true);
  });
});

describe("theme", () => {
  it("defaults to System: no data-theme, System pressed", () => {
    const onChange = vi.fn();
    initTheme(document, memoryPrefs(), onChange);
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(pressed()).toEqual(["system"]);
    expect(onChange).toHaveBeenCalledWith("system");
  });

  it("switches system → light → dark → system and remembers the choice", () => {
    const prefs = memoryPrefs();
    const onChange = vi.fn();
    initTheme(document, prefs, onChange);
    const click = (t: string) => $(`[data-theme-choice="${t}"]`).click();

    click("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(pressed()).toEqual(["light"]);
    click("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(prefs.data[THEME_KEY]).toBe("dark");
    click("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(prefs.data[THEME_KEY]).toBe("system");
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(["system", "light", "dark", "system"]);
  });

  it("restores a saved theme and ignores unknown values", () => {
    initTheme(document, memoryPrefs({ [THEME_KEY]: "dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(readTheme(memoryPrefs({ [THEME_KEY]: "purple" }))).toBe("system");
  });
});
