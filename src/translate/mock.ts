import type { Translator } from "./index.js";
import type { Lang } from "../types.js";

/**
 * Deterministic offline translator for tests and the demo. Faithful by
 * default; `corrupt` mode replays Karthik's two production incidents after
 * translating: a lakh becomes a crore, and "before" becomes the "by"
 * wording — so the demo can show the tool catching both.
 */
const GLOSSARY: Record<Lang, Record<string, string>> = {
  hi: {
    Will: "क्या",
    before: "से पहले",
    by: "तक",
    on: "को",
    tokens: "टोकन",
    "prize pool": "पुरस्कार पूल",
    reach: "पहुँचेगा",
    June: "जून",
  },
  ta: {
    before: "க்கு முன்",
    by: "வரை",
    on: "அன்று",
    tokens: "டோக்கன்",
    "prize pool": "பரிசு பூல்",
    reach: "எட்டும்",
    June: "ஜூன்",
  },
  mr: {
    before: "आधी",
    by: "पर्यंत",
    on: "रोजी",
    tokens: "टोकन",
    "prize pool": "बक्षीस पूल",
    reach: "पोहोचेल",
    June: "जून",
  },
};

/** "before" wording → "by" wording, per language — the before/by incident. */
const SWAP_BEFORE_TO_BY: Record<Lang, [string, string]> = {
  hi: ["से पहले", "तक"],
  ta: ["க்கு முன்", "வரை"],
  mr: ["आधी", "पर्यंत"],
};

export type MockOptions = { corrupt?: boolean };

export function mockTranslator(opts: MockOptions = {}): Translator {
  return {
    name: opts.corrupt ? "mock-corrupt" : "mock",
    async translate(text, _from, to, ctx) {
      // 1. translate words, placeholders untouched
      let out = text;
      for (const [en, native] of Object.entries(GLOSSARY[to])) {
        if (native) out = out.replace(new RegExp(`\\b${en}\\b`, "g"), native);
      }
      if (
        opts.corrupt &&
        (ctx?.field === "question" || ctx?.field === "resolutionRules")
      ) {
        // incident 1: a lakh became a crore — first masked number is rewritten
        out = out.replace(/\{\{(\d+)\}\}/, (ph, i) => (i === "0" ? "10,00,000" : ph));
        // incident 2: "before" rendered as the "by" wording
        const [before, by] = SWAP_BEFORE_TO_BY[to];
        out = out.replace(new RegExp(before, "g"), by);
      }
      return out;
    },
  };
}
