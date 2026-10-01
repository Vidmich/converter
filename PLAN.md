# Converter — Implementation Plan

A small desktop calculator for back-of-the-envelope capacity estimates.
You type rough quantities in the top part of the window. The bottom part shows
the same quantity as round numbers per year, per day and per second (plus a
bit rate for data sizes).

```
100M photos / day        →  photos:  36.5 B /year   100 M /day   ~1,200 /s
50B x 70KB / day         →  ~1.3 EB /year   3.5 PB /day   ~41 GB /s   ~320 Gbps
4 MB * 100M/day          →  ~150 PB /year   400 TB /day   ~4.6 GB /s   ~37 Gbps
```

## Decisions

| Topic | Decision |
|---|---|
| Stack | Tauri 2 + TypeScript + Vite, vanilla DOM (no UI framework) |
| Tests | Vitest unit tests for the engine |
| Target | Windows first (`.msi` / NSIS installer from `tauri build`) |
| Evaluation | Live: a multi-line editor on top, one result line per input line in the bottom panel, updated as you type |
| Units | Decimal SI only: 1 KB = 1000 B, 1 Gbps = 10⁹ bit/s |
| Rounding | 2 significant digits; prefix `~` only when rounding changed the value |
| Time | Input accepts `s, min, h/hour, day, week, month, year`. Output always shows `/year`, `/day`, `/s`, plus a bit rate (`bps`…`Tbps`) for data. Year = 365 days, month = 30 days |
| Extras in v1 | Labels (free words like `photos`) and `#` comments. Not in v1: variables, persistence, copy buttons |

## Input language

### Grammar (informal)

```
line      := expr? comment?
comment   := '#' anything
expr      := term (('+' | '-') term)*
term      := factor (('*' | 'x' | '×' | '/') factor)*
factor    := '(' expr ')' | quantity | '/' period
quantity  := number scale? unit? label*
number    := digits with optional '.' and ',' separators, e.g. 1,200 or 3.5
scale     := K | M | B | T            (thousand, million, billion, trillion)
unit      := byte | bytes | KB | MB | GB | TB | PB | EB | ZB   (bytes)
           | bit | bits | Kbit | Mbit | Gbit | … | Zbit        (bits)
           | bps | Kbps | Mbps | Gbps | Tbps | Pbps            (bits per second)
           (all scales and units are case-insensitive: m = M, mb = Mb = mB = MB)
period    := s | sec | second | min | minute | h | hour | day | week | month | year | yr (+ plural)
label     := any other word, e.g. photos, users, requests
```

### Ambiguity rules

- Scales and units ignore case (Organizer issue #3): `100m` = `100M`,
  `5t` = `5T`, and `mb`, `Mb`, `mB` all mean `MB` (megabytes), likewise for
  every prefix (`kb`, `gb`, `tB`…).
- `b`/`B` alone always means **billion** (`50B` = `50b` = 5·10¹⁰). Plain bytes
  and bits are written as words: `byte` / `bytes`, `bit` / `bits`. Prefixed
  bits are `Kbit`, `Mbit`… (never `Mb`, which is megabytes).
- Bit rates `bps`, `Kbps`, `Mbps`… are megabits etc. per second, any case.
- Minutes are `min` (never `m`, which is million).
- `x` is multiplication only between two quantities (`50B x 70KB`).
- `/ day`, `/day` and `per day` all mean "divided by one day".
- A space between number and scale/unit is allowed (`4 MB`, `100 M`).

### Dimensions

Every value has a number plus a dimension:

- `count` (no unit) or `bytes` (bits are stored as bytes ÷ 8)
- a time exponent: `0` = an amount, `-1` = a rate per time

Multiplying adds exponents and multiplying two `bytes` values is an error.
Adding requires matching dimensions. Results with any other dimension
(e.g. `day²`) show an error.

### Labels & comments

- Spaced words after a quantity that are not units are its label
  (`100M daily photos` → `daily photos`).
- The labels of all operands are combined left to right, with each word kept
  once: `100M photos * 4MB size /day` → `photos size`, `100M photos * 2 photos`
  → `photos`. A label written after `( … )` replaces the labels inside.
- The label is shown once, in its own column before the values, followed by
  a colon (Organizer issue #2):
  `100M photos * 4MB /day` → `photos:  ~150 PB /year  400 TB /day  ~4.6 GB /s  ~37 Gbps`.
  Rows without a label leave that column empty, so the values still line up.
- A word glued to a number that isn't a known unit is an error (`5qb`).
- `#` starts a comment: a line with only a comment gives an empty result row,
  and text after `#` on an expression line is ignored.

## Output format

| Value kind | Columns |
|---|---|
| count rate | `/year` `/day` `/s` |
| bytes rate | `/year` `/day` `/s` + bit rate (`bps`, `Kbps`, `Mbps`, `Gbps`, `Tbps`, `Pbps`) |
| count amount (no time) | single value, e.g. `~1.2 B` |
| bytes amount | single value, e.g. `400 TB` |
| empty / comment line | empty |
| error | short message in muted red, e.g. `unknown unit "qb"` |

Number formatting:

- Count: below 10,000 → plain with thousands separators (`~1,200`); otherwise
  `K`, `M`, `B`, `T`, `Q` suffixes (`36.5 B`).
- Bytes: `B, KB, MB, GB, TB, PB, EB, ZB`. Pick the largest unit where the value is ≥ 1.
- Round to 2 significant digits **except** when the exact value has ≤ 2
  significant digits (`100 M`, `3.5 PB`), or exactly 3 and the shown number is
  fractional (`36.5 B`, `1.25 GB`). So `146 PB` → `~150 PB`, `108 TB` → `~110 TB`,
  `365` → `~370` (ties round away from zero). Show a `~` prefix whenever the
  shown value differs from the exact value by more than 1e-9 relative.
  (Changed by Organizer issue #1; it used to keep every ≤ 3-digit value exact.)
- The suffix/unit is chosen *after* rounding, so `999.7 KB` → `~1 MB` and `9,999` → `~10 K`.
- Magnitudes below 0.001 use exponent form (`1 /year` → `~3.2e-8 /s`).

## Architecture

```
converter/
├─ src-tauri/            Rust shell (generated by create-tauri-app, barely touched)
├─ src/
│  ├─ engine/
│  │  ├─ lexer.ts        text → tokens (number, word, op, paren, comment)
│  │  ├─ units.ts        unit / scale / period tables
│  │  ├─ parser.ts       tokens → AST (recursive descent)
│  │  ├─ evaluate.ts     AST → Quantity { value, dim: 'count'|'bytes', timeExp, label }
│  │  ├─ format.ts       Quantity → display columns (rounding, unit pick, ~)
│  │  └─ index.ts        evaluateLine(text) → LineResult
│  └─ ui/
│     ├─ main.ts         wires textarea → engine → results panel
│     └─ styles.css
├─ index.html            Vite entry (project root, as Vite expects)
└─ tests/engine/*.test.ts
```

The engine is pure TypeScript with no DOM or Tauri imports, so it can be fully
unit-tested with Vitest and reused later in a CLI or web build.

### UI

- One window (~720×480, resizable), split vertically:
  - **Top:** a monospace `<textarea>` (or a contenteditable with line numbers), with a placeholder showing the examples.
  - **Bottom:** a results panel with one row per input line. Columns are
    aligned in a CSS grid, and the row for the line under the cursor is
    highlighted.
- Re-evaluate on `input`, debounced to about 50 ms (evaluation is trivial, so mostly to avoid flicker).
- Follows the system light/dark theme via `prefers-color-scheme`.

## Milestones

1. **Project setup:** Tauri + Vite + TS scaffold, Vitest, the app runs with an empty window.
2. **Calculation engine:** lexer, parser, evaluator and formatter, with a test suite that covers the examples above.
3. **UI:** the split input/results layout, live evaluation, error display, theming.
4. **Packaging:** app icon, window settings, Windows installer, README.

Detailed tasks are in [TASKS.md](TASKS.md).

## Out of scope for v1 (possible later)

Variables, saving input between sessions, copy-to-clipboard, binary units
(KiB/MiB), configurable rounding, /hour and /month columns, macOS/Linux builds.
