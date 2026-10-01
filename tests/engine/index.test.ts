import { describe, expect, it } from "vitest";
import { evaluateLine } from "../../src/engine";

describe("evaluateLine", () => {
  it("returns empty for blank lines", () => {
    expect(evaluateLine("")).toEqual({ kind: "empty" });
    expect(evaluateLine("   \t")).toEqual({ kind: "empty" });
  });

  it("returns comment for comment-only lines", () => {
    expect(evaluateLine("# storage estimate")).toEqual({ kind: "comment" });
    expect(evaluateLine("   #")).toEqual({ kind: "comment" });
  });

  it("returns columns for values and ignores inline comments", () => {
    expect(evaluateLine("4 MB * 100M # one photo each")).toEqual({ kind: "value", columns: ["400 TB"] });
  });

  it("returns lexer, parser and evaluator errors with positions", () => {
    expect(evaluateLine("5 $")).toEqual({ kind: "error", error: 'unexpected "$"', pos: 2 });
    expect(evaluateLine("5qb")).toEqual({ kind: "error", error: 'unknown unit "qb"', pos: 1 });
    expect(evaluateLine("4 MB * 2 MB")).toEqual({ kind: "error", error: "can't multiply a size by a size", pos: 5 });
    expect(evaluateLine("3 days")).toEqual({
      kind: "error",
      error: "result is a duration; divide something by it to get a rate",
    });
  });
});
