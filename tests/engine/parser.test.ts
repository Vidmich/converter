import { describe, expect, it } from "vitest";
import { lex } from "../../src/engine/lexer";
import { parse, type Node } from "../../src/engine/parser";
import { EngineError } from "../../src/engine/errors";

/** Prints an AST as a compact s-expression, e.g. "(/ 1e8[photos] day)". */
function show(node: Node): string {
  switch (node.type) {
    case "quantity": {
      const num = node.unit?.kind === "time" && node.value === 1 ? "" : String(node.value);
      const unit = node.unit ? `${node.unit.kind}:${node.unit.factor}` : "";
      const labels = node.labels.length ? `[${node.labels.join(" ")}]` : "";
      return [num, unit].filter(Boolean).join(" ") + labels;
    }
    case "group":
      return `{${show(node.expr)}}` + (node.labels.length ? `[${node.labels.join(" ")}]` : "");
    case "neg":
      return `(- ${show(node.operand)})`;
    case "binary":
      return `(${node.op} ${show(node.left)} ${show(node.right)})`;
  }
}

const p = (line: string) => show(parse(lex(line).tokens, line.length));

function errorOf(line: string): EngineError {
  try {
    parse(lex(line).tokens, line.length);
  } catch (e) {
    if (e instanceof EngineError) return e;
    throw e;
  }
  throw new Error(`expected "${line}" to fail`);
}

describe("parse", () => {
  it("parses the brief's examples", () => {
    expect(p("100M photos / day")).toBe("(/ 100000000[photos] time:86400)");
    expect(p("50B x 70KB / day")).toBe("(/ (* 50000000000 70 size:1000) time:86400)");
    expect(p("4 MB * 100M/day")).toBe("(/ (* 4 size:1000000 100000000) time:86400)");
  });

  it("applies scales, spaced or glued", () => {
    expect(p("100M")).toBe("100000000");
    expect(p("100 M")).toBe("100000000");
    expect(p("3 thousand")).toBe("3000");
    expect(p("1.5k")).toBe("1500");
  });

  it("accepts per and bare periods", () => {
    expect(p("100M per day")).toBe(p("100M / day"));
    expect(p("5 Gbps")).toBe("5 rate:125000000");
  });

  it("reads a number with a period as a duration", () => {
    expect(p("1 TB / 2 days")).toBe("(/ 1 size:1000000000000 2 time:86400)");
  });

  it("collects several label words", () => {
    expect(p("100M daily photos")).toBe("100000000[daily photos]");
    expect(p("70KB photo")).toBe("70 size:1000[photo]");
  });

  it("gives * and / precedence over + and -", () => {
    expect(p("1 + 2 * 3")).toBe("(+ 1 (* 2 3))");
    expect(p("1 - 2 / 3")).toBe("(- 1 (/ 2 3))");
    expect(p("8 / 2 / 2")).toBe("(/ (/ 8 2) 2)");
  });

  it("parses parentheses and labels on groups", () => {
    expect(p("(1 + 2) * 3")).toBe("(* {(+ 1 2)} 3)");
    expect(p("(10M + 5M) users")).toBe("{(+ 10000000 5000000)}[users]");
  });

  it("parses unary minus", () => {
    expect(p("-5")).toBe("(- 5)");
    expect(p("10 - -5")).toBe("(- 10 (- 5))");
  });

  it.each([
    ["5qb", 'unknown unit "qb"', 1],
    ["100Mphotos", 'unknown unit "Mphotos"', 3],
    ["photos", 'expected a number before "photos"', 0],
    ["5 *", "expected a number at end of line", 3],
    ["(1 + 2", 'missing ")"', 6],
    ["1 + 2)", 'unexpected ")"', 5],
    ["5 MB 3", "unexpected number 3", 5],
    ["100M photos day", 'unexpected "day"', 12],
    ["* 5", 'expected a number, got "*"', 0],
  ])("rejects %s", (line, message, pos) => {
    const e = errorOf(line);
    expect(e.message).toBe(message);
    expect(e.pos).toBe(pos);
  });
});
