// Quantity → display columns with round numbers.
//
// Rounding: a value with at most 3 significant digits is shown exactly
// (36.5 B, 146 PB); anything else is rounded to 2 significant digits and
// marked with "~" (~1,200, ~41 GB).

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

/** Keeps values with ≤ 3 significant digits exact, otherwise rounds to 2 and marks them approximate. */
export function roundValue(x: number): Rounded {
  if (x === 0) return { value: 0, approx: false };
  const three = Number(x.toPrecision(3));
  if (Math.abs(three - x) <= 1e-9 * Math.abs(x)) {
    return { value: three, approx: false };
  }
  return { value: Number(x.toPrecision(2)), approx: true };
}

/** Formats a count: "~1,200", "36.5 B", "100 M". */
export function formatCount(x: number): string {
  const { value, approx } = roundValue(x);
  const abs = Math.abs(value);
  const suffix = abs >= COUNT_PLAIN_LIMIT ? COUNT_SUFFIXES.find((s) => abs >= s.factor) : undefined;
  return compose(value, approx, suffix);
}

/** Formats a size in bytes: "3.5 PB", "~41 GB", "500 B". */
export function formatBytes(x: number): string {
  return formatWithUnits(x, BYTE_UNITS);
}

/** Formats a rate in bits per second: "~320 Gbps". */
export function formatBitRate(bitsPerSecond: number): string {
  return formatWithUnits(bitsPerSecond, BIT_RATE_UNITS);
}

function formatWithUnits(x: number, units: Suffix[]): string {
  const { value, approx } = roundValue(x);
  const abs = Math.abs(value);
  const unit = units.find((u) => abs >= u.factor) ?? units[units.length - 1];
  return compose(value, approx, unit);
}

function compose(value: number, approx: boolean, suffix: Suffix | undefined): string {
  // value has ≤ 3 significant digits, so 3 is enough to undo float noise from the division.
  const scaled = suffix ? Number((value / suffix.factor).toPrecision(3)) : value;
  const abs = Math.abs(scaled);
  const digits = abs !== 0 && abs < EXPONENT_LIMIT ? scaled.toExponential() : numberFormat.format(scaled);
  return (approx ? "~" : "") + digits + (suffix ? ` ${suffix.name}` : "");
}

/**
 * Builds the result columns for an evaluated line.
 * - rate: "<n> [label] /year", "/day", "/s", plus "<n> Gbps" for sizes
 * - amount: a single "<n> [label]"
 */
export function formatQuantity(q: Quantity): string[] {
  const fmt = q.dim === "bytes" ? formatBytes : formatCount;
  const label = q.label ? ` ${q.label}` : "";

  if (q.timeExp === 0) {
    return [fmt(q.value) + label];
  }

  const columns = [
    `${fmt(q.value * YEAR)}${label} /year`,
    `${fmt(q.value * DAY)}${label} /day`,
    `${fmt(q.value)}${label} /s`,
  ];
  if (q.dim === "bytes") {
    columns.push(formatBitRate(q.value * 8));
  }
  return columns;
}
