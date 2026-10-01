// UI entry point: the input textarea on top, the results panel below.

import { evaluateLine } from "../engine";
import { debounce, renderResults } from "./render";

const EVAL_DELAY_MS = 50;

window.addEventListener("DOMContentLoaded", () => {
  const input = document.querySelector<HTMLTextAreaElement>("#input")!;
  const results = document.querySelector<HTMLElement>("#results")!;

  const update = () => {
    const lines = input.value === "" ? [] : input.value.split("\n");
    renderResults(results, lines.map(evaluateLine));
  };

  input.addEventListener("input", debounce(update, EVAL_DELAY_MS));
  update();
  input.focus();
});
