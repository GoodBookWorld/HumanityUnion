/**
 * Real Gemini smoke test for Language Architecture Pack 02 translation.
 *
 * Usage (from apps/api):
 *   TRANSLATION_PROVIDER=gemini npx tsx scripts/smoke-translation-gemini.ts
 *
 * Reads apps/api/.env (TRANSLATION_PROVIDER=gemini, GEMINI_API_KEY=...).
 * Never prints the API key or raw vendor payload.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../.env") });
dotenv.config({ path: path.resolve(scriptDir, "../../../.env") });

const { resolveTranslationConfig } = await import(
  "../src/modules/language/translation.config.js"
);
const { GeminiTranslationProvider } = await import(
  "../src/modules/language/providers/gemini-translation-provider.js"
);
const { HUMANITY_UNION_TRANSLATION_TERMINOLOGY } = await import(
  "../src/modules/language/hu-terminology-glossary.js"
);

const CASES = [
  {
    label: "English → Ukrainian",
    sourceLanguage: "en" as const,
    targetLanguage: "uk" as const,
    text: "Active Allies review the Collaborative Analysis before Collective Decision.",
  },
  {
    label: "Ukrainian → English",
    sourceLanguage: "uk" as const,
    targetLanguage: "en" as const,
    text: "Учасники підтримують Implementation Commitment для Public Impact.",
  },
  {
    label: "English → French",
    sourceLanguage: "en" as const,
    targetLanguage: "fr" as const,
    text: "The Petition gathers Participant support without changing voting counts: 120 signatures.",
  },
] as const;

async function main(): Promise<void> {
  process.env.TRANSLATION_PROVIDER = process.env.TRANSLATION_PROVIDER || "gemini";
  const config = resolveTranslationConfig();

  if (config.provider !== "gemini") {
    throw new Error("Set TRANSLATION_PROVIDER=gemini for this smoke test.");
  }

  if (!config.geminiApiKey) {
    throw new Error("Set GEMINI_API_KEY for this smoke test (server-side only).");
  }

  const provider = new GeminiTranslationProvider(config);

  console.log("Translation Gemini smoke");
  console.log(`configuredProvider=${config.provider}`);
  console.log(`activeProviderId=${provider.providerId}`);
  console.log(`model=${config.geminiModel}`);
  console.log("keyPresent=true");

  for (const [index, testCase] of CASES.entries()) {
    if (index > 0) {
      await new Promise((resolve) => setTimeout(resolve, 12_000));
    }

    const result = await provider.translate({
      sourceLanguage: testCase.sourceLanguage,
      targetLanguage: testCase.targetLanguage,
      text: testCase.text,
      contentType: "plain",
      sourceRecordId: `smoke-${index + 1}`,
      sourceVersion: "v1",
      terminologyContext: HUMANITY_UNION_TRANSLATION_TERMINOLOGY,
      safetyCleared: true,
    });

    console.log("---");
    console.log(testCase.label);
    console.log(`providerId=${result.providerId}`);
    console.log(`sourceLen=${testCase.text.length}`);
    console.log(`translatedLen=${result.translatedText.length}`);
    console.log(`translatedPreview=${result.translatedText.slice(0, 180)}`);
  }

  console.log("---");
  console.log("smoke_ok=true");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`smoke_failed=${message.replace(/AIza[0-9A-Za-z_-]+/g, "[redacted]")}`);
  process.exitCode = 1;
});
