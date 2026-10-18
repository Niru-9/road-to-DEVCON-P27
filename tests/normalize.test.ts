import { describe, expect, it } from "vitest";
import {
  digitsToAscii,
  extractNumbers,
  normalizeNumber,
  stripGrouping,
} from "../src/normalize.js";

describe("digitsToAscii", () => {
  it("folds Devanagari digits", () => {
    expect(digitsToAscii("१५ जून २०२६")).toBe("15 जून 2026");
  });
  it("folds Tamil digits", () => {
    expect(digitsToAscii("௧௫ ஜூன் ௨௦௨௬")).toBe("15 ஜூன் 2026");
  });
  it("leaves ASCII alone", () => expect(digitsToAscii("15 June")).toBe("15 June"));
});

describe("stripGrouping", () => {
  it("strips Indian grouping", () => expect(stripGrouping("1,00,000")).toBe("100000"));
  it("strips Western grouping", () => expect(stripGrouping("1,000,000")).toBe("1000000"));
  it("keeps decimals", () => expect(stripGrouping("12,345.67")).toBe("12345.67"));
  it("keeps spaces that are not digit grouping", () => {
    expect(stripGrouping("close 15 June")).toBe("close 15 June");
  });
});

describe("normalizeNumber", () => {
  it("equates Indian and Western grouping of the same value", () => {
    expect(normalizeNumber("1,00,000")).toBe(normalizeNumber("100,000"));
  });
  it("equates native-script and ASCII digits", () => {
    expect(normalizeNumber("१०००००")).toBe("100000");
  });
});

describe("extractNumbers", () => {
  it("returns normalized values found in text", () => {
    expect(extractNumbers("₹1,00,000 और २०२६ और 42.5%")).toEqual(["100000", "2026", "42.5"]);
  });
  it("finds nothing in clean text", () => expect(extractNumbers("no digits here")).toEqual([]));
  it("treats lakh and crore groupings of the same value as equal", () => {
    expect(extractNumbers("1,00,000")[0]).toBe(extractNumbers("100,000")[0]);
  });
});
