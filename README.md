# Bhasha Markets

Take **one finished English prediction market** and produce faithful **Hindi, Tamil, and
Marathi** versions — with a code-based guarantee that no number, date, or deadline
relation ever drifts from the English source.

A translation that changes `1,00,000` to `10,00,000`, or "before June 1" to "by
June 1", is not a translation bug — it is a **market-integrity bug**: two language
versions of the same market would resolve differently. Bhasha Markets extracts every
invariant from the English text with **pure code (regex + lexicon, never a model)**,
checks *every* translation against *every* invariant, and **refuses to publish** any
version that fails a check until a human fixes it in a review lane.

```
English market ──► mask numbers ──► translate ──► restore verbatim ──► verify ──► draft
                                                                         │
                                                          any failure ───┴──► blocked
                                                                                  │
                                    review lane (read / fix / approve) ◄──────────┘
                                                                                  │
                                            publish gate (approved only) ◄────────┘
```

---

## The two incidents this exists to prevent

1. **The lakh→crore slip.** A translator rendered `1,00,000` as `10,00,000`. The
   market's prize pool silently changed by **10×**.
2. **The before→by slip.** English said "**before** June 1, 2025"; the Hindi version
   said "**by** June 1, 2025" (`जून 1, 2025 तक`). One extra word flips which side of
   the deadline the market resolves on.

Both are reproduced on demand by the mock translator's `corrupt` mode and caught by
the checker.

---

## Quickstart

```bash
npm install

npm test          # 45 tests across 9 suites (vitest)
npm run demo      # happy path, then both incidents caught and refused
```

`npm run demo` prints (abridged):

```console
=== DEMO PART 1: faithful translation passes every check ===
(one English source -> Hindi, Tamil, Marathi; every number/date/relation verified)

== hi [approved] == all checks green
== ta [approved] == all checks green
== mr [approved] == all checks green

publish ok: hi, ta, mr

=== DEMO PART 2: broken translation of the same market ===
(the translator changed a number and rendered 'before' as the 'by' wording)

== hi [blocked] ==
  ✗ relation before before 15 June 2026 — relation "before" rendered as conflicting "तक" (in question)
  ✗ number-present 15 — source number 15 (15) missing from question
  ✗ no-extra-number 1000000 — translation contains number 1000000 in question that is absent from the English source (possible lakh/crore drift)
  ✗ placeholder all placeholders restored — question: ⟦N0⟧ missing in translation (expected 15)
  ...

publish refused as expected:
hi: status is "blocked", must be "approved"
```

---

## CLI

Run any command through the npm script:

```bash
npm run cli -- <command> [options]
```

| Command | What it does |
| --- | --- |
| `build <marketFile> [--out <dir>] [--corrupt]` | Translate one English market into hi/ta/mr, verify each, write `out/<id>.json` + `out/<id>.review.html`. |
| `review <builtFile> [--fix lang:field=text]... [--approve <lang>] [--page]` | Human review lane: read the side-by-side page, fix one field at a time (repeatable), or approve a language. |
| `publish <builtFile> [--lang <lang>]` | Publish approved version(s). Refuses anything blocked or not approved. |
| `demo [--out <dir>]` | Happy path, then replay both production incidents and show them refused. |

### Walk the reviewer journey

```bash
# 1. translate the market with the intentionally broken translator
npm run cli -- build markets/prize-pool.json --out out --corrupt
#    -> all three languages BLOCKED (number drift + relation drift + placeholder loss)

# 2. try to publish anyway — refused
npm run cli -- publish out/prize-pool.json
#    -> exit code 1, PublishBlockedError

# 3. read the review page (static HTML, no server needed)
npm run cli -- review out/prize-pool.json --page

# 4. fix the flagged fields by hand — each fix re-verifies immediately
npm run cli -- review out/prize-pool.json \
  --fix "hi:question=..." --fix "hi:resolutionRules=..."

# 5. approve, then publish — per language
npm run cli -- review out/prize-pool.json --approve hi
npm run cli -- publish out/prize-pool.json --lang hi
```

Statuses flow **`draft → approved → published`**. Anything with a failed check is
**`blocked`**; `publish` throws `PublishBlockedError` and the CLI exits non-zero.

### Exit codes

`0` success · `1` a `CliError` (bad path, blocked approval, refused publish) ·
Commander's own code for usage errors.

---

## How the guarantee works

### 1. Extract invariants — deterministic code, never a model

`src/extract.ts` runs regex over **question, resolutionRules, closeDate, and
resolutionSource** and produces the set of:

- **numbers** — ASCII, Indian-grouped (`1,00,000`), Western-grouped (`100,000`), decimals
- **dates** — `15 June 2026`, `June 15, 2026`, `15/06/2026`, `2026-06-15`, `15 June`
- **deadline relations** — `before / by / after / until / from / on` attached to a date

Each invariant records **which fields it appears in**, so a number stated in both the
question and the rules is checked in both.

### 2. Protect numbers before translating

`src/protect.ts` masks every digit-run as a placeholder (`⟦N0⟧`, `⟦N1⟧`, …) before the
text reaches the translator, then restores the original bytes afterwards. **Numbers
never pass through the translator**, so the number check is a backstop against
placeholder corruption, not the only defence.

### 3. Verify every translation against every invariant

`src/verify.ts` runs these rules for each language, for each field an invariant
appears in:

| Rule | Passes when |
| --- | --- |
| `placeholder` | every masked token was restored verbatim |
| `number-present` | each source number is present (Devanagari/Tamil digits folded, `1,00,000` == `100000`) |
| `date` | the deadline's day **and** month are preserved |
| `relation` | the deadline wording matches the source relation per the language lexicon — a conflicting word (`before` → `by`) is blocked |
| `no-extra-number` | no number appears that the source never contained (catches a 10× drift) |

If **any** rule fails, that language version is `blocked`.

### 4. Review lane + publish gate

A human can read the static side-by-side page, **fix a field** (which re-verifies
immediately), and **approve** only a version with zero failing checks. `publish` then
refuses every version that is not `approved` — so a drifting translation physically
cannot ship.

---

## Translation backends

Selected with `BHASHA_BACKEND` (copy `.env.example` to `.env`, which is gitignored):

| `BHASHA_BACKEND` | Backend | Notes |
| --- | --- | --- |
| `mock` *(default)* | Offline deterministic glossary | No network, no key. `corrupt` mode replays both incidents. |
| `sarvam` | [Sarvam Translate API](https://docs.sarvam.ai/api-reference-docs/) | Needs `SARVAM_API_KEY`. |
| `llm` | Any OpenAI-compatible chat endpoint | Needs `LLM_API_KEY`, optional `LLM_BASE_URL` / `LLM_MODEL`. |

All three sit behind one `Translator` interface, so the pipeline and the checks are
identical no matter which backend produced the text. **No credentials live in tracked
files** — `.env.example` contains empty placeholders only.

---

## Sample markets

| File | Purpose |
| --- | --- |
| `markets/monsoon-arrival.json` | Clean market — used by `npm run demo` for both paths. |
| `markets/prize-pool.json` | The lakh→crore prize-pool incident, replayed with `--corrupt`. |
| `markets/assembly-turnout.json` | A second clean market with percentage/date invariants. |

Any market can be run through the broken translator:

```bash
npm run cli -- build markets/prize-pool.json --out out --corrupt
```

---

## Scored test cases → where they live

| # | Test case | Code | Test |
| --- | --- | --- | --- |
| 1 | One source → three languages | `src/pipeline.ts` (`LANGUAGES`) | `tests/pipeline.test.ts` |
| 2 | Resolution rules translated, not only the question | `FIELD_KEYS` incl. `resolutionRules` | `tests/pipeline.test.ts` |
| 3 | Invariants extracted by code, never a model | `src/extract.ts` | `tests/extract.test.ts` |
| 4 | Every translation checked for every invariant | `src/verify.ts` | `tests/verify.test.ts`, `tests/cli.test.ts` |
| 5 | Native-script digits normalized before comparison | `src/normalize.ts` (`digitsToAscii`) | `tests/normalize.test.ts`, `tests/verify.test.ts` |
| 6 | Grouping separators ignored in comparison | `src/normalize.ts` (`stripGrouping`) | `tests/normalize.test.ts` |
| 7 | A failed check blocks publishing | `src/publish.ts`, `src/review.ts` | `tests/publish.test.ts`, `tests/cli.test.ts` |
| 8 | Fixture with a changed number is flagged | `tests/fixtures/corrupt-hi.json` | `tests/verify.test.ts` |
| 9 | No credential in any tracked file | `.env.example` (placeholders only) | manual scan of `git ls-files` |

Other fixtures: `tests/fixtures/before-by-hi.json` (the relation incident) and
`tests/fixtures/native-digits-hi.json` (Devanagari digits + Indian grouping, must
verify clean).

---

## Project layout

```
src/
  types.ts        Zod schemas for markets, invariants, checks, versions
  extract.ts      invariant extraction (regex) — never a model
  normalize.ts    Devanagari/Tamil digit folding, grouping-separator stripping
  relations.ts    deadline-relation lexicon per language (before/by/after/until/…)
  protect.ts      ⟦N#k⟧ masking + verbatim restore
  verify.ts       the invariant checks + check entry format
  translate/      mock | sarvam | llm backends behind one Translator interface
  pipeline.ts     buildMarket(): mask → translate → restore → verify → status
  review.ts       review lane (reject / approve / fix a field)
  reviewPage.ts   static side-by-side review HTML
  publish.ts      publish gate (approved only) + PublishBlockedError
  cli.ts          build / review / publish / demo commands
markets/          three sample English markets
tests/            vitest suite + fixtures
```

## Scripts

```bash
npm test          # 45 tests (vitest)
npm run build     # tsc type-check
npm run demo      # end-to-end demonstration
npm run cli -- --help
```

Built with **TypeScript**, **Zod**, **Commander**, **tsx**, and **Vitest**. Requires
Node 20.12+ (built on Node 24).
