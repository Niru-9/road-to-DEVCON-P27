import type { FieldKey, Lang } from "../types.js";
import { mockTranslator } from "./mock.js";
import { sarvamTranslator } from "./sarvam.js";
import { llmTranslator } from "./llm.js";

export type TranslateContext = { field: FieldKey; marketId: string };

export type Translator = {
  name: string;
  translate(text: string, from: "en", to: Lang, ctx?: TranslateContext): Promise<string>;
};

/** Backend from env (or an explicit override). `mock` needs no key — tests/demo run on it. */
export function translatorFromEnv(override?: string): Translator {
  const which = (override ?? process.env.BHASHA_BACKEND ?? "mock").toLowerCase();
  if (which === "sarvam") return sarvamTranslator(process.env.SARVAM_API_KEY ?? "");
  if (which === "llm")
    return llmTranslator({
      baseUrl: process.env.LLM_BASE_URL ?? "",
      apiKey: process.env.LLM_API_KEY ?? "",
      model: process.env.LLM_MODEL ?? "",
    });
  return mockTranslator();
}
