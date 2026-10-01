# Converter — Tasks

See [PLAN.md](PLAN.md) for the design. Status: `[ ]` open, `[x]` done.

## M1 — Project setup

- [x] **T1. Check prerequisites.** Rust (stable, MSVC toolchain), Node LTS, WebView2 runtime, Tauri CLI prerequisites for Windows.
  Found: rustc 1.98.1 (stable-x86_64-pc-windows-msvc), Node 24.21.0 / npm 9.9.3, WebView2 154, VS Community 2026 with VC tools, git 2.39.1.
- [x] **T2. Scaffold the Tauri app.** Run `npm create tauri-app@latest` with the vanilla TypeScript + Vite template in `H:\ai\converter`. Set the app name/identifier (`Converter`, `com.wizard.converter`) and a window size of 720×480.
  Done: Tauri 2.12, Vite 8, TS 6. Removed the template's greet demo and the opener plugin, set a 420×300 minimum window size and `withGlobalTauri: false`, and moved the UI entry to `src/ui/`.
- [x] **T3. Add Vitest.** Install `vitest`, add `npm test`, and create the `src/engine/` and `tests/engine/` folders with a placeholder test.
- [x] **T4. Smoke run.** `npm run tauri dev` opens an empty window and `npm test` passes.
  Verified: the first dev build takes about 1m20s, then the window opens with the title "Converter". `npm test` passes (1 test).

## M2 — Calculation engine (`src/engine`)

- [x] **T5. Unit tables (`units.ts`).** Scales (K/M/B/T), byte units (B…EB), bit units (bit…Gbit), bit rates (bps…Tbps) and periods (s…year, with year = 365 d and month = 30 d). Lookups are case-insensitive for words, but `B` = billion vs byte follows the ambiguity rules in PLAN.md.
- [x] **T6. Lexer (`lexer.ts`).** Tokens for numbers (with `,` grouping and `.` decimals), words, operators `+ - * x × /`, parens and `#` comments. Tests cover each token kind and the spacing variants (`100M`, `100 M`, `/day`, `/ day`, `per day`).
- [x] **T7. Parser (`parser.ts`).** Recursive descent to an AST using the PLAN.md grammar, with precedence `* /` over `+ -` and parentheses. It handles number+scale+unit+label grouping and returns errors with a position. Tests cover valid and invalid lines.
- [x] **T8. Evaluator (`evaluate.ts`).** AST to `Quantity { value, dim, timeExp, label }`, with dimension rules (no bytes×bytes, matching dims for + and -, timeExp must end up 0 or −1) and clear error messages.
- [x] **T9. Formatter (`format.ts`).** 2-significant-digit rounding with the ≤3-digit exact exception and `~` marking; count suffixes (plain below 10,000 with separators, then K/M/B/T/Q); byte unit choice; bit-rate column. Builds the columns for rates (`/year /day /s [+bps]`) and for amounts (single value), with the label inserted.
- [ ] **T10. `evaluateLine` API (`index.ts`).** Returns `{ kind: 'empty' | 'comment' | 'value' | 'error', columns?: string[], error?: string }`.
- [ ] **T11. Golden tests.** The three examples from the brief, checked against the exact expected strings in PLAN.md, plus edge cases: tiny values (`1/year` in `/s`), huge values (EB/ZB), zero, labels, comments, inline comments and every error path.

## M3 — UI (`src/ui`)

- [ ] **T12. Layout.** Input textarea on top and results panel below (CSS grid, resizable split optional). Monospace font, with a placeholder showing the three examples.
- [ ] **T13. Live evaluation.** On input (debounced ~50 ms), split the text into lines, call `evaluateLine` for each and render one result row per line so row *n* matches line *n*.
- [ ] **T14. Line alignment & focus highlight.** Keep the results panel scrolled in sync with the input and highlight the result row for the line under the caret.
- [ ] **T15. Error & state styling.** Errors in muted red, comment and empty rows blank, `~` values styled subtly. Light and dark theme via `prefers-color-scheme`.
- [ ] **T16. Manual check.** Type the brief's examples plus a few edge cases in `tauri dev` and confirm the output matches the golden tests.

## M4 — Packaging

- [ ] **T17. App icon & metadata.** Generate icons (`npm run tauri icon`), set the window title, version and description.
- [ ] **T18. Windows build.** `npm run tauri build` produces an `.msi`/NSIS installer. Install it, run it and confirm it starts quickly with no console window.
- [ ] **T19. README.** What the app does, input syntax cheat sheet, how to build and test.
