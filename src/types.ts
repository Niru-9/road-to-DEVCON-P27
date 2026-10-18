import { z } from "zod";

export const LANGUAGES = ["hi", "ta", "mr"] as const;
export const langSchema = z.enum(LANGUAGES);
export type Lang = z.infer<typeof langSchema>;

export const FIELD_KEYS = [
  "question",
  "resolutionRules",
  "closeDate",
  "resolutionSource",
] as const;
export const fieldKeySchema = z.enum(FIELD_KEYS);
export type FieldKey = z.infer<typeof fieldKeySchema>;

export const marketSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  resolutionRules: z.string().min(1),
  closeDate: z.string().min(1),
  resolutionSource: z.string().min(1),
});
export type Market = z.infer<typeof marketSchema>;

export const invariantKindSchema = z.enum(["number", "date", "deadline"]);
export type InvariantKind = z.infer<typeof invariantKindSchema>;

export const invariantSchema = z.object({
  id: z.string(),
  kind: invariantKindSchema,
  /** exact source text, e.g. "1,00,000" or "before 15 June 2026" */
  raw: z.string(),
  /** normalized comparable, e.g. "100000" / "06-15-2026" */
  value: z.string(),
  /** "before" | "by" | ... for deadline invariants */
  relation: z.string().optional(),
  fields: z.array(fieldKeySchema),
});
export type Invariant = z.infer<typeof invariantSchema>;

export const statusSchema = z.enum(["draft", "blocked", "approved", "published"]);
export type Status = z.infer<typeof statusSchema>;

export const checkResultSchema = z.object({
  invariantId: z.string(),
  field: fieldKeySchema,
  ok: z.boolean(),
  rule: z.string(),
  expected: z.string(),
  detail: z.string(),
});
export type CheckResult = z.infer<typeof checkResultSchema>;

export const languageVersionSchema = z.object({
  lang: langSchema,
  values: z.object({
    question: z.string(),
    resolutionRules: z.string(),
    closeDate: z.string(),
    resolutionSource: z.string(),
  }),
  status: statusSchema,
  checks: z.array(checkResultSchema),
  translator: z.string(),
});
export type LanguageVersion = z.infer<typeof languageVersionSchema>;

export const builtMarketSchema = z.object({
  source: marketSchema,
  invariants: z.array(invariantSchema),
  versions: z.array(languageVersionSchema),
  builtAt: z.string(),
});
export type BuiltMarket = z.infer<typeof builtMarketSchema>;
