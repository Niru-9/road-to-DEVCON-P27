import { describe, expect, it } from "vitest";
import { dateValue, extractInvariants } from "../src/extract.js";
import type { Market } from "../src/types.js";

const market: Market = {
  id: "m1",
  question: "Will Chennai get 1,00,000 mm of rain before 15 June 2026?",
  resolutionRules:
    "Resolves YES if the total is above 250 mm by 30 June 2026, or 40% by 1 July 2026.",
  closeDate: "15 June 2026, 11:59 PM IST",
  resolutionSource: "https://example.com/imd",
};

describe("extractInvariants", () => {
  it("extracts numerals by code, never by model", () => {
    const invs = extractInvariants(market);
    const numbers = invs.filter((i) => i.kind === "number").map((i) => i.value);
    expect(numbers).toEqual(
      expect.arrayContaining(["100000", "250", "40", "11", "59"]),
    );
  });

  it("extracts dates with normalized MM-DD-YYYY values", () => {
    const invs = extractInvariants(market);
    const dates = invs.filter((i) => i.kind === "date").map((i) => i.value);
    expect(dates).toEqual(expect.arrayContaining(["06-15-2026", "06-30-2026", "07-01-2026"]));
  });

  it("extracts deadline relations such as before/by", () => {
    const invs = extractInvariants(market);
    const deadlines = invs.filter((i) => i.kind === "deadline");
    expect(deadlines.map((d) => d.relation)).toEqual(expect.arrayContaining(["before", "by"]));
    expect(deadlines.find((d) => d.relation === "before")?.raw).toBe("before 15 June 2026");
  });

  it("records which field each invariant came from", () => {
    const invs = extractInvariants(market);
    const close = invs.find((i) => i.raw === "15 June 2026");
    expect(close?.fields).toContain("closeDate");
    expect(close?.fields).toContain("question");
  });

  it("handles slashed and ISO date forms", () => {
    expect(dateValue("15/06/2026")).toBe("06-15-2026");
    expect(dateValue("2026-06-15")).toBe("06-15-2026");
    expect(dateValue("June 15, 2026")).toBe("06-15-2026");
    expect(dateValue("15 June")).toBe("06-15");
    expect(dateValue("not a date")).toBeUndefined();
  });
});
