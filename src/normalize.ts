/** Fold Devanagari (U+0966..U+096F) and Tamil (U+0BE6..U+0BEF) digits to ASCII. */
const DIGIT_RANGES: Array<[number, number]> = [
  [0x0966, 0x096f], // Devanagari ०-९
  [0x0be6, 0x0bef], // Tamil ௦-௯
];

export function digitsToAscii(text: string): string {
  return [...text]
    .map((ch) => {
      const cp = ch.codePointAt(0) ?? -1;
      for (const [start, end] of DIGIT_RANGES) {
        if (cp >= start && cp <= end) return String.fromCharCode(cp - start + 48);
      }
      return ch;
    })
    .join("");
}

/** Remove grouping separators (`,` `_` and spaces) that sit between digits. */
export function stripGrouping(text: string): string {
  return text.replace(/(?<=\d)[, _](?=\d)/g, "");
}

/** Canonical comparable form of a numeric token: ASCII digits, no grouping. */
export function normalizeNumber(token: string): string {
  return stripGrouping(digitsToAscii(token)).trim();
}

const NUMBER_TOKEN = /\d+(?:[,_]\d+)*(?:\.\d+)?/g;

/** Every number in `text` as a normalized comparable value, in order. */
export function extractNumbers(text: string): string[] {
  const folded = digitsToAscii(text);
  const matches = folded.match(NUMBER_TOKEN) ?? [];
  return matches.map((m) => normalizeNumber(m));
}
