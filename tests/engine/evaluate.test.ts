import { describe, expect, it } from "vitest";
import { lex } from "../../src/engine/lexer";
import { parse } from "../../src/engine/parser";
import { evaluate } from "../../src/engine/evaluate";
import { EngineError } from "../../src/engine/errors";
import { DAY } from "../../src/engine/units";

const ev = (line: string) => evaluate(parse(lex(line).tokens, line.length));

function errorOf(line: string): EngineError {
  try {
    ev(line);
  } catch (e) {
    if (e instanceof EngineError) return e;
    throw e;
  }
  throw new Error(`expected "${line}" to fail`);
}

describe("evaluate", () => {
  it("evaluates the brief's examples to per-second rates", () => {
    const photos = ev("100M photos / day");
    expect(photos).toMatchObject({ dim: "count", timeExp: -1, label: "photos" });
    expect(photos.value).toBeCloseTo(1e8 / DAY);

    const storage = ev("50B x 70KB / day");
    expect(storage).toMatchObject({ dim: "bytes", timeExp: -1 });
    expect(storage.value).toBeCloseTo(3.5e15 / DAY);
    expect(storage.label).toBeUndefined();

    const uploads = ev("4 MB * 100M/day");
    expect(uploads).toMatchObject({ dim: "bytes", timeExp: -1 });
    expect(uploads.value).toBeCloseTo(4e14 / DAY);
  });

  it("evaluates amounts", () => {
    expect(ev("4 MB * 100M")).toEqual({ value: 4e14, dim: "bytes", timeExp: 0 });
    expect(ev("3 * (2 + 1)")).toEqual({ value: 9, dim: "count", timeExp: 0 });
  });

  it("stores bits and bit rates as bytes", () => {
    expect(ev("8 bits")).toEqual({ value: 1, dim: "bytes", timeExp: 0 });
    expect(ev("8 Gbps")).toEqual({ value: 1e9, dim: "bytes", timeExp: -1 });
  });

  it("converts between periods", () => {
    expect(ev("1 TB / 2 days").value).toBeCloseTo(1e12 / (2 * DAY));
    expect(ev("1 Gbps * 1 day")).toEqual({ value: (1e9 / 8) * DAY, dim: "bytes", timeExp: 0 });
    expect(ev("10K / s * 1 hour").value).toBeCloseTo(3.6e7);
  });

  it("treats size / size as a ratio", () => {
    expect(ev("1 TB / 4 MB")).toEqual({ value: 250_000, dim: "count", timeExp: 0 });
  });

  it("adds matching quantities", () => {
    expect(ev("1 MB + 500 KB")).toEqual({ value: 1.5e6, dim: "bytes", timeExp: 0 });
    expect(ev("-5 + 2").value).toBe(-3);
  });

  it("keeps labels, preferring the enclosing group", () => {
    expect(ev("100M photos * 2").label).toBe("photos");
    expect(ev("2 * 100M photos").label).toBe("photos");
    expect(ev("(10M users + 5M) accounts").label).toBe("accounts");
  });

  it.each([
    ["4 MB * 2 MB", "can't multiply a size by a size", 5],
    ["5 / 2 MB", "can't divide a count by a size", 2],
    ["1 MB + 5", "can't add a count to a size", 5],
    ["1 MB/s - 5 MB", "can't subtract a size from a size per time", 7],
    ["5 / 0", "division by zero", 2],
    ["3 days", "result is a duration; divide something by it to get a rate", undefined],
    ["5 / s / s", "result has time^-2 units", undefined],
    ["1e300 * 1e300", "number is too large", undefined],
  ])("rejects %s", (line, message, pos) => {
    const e = errorOf(line);
    expect(e.message).toBe(message);
    expect(e.pos).toBe(pos);
  });
});
