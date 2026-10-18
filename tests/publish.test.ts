import { describe, expect, it } from "vitest";
import { buildMarket } from "../src/pipeline.js";
import { approveVersion, fixField, rejectBlocked } from "../src/review.js";
import { publish, PublishBlockedError } from "../src/publish.js";
import { mockTranslator } from "../src/translate/mock.js";
import type { BuiltMarket, Market } from "../src/types.js";

const market: Market = {
  id: "m1",
  question: "Will the prize pool reach 1,00,000 tokens before 15 June 2026?",
  resolutionRules: "Resolves YES if the final pool is at least 1,00,000 tokens on 15 June 2026.",
  closeDate: "15 June 2026, 11:59 PM IST",
  resolutionSource: "https://example.com/leaderboard",
};

describe("publish gate", () => {
  it("TEST 7: refuses a version whose invariant check failed", async () => {
    const built = rejectBlocked(await buildMarket(market, mockTranslator({ corrupt: true })));
    expect(built.versions.every((v) => v.status === "blocked")).toBe(true);
    expect(() => publish(built)).toThrow(PublishBlockedError);
    expect(() => publish(built)).toThrow(/blocked/i);
  });

  it("refuses to approve a blocked version directly", async () => {
    const built = rejectBlocked(await buildMarket(market, mockTranslator({ corrupt: true })));
    expect(() => approveVersion(built, "hi")).toThrow(/cannot approve hi/);
  });

  it("publishes only after a human fixes the text and approves each language", async () => {
    let built = rejectBlocked(await buildMarket(market, mockTranslator({ corrupt: true })));

    // the corrupt translator swapped the by-wording in for the before-wording
    const BY_WORD: Record<string, [string, string]> = {
      hi: ["तक", "से पहले"],
      ta: ["வரை", "க்கு முன்"],
      mr: ["पर्यंत", "आधी"],
    };

    // human reads the review lane and repairs every field, then approves
    for (const lang of ["hi", "ta", "mr"] as const) {
      const [by, before] = BY_WORD[lang];
      const v = built.versions.find((x) => x.lang === lang)!;
      for (const field of ["question", "resolutionRules"] as const) {
        const fixed = v.values[field]
          .replaceAll("10,00,000", "1,00,000")
          .replaceAll(by, before);
        built = fixField(built, lang, field, fixed);
      }
      built = approveVersion(built, lang);
    }
    expect(built.versions.every((v) => v.status === "approved")).toBe(true);

    const published = publish(built);
    expect(published.versions.every((v) => v.status === "published")).toBe(true);
  });

  it("publishes a clean build only after explicit approval", async () => {
    const built: BuiltMarket = rejectBlocked(
      await buildMarket(market, mockTranslator()),
    );
    // nothing approved yet -> still refused
    expect(() => publish(built)).toThrow(/draft/);
    const approved = built.versions.reduce(
      (acc, v) => approveVersion(acc, v.lang),
      built,
    );
    expect(publish(approved).versions.every((v) => v.status === "published")).toBe(true);
  });
});
