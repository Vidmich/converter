// UI entry point. The input/results layout arrives in M3 (T12–T15).
window.addEventListener("DOMContentLoaded", () => {
  const app = document.querySelector<HTMLElement>("#app");
  if (app) app.textContent = "Converter";
});
