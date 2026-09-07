/**
 * Reset 03B.2 — thin provider execution boundary (execute only).
 * Never silently falls back to the heavy Gemini provider module / registry barrel.
 */

import type { LanguageCode } from "@hu/types";
import {
  protectBrandTokensForMachineTranslation,
  restoreBrandTokensAfterMachineTranslation,
  templateHasBrandSiteNameToken,
} from "@hu/types";

import type { TranslationProvider } from "../translation-provider.js";
import {
  markMaterializerProviderCall,
  markMaterializerProviderImported,
  getMediaPlpMaterializerCounters,
} from "./counters.js";
import { resolveMediaPlpOperatorMaxProviderInputBytes } from "./constants.js";
import {
  createThinMediaPlpProviderFromConfig,
  MEDIA_PLP_THIN_GEMINI_TRANSPORT_ID,
} from "./thin-gemini-transport.js";

export const MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY = "THIN" as const;

export type ProviderBoundaryResult =
  | {
      readonly ok: true;
      readonly values: Readonly<Record<string, string>>;
      readonly PROVIDER_INPUT_BYTES: number;
      readonly providerId: string;
      readonly PROVIDER_EXECUTION_BOUNDARY: typeof MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY;
      readonly PROVIDER_TRANSPORT: string;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "PAYLOAD_LIMIT"
        | "PROVIDER_CALL_CAP"
        | "PROVIDER_FAILURE"
        | "PARSE_FAILURE"
        | "WRONG_TARGET_LANGUAGE"
        | "LOCALIZATION_CONTENT_INTEGRITY_FAILED"
        | "BRAND_TOKEN_PRESERVATION_FAILED"
        | "PARTIAL"
        | "TIMEOUT";
      readonly PROVIDER_INPUT_BYTES: number;
      readonly message: string;
      readonly PROVIDER_EXECUTION_BOUNDARY: typeof MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY;
      readonly PROVIDER_TRANSPORT: string;
    };

export type ThinProviderImportResult = {
  readonly provider: TranslationProvider;
  readonly PROVIDER_EXECUTION_BOUNDARY: typeof MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY;
  readonly PROVIDER_TRANSPORT: string;
};

/**
 * Import the thin Media PLP provider execution boundary only.
 * Never imports the heavy Gemini provider module (registry barrel).
 */
export async function importMediaPlpMaterializerProvider(): Promise<ThinProviderImportResult> {
  markMaterializerProviderImported();
  const { resolveTranslationConfig } = await import("../translation.config.js");
  const config = resolveTranslationConfig();
  const created = await createThinMediaPlpProviderFromConfig(config);
  return {
    provider: created.provider,
    PROVIDER_EXECUTION_BOUNDARY: MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY,
    PROVIDER_TRANSPORT: created.PROVIDER_TRANSPORT,
  };
}

export function validateMediaPlpProviderLocalizationValues(input: {
  readonly locale: LanguageCode;
  readonly autoValues: Readonly<Record<string, string>>;
  readonly translated: Readonly<Record<string, string>>;
}):
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "PARTIAL"
        | "WRONG_TARGET_LANGUAGE"
        | "LOCALIZATION_CONTENT_INTEGRITY_FAILED"
        | "BRAND_TOKEN_PRESERVATION_FAILED";
      readonly message: string;
    } {
  const missing: string[] = [];
  for (const key of Object.keys(input.autoValues)) {
    const value = input.translated[key];
    if (typeof value !== "string" || !value.trim()) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    return {
      ok: false,
      reason: "PARTIAL",
      message: `Provider localization missing AUTO paths: ${missing.join(", ")}`,
    };
  }

  // Brand tokens must survive MACHINE exactly; Brand Localization owns substitution later.
  const brandTokenLoss: string[] = [];
  for (const key of Object.keys(input.autoValues)) {
    const source = input.autoValues[key]!;
    const translated = input.translated[key]!;
    if (
      templateHasBrandSiteNameToken(source) &&
      !templateHasBrandSiteNameToken(translated)
    ) {
      brandTokenLoss.push(key);
    }
  }
  if (brandTokenLoss.length > 0) {
    return {
      ok: false,
      reason: "BRAND_TOKEN_PRESERVATION_FAILED",
      message: `Provider removed/altered Brand {siteName} tokens on paths: ${brandTokenLoss.join(", ")}; refusing PARTIAL publish.`,
    };
  }

  if (input.locale !== "en") {
    const identical: string[] = [];
    let anyProsePath = false;
    for (const key of Object.keys(input.autoValues)) {
      // Technical identity paths may remain identical (protected by contract).
      if (key === "id" || key.endsWith(".id")) {
        continue;
      }
      anyProsePath = true;
      const source = input.autoValues[key]!;
      const translated = input.translated[key]!;
      const normSource = source.trim().replace(/\s+/g, " ");
      const normTranslated = translated.trim().replace(/\s+/g, " ");
      if (normTranslated === normSource) {
        identical.push(key);
      }
    }
    if (anyProsePath && identical.length === Object.keys(input.autoValues).filter((k) => k !== "id" && !k.endsWith(".id")).length) {
      return {
        ok: false,
        reason: "WRONG_TARGET_LANGUAGE",
        message: `Provider returned source-identical values for every translatable path (locale=${input.locale}); refusing publish.`,
      };
    }
    if (identical.length > 0) {
      return {
        ok: false,
        reason: "LOCALIZATION_CONTENT_INTEGRITY_FAILED",
        message: `Provider left ${identical.length} translatable path(s) canonical-identical (e.g. ${identical.slice(0, 3).join(", ")}); refusing publish.`,
      };
    }
  }

  return { ok: true };
}

export function flattenStructuredLocalizationValues(
  node: unknown,
  prefix: string,
  out: Record<string, string>,
): void {
  if (typeof node === "string") {
    if (prefix && node.trim()) {
      out[prefix] = node;
    }
    return;
  }
  if (node === null || node === undefined) {
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((entry, index) => {
      const next = prefix ? `${prefix}[${index}]` : `[${index}]`;
      flattenStructuredLocalizationValues(entry, next, out);
    });
    return;
  }
  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const next = prefix ? `${prefix}.${key}` : key;
      flattenStructuredLocalizationValues(value, next, out);
    }
  }
}

export async function callMediaPlpMaterializerProviderOnce(input: {
  readonly provider: TranslationProvider;
  readonly locale: LanguageCode;
  readonly autoValues: Readonly<Record<string, string>>;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly maxInputBytes?: number;
  readonly PROVIDER_TRANSPORT?: string;
}): Promise<ProviderBoundaryResult> {
  const transport = input.PROVIDER_TRANSPORT ?? MEDIA_PLP_THIN_GEMINI_TRANSPORT_ID;
  const boundary = MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY;
  const counters = getMediaPlpMaterializerCounters();
  if (counters.PROVIDER_CALL_COUNT >= 1) {
    return {
      ok: false,
      reason: "PROVIDER_CALL_CAP",
      PROVIDER_INPUT_BYTES: 0,
      message: "Hard fail: PROVIDER_CALL_COUNT would exceed 1.",
      PROVIDER_EXECUTION_BOUNDARY: boundary,
      PROVIDER_TRANSPORT: transport,
    };
  }

  const protectedAutoValues: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.autoValues)) {
    protectedAutoValues[key] = protectBrandTokensForMachineTranslation(value);
  }

  const payload = JSON.stringify(protectedAutoValues);
  const bytes = Buffer.byteLength(payload, "utf8");
  const maxBytes = input.maxInputBytes ?? resolveMediaPlpOperatorMaxProviderInputBytes();
  if (bytes > maxBytes) {
    return {
      ok: false,
      reason: "PAYLOAD_LIMIT",
      PROVIDER_INPUT_BYTES: bytes,
      message: `Provider input ${bytes} bytes exceeds limit ${maxBytes}.`,
      PROVIDER_EXECUTION_BOUNDARY: boundary,
      PROVIDER_TRANSPORT: transport,
    };
  }

  markMaterializerProviderCall();
  if (getMediaPlpMaterializerCounters().PROVIDER_CALL_COUNT > 1) {
    return {
      ok: false,
      reason: "PROVIDER_CALL_CAP",
      PROVIDER_INPUT_BYTES: bytes,
      message: "Hard fail: PROVIDER_CALL_COUNT exceeded 1.",
      PROVIDER_EXECUTION_BOUNDARY: boundary,
      PROVIDER_TRANSPORT: transport,
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
        PROVIDER_EXECUTION_BOUNDARY: boundary,
        PROVIDER_TRANSPORT: transport,
      };
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        reason: "PARSE_FAILURE",
        PROVIDER_INPUT_BYTES: bytes,
        message: "Provider returned unexpected structured shape.",
        PROVIDER_EXECUTION_BOUNDARY: boundary,
        PROVIDER_TRANSPORT: transport,
      };
    }
    const values: Record<string, string> = {};
    flattenStructuredLocalizationValues(parsed, "", values);
    for (const [key, value] of Object.entries(values)) {
      values[key] = restoreBrandTokensAfterMachineTranslation(value);
    }

    // Prefer exact autoValues keys from flat or nested provider payload.
    const aligned: Record<string, string> = {};
    for (const key of Object.keys(input.autoValues)) {
      const direct = values[key];
      if (typeof direct === "string" && direct.trim()) {
        aligned[key] = direct;
      }
    }

    const validated = validateMediaPlpProviderLocalizationValues({
      locale: input.locale,
      autoValues: input.autoValues,
      translated: aligned,
    });
    if (!validated.ok) {
      return {
        ok: false,
        reason: validated.reason,
        PROVIDER_INPUT_BYTES: bytes,
        message: validated.message,
        PROVIDER_EXECUTION_BOUNDARY: boundary,
        PROVIDER_TRANSPORT: transport,
      };
    }

    return {
      ok: true,
      values: aligned,
      PROVIDER_INPUT_BYTES: bytes,
      providerId: result.providerId,
      PROVIDER_EXECUTION_BOUNDARY: boundary,
      PROVIDER_TRANSPORT: transport,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "provider failure";
    const isTimeout =
      (error instanceof Error &&
        ("code" in error
          ? (error as { code?: string }).code === "timeout"
          : false)) ||
      /timed out/i.test(message);
    return {
      ok: false,
      reason: isTimeout ? "TIMEOUT" : "PROVIDER_FAILURE",
      PROVIDER_INPUT_BYTES: bytes,
      message,
      PROVIDER_EXECUTION_BOUNDARY: boundary,
      PROVIDER_TRANSPORT: transport,
    };
  }
}
