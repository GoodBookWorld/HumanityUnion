/**
 * Reset 03B.2 / RESET 05D.4 — thin provider execution boundary (execute only).
 * Never silently falls back to the heavy Gemini provider module / registry barrel.
 *
 * RESET 05D.4 — ASCII Brand transport sentinel; PARTIAL path diagnostics;
 * structured failure metadata for retry taxonomy.
 */

import type { BrandTokenPathTransportReport, LanguageCode } from "@hu/types";
import {
  classifyBrandTokenPathTransport,
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

export type ProviderMachinePathDiagnostics = {
  readonly EXPECTED_MACHINE_PATHS: readonly string[];
  readonly RETURNED_MACHINE_PATHS: readonly string[];
  readonly MISSING_MACHINE_PATHS: readonly string[];
  readonly UNEXPECTED_MACHINE_PATHS: readonly string[];
  readonly BRAND_TOKEN_PATH_STATES: readonly BrandTokenPathTransportReport[];
};

export type ProviderBoundaryFailureReason =
  | "PAYLOAD_LIMIT"
  | "PROVIDER_CALL_CAP"
  | "PROVIDER_FAILURE"
  | "PARSE_FAILURE"
  | "WRONG_TARGET_LANGUAGE"
  | "LOCALIZATION_CONTENT_INTEGRITY_FAILED"
  | "BRAND_TOKEN_PRESERVATION_FAILED"
  | "PARTIAL"
  | "TIMEOUT";

export type ProviderBoundaryResult =
  | {
      readonly ok: true;
      readonly values: Readonly<Record<string, string>>;
      readonly PROVIDER_INPUT_BYTES: number;
      readonly providerId: string;
      readonly PROVIDER_EXECUTION_BOUNDARY: typeof MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY;
      readonly PROVIDER_TRANSPORT: string;
      readonly pathDiagnostics: ProviderMachinePathDiagnostics;
    }
  | {
      readonly ok: false;
      readonly reason: ProviderBoundaryFailureReason;
      readonly PROVIDER_INPUT_BYTES: number;
      readonly message: string;
      readonly PROVIDER_EXECUTION_BOUNDARY: typeof MEDIA_PLP_PROVIDER_EXECUTION_BOUNDARY;
      readonly PROVIDER_TRANSPORT: string;
      readonly pathDiagnostics?: ProviderMachinePathDiagnostics;
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

export function buildProviderMachinePathDiagnostics(input: {
  readonly autoValues: Readonly<Record<string, string>>;
  readonly translated: Readonly<Record<string, string>>;
  readonly allReturnedKeys?: readonly string[];
}): ProviderMachinePathDiagnostics {
  const expected = Object.keys(input.autoValues).sort();
  const returned = Object.keys(input.translated)
    .filter((k) => typeof input.translated[k] === "string" && input.translated[k]!.trim())
    .sort();
  const expectedSet = new Set(expected);
  const returnedSet = new Set(returned);
  const missing = expected.filter((p) => !returnedSet.has(p));
  const unexpected = (input.allReturnedKeys ?? returned).filter(
    (p) => !expectedSet.has(p),
  );
  const brandStates: BrandTokenPathTransportReport[] = [];
  for (const path of expected) {
    const source = input.autoValues[path] ?? "";
    const translated = input.translated[path] ?? "";
    const report = classifyBrandTokenPathTransport({
      path,
      canonicalSource: source,
      restoredTranslated: translated,
    });
    if (report) {
      brandStates.push(report);
    }
  }
  return {
    EXPECTED_MACHINE_PATHS: expected,
    RETURNED_MACHINE_PATHS: returned,
    MISSING_MACHINE_PATHS: missing,
    UNEXPECTED_MACHINE_PATHS: [...new Set(unexpected)].sort(),
    BRAND_TOKEN_PATH_STATES: brandStates,
  };
}

export function validateMediaPlpProviderLocalizationValues(input: {
  readonly locale: LanguageCode;
  readonly autoValues: Readonly<Record<string, string>>;
  readonly translated: Readonly<Record<string, string>>;
}):
  | { readonly ok: true; readonly pathDiagnostics: ProviderMachinePathDiagnostics }
  | {
      readonly ok: false;
      readonly reason:
        | "PARTIAL"
        | "WRONG_TARGET_LANGUAGE"
        | "LOCALIZATION_CONTENT_INTEGRITY_FAILED"
        | "BRAND_TOKEN_PRESERVATION_FAILED";
      readonly message: string;
      readonly pathDiagnostics: ProviderMachinePathDiagnostics;
    } {
  const pathDiagnostics = buildProviderMachinePathDiagnostics({
    autoValues: input.autoValues,
    translated: input.translated,
  });

  if (pathDiagnostics.MISSING_MACHINE_PATHS.length > 0) {
    return {
      ok: false,
      reason: "PARTIAL",
      message: `Provider localization missing AUTO paths: ${pathDiagnostics.MISSING_MACHINE_PATHS.join(", ")}`,
      pathDiagnostics,
    };
  }

  const brandLoss = pathDiagnostics.BRAND_TOKEN_PATH_STATES.filter(
    (row) => row.TOKEN_STATE !== "PRESERVED",
  );
  if (brandLoss.length > 0) {
    return {
      ok: false,
      reason: "BRAND_TOKEN_PRESERVATION_FAILED",
      message: `Provider removed/altered Brand {siteName} tokens on paths: ${brandLoss
        .map((r) => `${r.SEMANTIC_PATH}:${r.TOKEN_STATE}`)
        .join(", ")}; refusing PARTIAL publish.`,
      pathDiagnostics,
    };
  }

  // Defensive: also catch missing tokens via template helper (count edge cases).
  for (const key of Object.keys(input.autoValues)) {
    const source = input.autoValues[key]!;
    const translated = input.translated[key]!;
    if (
      templateHasBrandSiteNameToken(source) &&
      !templateHasBrandSiteNameToken(translated)
    ) {
      return {
        ok: false,
        reason: "BRAND_TOKEN_PRESERVATION_FAILED",
        message: `Provider removed/altered Brand {siteName} tokens on paths: ${key}; refusing PARTIAL publish.`,
        pathDiagnostics,
      };
    }
  }

  if (input.locale !== "en") {
    const identical: string[] = [];
    let anyProsePath = false;
    for (const key of Object.keys(input.autoValues)) {
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
    const proseKeys = Object.keys(input.autoValues).filter(
      (k) => k !== "id" && !k.endsWith(".id"),
    );
    if (anyProsePath && identical.length === proseKeys.length) {
      return {
        ok: false,
        reason: "WRONG_TARGET_LANGUAGE",
        message: `Provider returned source-identical values for every translatable path (locale=${input.locale}); refusing publish.`,
        pathDiagnostics,
      };
    }
    if (identical.length > 0) {
      return {
        ok: false,
        reason: "LOCALIZATION_CONTENT_INTEGRITY_FAILED",
        message: `Provider left ${identical.length} translatable path(s) canonical-identical (e.g. ${identical.slice(0, 3).join(", ")}); refusing publish.`,
        pathDiagnostics,
      };
    }
  }

  return { ok: true, pathDiagnostics };
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

export function formatProviderPathDiagnosticsSafe(
  diagnostics: ProviderMachinePathDiagnostics | undefined,
): string {
  if (!diagnostics) {
    return "";
  }
  const parts: string[] = [];
  if (diagnostics.MISSING_MACHINE_PATHS.length > 0) {
    parts.push(
      `MISSING_MACHINE_PATHS=${diagnostics.MISSING_MACHINE_PATHS.slice(0, 24).join("|")}`,
    );
  }
  if (diagnostics.EXPECTED_MACHINE_PATHS.length > 0) {
    parts.push(
      `EXPECTED_MACHINE_PATHS=${diagnostics.EXPECTED_MACHINE_PATHS.slice(0, 24).join("|")}`,
    );
  }
  const brandFail = diagnostics.BRAND_TOKEN_PATH_STATES.filter(
    (r) => r.TOKEN_STATE !== "PRESERVED",
  );
  if (brandFail.length > 0) {
    parts.push(
      `BRAND_TOKEN_PATHS=${brandFail
        .slice(0, 16)
        .map((r) => `${r.SEMANTIC_PATH}:${r.TOKEN_STATE}`)
        .join("|")}`,
    );
  }
  return parts.length > 0 ? `;${parts.join(";")}` : "";
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
        pathDiagnostics: buildProviderMachinePathDiagnostics({
          autoValues: input.autoValues,
          translated: {},
        }),
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
        pathDiagnostics: buildProviderMachinePathDiagnostics({
          autoValues: input.autoValues,
          translated: {},
        }),
      };
    }
    const values: Record<string, string> = {};
    flattenStructuredLocalizationValues(parsed, "", values);
    for (const [key, value] of Object.entries(values)) {
      values[key] = restoreBrandTokensAfterMachineTranslation(value);
    }

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
        message: `${validated.message}${formatProviderPathDiagnosticsSafe(validated.pathDiagnostics)}`,
        PROVIDER_EXECUTION_BOUNDARY: boundary,
        PROVIDER_TRANSPORT: transport,
        pathDiagnostics: validated.pathDiagnostics,
      };
    }

    return {
      ok: true,
      values: aligned,
      PROVIDER_INPUT_BYTES: bytes,
      providerId: result.providerId,
      PROVIDER_EXECUTION_BOUNDARY: boundary,
      PROVIDER_TRANSPORT: transport,
      pathDiagnostics: validated.pathDiagnostics,
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
