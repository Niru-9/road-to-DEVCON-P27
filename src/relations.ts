import type { Lang } from "./types.js";

export type Relation = "before" | "after" | "by" | "until" | "from" | "on";

/** Text that SATISFIES each relation in each language. */
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
    hi: ["को", "रोज़"],
    ta: ["அன்று"],
    mr: ["रोजी", "रोज"],
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

export function checkRelation(
  relation: Relation,
  lang: Lang,
  translatedText: string,
): RelationCheck {
  const accepted = ACCEPT[relation][lang];
  const hasAccept = accepted.some((t) => translatedText.includes(t));
  const conflicts = [...new Set(
    CONFLICT[relation].flatMap((c) => ACCEPT[c][lang]).filter((t) => translatedText.includes(t)),
  )];
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
