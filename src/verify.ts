import { digitsToAscii, extractNumbers } from "./normalize.js";
import { checkRelation, type Relation } from "./relations.js";
import { FIELD_KEYS } from "./types.js";
import type { CheckResult, FieldKey, Invariant, Lang, Market } from "./types.js";

const MONTH_VARIANTS: Record<number, string[]> = {
  1: ["january", "जनवरी", "ஜனவரி"],
  2: ["february", "फ़रवरी", "फरवरी", "பிப்ரவரி"],
  3: ["march", "मार्च", "மார்ச்"],
  4: ["april", "अप्रैल", "ஏப்ரல்"],
  5: ["may", "मई", "மே"],
  6: ["june", "जून", "ஜூன்"],
  7: ["july", "जुलाई", "जूலை"],
  8: ["august", "अगस्त", "ஆகஸ்ட்"],
  9: ["september", "सितंबर", "सितम्बर", "செப்டம்பர்"],
  10: ["october", "अक्टूबर", "அக்டோபர்"],
  11: ["november", "नवंबर", "नोवेम्बर", "நவம்பர்"],
  12: ["december", "दिसंबर", "डिसेंबर", "டிசம்பர்"],
};

/** Invariant value is "MM-DD-YYYY" or "MM-DD" — pull the month out. */
function monthOf(dateValue: string): number | undefined {
  const m = dateValue.match(/^(\d{2})-(\d{2})/);
  return m ? Number(m[1]) : undefined;
}

function dayOf(dateValue: string): string | undefined {
  const m = dateValue.match(/^\d{2}-(\d{2})/);
  return m ? String(Number(m[1])) : undefined;
}

function hasMonth(text: string, month: number): boolean {
  const folded = digitsToAscii(text).toLowerCase();
  if ((MONTH_VARIANTS[month] ?? []).some((v) => folded.includes(v))) return true;
  // numeric date forms: ISO "2025-06-01" or slashed "01/06/2025" — month by number
  const iso = folded.match(/\b\d{4}-(\d{1,2})-(\d{1,2})\b/);
  if (iso && Number(iso[1]) === month) return true;
  for (const m of folded.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-]\d{2,4}\b/g)) {
    if (Number(m[1]) === month || Number(m[2]) === month) return true;
  }
  return false;
}

/** Day equality is numeric: "01" and "1" are the same day. */
const hasDay = (foundNumbers: string[], day: string) =>
  foundNumbers.some((n) => Number(n) === Number(day));

export type VerifyArgs = {
  lang: Lang;
  source: Market;
  values: Record<FieldKey, string>;
  invariants: Invariant[];
};

/**
 * Deterministic check of one translated language version against the English
 * source. Every invariant is checked in every field it appears in — no model
 * is consulted anywhere in this module (test case 4).
 */
export function verifyVersion(args: VerifyArgs): CheckResult[] {
  const { source, values, invariants, lang } = args;
  const results: CheckResult[] = [];

  const sourceNumbers = new Set(
    FIELD_KEYS.flatMap((f) => extractNumbers(String(source[f]))),
  );

  for (const inv of invariants) {
    for (const field of inv.fields) {
      const text = values[field] ?? "";
      const foundNumbers = extractNumbers(text);

      if (inv.kind === "number") {
        const present = foundNumbers.includes(inv.value);
        results.push({
          invariantId: inv.id,
          field,
          rule: "number-present",
          ok: present,
          expected: inv.value,
          detail: present
            ? `found ${inv.value}`
            : `source number ${inv.raw} (${inv.value}) missing from ${field}`,
        });
      }

      if (inv.kind === "date" || inv.kind === "deadline") {
        const month = monthOf(inv.value);
        const day = dayOf(inv.value);
        const dayOk = day === undefined || hasDay(foundNumbers, day);
        const monthOk = month === undefined || hasMonth(text, month);
        const ok = dayOk && monthOk;
        results.push({
          invariantId: inv.id,
          field,
          rule: "date",
          ok,
          expected: inv.raw,
          detail: ok
            ? `date ${inv.raw} preserved in ${field}`
            : `date ${inv.raw} not preserved in ${field} (day ok: ${dayOk}, month ok: ${monthOk})`,
        });

        if (inv.kind === "deadline" && inv.relation) {
          const rc = checkRelation(inv.relation as Relation, lang, text);
          results.push({
            invariantId: inv.id,
            field,
            rule: "relation",
            ok: rc.ok,
            expected: `${inv.relation} ${inv.raw}`,
            detail: `${rc.detail} (in ${field})`,
          });
        }
      }
    }
  }

  // Cross-field sweep: any number anywhere in the translation that the English
  // source never contained is a red flag (lakh -> crore adds digits).
  // Reported once per field where it occurs, not once per invariant.
  const translatedNumbers = new Set(
    Object.values(values).flatMap((v) => extractNumbers(v)),
  );
  const extras = [...translatedNumbers].filter((n) => !sourceNumbers.has(n));
  for (const extra of extras) {
    const fieldsWith = FIELD_KEYS.filter((f) => extractNumbers(values[f]).includes(extra));
    for (const field of fieldsWith) {
      results.push({
        invariantId: "GLOBAL",
        field,
        rule: "no-extra-number",
        ok: false,
        expected: extra,
        detail: `translation contains number ${extra} in ${field} that is absent from the English source (possible lakh/crore drift)`,
      });
    }
  }

  return results;
}
