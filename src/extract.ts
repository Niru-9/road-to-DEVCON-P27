import type { Invariant, Market } from "./types.js";
import { FIELD_KEYS } from "./types.js";
import { normalizeNumber } from "./normalize.js";

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

export const DEADLINE_RELATIONS = [
  "before", "after", "by", "until", "from", "on",
] as const;
export type Relation = (typeof DEADLINE_RELATIONS)[number];

const NUMBER_RE = /\d+(?:[,_]\d+)*(?:\.\d+)?/g;

// "15 June 2026" | "June 15, 2026" | "15/06/2026" | "2026-06-15"
const DATE_PATTERNS: RegExp[] = [
  /\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+\d{4})?\b/gi,
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2},?(?:\s+\d{4})?\b/gi,
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
  /\b\d{4}-\d{1,2}-\d{1,2}\b/g,
];

/** relation word immediately followed by a date-ish phrase: "before 15 June", "by 30 June 2026" */
const RELATION_RE = /\b(before|after|by|until|from|on)\s+(?=[\d\p{L}])/giu;

const pad = (n: number) => String(n).padStart(2, "0");

function monthNumber(name: string): number | undefined {
  const low = name.toLowerCase();
  return MONTHS[low] ?? MONTHS[low.slice(0, 3)];
}

/** Normalize any recognized date expression to "MM-DD-YYYY" (year optional). */
export function dateValue(raw: string): string | undefined {
  let m = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\.?(?:\s+(\d{4}))?$/);
  if (m && monthNumber(m[2]) !== undefined) {
    const month = pad(monthNumber(m[2])!);
    return m[3] ? `${month}-${pad(+m[1])}-${m[3]}` : `${month}-${pad(+m[1])}`;
  }
  m = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),?(?:\s+(\d{4}))?$/);
  if (m && monthNumber(m[1]) !== undefined) {
    const month = pad(monthNumber(m[1])!);
    return m[3] ? `${month}-${pad(+m[2])}-${m[3]}` : `${month}-${pad(+m[2])}`;
  }
  m = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${pad(+m[2])}-${pad(+m[1])}-${year}`; // dd/mm/yyyy
  }
  m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${pad(+m[2])}-${pad(+m[3])}-${m[1]}`;
  return undefined;
}

const isDateLike = (raw: string) => dateValue(raw) !== undefined;

/**
 * Deterministic (regex-only) extraction of every checkable fact from the
 * English source: numerals, date expressions, and deadline relations bound
 * to a date. No model is ever consulted — this is test case 3.
 */
export function extractInvariants(market: Market): Invariant[] {
  const out: Invariant[] = [];
  let seq = 0;
  const push = (inv: Omit<Invariant, "id">) => {
    const existing = out.find((e) => e.raw === inv.raw && e.kind === inv.kind);
    if (existing) {
      for (const f of inv.fields) if (!existing.fields.includes(f)) existing.fields.push(f);
      return;
    }
    out.push({ id: `INV${seq++}`, ...inv });
  };

  for (const field of FIELD_KEYS) {
    const text = String(market[field] ?? "");
    if (!text) continue;

    // 1. whole date expressions
    for (const re of DATE_PATTERNS) {
      for (const m of text.matchAll(re)) {
        const raw = m[0].trim();
        const value = dateValue(raw);
        if (!value) continue;
        push({ kind: "date", raw, value, fields: [field] });
      }
    }

    // 2. deadline relations bound to a date: "before 15 June 2026"
    for (const m of text.matchAll(RELATION_RE)) {
      const start = m.index!;
      const tail = text.slice(start + m[0].length);
      const dayFirst = tail.match(/^\s*\d{1,2}\s+[A-Za-z]+(?:\s+\d{4})?/);
      const monthFirst = tail.match(/^\s*[A-Za-z]+\s+\d{1,2}(?:,\s*\d{4})?/);
      const span = dayFirst ?? monthFirst;
      if (!span) continue;
      const whole = text.slice(start, start + m[0].length + span[0].length).trim();
      const datePart = whole.slice(m[1].length).trim();
      const value = dateValue(datePart.replace(/,\s*(\d{4})$/, " $1")) ?? datePart;
      push({
        kind: "deadline",
        raw: whole,
        value,
        relation: m[1].toLowerCase(),
        fields: [field],
      });
    }

    // 3. every remaining numeral
    for (const m of text.matchAll(NUMBER_RE)) {
      const raw = m[0];
      if (isDateLike(raw)) continue;
      push({ kind: "number", raw, value: normalizeNumber(raw), fields: [field] });
    }
  }
  return out;
}
