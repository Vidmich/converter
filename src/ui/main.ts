// UI entry point: the input textarea on top, the results panel below.

import { evaluateLine } from "../engine";
import { debounce, highlightRow, lineAt, renderResults } from "./render";

const EVAL_DELAY_MS = 50;

window.addEventListener("DOMContentLoaded", () => {
  const input = document.querySelector<HTMLTextAreaElement>("#input")!;
  const results = document.querySelector<HTMLElement>("#results")!;

  const highlightCaretLine = () => {
    if (document.activeElement !== input) return;
    highlightRow(results, lineAt(input.value, input.selectionStart));
  };

  const update = () => {
    const lines = input.value === "" ? [] : input.value.split("\n");
    renderResults(results, lines.map(evaluateLine));
    highlightCaretLine();
  };

  input.addEventListener("input", debounce(update, EVAL_DELAY_MS));
  // Rows have the same height as input lines, so equal scrollTop keeps row n level with line n.
  input.addEventListener("scroll", () => {
    results.scrollTop = input.scrollTop;
  });
  document.addEventListener("selectionchange", highlightCaretLine);
  input.addEventListener("blur", () => results.querySelector(".row.current")?.classList.remove("current"));
  input.addEventListener("focus", highlightCaretLine);

  update();
  input.focus();
});
