import { verifyVersion } from "./verify.js";
import type { BuiltMarket, FieldKey, LanguageVersion, Status } from "./types.js";

/** Re-run every invariant check on every language; blocked when any fails.
 *
 * Placeholder-integrity checks come from the build (they depend on the masked
 * tokens, which are not available here) and are carried through unchanged —
 * `fixField` drops the ones for the field a human has rewritten.
 */
export function rejectBlocked(built: BuiltMarket): BuiltMarket {
  const versions = built.versions.map((v) => {
    const placeholderChecks = v.checks.filter((c) => c.rule === "placeholder");
    const checks = [
      ...verifyVersion({
        lang: v.lang,
        source: built.source,
        values: v.values,
        invariants: built.invariants,
      }),
      ...placeholderChecks,
    ];
    const ok = checks.every((c) => c.ok);
    const status: Status = ok ? v.status : "blocked";
    return { ...v, checks, status };
  });
  return { ...built, versions };
}

/**
 * Human review lane: a reviewer may only approve a version that passes every
 * check. A blocked version must be fixed (values edited) first.
 */
export function approveVersion(built: BuiltMarket, lang: string): BuiltMarket {
  const fresh = rejectBlocked(built);
  const versions = fresh.versions.map((v): LanguageVersion => {
    if (v.lang !== lang) return v;
    const failed = v.checks.filter((c) => !c.ok);
    if (failed.length > 0) {
      throw new Error(
        `cannot approve ${lang}: ${failed.length} failed check(s) — ` +
          failed.map((c) => `${c.rule}(${c.expected})`).join(", "),
      );
    }
    return { ...v, status: "approved" };
  });
  return { ...fresh, versions };
}

/** Apply a human fix to one field of one language, then re-verify that build. */
export function fixField(
  built: BuiltMarket,
  lang: string,
  field: FieldKey,
  text: string,
): BuiltMarket {
  const versions = built.versions.map((v) => {
    if (v.lang !== lang) return v;
    const values: Record<FieldKey, string> = { ...v.values, [field]: text };
    // the human has rewritten this field, so its build-time placeholder
    // state no longer applies — verify will re-check the new text
    const checks = v.checks.filter(
      (c) => !(c.rule === "placeholder" && c.field === field),
    );
    return { ...v, values, checks, status: "draft" as const };
  });
  return rejectBlocked({ ...built, versions });
}
