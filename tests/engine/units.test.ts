import { describe, expect, it } from "vitest";
import { DAY, MONTH, YEAR, lookupScale, lookupUnit, miscasedUnitHint } from "../../src/engine/units";

describe("lookupScale", () => {
  it.each([
    ["K", 1e3],
    ["k", 1e3],
    ["M", 1e6],
    ["B", 1e9],
    ["T", 1e12],
    ["thousand", 1e3],
    ["Million", 1e6],
    ["BILLION", 1e9],
    ["trillion", 1e12],
  ])("%s = %d", (word, factor) => {
    expect(lookupScale(word)).toEqual({ factor });
  });

  it.each(["m", "b", "t", "KB", "photos"])("%s is not a scale", (word) => {
    expect(lookupScale(word)).toBeUndefined();
  });
});

describe("lookupUnit", () => {
  it("reads B alone as billion, never as bytes", () => {
    expect(lookupUnit("B")).toBeUndefined();
    expect(lookupScale("B")).toEqual({ factor: 1e9 });
  });

  it.each([
    ["byte", 1],
    ["Bytes", 1],
    ["KB", 1e3],
    ["kB", 1e3],
    ["MB", 1e6],
    ["GB", 1e9],
    ["TB", 1e12],
    ["PB", 1e15],
    ["EB", 1e18],
  ])("%s is a size of %d bytes", (word, factor) => {
    expect(lookupUnit(word)).toEqual({ kind: "size", factor });
  });

  it.each(["Mb", "gb", "mb", "Kb"])("%s is not a byte unit", (word) => {
    expect(lookupUnit(word)).toBeUndefined();
  });

  it.each([
    ["bit", 1 / 8],
    ["bits", 1 / 8],
    ["Kbit", 1e3 / 8],
    ["Gbit", 1e9 / 8],
  ])("%s is a size in bits", (word, factor) => {
    expect(lookupUnit(word)).toEqual({ kind: "size", factor });
  });

  it.each([
    ["bps", 1 / 8],
    ["Kbps", 1e3 / 8],
    ["Mbps", 1e6 / 8],
    ["Gbps", 1e9 / 8],
    ["gbps", 1e9 / 8],
    ["Tbps", 1e12 / 8],
  ])("%s is a rate in bytes/s", (word, factor) => {
    expect(lookupUnit(word)).toEqual({ kind: "rate", factor });
  });

  it.each([
    ["s", 1],
    ["sec", 1],
    ["min", 60],
    ["hour", 3600],
    ["h", 3600],
    ["day", DAY],
    ["Days", DAY],
    ["week", 7 * DAY],
    ["month", MONTH],
    ["year", YEAR],
    ["yr", YEAR],
  ])("%s is a period of %d s", (word, factor) => {
    expect(lookupUnit(word)).toEqual({ kind: "time", factor });
  });

  it("uses 365-day years and 30-day months", () => {
    expect(YEAR).toBe(365 * 86_400);
    expect(MONTH).toBe(30 * 86_400);
  });

  it("hints at the right spelling for miscased byte units", () => {
    expect(miscasedUnitHint("Mb")).toBe('ambiguous unit "Mb": use MB for bytes or Mbit for bits');
    expect(miscasedUnitHint("kb")).toBe('ambiguous unit "kb": use KB for bytes or Kbit for bits');
    expect(miscasedUnitHint("MB")).toBeUndefined();
    expect(miscasedUnitHint("kB")).toBeUndefined();
    expect(miscasedUnitHint("b")).toBeUndefined();
    expect(miscasedUnitHint("photos")).toBeUndefined();
  });

  it("does not know labels", () => {
    expect(lookupUnit("photos")).toBeUndefined();
  });
});
