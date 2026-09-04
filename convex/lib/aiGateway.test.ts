import { describe, expect, it } from "vitest";
import { DEFAULT_GATEWAY_MODEL, parseMatchScore } from "./aiGateway";

describe("Convex AI Gateway response validation", () => {
  it("uses a provider-qualified default model", () => {
    expect(DEFAULT_GATEWAY_MODEL).toBe("openai/gpt-5.2");
  });

  it("bounds the score and removes invalid reasons", () => {
    expect(
      parseMatchScore(
        JSON.stringify({ score: 1.7, reasons: ["white chest", 42, "  ", "dark muzzle"] }),
      ),
    ).toEqual({ score: 1, reasons: ["white chest", "dark muzzle"] });
  });

  it("rejects non-JSON provider output", () => {
    expect(() => parseMatchScore("not json")).toThrow();
  });
});
