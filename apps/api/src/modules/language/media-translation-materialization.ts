/**
 * Pack 08K.3.2 — Media translation materialization classifiers (no prose payloads).
 *
 * Distinguishes COMPLETE / PARTIAL / MISSING / STALE / FAILED without importing
 * provider, worker, or full corpus graphs.
 */

export type MediaTranslationMaterializationState =
  | "COMPLETE"
  | "PARTIAL"
  | "MISSING"
  | "STALE"
  | "FAILED"
  | "SOURCE_LANGUAGE";

export type MediaFallbackReason =
  | "BOUNDARY_BYPASS"
  | "IDENTITY_MISSING"
  | "SOURCE_VERSION_MISMATCH"
  | "SEMANTIC_NODE_NOT_FINGERPRINTED"
  | "TRANSLATION_MISSING"
  | "TRANSLATION_STALE"
  | "TRANSLATION_FAILED"
  | "PARTIAL_TRANSLATION_ROW"
  | "RAW_MERGE_OVERWRITE"
  | "GENERATION_NOT_SCHEDULED";

export type MediaSemanticPathDiagnostic = {
  readonly path: string;
  readonly ownership: "AUTO_TRANSLATABLE_CONTENT" | "PROTECTED_IDENTITY" | "PROTECTED_TECHNICAL";
  readonly fingerprinted: boolean;
  readonly translationPathExists: boolean;
  readonly localizedValueApplied: boolean;
  readonly fallbackReason: MediaFallbackReason | null;
};

/**
 * Compare expected AUTO field keys against a translated field bag.
 * Empty source values are not required in the translation bag.
 */
export function classifyTranslatedFieldCoverage(input: {
  readonly sourceFields: Readonly<Record<string, string>>;
  readonly translatedFields: Readonly<Record<string, string>> | null | undefined;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly translationRowExists: boolean;
  readonly translationSourceVersion: string | null;
  readonly liveSourceVersion: string;
  readonly translationStale?: boolean;
  readonly generationFailed?: boolean;
}): {
  readonly state: MediaTranslationMaterializationState;
  readonly missingPaths: readonly string[];
  readonly presentPaths: readonly string[];
} {
  if (input.sourceLanguage === input.targetLanguage) {
    return { state: "SOURCE_LANGUAGE", missingPaths: [], presentPaths: [] };
  }
  if (input.generationFailed) {
    return { state: "FAILED", missingPaths: [], presentPaths: [] };
  }
  if (!input.translationRowExists || !input.translatedFields) {
    const missing = Object.entries(input.sourceFields)
      .filter(([, value]) => value.trim().length > 0)
      .map(([key]) => key);
    return { state: "MISSING", missingPaths: missing, presentPaths: [] };
  }
  if (
    input.translationStale ||
    (input.translationSourceVersion != null &&
      input.translationSourceVersion !== input.liveSourceVersion)
  ) {
    return { state: "STALE", missingPaths: [], presentPaths: [] };
  }

  const presentPaths: string[] = [];
  const missingPaths: string[] = [];
  for (const [key, sourceValue] of Object.entries(input.sourceFields)) {
    if (!sourceValue.trim()) {
      continue;
    }
    const translated = input.translatedFields[key];
    if (typeof translated === "string" && translated.trim()) {
      presentPaths.push(key);
    } else {
      missingPaths.push(key);
    }
  }

  if (missingPaths.length === 0) {
    return { state: "COMPLETE", missingPaths, presentPaths };
  }
  if (presentPaths.length === 0) {
    return { state: "MISSING", missingPaths, presentPaths };
  }
  return { state: "PARTIAL", missingPaths, presentPaths };
}

/**
 * Merge canonical + localized bags: AUTO keys keep localized when present;
 * never restore English by spreading raw over localized.
 */
export function mergeLocalizedOverCanonical(input: {
  readonly canonical: Readonly<Record<string, string>>;
  readonly localized: Readonly<Record<string, string>>;
  readonly autoKeys: readonly string[];
}): Record<string, string> {
  const auto = new Set(input.autoKeys);
  const out: Record<string, string> = { ...input.canonical };
  for (const key of auto) {
    const localized = input.localized[key];
    if (typeof localized === "string" && localized.trim()) {
      out[key] = localized;
    }
  }
  // Protected / non-auto keys may refresh from canonical after localized apply.
  for (const [key, value] of Object.entries(input.canonical)) {
    if (!auto.has(key)) {
      out[key] = value;
    }
  }
  return out;
}

/** Deterministic RSS identity helpers for audit counters (no network). */
export function auditRssIdentityStability(input: {
  readonly records: ReadonlyArray<{
    readonly id: string;
    readonly normalizedArticleUrl: string;
  }>;
}): {
  readonly RSS_IDENTITY_COLLISIONS: number;
  readonly RSS_DUPLICATE_IDENTITIES: number;
  readonly RSS_UNSTABLE_IDENTITIES: number;
} {
  const byUrl = new Map<string, Set<string>>();
  const byId = new Map<string, Set<string>>();
  for (const record of input.records) {
    const url = record.normalizedArticleUrl.trim().toLowerCase();
    const id = record.id.trim();
    if (!byUrl.has(url)) {
      byUrl.set(url, new Set());
    }
    byUrl.get(url)!.add(id);
    if (!byId.has(id)) {
      byId.set(id, new Set());
    }
    byId.get(id)!.add(url);
  }

  let collisions = 0;
  for (const ids of byUrl.values()) {
    if (ids.size > 1) {
      collisions += 1;
    }
  }
  let duplicates = 0;
  for (const urls of byId.values()) {
    if (urls.size > 1) {
      duplicates += 1;
    }
  }

  return {
    RSS_IDENTITY_COLLISIONS: collisions,
    RSS_DUPLICATE_IDENTITIES: duplicates,
    // Unstable = same URL maps to >1 id across the observed set (collision).
    RSS_UNSTABLE_IDENTITIES: collisions,
  };
}

export function shouldScheduleMediaTranslationRepair(
  state: MediaTranslationMaterializationState,
): boolean {
  return state === "MISSING" || state === "STALE" || state === "PARTIAL";
}

export function buildSemanticPathDiagnostics(input: {
  readonly autoPaths: readonly string[];
  readonly fingerprintedPaths: ReadonlySet<string>;
  readonly translationPaths: ReadonlySet<string>;
  readonly appliedPaths: ReadonlySet<string>;
  readonly state: MediaTranslationMaterializationState;
}): readonly MediaSemanticPathDiagnostic[] {
  return input.autoPaths.map((path) => {
    const fingerprinted = input.fingerprintedPaths.has(path);
    const translationPathExists = input.translationPaths.has(path);
    const localizedValueApplied = input.appliedPaths.has(path);
    let fallbackReason: MediaFallbackReason | null = null;
    if (!localizedValueApplied) {
      if (!fingerprinted) {
        fallbackReason = "SEMANTIC_NODE_NOT_FINGERPRINTED";
      } else if (input.state === "STALE") {
        fallbackReason = "TRANSLATION_STALE";
      } else if (input.state === "FAILED") {
        fallbackReason = "TRANSLATION_FAILED";
      } else if (input.state === "PARTIAL" && translationPathExists === false) {
        fallbackReason = "PARTIAL_TRANSLATION_ROW";
      } else if (!translationPathExists) {
        fallbackReason = "TRANSLATION_MISSING";
      } else {
        fallbackReason = "PARTIAL_TRANSLATION_ROW";
      }
    }
    return {
      path,
      ownership: "AUTO_TRANSLATABLE_CONTENT" as const,
      fingerprinted,
      translationPathExists,
      localizedValueApplied,
      fallbackReason,
    };
  });
}
