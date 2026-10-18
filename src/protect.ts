export type MaskToken = { placeholder: string; original: string };

const PLACEHOLDER = (i: number) => `⟦N${i}⟧`;
/** ASCII + Devanagari + Tamil digits, so native-script numerals are protected too. */
const ND = "\\d\u0966-\u096f\u0be6-\u0bef";
const NUMBER_IN_TEXT = new RegExp(
  `[${ND}](?:[${ND},_]*(?:\\.[${ND}])?)`,
  "g",
);

/** Replace every numeral with a placeholder so the translator cannot alter it. */
export function maskNumbers(text: string): { masked: string; tokens: MaskToken[] } {
  const tokens: MaskToken[] = [];
  let i = 0;
  const masked = text.replace(NUMBER_IN_TEXT, (original) => {
    const placeholder = PLACEHOLDER(i++);
    tokens.push({ placeholder, original });
    return placeholder;
  });
  return { masked, tokens };
}

export function tokenValue(t: MaskToken): string {
  return t.original;
}

/** Put originals back EXACTLY as they were. Throws if one was lost or rewritten. */
export function restoreNumbers(translated: string, tokens: MaskToken[]): string {
  let out = translated;
  for (const t of tokens) {
    if (!out.includes(t.placeholder)) {
      throw new Error(`${t.placeholder} missing in translation (expected ${t.original})`);
    }
    out = out.split(t.placeholder).join(t.original);
  }
  const leftover = out.match(/⟦N\d+⟧/);
  if (leftover) throw new Error(`unexpected placeholder ${leftover[0]} in translation`);
  return out;
}

/**
 * Non-throwing variant for the pipeline: restores every placeholder that
 * survived and reports the ones that did not, so the reviewer can read the
 * broken text instead of a wall of ⟦N#⟧.
 */
export function restoreNumbersPartial(
  translated: string,
  tokens: MaskToken[],
): { text: string; missing: MaskToken[]; leftover?: string } {
  let out = translated;
  const missing: MaskToken[] = [];
  for (const t of tokens) {
    if (!out.includes(t.placeholder)) {
      missing.push(t);
      continue;
    }
    out = out.split(t.placeholder).join(t.original);
  }
  const leftover = out.match(/⟦N\d+⟧/)?.[0];
  return { text: out, missing, leftover };
}
