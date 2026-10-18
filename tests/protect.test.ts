import { describe, expect, it } from "vitest";
import { maskNumbers, restoreNumbers, tokenValue } from "../src/protect.js";

describe("maskNumbers", () => {
  it("replaces every numeral with a placeholder and keeps words translatable", () => {
    const { masked, tokens } = maskNumbers("Pay ₹1,00,000 before 15 June 2026");
    expect(masked).toBe("Pay ₹⟦N0⟧ before ⟦N1⟧ June ⟦N2⟧");
    expect(tokens.map(tokenValue)).toEqual(["1,00,000", "15", "2026"]);
  });

  it("restores placeholders verbatim, including native-script digits", () => {
    const { tokens } = maskNumbers("₹1,00,000 on १५ जून");
    const translated = "₹⟦N0⟧ पर ⟦N1⟧ जून";
    expect(restoreNumbers(translated, tokens)).toBe("₹1,00,000 पर १५ जून");
  });

  it("reports a missing placeholder as a protection failure", () => {
    const { tokens } = maskNumbers("2 winners get 3 prizes");
    expect(() => restoreNumbers("⟦N0⟧ winners get prizes", tokens)).toThrow(/⟦N1⟧ missing/);
  });

  it("rejects a placeholder the source never contained", () => {
    const { tokens } = maskNumbers("only one number 7 here");
    expect(() => restoreNumbers("⟦N0⟧ and extra ⟦N9⟧", tokens)).toThrow(/unexpected/);
  });
});
