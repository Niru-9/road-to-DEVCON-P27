import { digitsToAscii } from "./normalize.js";
import type { Lang } from "./types.js";

export type Relation = "before" | "after" | "by" | "until" | "from" | "on";

/**
 * Text that SATISFIES each relation in each language. An empty list means the
 * relation is *neutral* — it carries no deadline semantics (e.g. "on DATE"),
 * so there is no wording to enforce.
 */
const ACCEPT: Record<Relation, Record<Lang, string[]>> = {
  before: {
    hi: ["से पहले", "पहले", "से पूर्व"],
    ta: ["க்கு முன்", "முன்"],
    mr: ["आधी", "पूर्वी"],
  },
  after: {
    hi: ["के बाद", "बाद में"],
    ta: ["க்குப் பிறகு", "பிறகு"],
    mr: ["नंतर"],
  },
  by: {
    hi: ["तक"],
    ta: ["வரை", "க்குள்"],
    mr: ["पर्यंत"],
  },
  until: {
    hi: ["तक"],
    ta: ["வரை"],
    mr: ["पर्यंत"],
  },
  from: {
    hi: ["से"],
    ta: ["இருந்து"],
    mr: ["पासून"],
  },
  on: {
    hi: [],
    ta: [],
    mr: [],
  },
};

/**
 * Relations that must NOT appear when the source used `relation`.
 * `before` ⇄ `by` is the exact production incident from Karthik's network.
 */
const CONFLICT: Record<Relation, Relation[]> = {
  before: ["by", "until"],
  by: ["before", "after"],
  after: ["by"],
  until: ["before"],
  from: [],
  on: [],
};

export type RelationCheck = { ok: boolean; detail: string };

/**
 * Concatenated text near each anchor. A conflicting word only counts when it
 * sits next to the date: Hindi "1,00,000 टोकन तक पहुँचेगा" ("will reach *up to*
 * 1,00,000") uses `तक` harmlessly, while "15 जून 2026 तक" is the real drift.
 * Without anchors the whole text is scanned.
 */
function vicinity(text: string, anchors: string[], radius = 22): string {
  const folded = digitsToAscii(text);
  if (anchors.length === 0) return folded;
  const windows: string[] = [];
  for (const anchor of anchors) {
    if (!anchor) continue;
    let at = folded.indexOf(anchor);
    while (at !== -1) {
      windows.push(folded.slice(Math.max(0, at - radius), at + anchor.length + radius));
      at = folded.indexOf(anchor, at + 1);
    }
  }
  return windows.length > 0 ? windows.join("\n") : folded;
}

export function checkRelation(
  relation: Relation,
  lang: Lang,
  translatedText: string,
  anchors: string[] = [],
): RelationCheck {
  const accepted = ACCEPT[relation][lang];
  if (accepted.length === 0) {
    return { ok: true, detail: `relation "${relation}" is neutral — no wording required` };
  }

  const folded = digitsToAscii(translatedText);
  // Accepted wording is looked for anywhere (scrambled word order is fine);
  // conflicting wording only counts when it sits next to the date.
  const hasAccept = accepted.some((t) => folded.includes(t));
  const nearDate = vicinity(translatedText, anchors);
  const conflicts = [
    ...new Set(
      CONFLICT[relation].flatMap((c) => ACCEPT[c][lang]).filter((t) => nearDate.includes(t)),
    ),
  ];
  // A conflict is only fatal when it is unambiguous — i.e. not a substring
  // of accepted wording (e.g. "पहले तक" contains both, but "से पहले" wins).
  const realConflicts = conflicts.filter((c) => !accepted.some((a) => a.includes(c)));

  if (!hasAccept && realConflicts.length > 0) {
    return {
      ok: false,
      detail: `relation "${relation}" rendered as conflicting "${realConflicts.join(",")}"`,
    };
  }
  if (!hasAccept) {
    return {
      ok: false,
      detail: `expected wording for "${relation}" not found (${accepted.join("|")})`,
    };
  }
  if (realConflicts.length > 0) {
    return {
      ok: false,
      detail: `conflicting relation wording present: ${realConflicts.join(",")}`,
    };
  }
  return { ok: true, detail: `relation "${relation}" preserved` };
}
