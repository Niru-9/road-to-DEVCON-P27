import type { Translator } from "./index.js";

/** OpenAI-compatible chat client; any baseUrl/model works. */
export function llmTranslator(cfg: {
  baseUrl: string;
  apiKey: string;
  model: string;
}): Translator {
  if (!cfg.apiKey) throw new Error("LLM_API_KEY missing — set BHASHA_BACKEND=mock instead");
  const systemPrompt = (lang: string) =>
    `Translate the placeholder-marked text from English to ${lang}. ` +
    `Keep tokens like {{0}} EXACTLY as they are, in place. ` +
    `Do not add, remove or change any number. Return only the translation.`;
  return {
    name: "llm",
    async translate(text, _from, to) {
      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          temperature: 0,
          messages: [
            { role: "system", content: systemPrompt(to) },
            { role: "user", content: text },
          ],
        }),
      });
      if (!res.ok) throw new Error(`llm ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
      return data.choices[0].message.content.trim();
    },
  };
}
