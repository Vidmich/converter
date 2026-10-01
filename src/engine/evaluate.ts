// AST → Quantity. Values are kept in base units: count or bytes, per second.

import { EngineError } from "./errors";
import type { Node } from "./parser";

export interface Quantity {
  /** In base units: a count, or bytes; per second when timeExp is -1. */
  value: number;
  dim: "count" | "bytes";
  /** Power of seconds: 0 = amount, -1 = rate, 1 = duration. */
  timeExp: number;
  /**
   * Label words, e.g. "photos size": the labels of all operands, left to
   * right, each word once; a label on an enclosing group replaces them.
   */
  label?: string;
}

/** Evaluates a parsed line. The result is always an amount (timeExp 0) or a rate (timeExp -1). */
export function evaluate(node: Node): Quantity {
  const q = evalNode(node);
  if (!Number.isFinite(q.value)) {
    throw new EngineError("number is too large");
  }
  if (q.timeExp === 1) {
    throw new EngineError("result is a duration; divide something by it to get a rate");
  }
  if (q.timeExp !== 0 && q.timeExp !== -1) {
    throw new EngineError(`result has time^${q.timeExp} units`);
  }
  return q;
}

function evalNode(node: Node): Quantity {
  switch (node.type) {
    case "quantity": {
      const q: Quantity = { value: node.value, dim: "count", timeExp: 0 };
      if (node.unit) {
        q.value *= node.unit.factor;
        if (node.unit.kind === "size") q.dim = "bytes";
        if (node.unit.kind === "rate") {
          q.dim = "bytes";
          q.timeExp = -1;
        }
        if (node.unit.kind === "time") q.timeExp = 1;
      }
      return withLabel(q, node.labels);
    }

    case "group":
      return withLabel(evalNode(node.expr), node.labels);

    case "neg": {
      const q = evalNode(node.operand);
      return { ...q, value: -q.value };
    }

    case "power": {
      const base = evalNode(node.base);
      const exp = evalNode(node.exponent);
      if (exp.dim !== "count" || exp.timeExp !== 0) {
        throw new EngineError("the exponent must be a plain number", node.pos);
      }
      if (exp.value === 1) return base;
      if (base.dim !== "count" || base.timeExp !== 0) {
        throw new EngineError(`can't raise ${kind(base)} to a power`, node.pos);
      }
      const value = Math.pow(base.value, exp.value);
      if (Number.isNaN(value)) {
        throw new EngineError("can't raise a negative number to a fractional power", node.pos);
      }
      return { value, dim: "count", timeExp: 0, label: base.label };
    }

    case "binary": {
      const a = evalNode(node.left);
      const b = evalNode(node.right);
      const label = combineLabels(a.label, b.label);
      switch (node.op) {
        case "+":
        case "-": {
          if (a.dim !== b.dim || a.timeExp !== b.timeExp) {
            throw new EngineError(`can't ${node.op === "+" ? "add" : "subtract"} ${kind(b)} ${node.op === "+" ? "to" : "from"} ${kind(a)}`, node.pos);
          }
          const value = node.op === "+" ? a.value + b.value : a.value - b.value;
          return { value, dim: a.dim, timeExp: a.timeExp, label };
        }
        case "*": {
          if (a.dim === "bytes" && b.dim === "bytes") {
            throw new EngineError("can't multiply a size by a size", node.pos);
          }
          const dim = a.dim === "bytes" || b.dim === "bytes" ? "bytes" : "count";
          return { value: a.value * b.value, dim, timeExp: a.timeExp + b.timeExp, label };
        }
        case "/": {
          if (b.dim === "bytes" && a.dim !== "bytes") {
            throw new EngineError("can't divide a count by a size", node.pos);
          }
          if (b.value === 0) {
            throw new EngineError("division by zero", node.pos);
          }
          // size / size is a plain ratio
          const dim = a.dim === "bytes" && b.dim !== "bytes" ? "bytes" : "count";
          return { value: a.value / b.value, dim, timeExp: a.timeExp - b.timeExp, label };
        }
      }
    }
  }
}

/** Labels written on a quantity or group take priority over labels inside it. */
function withLabel(q: Quantity, labels: string[]): Quantity {
  return labels.length ? { ...q, label: labels.join(" ") } : q;
}

/** Joins two labels left to right, keeping each word once: "photos" + "size" → "photos size". */
function combineLabels(a: string | undefined, b: string | undefined): string | undefined {
  const words = [...new Set([a, b].filter(Boolean).join(" ").split(" ").filter(Boolean))];
  return words.length ? words.join(" ") : undefined;
}

/** Human description of a quantity's kind for error messages. */
function kind(q: Quantity): string {
  const what = q.dim === "bytes" ? "a size" : "a count";
  if (q.timeExp === 0) return what;
  if (q.timeExp === -1) return `${what} per time`;
  if (q.timeExp === 1 && q.dim === "count") return "a duration";
  return `${what} × time^${q.timeExp}`;
}
