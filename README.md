# Converter

A small Windows desktop calculator for back-of-the-envelope capacity
estimates. Type rough quantities in the top panel, one per line, and the
bottom panel shows each line as round numbers per year, per day and per
second, plus a bit rate for data sizes.

```
100M photos / day   →  photos:  36.5 B /year   100 M /day   ~1,200 /s
50B x 70KB / day    →  ~1.3 EB /year   3.5 PB /day   ~41 GB /s   ~320 Gbps
4 MB * 100M/day     →  ~150 PB /year   400 TB /day   ~4.6 GB /s   ~37 Gbps
```

Results update as you type. The row for the line the caret is on is highlighted.

## Input cheat sheet

| What | Write | Notes |
|---|---|---|
| Numbers | `42`, `3.5`, `.5`, `1,200`, `1e6` | Commas must group exactly 3 digits |
| Scales | `K` thousand, `M` million, `B` billion, `T` trillion; or the words `thousand`, `million`, `billion`, `trillion` | Any case (`100m` = `100M`). `B`/`b` alone is **always billion** |
| Sizes (bytes) | `byte(s)`, `KB`, `MB`, `GB`, `TB`, `PB`, `EB`, `ZB` | Any case (`mb` = `Mb` = `MB`). Decimal: 1 KB = 1000 B |
| Sizes (bits) | `bit(s)`, `Kbit`, `Mbit`, `Gbit`, `Tbit`, `Pbit` | Bits are always spelled out (`Mb` means megabytes). Stored as bytes ÷ 8 |
| Bit rates | `bps`, `Kbps`, `Mbps`, `Gbps`, `Tbps`, `Pbps` | Any case. Already "per second" |
| Periods | `s`/`sec`, `min`, `h`/`hr`/`hour`, `d`/`day`, `wk`/`week`, `mo`/`month`, `y`/`yr`/`year` (plurals too) | Year = 365 days, month = 30 days. Minutes are `min`: `m` is million |
| Operators | `+  -  *  x  ×  /  ÷  per`, parentheses | `* /` before `+ -` |
| Labels | any other word after a quantity: `100M photos` | Shown once before the results (`photos:`). Labels of all parts are combined (`100M photos * 4MB size` → `photos size`); `(…) users` replaces the labels inside |
| Comments | `# anything` | A whole line or the end of a line |

Spacing is flexible: `100M/day`, `100 M / day` and `100 million per day` are the same.

### Examples

```
# traffic
10K requests / s                →  requests:  ~320 B /year   ~860 M /day   10 K /s
10K/s * 2 KB                    →  ~630 TB /year   ~1.7 TB /day   20 MB /s   160 Mbps
1 TB / 2 days                   →  ~180 TB /year   500 GB /day   ~5.8 MB /s   ~46 Mbps
10 Gbps * 1 day                 →  ~110 TB
1 TB / 4 MB                     →  250 K
(10M + 5M) users / month        →  users:  ~180 M /year   500 K /day   ~5.8 /s
100M photos * 4MB size / day    →  photos size:  ~150 PB /year   400 TB /day   ~4.6 GB /s   ~37 Gbps
```

## How results are shown

- **Rates** show `/year`, `/day` and `/s`. Data rates add a bit-rate column (`Gbps`).
- **Amounts** (no time unit) show a single value, e.g. `400 TB`.
- **Rounding:** values with at most 2 significant digits are exact (`100 M`,
  `3.5 PB`), and so are 3-digit values whose shown number has a decimal part
  (`36.5 B`, `1.25 GB`). Everything else is rounded to 2 significant digits
  and marked with `~` (`~1,200`, `~41 GB`, `~150 PB`).
- **Counts** below 10,000 are written in full (`~1,200`); larger ones use
  `K`, `M`, `B`, `T`, `Q`. Values below 0.001 use exponent form (`~3.2e-8`).

### Errors

A line that can't be computed shows a short message in red on its row, e.g.:

| Input | Message |
|---|---|
| `5qb` | `unknown unit "qb"` |
| `4 MB * 2 MB` | `can't multiply a size by a size` |
| `1 MB + 5` | `can't add a count to a size` |
| `3 days` | `result is a duration; divide something by it to get a rate` |

Hover over the message to see the column it refers to.

## Development

Requirements: Node LTS, Rust (stable, MSVC toolchain), the Visual Studio C++
build tools and the WebView2 runtime (see the [Tauri prerequisites](https://tauri.app/start/prerequisites/)).

```bash
npm install
```

Run the app with hot reload:

```bash
npm run tauri dev
```

Run the tests (Vitest; the engine and UI rendering):

```bash
npm test
```

Build the Windows installers (MSI and NSIS) into `src-tauri/target/release/bundle/`:

```bash
npm run tauri build
```

Regenerate the icons after editing `app-icon.svg`:

```bash
npm run tauri icon app-icon.svg
```

### Layout

```
src/engine/   pure TypeScript calculator: units → lexer → parser → evaluate → format
              public API: evaluateLine(line) in src/engine/index.ts
src/ui/       main.ts (wiring), render.ts (result rows), styles.css
src-tauri/    Tauri 2 shell (no custom Rust commands)
tests/        Vitest: tests/engine/*.test.ts, tests/ui/render.test.ts
```

The design and decisions are in [PLAN.md](PLAN.md), and the task history is in [TASKS.md](TASKS.md).
