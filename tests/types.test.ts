import { describe, expect, it } from "vitest";
import { FIELD_KEYS, LANGUAGES, marketSchema } from "../src/types.js";

describe("marketSchema", () => {
  it("rejects a market with no resolutionRules", () => {
    const bad = {
      id: "m1",
      question: "Will X happen?",
      closeDate: "15 June 2026",
      resolutionSource: "https://example.com",
    };
    expect(marketSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts a complete market", () => {
    const good = {
      id: "m1",
      question: "Will X happen?",
      resolutionRules: "Resolves YES if Y.",
      closeDate: "15 June 2026",
      resolutionSource: "https://example.com",
    };
    expect(marketSchema.safeParse(good).success).toBe(true);
  });

  it("exports three target languages and four checkable fields", () => {
    expect([...LANGUAGES]).toEqual(["hi", "ta", "mr"]);
    expect([...FIELD_KEYS]).toEqual([
      "question",
      "resolutionRules",
      "closeDate",
      "resolutionSource",
    ]);
  });
});
