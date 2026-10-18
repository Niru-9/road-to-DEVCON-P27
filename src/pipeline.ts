import { extractInvariants } from "./extract.js";
import { maskNumbers, restoreNumbersPartial } from "./protect.js";
import { verifyVersion } from "./verify.js";
import type { Translator } from "./translate/index.js";
import {
  FIELD_KEYS,
  LANGUAGES,
  type BuiltMarket,
  type FieldKey,
  type LanguageVersion,
  type Market,
  type Status,
} from "./types.js";

/**
 * One finished English market -> three verified language versions.
 * Every field (question, resolution rules, close date, resolution source)
 * goes through: mask -> translate -> restore -> verify. Any failed check
 * blocks that language version.
 */
export async function buildMarket(
  source: Market,
  translator: Translator,
): Promise<BuiltMarket> {
  const invariants = extractInvariants(source);
  const versions: LanguageVersion[] = [];

  for (const lang of LANGUAGES) {
    const values: Record<FieldKey, string> = {
      question: "",
      resolutionRules: "",
      closeDate: "",
      resolutionSource: "",
    };
    const failures: Array<{ field: FieldKey; detail: string }> = [];

    for (const field of FIELD_KEYS) {
      const original = source[field];
      const { masked, tokens } = maskNumbers(original);
      let translated: string;
      try {
        translated = await translator.translate(masked, "en", lang, {
          field,
          marketId: source.id,
        });
      } catch (err) {
        failures.push({
          field,
          detail: `${field}: translation failed — ${(err as Error).message}`,
        });
        values[field] = masked;
        continue;
      }
      try {
        const restored = restoreNumbersPartial(translated, tokens);
        values[field] = restored.text;
        for (const m of restored.missing) {
          failures.push({
            field,
            detail: `${field}: ${m.placeholder} missing in translation (expected ${m.original})`,
          });
        }
        if (restored.leftover) {
          failures.push({
            field,
            detail: `${field}: unexpected placeholder ${restored.leftover} in translation`,
          });
        }
      } catch (err) {
        failures.push({ field, detail: `${field}: ${(err as Error).message}` });
        values[field] = translated; // keep the broken text so the reviewer sees it
      }
    }

    const checks = verifyVersion({ lang, source, values, invariants });
    for (const f of failures) {
      checks.push({
        invariantId: "PROTECTION",
        field: f.field,
        ok: false,
        rule: "placeholder",
        expected: "all placeholders restored",
        detail: f.detail,
      });
    }
    const status: Status = checks.some((c) => !c.ok) ? "blocked" : "draft";
    versions.push({ lang, values, status, checks, translator: translator.name });
  }

  return { source, invariants, versions, builtAt: new Date().toISOString() };
}
