// Calculation engine public API. Pure TypeScript: no DOM or Tauri imports.

import { EngineError } from "./errors";
import { evaluate } from "./evaluate";
import { formatQuantity } from "./format";
import { lex } from "./lexer";
import { parse } from "./parser";

export type LineResult =
  | { kind: "empty" }
  | { kind: "comment" }
  | { kind: "value"; columns: string[] }
  | { kind: "error"; error: string; pos?: number };

/** Evaluates one line of input into display columns, or an error message. */
export function evaluateLine(line: string): LineResult {
  try {
    const { tokens, comment } = lex(line);
    if (tokens.length === 0) {
      return comment === undefined ? { kind: "empty" } : { kind: "comment" };
    }
    const quantity = evaluate(parse(tokens, line.length));
    return { kind: "value", columns: formatQuantity(quantity) };
  } catch (e) {
    if (e instanceof EngineError) {
      return e.pos === undefined ? { kind: "error", error: e.message } : { kind: "error", error: e.message, pos: e.pos };
    }
    throw e;
  }
}
