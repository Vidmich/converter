// End-to-end golden tests: input line → exact display columns.
// The first three are the examples from the brief (see PLAN.md).

import { describe, expect, it } from "vitest";
import { evaluateLine } from "../../src/engine";

const value = (...columns: string[]) => ({ kind: "value", columns });
const error = (message: string, pos?: number) =>
  pos === undefined ? { kind: "error", error: message } : { kind: "error", error: message, pos };

describe("golden: brief examples", () => {
  it.each([
    ["100M photos / day", value("36.5 B photos /year", "100 M photos /day", "~1,200 photos /s")],
    ["50B x 70KB / day", value("~1.3 EB /year", "3.5 PB /day", "~41 GB /s", "~320 Gbps")],
    ["4 MB * 100M/day", value("146 PB /year", "400 TB /day", "~4.6 GB /s", "~37 Gbps")],
  ])("%s", (line, expected) => {
    expect(evaluateLine(line)).toEqual(expected);
  });
});

describe("golden: spelling variants give the same result", () => {
  it.each(["100M photos/day", "100 M photos / day", "100,000,000 photos per day", "100 million photos per day"])(
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
    ["huge size rate", "1 ZB / day", value("365 ZB /year", "1 ZB /day", "~12 PB /s", "~93 Pbps")],
    ["bit-rate input", "10 Gbps", value("~39 PB /year", "108 TB /day", "1.25 GB /s", "10 Gbps")],
    ["duration divisor", "1 TB / 2 days", value("~180 TB /year", "500 GB /day", "~5.8 MB /s", "~46 Mbps")],
    ["month period", "(10M + 5M) users / month", value("~180 M users /year", "500 K users /day", "~5.8 users /s")],
    ["label carried to sizes", "100M photos/day * 4 MB", value("146 PB photos /year", "400 TB photos /day", "~4.6 GB photos /s", "~37 Gbps")],
    ["size amount", "4 MB * 100M", value("400 TB")],
    ["count amount", "1,234,567 users", value("~1.2 M users")],
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
    ["5qb", error('unknown unit "qb"', 1)],
    ["5 Mb", error('ambiguous unit "Mb": use MB for bytes or Mbit for bits', 2)],
    ["5gb", error('ambiguous unit "gb": use GB for bytes or Gbit for bits', 1)],
    ["100M photos mb", error('ambiguous unit "mb": use MB for bytes or Mbit for bits', 12)],
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
