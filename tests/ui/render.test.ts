// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { evaluateLine } from "../../src/engine";
import { debounce, renderResults } from "../../src/ui/render";

const rowTexts = (container: HTMLElement) =>
  [...container.querySelectorAll(".row")].map((row) => [...row.children].map((c) => c.textContent));

describe("renderResults", () => {
  it("renders one row per line, keeping empty and comment lines", () => {
    const container = document.createElement("div");
    const lines = ["100M photos / day", "", "# note", "5qb"];
    renderResults(container, lines.map(evaluateLine));

    expect(rowTexts(container)).toEqual([
      ["1", "36.5 B photos /year", "100 M photos /day", "~1,200 photos /s"],
      ["2"],
      ["3"],
      ["4", 'unknown unit "qb"'],
    ]);
    expect([...container.querySelectorAll<HTMLElement>(".row")].map((r) => r.dataset.kind)).toEqual([
      "value",
      "empty",
      "comment",
      "error",
    ]);
  });

  it("marks approximate cells and gives errors a column tooltip", () => {
    const container = document.createElement("div");
    renderResults(container, ["100M / day", "5qb"].map(evaluateLine));

    const cells = [...container.querySelectorAll(".cell")];
    expect(cells.map((c) => c.classList.contains("approx"))).toEqual([false, false, true]);
    expect(container.querySelector<HTMLElement>(".error")!.title).toBe("at column 2");
  });

  it("replaces previous rows", () => {
    const container = document.createElement("div");
    renderResults(container, ["1", "2", "3"].map(evaluateLine));
    renderResults(container, ["1"].map(evaluateLine));
    expect(container.querySelectorAll(".row")).toHaveLength(1);
  });
});

describe("debounce", () => {
  it("runs once after calls stop, with the last arguments", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 50);
    d(1);
    d(2);
    vi.advanceTimersByTime(49);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith(2);
    vi.useRealTimers();
  });
});
