import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "../../src/engine";

// Placeholder: proves the test runner can import the engine. Replaced by real tests in M2.
describe("engine", () => {
  it("is importable", () => {
    expect(ENGINE_VERSION).toBe("0.1.0");
  });
});
