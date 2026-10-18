import type { BuiltMarket } from "./types.js";

const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );

/**
 * Static HTML the reviewer opens in a browser: English source side by side
 * with each language version, every failed check highlighted in red.
 */
export function renderReviewPage(built: BuiltMarket): string {
  const rows = (["question", "resolutionRules", "closeDate", "resolutionSource"] as const)
    .map((field) => {
      const en = built.source[field];
      const cells = built.versions
        .map((v) => {
          const failed = v.checks.filter((c) => c.field === field && !c.ok);
          const bad = failed.length > 0;
          const why = failed.map((f) => `<li>${esc(f.rule)}: ${esc(f.detail)}</li>`).join("");
          return `<td class="${bad ? "bad" : "ok"}">${esc(v.values[field] ?? "")}${
            bad ? `<ul class="why">${why}</ul>` : ""
          }<div class="tag">${v.lang} · ${v.status}</div></td>`;
        })
        .join("");
      return `<tr><th>${esc(field)}</th><td class="en">${esc(String(en))}</td>${cells}</tr>`;
    })
    .join("\n");

  const blocked = built.versions.filter((v) => v.status === "blocked").length;
  const drafts = built.versions.filter((v) => v.status === "draft").length;
  const banner = blocked
    ? `⛔ ${blocked} language version(s) blocked — fix the red fields, then approve`
    : drafts
      ? `⏳ ${drafts} language version(s) awaiting human approval`
      : "✅ all versions approved — ready to publish";
  const tone = blocked ? "#7f1d1d" : drafts ? "#78350f" : "#14532d";

  return `<!doctype html><html><head><meta charset="utf-8"><title>Review ${esc(built.source.id)}</title>
<style>
body{font:15px/1.5 system-ui,sans-serif;margin:2rem;background:#0f1115;color:#e7e7e7}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #2a2e36;padding:.6rem;vertical-align:top}
th{background:#171a21;text-align:left}
.en{background:#11141b}
.bad{background:#3a1414;border-color:#7f1d1d}
.ok{background:#0f1e14}
.why{margin:.4rem 0 0;padding-left:1.1rem;font-size:.8rem;color:#fca5a5}
.tag{opacity:.6;font-size:.75rem;margin-top:.4rem}
h1{font-size:1.2rem}
.banner{padding:.8rem;border-radius:6px;margin-bottom:1rem;background:${tone}}
code{background:#171a21;padding:.1rem .3rem;border-radius:4px}
</style></head><body>
<h1>Review lane — ${esc(built.source.id)}</h1>
<div class="banner">${banner}</div>
<table><tr><th>field</th><th>English (source)</th>${built.versions
    .map((v) => `<th>${v.lang}</th>`)
    .join("")}</tr>
${rows}</table>
<p>Fix with: <code>npm run cli -- review ${esc(built.source.id)} --fix hi:question="..."</code>
then <code>--approve hi</code>, then <code>npm run cli -- publish ${esc(built.source.id)}</code></p>
</body></html>`;
}
