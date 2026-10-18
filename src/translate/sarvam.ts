import type { Translator } from "./index.js";

const LANG_CODE: Record<string, string> = { hi: "hi-IN", ta: "ta-IN", mr: "mr-IN" };

export function sarvamTranslator(apiKey: string): Translator {
  if (!apiKey) throw new Error("SARVAM_API_KEY missing — set BHASHA_BACKEND=mock instead");
  const baseUrl = process.env.SARVAM_BASE_URL ?? "https://api.sarvam.ai";
  return {
    name: "sarvam",
    async translate(text, from, to) {
      const res = await fetch(`${baseUrl}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "api-subscription-key": apiKey },
        body: JSON.stringify({
          input: text,
          from: `${from}-IN`,
          to: LANG_CODE[to],
          mode: "formal",
        }),
      });
      if (!res.ok) throw new Error(`sarvam ${res.status}: ${await res.text()}`);
      const data = (await res.json()) as { translated_text: string };
      return data.translated_text;
    },
  };
}
