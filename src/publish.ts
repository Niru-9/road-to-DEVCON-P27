import type { BuiltMarket } from "./types.js";

export class PublishBlockedError extends Error {
  constructor(public readonly report: string[]) {
    super(`publish blocked:\n${report.join("\n")}`);
    this.name = "PublishBlockedError";
  }
}

/**
 * Publishing requires, for the language version(s) selected:
 *   1. status === "approved" (set only by approveVersion after a green re-check)
 *   2. every invariant check green
 * Anything else throws PublishBlockedError — a failed invariant check
 * blocks publishing, full stop.
 *
 * With `lang`, only that language is gated and published; the others are
 * untouched (so languages can be approved and shipped independently).
 */
export function publish(built: BuiltMarket, lang?: string): BuiltMarket {
  const report: string[] = [];
  for (const v of built.versions) {
    if (lang !== undefined && v.lang !== lang) continue;
    if (v.status === "published") continue; // already shipped — nothing to gate
    const failed = v.checks.filter((c) => !c.ok);
    if (failed.length > 0) {
      report.push(
        `${v.lang}: ${failed.length} failed check(s) — ` +
          failed.map((c) => `${c.rule}:${c.expected}`).join(", "),
      );
    }
    if (v.status !== "approved") {
      report.push(`${v.lang}: status is "${v.status}", must be "approved"`);
    }
  }
  if (report.length > 0) throw new PublishBlockedError(report);

  return {
    ...built,
    versions: built.versions.map((v) =>
      lang !== undefined && v.lang !== lang ? v : { ...v, status: "published" as const },
    ),
  };
}
