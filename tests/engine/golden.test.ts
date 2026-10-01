// End-to-end golden tests: input line → exact display columns.
// The first three are the examples from the brief (see PLAN.md).

import { describe, expect, it } from "vitest";
import { evaluateLine } from "../../src/engine";

const value = (...columns: string[]) => ({ kind: "value", columns });
const labelled = (label: string, ...columns: string[]) => ({ kind: "value", label, columns });
const error = (message: string, pos?: number) =>
  pos === undefined ? { kind: "error", error: message } : { kind: "error", error: message, pos };

describe("golden: brief examples", () => {
  it.each([
    ["100M photos / day", labelled("photos", "36.5 B /year", "100 M /day", "~1,200 /s")],
    ["50B x 70KB / day", value("~1.3 EB /year", "3.5 PB /day", "~41 GB /s", "~320 Gbps")],
    ["4 MB * 100M/day", value("~150 PB /year", "400 TB /day", "~4.6 GB /s", "~37 Gbps")],
    // Organizer issue #1: 146 PB is shown as ~150 PB
    ["100M photos * 4MB /day", labelled("photos", "~150 PB /year", "400 TB /day", "~4.6 GB /s", "~37 Gbps")],
  ])("%s", (line, expected) => {
    expect(evaluateLine(line)).toEqual(expected);
  });
});

// Organizer issue #2: the label is returned separately, combined from all operands.
describe("golden: labels", () => {
  it.each([
    ["100M photos * 4MB size /day", labelled("photos size", "~150 PB /year", "400 TB /day", "~4.6 GB /s", "~37 Gbps")],
    ["100M photos * 2 photos", labelled("photos", "200 M")],
    ["100M daily photos * 4 MB photo size", labelled("daily photos photo size", "400 TB")],
    ["(10M users + 5M bots) accounts / day", labelled("accounts", "~5.5 B /year", "15 M /day", "~170 /s")],
    ["(10M users + 5M bots) / day", labelled("users bots", "~5.5 B /year", "15 M /day", "~170 /s")],
    ["4 MB * 100M", value("400 TB")],
  ])("%s", (line, expected) => {
    expect(evaluateLine(line)).toEqual(expected);
  });
});

describe("golden: README examples", () => {
  it.each([
    ["10K requests / s", labelled("requests", "~320 B /year", "~860 M /day", "10 K /s")],
    ["10K/s * 2 KB", value("~630 TB /year", "~1.7 TB /day", "20 MB /s", "160 Mbps")],
    ["1 TB / 2 days", value("~180 TB /year", "500 GB /day", "~5.8 MB /s", "~46 Mbps")],
    ["10 Gbps * 1 day", value("~110 TB")],
    ["1 TB / 4 MB", value("250 K")],
    ["(10M + 5M) users / month", labelled("users", "~180 M /year", "500 K /day", "~5.8 /s")],
    ["100M photos * 4MB size / day", labelled("photos size", "~150 PB /year", "400 TB /day", "~4.6 GB /s", "~37 Gbps")],
    ["1 MB + 5", error("can't add a count to a size", 5)],
  ])("%s", (line, expected) => {
    expect(evaluateLine(line)).toEqual(expected);
  });
});

// Organizer issue #3: scales and byte units ignore case; bits and bytes alone are words.
describe("golden: case-insensitive suffixes", () => {
  it.each([
    ["100m photos / day", "100M photos / day"],
    ["50b x 70kb / day", "50B x 70KB / day"],
    ["4 mb * 100m/day", "4 MB * 100M/day"],
    ["5 Mb", "5 MB"],
    ["5 mB", "5 MB"],
    ["5gb", "5 GB"],
    ["2 tB", "2 TB"],
    ["5t", "5 T"],
    ["5 b", "5 B"],
    ["8 bits", "1 byte"],
    ["8 mbit", "1 MB"],
    ["80 mbps", "80 Mbps"],
  ])("%s = %s", (line, same) => {
    expect(evaluateLine(line)).toEqual(evaluateLine(same));
  });

  it.each([
    ["5 Mb", value("5 MB")],
    ["100b", value("100 B")],
    ["2 bytes", value("2 B")],
  ])("%s", (line, expected) => {
    expect(evaluateLine(line)).toEqual(expected);
  });
});

describe("golden: spelling variants give the same result", () => {
  it.each([
    "100M photos/day",
    "100 M photos / day",
    "100,000,000 photos per day",
    "100_000_000 photos per day", // issue #4
    "100,000_000 photos / day",
    "100 million photos per day",
  ])(
    "%s",
    (line) => {
      expect(evaluateLine(line)).toEqual(evaluateLine("100M photos / day"));
    },
  );

  it.each(["50B * 70KB / day", "50B × 70KB / day", "50 billion x 70 KB per day", "(50B x 70KB) / day"])("%s", (line) => {
    expect(evaluateLine(line)).toEqual(evaluateLine("50B x 70KB / day"));
  });
});

describe("golden: edge cases", () => {
  it.each([
    ["tiny rate", "1 / year", value("1 /year", "~0.0027 /day", "~3.2e-8 /s")],
    ["zero", "0 / day", value("0 /year", "0 /day", "0 /s")],
    ["huge size rate", "1 ZB / day", value("~370 ZB /year", "1 ZB /day", "~12 PB /s", "~93 Pbps")],
    ["bit-rate input", "10 Gbps", value("~39 PB /year", "~110 TB /day", "1.25 GB /s", "10 Gbps")],
    ["duration divisor", "1 TB / 2 days", value("~180 TB /year", "500 GB /day", "~5.8 MB /s", "~46 Mbps")],
    ["month period", "(10M + 5M) users / month", labelled("users", "~180 M /year", "500 K /day", "~5.8 /s")],
    ["label carried to sizes", "100M photos/day * 4 MB", labelled("photos", "~150 PB /year", "400 TB /day", "~4.6 GB /s", "~37 Gbps")],
    ["size amount", "4 MB * 100M", value("400 TB")],
    ["count amount", "1,234,567 users", labelled("users", "~1.2 M")],
    ["ratio", "1 TB / 4 MB", value("250 K")],
    ["inline comment", "5 MB # avg photo", value("5 MB")],
    ["bits amount", "8 Gbit", value("1 GB")],
  ])("%s: %s", (_name, line, expected) => {
    expect(evaluateLine(line)).toEqual(expected);
  });

  it.each([
    ["", { kind: "empty" }],
    ["# daily uploads", { kind: "comment" }],
  ])("non-values: %j", (line, expected) => {
    expect(evaluateLine(line)).toEqual(expected);
  });
});

describe("golden: errors", () => {
  it.each([
    ["5 $ 3", error('unexpected "$"', 2)],
    ["1,20", error('bad thousands separator in "1,20"', 1)],
    ["1_20", error('bad thousands separator in "1_20"', 1)],
    ["1.000_5", error('unknown unit "_5"', 5)],
    ["5qb", error('unknown unit "qb"', 1)],
    ["100M photos mb", error('unexpected "mb"', 12)],
    ["photos / day", error('expected a number before "photos"', 0)],
    ["5 *", error("expected a number at end of line", 3)],
    ["(1 + 2", error('missing ")"', 6)],
    ["1 + 2)", error('unexpected ")"', 5)],
    ["4 MB * 2 MB", error("can't multiply a size by a size", 5)],
    ["5 / 2 MB", error("can't divide a count by a size", 2)],
    ["1 MB + 5", error("can't add a count to a size", 5)],
    ["5 / 0", error("division by zero", 2)],
    ["3 days", error("result is a duration; divide something by it to get a rate")],
    ["5 / s / s", error("result has time^-2 units")],
    ["1e300 * 1e300", error("number is too large")],
  ])("%s", (line, expected) => {
    expect(evaluateLine(line)).toEqual(expected);
  });
});
