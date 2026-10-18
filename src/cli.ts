#!/usr/bin/env node
import { Command, CommanderError } from "commander";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildMarket } from "./pipeline.js";
import { approveVersion, fixField, rejectBlocked } from "./review.js";
import { PublishBlockedError, publish } from "./publish.js";
import { renderReviewPage } from "./reviewPage.js";
import { translatorFromEnv } from "./translate/index.js";
import { mockTranslator } from "./translate/mock.js";
import { marketSchema, type BuiltMarket, type FieldKey, type Market } from "./types.js";

/** Thrown by command handlers; runCli turns it into exit code 1. */
export class CliError extends Error {}

const loadMarket = (p: string): Market =>
  marketSchema.parse(JSON.parse(readFileSync(p, "utf8")));

const loadBuilt = (p: string): BuiltMarket =>
  JSON.parse(readFileSync(p, "utf8"));

const save = (path: string, built: BuiltMarket) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(built, null, 2));
};

const writePage = (jsonPath: string, built: BuiltMarket): string => {
  const pagePath = jsonPath.replace(/\.json$/, ".review.html");
  mkdirSync(dirname(pagePath), { recursive: true });
  writeFileSync(pagePath, renderReviewPage(built));
  return pagePath;
};

const reportVersions = (built: BuiltMarket) => {
  for (const v of built.versions) {
    const failed = v.checks.filter((c) => !c.ok);
    console.log(
      `\n== ${v.lang} [${v.status}] ==` + (failed.length === 0 ? " all checks green" : ""),
    );
    for (const c of failed) {
      console.log(`  ✗ ${c.rule} ${c.expected} — ${c.detail}`);
    }
  }
};

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("bhasha")
    .description("English market in -> verified Hindi/Tamil/Marathi out")
    .exitOverride();

  program
    .command("build")
    .argument("<marketFile>", "path to an English market JSON")
    .option("--out <dir>", "output directory", "out")
    .option("--corrupt", "use the intentionally broken translator (demo)")
    .option("--backend <name>", "mock | sarvam | llm (default: $BHASHA_BACKEND)")
    .action(async (file: string, opts: { out: string; corrupt?: boolean; backend?: string }) => {
      const market = loadMarket(file);
      const translator = opts.corrupt
        ? mockTranslator({ corrupt: true })
        : translatorFromEnv(opts.backend);
      const built = rejectBlocked(await buildMarket(market, translator));
      const jsonPath = `${opts.out}/${market.id}.json`;
      save(jsonPath, built);
      const pagePath = writePage(jsonPath, built);
      for (const v of built.versions) {
        const failed = v.checks.filter((c) => !c.ok);
        console.log(
          `${v.lang}: ${failed.length === 0 ? "CLEAN (draft — needs approval)" : `BLOCKED (${failed.length})`}`,
        );
        for (const f of failed) console.log(`   ✗ ${f.rule} ${f.expected} — ${f.detail}`);
      }
      console.log(
        `\nwrote ${jsonPath} · ${built.invariants.length} invariants extracted\nreview page: ${pagePath}`,
      );
    });

  program
    .command("review")
    .argument("<builtFile>", "path to a built market JSON (out/<id>.json)")
    .option(
      "--fix <pair>",
      'apply a human fix, e.g. hi:question="..." (repeatable)',
      (v: string, acc: string[]) => [...acc, v],
      [] as string[],
    )
    .option("--approve <lang>", "approve one language after reading it")
    .option("--page", "rewrite the side-by-side review HTML")
    .action((file: string, opts: { fix: string[]; approve?: string; page?: boolean }) => {
      let built = loadBuilt(file);
      for (const pair of opts.fix) {
        const [lang, rest] = pair.split(":");
        if (!lang || !rest) throw new CliError(`bad --fix value: ${pair}`);
        const eq = rest.indexOf("=");
        if (eq < 0) throw new CliError(`bad --fix value (need lang:field=text): ${pair}`);
        const field = rest.slice(0, eq) as FieldKey;
        const text = rest.slice(eq + 1);
        built = fixField(built, lang, field, text);
        save(file, built);
        console.log(`fixed ${lang}.${field} and re-verified`);
      }
      if (opts.approve) {
        try {
          built = approveVersion(built, opts.approve);
          save(file, built);
          console.log(`approved ${opts.approve}`);
        } catch (e) {
          throw new CliError((e as Error).message);
        }
      }
      reportVersions(built);
      if (opts.page) console.log(`\nreview page: ${writePage(file, built)}`);
    });

  program
    .command("publish")
    .argument("<builtFile>", "path to a built market JSON (out/<id>.json)")
    .option("--lang <lang>", "publish only this language (default: all)")
    .action((file: string, opts: { lang?: string }) => {
      if (!existsSync(file)) throw new CliError(`no built market at ${file} — run build first`);
      try {
        const published = publish(loadBuilt(file), opts.lang);
        save(file, published);
        const langs = published.versions
          .filter((v) => v.status === "published")
          .map((v) => v.lang);
        console.log(`published ${file}: ${langs.join(", ")}`);
      } catch (e) {
        if (e instanceof PublishBlockedError) throw new CliError(e.message);
        throw e;
      }
    });

  program
    .command("demo")
    .description("happy path, then replay both production incidents and show the tool catching them")
    .option("--out <dir>", "output directory", "out")
    .action(async (opts: { out: string }) => {
      const market = loadMarket("markets/monsoon-arrival.json");

      // --- Part 1: clean translation verifies, approves, publishes ---
      let good = await buildMarket(market, mockTranslator());
      for (const v of good.versions) good = approveVersion(good, v.lang);
      const goodPath = `${opts.out}/${market.id}.json`;
      save(goodPath, good);
      const goodPage = writePage(goodPath, good);
      console.log("=== DEMO PART 1: faithful translation passes every check ===");
      console.log("(one English source -> Hindi, Tamil, Marathi; every number/date/relation verified)\n");
      reportVersions(good);
      const published = publish(good);
      const langs = published.versions.filter((v) => v.status === "published").map((v) => v.lang);
      console.log(`\npublish ok: ${langs.join(", ")}\n`);

      // --- Part 2: corrupt translation is caught and refused ---
      const built = rejectBlocked(await buildMarket(market, mockTranslator({ corrupt: true })));
      const corruptPath = `${opts.out}/${market.id}-corrupt.json`;
      save(corruptPath, built);
      const corruptPage = writePage(corruptPath, built);
      console.log("=== DEMO PART 2: broken translation of the same market ===");
      console.log("(the translator changed a number and rendered 'before' as the 'by' wording)\n");
      reportVersions(built);
      try {
        publish(built);
        throw new CliError("BUG: publish should have been blocked");
      } catch (e) {
        if (e instanceof PublishBlockedError) {
          console.log(`\npublish refused as expected:\n${e.message}`);
        } else {
          throw e;
        }
      }
      console.log(`\nreview pages:\n  ${goodPage}\n  ${corruptPage}`);
    });

  return program;
}

/** Programmatic entry point: returns a process exit code instead of exiting. */
export async function runCli(argv: string[]): Promise<number> {
  try {
    await buildProgram().parseAsync(argv, { from: "user" });
    return 0;
  } catch (e) {
    if (e instanceof CommanderError) return e.exitCode;
    console.error((e as Error).message);
    return 1;
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

/** Load a local `.env` (gitignored) so keys like SARVAM_API_KEY can live there. */
function loadDotEnv(): void {
  try {
    // Node >= 20.12: reads ./.env relative to cwd; no-op error if absent
    (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.();
  } catch {
    // no .env present — fall back to real environment variables
  }
}

if (isDirectRun) {
  loadDotEnv();
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
