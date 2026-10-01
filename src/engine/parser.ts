// Recursive-descent parser: tokens → AST.
//
//   expr     := term (('+' | '-') term)*
//   term     := unary (('*' | '/') unary)*
//   unary    := '-' unary | factor
//   factor   := '(' expr ')' label* | quantity
//   quantity := number scale? unit? label*  |  unit label*
//
// A bare unit counts as one of that unit, which is what makes "/ day" and
// "per second" work. Labels are spaced words that are not units or scales.

import { EngineError } from "./errors";
import type { Op, Token } from "./lexer";
import { lookupScale, lookupUnit, type Unit } from "./units";

export type Node =
  | {
      type: "quantity";
      /** The number with its scale applied (100M → 1e8), not yet multiplied by the unit. */
      value: number;
      unit?: Unit;
      labels: string[];
      pos: number;
    }
  | { type: "group"; expr: Node; labels: string[]; pos: number }
  | { type: "neg"; operand: Node; pos: number }
  | { type: "binary"; op: Op; left: Node; right: Node; pos: number };

export function parse(tokens: Token[], lineLength: number): Node {
  return new Parser(tokens, lineLength).parseLine();
}

class Parser {
  private i = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly lineLength: number,
  ) {}

  parseLine(): Node {
    const node = this.parseExpr();
    const extra = this.peek();
    if (extra) {
      throw new EngineError(`unexpected ${describe(extra)}`, extra.pos);
    }
    return node;
  }

  private parseExpr(): Node {
    let left = this.parseTerm();
    for (let t = this.peek(); t?.kind === "op" && (t.op === "+" || t.op === "-"); t = this.peek()) {
      this.i++;
      left = { type: "binary", op: t.op, left, right: this.parseTerm(), pos: t.pos };
    }
    return left;
  }

  private parseTerm(): Node {
    let left = this.parseUnary();
    for (let t = this.peek(); t?.kind === "op" && (t.op === "*" || t.op === "/"); t = this.peek()) {
      this.i++;
      left = { type: "binary", op: t.op, left, right: this.parseUnary(), pos: t.pos };
    }
    return left;
  }

  private parseUnary(): Node {
    const t = this.peek();
    if (t?.kind === "op" && t.op === "-") {
      this.i++;
      return { type: "neg", operand: this.parseUnary(), pos: t.pos };
    }
    return this.parseFactor();
  }

  private parseFactor(): Node {
    const t = this.peek();
    if (!t) {
      throw new EngineError("expected a number at end of line", this.lineLength);
    }

    if (t.kind === "lparen") {
      this.i++;
      const expr = this.parseExpr();
      const close = this.peek();
      if (close?.kind !== "rparen") {
        throw new EngineError('missing ")"', close?.pos ?? this.lineLength);
      }
      this.i++;
      return { type: "group", expr, labels: this.parseLabels(), pos: t.pos };
    }

    if (t.kind === "num") {
      this.i++;
      let value = t.value;
      const scale = this.peekWord();
      const factor = scale && lookupScale(scale.text)?.factor;
      if (factor !== undefined) {
        this.i++;
        value *= factor;
      }
      return { type: "quantity", value, unit: this.parseUnit(), labels: this.parseLabels(), pos: t.pos };
    }

    if (t.kind === "word") {
      const unit = lookupUnit(t.text);
      if (unit) {
        this.i++;
        return { type: "quantity", value: 1, unit, labels: this.parseLabels(), pos: t.pos };
      }
      throw new EngineError(`expected a number before "${t.text}"`, t.pos);
    }

    throw new EngineError(`expected a number, got ${describe(t)}`, t.pos);
  }

  /** An optional unit right after a number or scale. A glued unknown word is an error. */
  private parseUnit(): Unit | undefined {
    const w = this.peekWord();
    if (!w) return undefined;
    const unit = lookupUnit(w.text);
    if (unit) {
      this.i++;
      return unit;
    }
    checkNotUnitLike(w);
    return undefined;
  }

  /** Spaced words that are not units or scales, e.g. "photos" in "100M photos / day". */
  private parseLabels(): string[] {
    const labels: string[] = [];
    for (let w = this.peekWord(); w; w = this.peekWord()) {
      if (lookupUnit(w.text) || lookupScale(w.text)) break;
      checkNotUnitLike(w);
      labels.push(w.text);
      this.i++;
    }
    return labels;
  }

  private peek(): Token | undefined {
    return this.tokens[this.i];
  }

  private peekWord(): Extract<Token, { kind: "word" }> | undefined {
    const t = this.peek();
    return t?.kind === "word" ? t : undefined;
  }
}

/** Rejects a word glued to the previous token ("5qb"): it can't be a label. */
function checkNotUnitLike(w: Extract<Token, { kind: "word" }>): void {
  if (!w.spaced) throw new EngineError(`unknown unit "${w.text}"`, w.pos);
}

function describe(t: Token): string {
  switch (t.kind) {
    case "num":
      return `number ${t.value}`;
    case "word":
      return `"${t.text}"`;
    case "op":
      return `"${t.op}"`;
    case "lparen":
      return '"("';
    case "rparen":
      return '")"';
  }
}
