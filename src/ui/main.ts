// UI entry point: the input textarea on top, the results panel below.

window.addEventListener("DOMContentLoaded", () => {
  const input = document.querySelector<HTMLTextAreaElement>("#input");
  input?.focus();
});
