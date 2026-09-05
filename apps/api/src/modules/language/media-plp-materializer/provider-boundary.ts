/**
 * Reset 03B — provider dynamic-import boundary (execute only).
 * Never imported at CLI startup / dry-run / lookup phases.
 */

import type { LanguageCode } from "@hu/types";

import type { TranslationProvider } from "../translation-provider.js";
import {
  markMaterializerProviderCall,
  markMaterializerProviderImported,
  getMediaPlpMaterializerCounters,
} from "./counters.js";
import { resolveMediaPlpOperatorMaxProviderInputBytes } from "./constants.js";

export type ProviderBoundaryResult =
  | {
      readonly ok: true;
      readonly values: Readonly<Record<string, string>>;
      readonly PROVIDER_INPUT_BYTES: number;
      readonly providerId: string;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "PAYLOAD_LIMIT"
        | "PROVIDER_CALL_CAP"
        | "PROVIDER_FAILURE"
        | "PARSE_FAILURE";
      readonly PROVIDER_INPUT_BYTES: number;
      readonly message: string;
    };

/**
 * Dynamically import a TranslationProvider implementation.
 * Gemini module loads only when TRANSLATION_PROVIDER=gemini.
 */
export async function importMediaPlpMaterializerProvider(): Promise<TranslationProvider> {
  markMaterializerProviderImported();
  const { resolveTranslationConfig } = await import("../translation.config.js");
  const config = resolveTranslationConfig();
  if (config.provider === "gemini") {
    const { GeminiTranslationProvider } = await import(
      "../providers/gemini-translation-provider.js"
    );
    const { assertGeminiTranslationConfigured } = await import("../translation.config.js");
    assertGeminiTranslationConfigured(config);
    return new GeminiTranslationProvider(config);
  }
  const { DeterministicTranslationProvider } = await import(
    "../providers/deterministic-translation-provider.js"
  );
  return new DeterministicTranslationProvider();
}

export async function callMediaPlpMaterializerProviderOnce(input: {
  readonly provider: TranslationProvider;
  readonly locale: LanguageCode;
  readonly autoValues: Readonly<Record<string, string>>;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly maxInputBytes?: number;
}): Promise<ProviderBoundaryResult> {
  const counters = getMediaPlpMaterializerCounters();
  if (counters.PROVIDER_CALL_COUNT >= 1) {
    return {
      ok: false,
      reason: "PROVIDER_CALL_CAP",
      PROVIDER_INPUT_BYTES: 0,
      message: "Hard fail: PROVIDER_CALL_COUNT would exceed 1.",
    };
  }

  const payload = JSON.stringify(input.autoValues);
  const bytes = Buffer.byteLength(payload, "utf8");
  const maxBytes = input.maxInputBytes ?? resolveMediaPlpOperatorMaxProviderInputBytes();
  if (bytes > maxBytes) {
    return {
      ok: false,
      reason: "PAYLOAD_LIMIT",
      PROVIDER_INPUT_BYTES: bytes,
      message: `Provider input ${bytes} bytes exceeds limit ${maxBytes}.`,
    };
  }

  markMaterializerProviderCall();
  if (getMediaPlpMaterializerCounters().PROVIDER_CALL_COUNT > 1) {
    return {
      ok: false,
      reason: "PROVIDER_CALL_CAP",
      PROVIDER_INPUT_BYTES: bytes,
      message: "Hard fail: PROVIDER_CALL_COUNT exceeded 1.",
    };
  }

  try {
    const result = await input.provider.translate({
      sourceLanguage: "en",
      targetLanguage: input.locale,
      text: payload,
      contentType: "structured_json",
      sourceRecordId: input.sourceRecordId,
      sourceVersion: input.sourceVersion,
      safetyCleared: true,
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.translatedText);
    } catch {
      return {
        ok: false,
        reason: "PARSE_FAILURE",
        PROVIDER_INPUT_BYTES: bytes,
        message: "Provider returned non-JSON structured payload.",
      };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        reason: "PARSE_FAILURE",
        PROVIDER_INPUT_BYTES: bytes,
        message: "Provider returned unexpected structured shape.",
      };
    }
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) {
        values[key] = value;
      }
    }
    return {
      ok: true,
      values,
      PROVIDER_INPUT_BYTES: bytes,
      providerId: result.providerId,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "PROVIDER_FAILURE",
      PROVIDER_INPUT_BYTES: bytes,
      message: error instanceof Error ? error.message : "provider failure",
    };
  }
}
