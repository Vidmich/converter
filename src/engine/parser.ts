// Recursive-descent parser: tokens → AST.
//
//   expr     := term (('+' | '-') term)*
//   term     := unary (('*' | '/') unary)*
//   unary    := '-' unary | factor
//   factor   := '(' expr ')' ('^' exponent)? label* | quantity
//   quantity := number ('^' exponent)? scale? unit? label*  |  unit label*
//   exponent := '-' exponent | (number | '(' expr ')') ('^' exponent)?
//
// "^" (also "**") binds tighter than unary minus and is right-associative:
// -2^2 = -4, 2^3^2 = 2^9. Scale, unit and labels after a power apply to its
// result: 2^10 KB = (2^10) × 1 KB.
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
  | { type: "power"; base: Node; exponent: Node; pos: number }
  | { type: "binary"; op: Exclude<Op, "^">; left: Node; right: Node; pos: number };

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
      let expr: Node = this.parseParens();
      const pow = this.takePower();
      if (pow) {
        const base: Node = { type: "group", expr, labels: [], pos: t.pos };
        expr = { type: "power", base, exponent: this.parseExponent(), pos: pow.pos };
      }
      return { type: "group", expr, labels: this.parseLabels(), pos: t.pos };
    }

    if (t.kind === "num") {
      this.i++;
      const pow = this.takePower();
      if (!pow) return this.parseQuantityTail(t.value, t.pos);

      const base: Node = { type: "quantity", value: t.value, labels: [], pos: t.pos };
      const power: Node = { type: "power", base, exponent: this.parseExponent(), pos: pow.pos };
      const tail = this.parseQuantityTail(1, t.pos);
      const plain = tail.type === "quantity" && tail.value === 1 && !tail.unit && tail.labels.length === 0;
      return plain ? power : { type: "binary", op: "*", left: power, right: tail, pos: pow.pos };
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

  /** Scale, unit and labels after a number: the "M photos" in "100M photos". */
  private parseQuantityTail(value: number, pos: number): Node {
    const scale = this.peekWord();
    const factor = scale && lookupScale(scale.text)?.factor;
    if (factor !== undefined) {
      this.i++;
      value *= factor;
    }
    return { type: "quantity", value, unit: this.parseUnit(), labels: this.parseLabels(), pos };
  }

  /** The exponent after "^": a number or parenthesised expression, optionally negated or raised again. */
  private parseExponent(): Node {
    const t = this.peek();
    if (t?.kind === "op" && t.op === "-") {
      this.i++;
      return { type: "neg", operand: this.parseExponent(), pos: t.pos };
    }
    let node: Node;
    if (t?.kind === "num") {
      this.i++;
      node = { type: "quantity", value: t.value, labels: [], pos: t.pos };
    } else if (t?.kind === "lparen") {
      node = { type: "group", expr: this.parseParens(), labels: [], pos: t.pos };
    } else {
      const where = t ? `, got ${describe(t)}` : " at end of line";
      throw new EngineError(`expected a number after "^"${where}`, t?.pos ?? this.lineLength);
    }
    const pow = this.takePower();
    return pow ? { type: "power", base: node, exponent: this.parseExponent(), pos: pow.pos } : node;
  }

  /** Parses "( expr )" starting at the "(" and returns the inner expression. */
  private parseParens(): Node {
    this.i++;
    const expr = this.parseExpr();
    const close = this.peek();
    if (close?.kind !== "rparen") {
      throw new EngineError('missing ")"', close?.pos ?? this.lineLength);
    }
    this.i++;
    return expr;
  }

  /** Consumes a "^" (or "**") token if it is next. */
  private takePower(): Token | undefined {
    const t = this.peek();
    if (t?.kind === "op" && t.op === "^") {
      this.i++;
      return t;
    }
    return undefined;
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
      return `"${t.op}"`; // "**" is reported as "^"
    case "lparen":
      return '"("';
    case "rparen":
      return '")"';
  }
}
