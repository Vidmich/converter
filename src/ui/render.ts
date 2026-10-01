// Renders engine results as one row per input line.

import type { LineResult } from "../engine";

/**
 * Replaces the container's rows with one row per result. Row n always
 * corresponds to input line n, including empty and comment lines.
 */
export function renderResults(container: HTMLElement, results: LineResult[]): void {
  const doc = container.ownerDocument;
  const rows = results.map((result, i) => {
    const row = doc.createElement("div");
    row.className = "row";
    row.dataset.kind = result.kind;

    const lineNo = doc.createElement("span");
    lineNo.className = "ln";
    lineNo.textContent = String(i + 1);
    row.append(lineNo);

    if (result.kind === "value") {
      for (const text of result.columns) {
        const cell = doc.createElement("span");
        cell.className = text.startsWith("~") ? "cell approx" : "cell";
        cell.textContent = text;
        row.append(cell);
      }
    } else if (result.kind === "error") {
      const cell = doc.createElement("span");
      cell.className = "error";
      cell.textContent = result.error;
      if (result.pos !== undefined) cell.title = `at column ${result.pos + 1}`;
      row.append(cell);
    }
    return row;
  });
  container.replaceChildren(...rows);
}

/** Returns a function that runs `fn` once calls have stopped for `ms` milliseconds. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
