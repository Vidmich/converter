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
      // Always present (empty without a label) so value columns line up across rows.
      row.append(span(doc, "label", result.label ? `${result.label}:` : ""));
      for (const text of result.columns) {
        row.append(createCell(doc, text));
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

/**
 * Builds a result cell such as "~1,200 /s". The leading "~" and the
 * trailing period (" /s") get their own spans so they can be shown subtly.
 */
function createCell(doc: Document, text: string): HTMLElement {
  const cell = doc.createElement("span");
  cell.className = "cell";
  let rest = text;
  if (rest.startsWith("~")) {
    cell.classList.add("approx");
    cell.append(span(doc, "tilde", "~"));
    rest = rest.slice(1);
  }
  const per = rest.lastIndexOf(" /");
  if (per === -1) {
    cell.append(rest);
  } else {
    cell.append(rest.slice(0, per), span(doc, "per", rest.slice(per)));
  }
  return cell;
}

function span(doc: Document, className: string, text: string): HTMLElement {
  const el = doc.createElement("span");
  el.className = className;
  el.textContent = text;
  return el;
}

/** Zero-based index of the line containing character `offset` of `text`. */
export function lineAt(text: string, offset: number): number {
  let line = 0;
  for (let i = text.indexOf("\n"); i !== -1 && i < offset; i = text.indexOf("\n", i + 1)) line++;
  return line;
}

/** Marks row `index` as the current one (the caret's line) and scrolls it into view. */
export function highlightRow(container: HTMLElement, index: number): void {
  container.querySelector(".row.current")?.classList.remove("current");
  const row = container.children[index];
  if (!row) return;
  row.classList.add("current");
  row.scrollIntoView?.({ block: "nearest" });
}

/** Returns a function that runs `fn` once calls have stopped for `ms` milliseconds. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
