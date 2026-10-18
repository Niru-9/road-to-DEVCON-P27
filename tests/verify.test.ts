import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractInvariants } from "../src/extract.js";
import { verifyVersion } from "../src/verify.js";
import type { FieldKey, Lang, Market } from "../src/types.js";

const load = (f: string) => JSON.parse(readFileSync(`tests/fixtures/${f}`, "utf8"));
const run = (f: string) => {
  const fx = load(f);
  const source = fx.source as Market;
  return verifyVersion({
    lang: fx.lang as Lang,
    source,
    values: fx.translation as Record<FieldKey, string>,
    invariants: extractInvariants(source),
  });
};

describe("verifyVersion", () => {
  it("TEST 8: flags a translation whose number was changed", () => {
    const checks = run("corrupt-hi.json");
    const failed = checks.filter((c) => !c.ok);
    expect(failed.length).toBeGreaterThan(0);
    // the changed 1,00,000 -> 10,00,000: source value missing AND foreign value present
    expect(failed.some((c) => c.rule === "number-present" && c.expected === "100000")).toBe(true);
    expect(failed.some((c) => c.rule === "no-extra-number" && c.expected === "1000000")).toBe(true);
  });

  it("flags the real before -> by mistake", () => {
    const checks = run("before-by-hi.json");
    const relationFailures = checks.filter((c) => !c.ok && c.rule === "relation");
    expect(relationFailures.length).toBeGreaterThan(0);
    expect(relationFailures.some((c) => c.detail.includes("तक"))).toBe(true);
  });

  it("accepts native-script digits after normalization (test case 5)", () => {
    const checks = run("native-digits-hi.json");
    expect(checks.filter((c) => !c.ok)).toEqual([]);
  });

  it("checks every invariant for every field it appears in (test case 4)", () => {
    const fx = load("corrupt-hi.json");
    const source = fx.source as Market;
    const invariants = extractInvariants(source);
    const checks = verifyVersion({
      lang: "hi",
      source,
      values: fx.translation,
      invariants,
    });
    for (const inv of invariants) {
      for (const field of inv.fields) {
        expect(
          checks.some((c) => c.invariantId === inv.id && c.field === field),
          `no check for ${inv.id} (${inv.raw}) in ${field}`,
        ).toBe(true);
      }
    }
  });
});
