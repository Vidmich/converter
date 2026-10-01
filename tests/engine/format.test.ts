import { describe, expect, it } from "vitest";
import { formatBitRate, formatBytes, formatCount, formatQuantity, roundValue } from "../../src/engine/format";
import { DAY } from "../../src/engine/units";

describe("roundValue", () => {
  it.each([
    [0, 0, false],
    [36.5e9, 36.5e9, false],
    [146e15, 146e15, false],
    [1157.407, 1200, true],
    [4.0509e10, 4.1e10, true],
    [1234, 1200, true],
    [0.0123, 0.0123, false],
    [0.012345, 0.012, true],
    [-1157, -1200, true],
  ])("%d → %d (approx %s)", (x, value, approx) => {
    expect(roundValue(x)).toEqual({ value, approx });
  });

  it("treats float noise as exact", () => {
    expect(roundValue((4e14 / DAY) * DAY)).toEqual({ value: 4e14, approx: false });
    expect(roundValue(0.1 + 0.2)).toEqual({ value: 0.3, approx: false });
  });
});

describe("formatCount", () => {
  it.each([
    [0, "0"],
    [7, "7"],
    [1157.4, "~1,200"],
    [9999, "~10 K"], // the suffix is picked after rounding
    [10_000, "10 K"],
    [12_345, "~12 K"],
    [1e8, "100 M"],
    [36.5e9, "36.5 B"],
    [2e12, "2 T"],
    [5e15, "5 Q"],
    [1.2e18, "1,200 Q"],
    [0.5, "0.5"],
    [0.0317, "0.0317"],
    [0.031709, "~0.032"],
    [1 / (365 * DAY), "~3.2e-8"],
    [-2.5e6, "-2.5 M"],
  ])("%d → %s", (x, text) => {
    expect(formatCount(x)).toBe(text);
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [500, "500 B"],
    [1000, "1 KB"],
    [70e3, "70 KB"],
    [4.6296e9, "~4.6 GB"],
    [4.0509e10, "~41 GB"],
    [400e12, "400 TB"],
    [3.5e15, "3.5 PB"],
    [146e15, "146 PB"],
    [1.2775e18, "~1.3 EB"],
    [999.7e3, "~1 MB"],
    [2e24, "2,000 ZB"],
    [0.125, "0.125 B"],
  ])("%d → %s", (x, text) => {
    expect(formatBytes(x)).toBe(text);
  });
});

describe("formatBitRate", () => {
  it.each([
    [3.2407e11, "~320 Gbps"],
    [3.7037e10, "~37 Gbps"],
    [1e9, "1 Gbps"],
    [800, "800 bps"],
  ])("%d → %s", (x, text) => {
    expect(formatBitRate(x)).toBe(text);
  });
});

describe("formatQuantity", () => {
  it("shows count rates per year, day and second with the label", () => {
    expect(formatQuantity({ value: 1e8 / DAY, dim: "count", timeExp: -1, label: "photos" })).toEqual([
      "36.5 B photos /year",
      "100 M photos /day",
      "~1,200 photos /s",
    ]);
  });

  it("adds a bit-rate column for size rates", () => {
    expect(formatQuantity({ value: 3.5e15 / DAY, dim: "bytes", timeExp: -1 })).toEqual([
      "~1.3 EB /year",
      "3.5 PB /day",
      "~41 GB /s",
      "~320 Gbps",
    ]);
  });

  it("shows amounts as a single column", () => {
    expect(formatQuantity({ value: 4e14, dim: "bytes", timeExp: 0 })).toEqual(["400 TB"]);
    expect(formatQuantity({ value: 1.2345e9, dim: "count", timeExp: 0, label: "users" })).toEqual(["~1.2 B users"]);
  });
});
