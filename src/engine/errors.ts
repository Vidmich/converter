/** An error in a line, with the character position it refers to (if any). */
export class EngineError extends Error {
  constructor(
    message: string,
    readonly pos?: number,
  ) {
    super(message);
    this.name = "EngineError";
  }
}
