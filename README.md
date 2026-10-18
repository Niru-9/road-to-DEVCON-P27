# Bhasha Markets

Take **one finished English prediction market** and publish faithful **Hindi, Tamil, and
Marathi** versions — with a code-based guarantee that no number, date, or deadline
relation ever drifts from the English source.

A translation that changes `1,00,000` to `10,00,000`, or "before June 1" to "by
June 1", is not a translation bug — it is a market-integrity bug. Bhasha Markets
extracts every invariant from the English text with **pure code (regex + lexicon,
never a model)**, checks *every* translation against *every* invariant, and
**refuses to publish** any version that fails a check.

## The two incidents this exists to prevent

1. **The lakh→crore slip.** A human (or model) translator rendered `1,00,000` as
   `10,00,000`. The market's prize pool silently changed by 10×.
2. **The before→by slip.** English said "**before** June 1, 2025"; the Hindi
   version said "**by** June 1, 2025" (`जून 1, 2025 तक`). One extra word changes
   which side of the deadline the market resolves on.

Both are reproduced on demand by the mock translator's `corrupt` mode and caught
by the checker:

```console
$ npm run demo
=== DEMO PART 1: faithful translation passes every check ===
(one English source -> Hindi, Tamil, Marathi; every number/date/relation verified)

== hi [approved] == all checks green
== ta [approved] == all checks green
== mr [approved] == all checks green

publish ok: hi, ta, mr

=== DEMO PART 2: broken translation of the same market ===
(the translator changed a number and rendered 'before' as the 'by' wording)

== hi [blocked] ==
  ✗ date 15 June 2026 — date not preserved in question (day ok: false, month ok: true)
  ✗ relation before before 15 June 2026 — relation "before" rendered as conflicting "तक"
  ✗ number-present 15 — source number 15 missing from question
  ✗ no-extra-number 1000000 — translation contains number 1000000 absent from source
  ✗ placeholder all placeholders restored — question: ⟦N0⟧ missing in translation
...
publish refused as expected:
hi: status is "blocked", must be "approved"
```

## Install & run

```bash
npm install
npm test          # 45 tests: invariants, normalizer, verifier, fixtures, CLI
npm run demo      # happy path (approve → publish), then both incidents caught
```

### CLI

```bash
npm run cli -- build markets/prize-pool.json --out out   # writes JSON + review page
npm run cli -- review out/prize-pool.json --page          # rewrite the side-by-side review HTML
npm run cli -- review out/prize-pool.json --approve hi    # human approves a clean version
npm run cli -- review out/prize-pool.json --fix "hi:question=..."  # fix one field, re-verify
npm run cli -- publish out/prize-pool.json --lang hi      # refuses if blocked or not approved
```

Statuses flow `draft → approved → published`. Anything with a failed check is
`blocked`, and `publish` throws `PublishBlockedError`.

### Translation backends

| `BHASHA_BACKEND` | Backend | Notes |
| --- | --- | --- |
| `mock` (default) | Offline deterministic glossary | No network, no key. `corrupt` mode replays both incidents. |
| `sarvam` | [Sarvam Translate API](https://docs.sarvam.ai/api-reference-docs/) | Needs `SARVAM_API_KEY`. |
| `llm` | Any OpenAI-compatible chat endpoint | Needs `LLM_API_KEY`, optional `LLM_BASE_URL`/`LLM_MODEL`. |

Copy `.env.example` to `.env` (gitignored) to supply keys. **No credentials live
in tracked files** — enforced by the sample config using empty placeholders only.

## How it works

```
English market
   │
   ├─ extract()   regex over question / resolutionRules / closeDate / resolutionSource
   │              → numbers, dates, deadline relations   (code, never a model)
   │
   └─ for each language hi, ta, mr:
        protect()  mask every number/digit-run as ⟦N#k⟧
        translate  model never sees a number it could drift
        restore()  numbers come back byte-identical to English
        verify()   checks, every invariant, every field it appears in:
                     placeholder          all ⟦N#k⟧ placeholders restored
                     number-present       each source number still present
                                          (Devanagari/Tamil digits folded, 1,00,000 == 100000)
                     date                 deadline day + month preserved
                     relation             before/by/after/until words must match the English
                                          relation per language lexicon; conflicts blocked
                     no-extra-number      no number appears that the source never had
        status     clean → draft  |  any failure → blocked
   │
   review lane   reject / approve / fix a field, with a static HTML side-by-side page
   publish gate  only approved versions; blocked versions are refused
```

Key property: **numbers never pass through the translator.** They are masked to
`⟦N#k⟧` placeholders before translation and restored verbatim afterwards, so the
number check is a backstop against placeholder corruption rather than the only
defence.

### Review page

`build --out` writes `<id>.review.html` per market: side-by-side English vs each
translation, failed checks highlighted in red, and a copy-pasteable review
checklist. It is a static file — open it in any browser, no server needed.

## Sample markets

| Market | Language | `npm run demo` |
| --- | --- | --- |
| `markets/monsoon-arrival.json` | hi, ta, mr | Part 1: all clean → approved → published |
| same market, corrupt translator | hi, ta, mr | Part 2: blocked — placeholder loss + number drift + relation drift |

Use `build --corrupt` to replay the incidents on any market:

```bash
npm run cli -- build markets/prize-pool.json --out out --corrupt
```

## Test cases → where they live

From the problem statement's scored test cases:

| # | Test case | Where |
| --- | --- | --- |
| 1 | One source → 3 languages | `tests/pipeline.test.ts`, `tests/cli.test.ts` |
| 2 | Resolution rules translated | `tests/pipeline.test.ts` |
| 3 | Code-based invariant extraction, never a model | `src/extract.ts`, `tests/extract.test.ts` |
| 4 | Every translation checked on every invariant | `src/verify.ts`, `tests/verify.test.ts` |
| 5 | Native-script digit normalization | `src/normalize.ts`, `tests/normalize.test.ts` |
| 6 | Grouping-separator-insensitive comparison | `tests/normalize.test.ts`, `tests/verify.test.ts` |
| 7 | Failed check blocks publishing | `src/publish.ts`, `tests/publish.test.ts`, `tests/cli.test.ts` |
| 8 | Changed-number fixture fails its check | `tests/fixtures/corrupt-hi.json` + `tests/verify.test.ts` |
| 9 | No credentials in tracked files | `.env.example` (placeholders only), `.gitignore` ignores `.env` |

## Layout

```
src/
  extract.ts      invariant extraction (regex)
  normalize.ts    Devanagari/Tamil digit folding, grouping-separator stripping
  relations.ts    deadline-relation lexicon per language (before/by/after/until/…)
  protect.ts      ⟦N#k⟧ masking + verbatim restore
  verify.ts       the four checks + check entry format
  translate/      mock | sarvam | llm backends behind one interface
  pipeline.ts     buildMarket(): the whole flow above
  review.ts       review lane (reject / approve / fix)
  reviewPage.ts   static HTML review page
  publish.ts      publish gate
  cli.ts          build / review / publish / demo commands
markets/          three sample English markets
tests/            vitest suite + fixtures
```
