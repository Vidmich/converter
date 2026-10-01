// Unit, scale and period tables. All sizes are decimal SI (1 KB = 1000 B).
// Base units: count = 1, size = 1 byte, time = 1 second.

export const SECOND = 1;
export const MINUTE = 60;
export const HOUR = 3600;
export const DAY = 86_400;
export const WEEK = 7 * DAY;
export const MONTH = 30 * DAY;
export const YEAR = 365 * DAY;

/** A word that follows a number and multiplies it: 100M, 50B, 3 thousand. */
export interface Scale {
  factor: number;
}

/**
 * A word that gives a number a dimension.
 * - `size`: bytes (bits are stored as bytes / 8)
 * - `rate`: bytes per second (bps family)
 * - `time`: seconds
 */
export interface Unit {
  kind: "size" | "rate" | "time";
  /** Value of one unit in base units (bytes, bytes/s or seconds). */
  factor: number;
}

// All lookups are case-insensitive; tables are keyed in lower case.
// "b"/"B" alone is always billion: plain bytes and bits are written as the
// words "byte(s)" and "bit(s)". Minutes are "min", never "m".
const SCALES: Record<string, number> = {
  k: 1e3,
  m: 1e6,
  b: 1e9,
  t: 1e12,
  thousand: 1e3,
  million: 1e6,
  billion: 1e9,
  trillion: 1e12,
};

const UNITS: Record<string, Unit> = {
  byte: { kind: "size", factor: 1 },
  bytes: { kind: "size", factor: 1 },
  kb: { kind: "size", factor: 1e3 },
  mb: { kind: "size", factor: 1e6 },
  gb: { kind: "size", factor: 1e9 },
  tb: { kind: "size", factor: 1e12 },
  pb: { kind: "size", factor: 1e15 },
  eb: { kind: "size", factor: 1e18 },
  zb: { kind: "size", factor: 1e21 },

  bit: { kind: "size", factor: 1 / 8 },
  bits: { kind: "size", factor: 1 / 8 },
  kbit: { kind: "size", factor: 1e3 / 8 },
  mbit: { kind: "size", factor: 1e6 / 8 },
  gbit: { kind: "size", factor: 1e9 / 8 },
  tbit: { kind: "size", factor: 1e12 / 8 },
  pbit: { kind: "size", factor: 1e15 / 8 },
  ebit: { kind: "size", factor: 1e18 / 8 },
  zbit: { kind: "size", factor: 1e21 / 8 },

  bps: { kind: "rate", factor: 1 / 8 },
  kbps: { kind: "rate", factor: 1e3 / 8 },
  mbps: { kind: "rate", factor: 1e6 / 8 },
  gbps: { kind: "rate", factor: 1e9 / 8 },
  tbps: { kind: "rate", factor: 1e12 / 8 },
  pbps: { kind: "rate", factor: 1e15 / 8 },
};

const PERIODS: Record<string, number> = {
  s: SECOND,
  sec: SECOND,
  secs: SECOND,
  second: SECOND,
  seconds: SECOND,
  min: MINUTE,
  mins: MINUTE,
  minute: MINUTE,
  minutes: MINUTE,
  h: HOUR,
  hr: HOUR,
  hrs: HOUR,
  hour: HOUR,
  hours: HOUR,
  d: DAY,
  day: DAY,
  days: DAY,
  wk: WEEK,
  week: WEEK,
  weeks: WEEK,
  mo: MONTH,
  month: MONTH,
  months: MONTH,
  y: YEAR,
  yr: YEAR,
  yrs: YEAR,
  year: YEAR,
  years: YEAR,
};

/** Returns the scale for a word such as "M", "k", "b" or "billion", if it is one. */
export function lookupScale(word: string): Scale | undefined {
  const factor = SCALES[word.toLowerCase()];
  return factor === undefined ? undefined : { factor };
}

/** Returns the unit for a word such as "MB", "mb", "Gbps", "bits" or "day", if it is one. */
export function lookupUnit(word: string): Unit | undefined {
  const lower = word.toLowerCase();
  const unit = UNITS[lower];
  if (unit) return unit;
  const period = PERIODS[lower];
  if (period !== undefined) return { kind: "time", factor: period };
  return undefined;
}
