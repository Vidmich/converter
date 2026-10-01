// Turns one input line into tokens. Everything after "#" is a comment.

import { EngineError } from "./errors";

export type Op = "+" | "-" | "*" | "/";

export type Token =
  | { kind: "num"; value: number; pos: number; end: number }
  | { kind: "word"; text: string; pos: number; end: number; spaced: boolean }
  | { kind: "op"; op: Op; pos: number; end: number }
  | { kind: "lparen"; pos: number; end: number }
  | { kind: "rparen"; pos: number; end: number };

export interface LexResult {
  tokens: Token[];
  /** Comment text after "#", without the "#"; undefined when there is none. */
  comment?: string;
}

const SYMBOL_OPS: Record<string, Op> = {
  "+": "+",
  "-": "-",
  "−": "-",
  "*": "*",
  "×": "*",
  "·": "*",
  "/": "/",
  "÷": "/",
};

// Words that act as operators: "50B x 70KB", "100M per day".
const WORD_OPS: Record<string, Op> = {
  x: "*",
  per: "/",
};

const isDigit = (c: string) => c >= "0" && c <= "9";
const isWordStart = (c: string) => /\p{L}|_/u.test(c);
const isWordChar = (c: string) => /[\p{L}\p{N}_]/u.test(c);

export function lex(line: string): LexResult {
  const tokens: Token[] = [];
  let i = 0;
  let spaced = true; // whitespace (or line start) before the current token

  while (i < line.length) {
    const c = line[i];

    if (c === "#") {
      return { tokens, comment: line.slice(i + 1) };
    }
    if (/\s/.test(c)) {
      i++;
      spaced = true;
      continue;
    }

    const start = i;
    if (isDigit(c) || (c === "." && isDigit(line[i + 1] ?? ""))) {
      i = readNumber(line, i, tokens);
    } else if (isWordStart(c)) {
      while (i < line.length && isWordChar(line[i])) i++;
      const text = line.slice(start, i);
      const op = WORD_OPS[text.toLowerCase()];
      if (op) {
        tokens.push({ kind: "op", op, pos: start, end: i });
      } else {
        tokens.push({ kind: "word", text, pos: start, end: i, spaced });
      }
    } else if (SYMBOL_OPS[c]) {
      i++;
      tokens.push({ kind: "op", op: SYMBOL_OPS[c], pos: start, end: i });
    } else if (c === "(") {
      i++;
      tokens.push({ kind: "lparen", pos: start, end: i });
    } else if (c === ")") {
      i++;
      tokens.push({ kind: "rparen", pos: start, end: i });
    } else {
      throw new EngineError(`unexpected "${c}"`, start);
    }
    spaced = false;
  }

  return { tokens };
}

/** Thousands separators in the integer part; they may be mixed (1,000_000). */
const isGroupSeparator = (c: string | undefined) => c === "," || c === "_";

/**
 * Reads a number such as 42, 1,200, 1_200, 3.5, .5 or 1e6 and pushes a num token.
 * "," and "_" are thousands separators and must be followed by exactly 3 digits.
 */
function readNumber(line: string, start: number, tokens: Token[]): number {
  let i = start;
  let text = "";

  const readDigits = () => {
    while (i < line.length && isDigit(line[i])) text += line[i++];
  };

  readDigits();
  while (isGroupSeparator(line[i]) && isDigit(line[i + 1] ?? "")) {
    const group = line.slice(i + 1).match(/^\d+/)![0];
    if (group.length !== 3) {
      throw new EngineError(`bad thousands separator in "${line.slice(start, i + 1 + group.length)}"`, i);
    }
    i++;
    readDigits();
  }
  if (line[i] === "." && isDigit(line[i + 1] ?? "")) {
    text += line[i++];
    readDigits();
  }
  // Exponent: 1e6, 2.5E-3. Only when digits follow, so "5e" stays a number + word.
  const exp = line.slice(i).match(/^[eE][+-]?\d+/);
  if (exp) {
    text += exp[0];
    i += exp[0].length;
  }

  tokens.push({ kind: "num", value: Number(text), pos: start, end: i });
  return i;
}
