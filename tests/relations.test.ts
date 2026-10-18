import { describe, expect, it } from "vitest";
import { checkRelation } from "../src/relations.js";

describe("checkRelation", () => {
  it("accepts a correct Hindi rendering of 'before'", () => {
    expect(checkRelation("before", "hi", "15 जून 2026 से पहले").ok).toBe(true);
  });

  it("flags the real-world mistake: 'before' rendered as 'by' (तक)", () => {
    const r = checkRelation("before", "hi", "15 जून 2026 तक");
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/तक/);
  });

  it("flags 'by' rendered as 'before'", () => {
    expect(checkRelation("by", "hi", "15 जून 2026 से पहले").ok).toBe(false);
  });

  it("accepts Tamil and Marathi equivalents", () => {
    expect(checkRelation("before", "ta", "ஜூன் 15 க்கு முன்").ok).toBe(true);
    expect(checkRelation("before", "mr", "जून 15 रोजी आधी").ok).toBe(true);
    expect(checkRelation("by", "ta", "ஜூன் 15 வரை").ok).toBe(true);
    expect(checkRelation("by", "mr", "जून 15 पर्यंत").ok).toBe(true);
  });

  it("flags ambiguous wording that mixes before and by", () => {
    // "से पहले तक" contains both the before-word and the by-word — a human must look
    expect(checkRelation("before", "hi", "15 जून 2026 से पहले तक").ok).toBe(false);
  });
});
