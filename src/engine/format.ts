// Quantity → display columns with round numbers.
//
// Rounding: a value is shown exactly when it has at most 2 significant
// digits (100 M, 3.5 PB), or 3 with a fractional shown number (36.5 B,
// 1.25 GB). Anything else is rounded to 2 significant digits and marked
// with "~" (~1,200, ~41 GB, 146 PB → ~150 PB).

import type { Quantity } from "./evaluate";
import { DAY, YEAR } from "./units";

interface Suffix {
  factor: number;
  name: string;
}

// Largest first. Counts below COUNT_PLAIN_LIMIT are shown without a suffix.
const COUNT_SUFFIXES: Suffix[] = [
  { factor: 1e15, name: "Q" },
  { factor: 1e12, name: "T" },
  { factor: 1e9, name: "B" },
  { factor: 1e6, name: "M" },
  { factor: 1e3, name: "K" },
];
const COUNT_PLAIN_LIMIT = 10_000;

const BYTE_UNITS: Suffix[] = [
  { factor: 1e21, name: "ZB" },
  { factor: 1e18, name: "EB" },
  { factor: 1e15, name: "PB" },
  { factor: 1e12, name: "TB" },
  { factor: 1e9, name: "GB" },
  { factor: 1e6, name: "MB" },
  { factor: 1e3, name: "KB" },
  { factor: 1, name: "B" },
];

const BIT_RATE_UNITS: Suffix[] = [
  { factor: 1e15, name: "Pbps" },
  { factor: 1e12, name: "Tbps" },
  { factor: 1e9, name: "Gbps" },
  { factor: 1e6, name: "Mbps" },
  { factor: 1e3, name: "Kbps" },
  { factor: 1, name: "bps" },
];

/** Below this magnitude numbers are written in exponent form (3.2e-8). */
const EXPONENT_LIMIT = 1e-3;

const numberFormat = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3 });

export interface Rounded {
  value: number;
  approx: boolean;
}

/** Picks the suffix (unit) a magnitude is shown in; undefined means no suffix. */
type SuffixPicker = (abs: number) => Suffix | undefined;

const sameValue = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.abs(b);

/**
 * Keeps a value exact when it has ≤ 2 significant digits, or 3 significant
 * digits and a fractional shown number (36.5 B, not 146 PB). Otherwise
 * rounds to 2 significant digits and marks it approximate.
 * `pick` gives the suffix the value will be shown in, which decides
 * whether the shown number is fractional.
 */
export function roundValue(x: number, pick: SuffixPicker = () => undefined): Rounded {
  if (x === 0) return { value: 0, approx: false };
  const two = Number(x.toPrecision(2));
  if (sameValue(two, x)) return { value: two, approx: false };
  const three = Number(x.toPrecision(3));
  if (sameValue(three, x)) {
    const shown = Number((three / (pick(Math.abs(three))?.factor ?? 1)).toPrecision(3));
    if (!Number.isInteger(shown)) return { value: three, approx: false };
    return { value: roundThreeToTwo(three), approx: true };
  }
  return { value: two, approx: true };
}

/**
 * Rounds a value with exactly 3 significant digits to 2, halves away from
 * zero, using its decimal digits: 365e21 is stored as 3.6499…e23, which
 * toPrecision(2) would round down to 360e21 instead of 370e21.
 */
function roundThreeToTwo(three: number): number {
  const [mantissa, exp] = three.toExponential(2).split("e"); // "3.65", "+23"
  const digits = Math.round(Math.abs(Number(mantissa)) * 100); // 365
  return Math.sign(three) * Number(`${Math.round(digits / 10)}e${Number(exp) - 1}`); // 37e22
}

const pickCountSuffix: SuffixPicker = (abs) =>
  abs >= COUNT_PLAIN_LIMIT ? COUNT_SUFFIXES.find((s) => abs >= s.factor) : undefined;

const unitPicker =
  (units: Suffix[]): SuffixPicker =>
  (abs) =>
    units.find((u) => abs >= u.factor) ?? units[units.length - 1];

/** Formats a count: "~1,200", "36.5 B", "100 M". */
export function formatCount(x: number): string {
  return formatWith(x, pickCountSuffix);
}

/** Formats a size in bytes: "3.5 PB", "~41 GB", "500 B". */
export function formatBytes(x: number): string {
  return formatWith(x, unitPicker(BYTE_UNITS));
}

/** Formats a rate in bits per second: "~320 Gbps". */
export function formatBitRate(bitsPerSecond: number): string {
  return formatWith(bitsPerSecond, unitPicker(BIT_RATE_UNITS));
}

function formatWith(x: number, pick: SuffixPicker): string {
  const { value, approx } = roundValue(x, pick);
  // Pick the suffix again after rounding: 999.7 KB rounds to ~1 MB.
  return compose(value, approx, pick(Math.abs(value)));
}

function compose(value: number, approx: boolean, suffix: Suffix | undefined): string {
  // value has ≤ 3 significant digits, so 3 is enough to undo float noise from the division.
  const scaled = suffix ? Number((value / suffix.factor).toPrecision(3)) : value;
  const abs = Math.abs(scaled);
  const digits = abs !== 0 && abs < EXPONENT_LIMIT ? scaled.toExponential() : numberFormat.format(scaled);
  return (approx ? "~" : "") + digits + (suffix ? ` ${suffix.name}` : "");
}

/**
 * Builds the value columns for an evaluated line (the label is shown separately).
 * - rate: "<n> /year", "<n> /day", "<n> /s", plus "<n> Gbps" for sizes
 * - amount: a single "<n>"
 */
export function formatQuantity(q: Quantity): string[] {
  const fmt = q.dim === "bytes" ? formatBytes : formatCount;

  if (q.timeExp === 0) {
    return [fmt(q.value)];
  }

  const columns = [`${fmt(q.value * YEAR)} /year`, `${fmt(q.value * DAY)} /day`, `${fmt(q.value)} /s`];
  if (q.dim === "bytes") {
    columns.push(formatBitRate(q.value * 8));
  }
  return columns;
}
