import { describe, expect, it } from "vitest";
import { maskNumbers, restoreNumbers, tokenValue } from "../src/protect.js";

describe("maskNumbers", () => {
  it("replaces every numeral with a placeholder and keeps words translatable", () => {
    const { masked, tokens } = maskNumbers("Pay ₹1,00,000 before 15 June 2026");
    expect(masked).toBe("Pay ₹{{0}} before {{1}} June {{2}}");
    expect(tokens.map(tokenValue)).toEqual(["1,00,000", "15", "2026"]);
  });

  it("restores placeholders verbatim, including native-script digits", () => {
    const { tokens } = maskNumbers("₹1,00,000 on १५ जून");
    const translated = "₹{{0}} पर {{1}} जून";
    expect(restoreNumbers(translated, tokens)).toBe("₹1,00,000 पर १५ जून");
  });

  it("survives a translator that rewrites the index digits as native numerals", () => {
    const { tokens } = maskNumbers("Pay 1 and 2");
    // e.g. a translator turning the ASCII index into Devanagari digits
    expect(restoreNumbers("भुगतान {{०}} और {{१}}", tokens)).toBe("भुगतान 1 और 2");
  });

  it("reports a missing placeholder as a protection failure", () => {
    const { tokens } = maskNumbers("2 winners get 3 prizes");
    expect(() => restoreNumbers("{{0}} winners get prizes", tokens)).toThrow(/\{\{1\}\} missing/);
  });

  it("rejects a placeholder the source never contained", () => {
    const { tokens } = maskNumbers("only one number 7 here");
    expect(() => restoreNumbers("{{0}} and extra {{9}}", tokens)).toThrow(/unexpected/);
  });
});
