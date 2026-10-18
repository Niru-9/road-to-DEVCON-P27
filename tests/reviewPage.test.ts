import { describe, expect, it } from "vitest";
import { renderReviewPage } from "../src/reviewPage.js";
import type { BuiltMarket, CheckResult, Lang, Status } from "../src/types.js";

const source = {
  id: "m1",
  question: "Will the pool reach 1,00,000 before 15 June 2026?",
  resolutionRules: "Resolves YES if the pool is at least 1,00,000 on 15 June 2026.",
  closeDate: "15 June 2026, 11:59 PM IST",
  resolutionSource: "https://example.com/leaderboard",
};

const failing: CheckResult = {
  invariantId: "INV0",
  field: "question",
  ok: false,
  rule: "relation",
  expected: "before 15 June 2026",
  detail: 'relation "before" rendered as conflicting "तक" (in question)',
};

const version = (lang: Lang, status: Status, checks: CheckResult[] = []) => ({
  lang,
  status,
  checks,
  translator: "mock",
  values: { question: "Q", resolutionRules: "R", closeDate: "C", resolutionSource: "S" },
});

const page = (versions: ReturnType<typeof version>[]) =>
  renderReviewPage({
    source,
    invariants: [],
    builtAt: new Date().toISOString(),
    versions,
  } as unknown as BuiltMarket);

describe("renderReviewPage banner", () => {
  it("counts only genuinely blocked versions as blocked", () => {
    const html = page([version("hi", "blocked", [failing]), version("ta", "draft"), version("mr", "draft")]);
    expect(html).toContain("1 language version(s) blocked");
    expect(html).not.toContain("awaiting human approval");
  });

  it("says versions are awaiting approval when nothing is blocked", () => {
    const html = page([version("hi", "draft"), version("ta", "draft"), version("mr", "draft")]);
    expect(html).toContain("3 language version(s) awaiting human approval");
    expect(html).not.toContain("blocked");
  });

  it("says ready when every version is approved or published", () => {
    const html = page([version("hi", "published"), version("ta", "approved"), version("mr", "published")]);
    expect(html).toContain("all versions approved — ready to publish");
  });
});
