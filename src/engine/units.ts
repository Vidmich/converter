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

// Single-letter scales are case-sensitive so that "B" (billion) never
// collides with bytes and "M" (million) never collides with minutes.
// "B" alone is always billion: bytes need a prefix (KB, MB…) or the word "byte".
const CASE_SENSITIVE_SCALES: Record<string, number> = {
  k: 1e3,
  K: 1e3,
  M: 1e6,
  B: 1e9,
  T: 1e12,
};

const WORD_SCALES: Record<string, number> = {
  thousand: 1e3,
  million: 1e6,
  billion: 1e9,
  trillion: 1e12,
};

// Byte units are case-sensitive: the trailing "B" must be upper case, so
// "Mb"/"Gb" are not silently read as bytes. "kB" is accepted as well.
const BYTE_UNITS: Record<string, number> = {
  KB: 1e3,
  kB: 1e3,
  MB: 1e6,
  GB: 1e9,
  TB: 1e12,
  PB: 1e15,
  EB: 1e18,
  ZB: 1e21,
};

// Case-insensitive word units, keyed in lower case.
const WORD_UNITS: Record<string, Unit> = {
  byte: { kind: "size", factor: 1 },
  bytes: { kind: "size", factor: 1 },

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

/** Returns the scale for a word such as "M", "k" or "billion", if it is one. */
export function lookupScale(word: string): Scale | undefined {
  const factor = CASE_SENSITIVE_SCALES[word] ?? WORD_SCALES[word.toLowerCase()];
  return factor === undefined ? undefined : { factor };
}

/**
 * For a word that looks like a byte unit in the wrong case ("Mb", "gb"),
 * returns a hint naming the byte and bit spellings; otherwise undefined.
 */
export function miscasedUnitHint(word: string): string | undefined {
  if (BYTE_UNITS[word] !== undefined) return undefined;
  const upper = word.toUpperCase();
  if (upper === "B" || BYTE_UNITS[upper] === undefined) return undefined;
  const prefix = upper[0] === "K" ? "K" : upper[0];
  return `ambiguous unit "${word}": use ${upper} for bytes or ${prefix}bit for bits`;
}

/** Returns the unit for a word such as "MB", "Gbps", "bits" or "day", if it is one. */
export function lookupUnit(word: string): Unit | undefined {
  const bytes = BYTE_UNITS[word];
  if (bytes !== undefined) return { kind: "size", factor: bytes };
  const lower = word.toLowerCase();
  const unit = WORD_UNITS[lower];
  if (unit) return unit;
  const period = PERIODS[lower];
  if (period !== undefined) return { kind: "time", factor: period };
  return undefined;
}
