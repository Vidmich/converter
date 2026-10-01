// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { evaluateLine } from "../../src/engine";
import { debounce, highlightRow, lineAt, renderResults } from "../../src/ui/render";

const rowTexts = (container: HTMLElement) =>
  [...container.querySelectorAll(".row")].map((row) => [...row.children].map((c) => c.textContent));

describe("renderResults", () => {
  it("renders one row per line, keeping empty and comment lines", () => {
    const container = document.createElement("div");
    const lines = ["100M photos / day", "", "# note", "5qb", "4 MB * 100M"];
    renderResults(container, lines.map(evaluateLine));

    expect(rowTexts(container)).toEqual([
      ["1", "photos:", "36.5 B /year", "100 M /day", "~1,200 /s"],
      ["2"],
      ["3"],
      ["4", 'unknown unit "qb"'],
      ["5", "", "400 TB"], // an empty label cell keeps the value columns aligned
    ]);
    expect([...container.querySelectorAll<HTMLElement>(".row")].map((r) => r.dataset.kind)).toEqual([
      "value",
      "empty",
      "comment",
      "error",
      "value",
    ]);
  });

  it("puts the label in its own cell before the values", () => {
    const container = document.createElement("div");
    renderResults(container, ["100M photos * 4MB size /day"].map(evaluateLine));
    const label = container.querySelector(".row > .label");
    expect(label?.textContent).toBe("photos size:");
    expect(label?.nextElementSibling?.textContent).toBe("~150 PB /year");
  });

  it("marks approximate cells and gives errors a column tooltip", () => {
    const container = document.createElement("div");
    renderResults(container, ["100M / day", "5qb"].map(evaluateLine));

    const cells = [...container.querySelectorAll(".cell")];
    expect(cells.map((c) => c.classList.contains("approx"))).toEqual([false, false, true]);
    expect(cells[2].querySelector(".tilde")?.textContent).toBe("~");
    expect(cells.map((c) => c.querySelector(".per")?.textContent)).toEqual([" /year", " /day", " /s"]);
    expect(container.querySelector<HTMLElement>(".error")!.title).toBe("at column 2");
  });

  it("replaces previous rows", () => {
    const container = document.createElement("div");
    renderResults(container, ["1", "2", "3"].map(evaluateLine));
    renderResults(container, ["1"].map(evaluateLine));
    expect(container.querySelectorAll(".row")).toHaveLength(1);
  });
});

describe("lineAt", () => {
  it.each([
    ["", 0, 0],
    ["abc", 2, 0],
    ["a\nb\nc", 0, 0],
    ["a\nb\nc", 1, 0], // caret right before the newline
    ["a\nb\nc", 2, 1], // caret at the start of line 2
    ["a\nb\nc", 5, 2],
    ["a\n\n", 3, 2],
  ])("lineAt(%j, %d) = %d", (text, offset, line) => {
    expect(lineAt(text, offset)).toBe(line);
  });
});

describe("highlightRow", () => {
  it("moves the current marker to the given row", () => {
    const container = document.createElement("div");
    renderResults(container, ["1", "2", "3"].map(evaluateLine));
    highlightRow(container, 1);
    highlightRow(container, 2);
    const current = [...container.querySelectorAll(".row")].map((r) => r.classList.contains("current"));
    expect(current).toEqual([false, false, true]);
  });

  it("ignores rows that don't exist yet", () => {
    const container = document.createElement("div");
    expect(() => highlightRow(container, 3)).not.toThrow();
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
