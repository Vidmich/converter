import { describe, expect, it } from "vitest";
import { lex, type Token } from "../../src/engine/lexer";
import { EngineError } from "../../src/engine/errors";

/** Compact view of tokens: numbers as numbers, words as "w:text", ops as the op, parens as "(" / ")". */
function kinds(line: string): (string | number)[] {
  return lex(line).tokens.map((t: Token) => {
    switch (t.kind) {
      case "num":
        return t.value;
      case "word":
        return `w:${t.text}`;
      case "op":
        return t.op;
      case "lparen":
        return "(";
      case "rparen":
        return ")";
    }
  });
}

describe("lex", () => {
  it("handles an empty line", () => {
    expect(lex("")).toEqual({ tokens: [] });
    expect(lex("   ")).toEqual({ tokens: [] });
  });

  it.each([
    ["42", 42],
    ["3.5", 3.5],
    [".5", 0.5],
    ["1,200", 1200],
    ["100,000,000", 100_000_000],
    ["1_200", 1200],
    ["100_000_000", 100_000_000],
    ["1,000_000", 1_000_000],
    ["1_000.5", 1000.5],
    ["1e6", 1e6],
    ["2.5E-3", 2.5e-3],
  ])("reads number %s", (text, value) => {
    expect(kinds(text)).toEqual([value]);
  });

  it("rejects bad thousands separators", () => {
    expect(() => lex("1,20")).toThrow(EngineError);
    expect(() => lex("1,2345")).toThrow(/thousands separator/);
    expect(() => lex("1_20")).toThrow('bad thousands separator in "1_20"');
    expect(() => lex("1_2345")).toThrow(/thousands separator/);
    expect(() => lex("1,000_20")).toThrow('bad thousands separator in "1,000_20"');
  });

  it("only groups the integer part", () => {
    // "_5" after the decimals is not a separator; it becomes a glued word, which the parser rejects
    expect(kinds("1.000_5")).toEqual([1, "w:_5"]);
  });

  it("splits a scale glued to a number", () => {
    expect(kinds("100M")).toEqual([100, "w:M"]);
    expect(kinds("100 M")).toEqual([100, "w:M"]);
    expect(kinds("70KB")).toEqual([70, "w:KB"]);
  });

  it("does not read a unit starting with e as an exponent", () => {
    expect(kinds("1EB")).toEqual([1, "w:EB"]);
    expect(kinds("5e")).toEqual([5, "w:e"]);
  });

  it("marks whether a word follows whitespace", () => {
    const [, glued] = lex("5MB").tokens;
    const [, spaced] = lex("5 MB").tokens;
    expect(glued).toMatchObject({ kind: "word", spaced: false });
    expect(spaced).toMatchObject({ kind: "word", spaced: true });
  });

  it.each([
    ["/day", ["/", "w:day"]],
    ["/ day", ["/", "w:day"]],
    ["per day", ["/", "w:day"]],
    ["Per Day", ["/", "w:Day"]],
  ])("reads %s as divide-by-period", (text, expected) => {
    expect(kinds(text)).toEqual(expected);
  });

  it.each([
    ["*", "*"],
    ["x", "*"],
    ["X", "*"],
    ["×", "*"],
    ["·", "*"],
    ["/", "/"],
    ["÷", "/"],
    ["+", "+"],
    ["-", "-"],
    ["−", "-"],
  ])("reads operator %s", (text, op) => {
    expect(kinds(`1 ${text} 2`)).toEqual([1, op, 2]);
  });

  it("reads the brief's examples", () => {
    expect(kinds("100M photos / day")).toEqual([100, "w:M", "w:photos", "/", "w:day"]);
    expect(kinds("50B x 70KB / day")).toEqual([50, "w:B", "*", 70, "w:KB", "/", "w:day"]);
    expect(kinds("4 MB * 100M/day")).toEqual([4, "w:MB", "*", 100, "w:M", "/", "w:day"]);
  });

  it("reads parentheses", () => {
    expect(kinds("(1 + 2) * 3")).toEqual(["(", 1, "+", 2, ")", "*", 3]);
  });

  it("splits off comments", () => {
    expect(lex("# just a note")).toEqual({ tokens: [], comment: " just a note" });
    const r = lex("4 MB # avg photo");
    expect(r.comment).toBe(" avg photo");
    expect(r.tokens).toHaveLength(2);
  });

  it("records token positions", () => {
    expect(lex("4 MB").tokens).toMatchObject([
      { kind: "num", pos: 0, end: 1 },
      { kind: "word", pos: 2, end: 4 },
    ]);
  });

  it("rejects unknown symbols with a position", () => {
    try {
      lex("5 $ 3");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(EngineError);
      expect((e as EngineError).pos).toBe(2);
      expect((e as EngineError).message).toBe('unexpected "$"');
    }
  });
});
