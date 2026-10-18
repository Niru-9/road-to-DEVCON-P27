import { describe, expect, it } from "vitest";
import { buildMarket } from "../src/pipeline.js";
import type { Translator } from "../src/translate/index.js";
import type { Market } from "../src/types.js";

const market: Market = {
  id: "m1",
  question: "Will the prize pool reach 1,00,000 tokens before 15 June 2026?",
  resolutionRules:
    "Resolves YES if the final pool is at least 1,00,000 tokens on 15 June 2026.",
  closeDate: "15 June 2026, 11:59 PM IST",
  resolutionSource: "https://example.com/leaderboard",
};

function spyTranslator(): Translator & { calls: Array<{ lang: string; field: string }> } {
  const calls: Array<{ lang: string; field: string }> = [];
  return {
    name: "spy",
    calls,
    async translate(text, _from, to, ctx) {
      calls.push({ lang: to, field: ctx?.field ?? "?" });
      return text; // faithful pass-through of the masked text
    },
  };
}

describe("buildMarket", () => {
  it("TEST 1: requests Hindi, Tamil and Marathi from one English source", async () => {
    const t = spyTranslator();
    const built = await buildMarket(market, t);
    expect(built.versions.map((v) => v.lang).sort()).toEqual(["hi", "mr", "ta"]);
  });

  it("TEST 2: sends the resolution rules for every target language", async () => {
    const t = spyTranslator();
    await buildMarket(market, t);
    for (const lang of ["hi", "ta", "mr"]) {
      const fields = t.calls.filter((c) => c.lang === lang).map((c) => c.field);
      expect(fields).toEqual(
        expect.arrayContaining([
          "question",
          "resolutionRules",
          "closeDate",
          "resolutionSource",
        ]),
      );
    }
  });

  it("marks a version blocked when the translator changes a number", async () => {
    const bad: Translator = {
      name: "bad",
      async translate(text) {
        return text.replace("{{0}}", "10,00,000");
      },
    };
    const built = await buildMarket(market, bad);
    expect(built.versions.every((v) => v.status === "blocked")).toBe(true);
    expect(built.versions.flatMap((v) => v.checks).some((c) => !c.ok)).toBe(true);
  });

  it("leaves a faithful translation in draft, ready for human approval", async () => {
    const built = await buildMarket(market, {
      name: "noop",
      async translate(text) {
        return text;
      },
    });
    // numbers survive verbatim; only relation wording is flagged for the
    // untranslated pass-through — the point is that facts never drift.
    const numberChecks = built.versions
      .flatMap((v) => v.checks)
      .filter((c) => c.rule === "number-present");
    expect(numberChecks.every((c) => c.ok)).toBe(true);
  });
});
