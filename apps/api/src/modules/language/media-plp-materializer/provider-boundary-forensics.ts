/**
 * RESET 05D.5 — provider-boundary forensics (safe structural metadata only).
 *
 * Paths, counts, enums, booleans — never prose, prompts, or raw provider bodies.
 */

import {
  BRAND_SITE_NAME_MACHINE_SENTINEL,
  BRAND_SITE_NAME_MACHINE_SENTINEL_LEGACY,
  countBrandSiteNameTokens,
  templateHasBrandSiteNameToken,
} from "@hu/types";

export type ProviderResponseShape = "OBJECT" | "STRING" | "ARRAY" | "INVALID";

export type BrandTokenForensicState =
  | "PRESERVED"
  | "MISSING_AFTER_PROVIDER"
  | "MISSING_AFTER_PARSE"
  | "MISSING_AFTER_FLATTEN"
  | "RESTORE_FAILED"
  | "ALTERED"
  | "DUPLICATED"
  | "UNMAPPABLE";

export type BrandPathForensicReport = {
  readonly SEMANTIC_PATH: string;
  readonly EXPECTED_TOKEN_COUNT: number;
  readonly PROTECTED_TOKEN_COUNT_BEFORE_SERIALIZE: number;
  readonly TOKEN_COUNT_AFTER_PROVIDER_PARSE: number;
  readonly TOKEN_COUNT_AFTER_FLATTEN: number;
  readonly TOKEN_COUNT_AFTER_RESTORE: number;
  readonly FINAL_CANONICAL_TOKEN_COUNT: number;
  readonly TOKEN_STATE: BrandTokenForensicState;
  readonly PROVIDER_PATH_PRESENT: boolean;
};

export type NewsPathForensicState = {
  readonly PATH: string;
  readonly PATH_PRESENT: boolean;
  readonly NON_EMPTY: boolean;
  readonly TARGET_LANGUAGE_ACCEPTED: boolean;
  readonly INTEGRITY_ACCEPTED: boolean;
  readonly MAPPED_TO_EXPECTED_PATH: boolean;
};

export type ProviderPartialSubreason =
  | "MISSING_PATH"
  | "EMPTY_VALUE"
  | "WRONG_TARGET_LANGUAGE"
  | "PATH_MAPPING_FAILURE"
  | "PARSE_FAILURE"
  | "CONTENT_INTEGRITY_FAILURE"
  | "OTHER_STRUCTURAL_FAILURE";

export type ProviderBoundaryForensics = {
  readonly PROVIDER_RESPONSE_SHAPE: ProviderResponseShape;
  readonly BRAND_TOKEN_PATH_STATES: readonly BrandPathForensicReport[];
  readonly NEWS_PATH_STATES: readonly NewsPathForensicState[];
  readonly PROVIDER_PARTIAL_SUBREASON: ProviderPartialSubreason | null;
  readonly EXPECTED_MACHINE_PATHS: readonly string[];
  readonly RETURNED_MACHINE_PATHS: readonly string[];
  readonly MISSING_MACHINE_PATHS: readonly string[];
  readonly UNEXPECTED_MACHINE_PATHS: readonly string[];
};

const SENTINEL_RE = /__HU_BRAND_SITE_NAME__/g;
const SENTINEL_LEGACY_RE = /⟦HU_BRAND_SITE_NAME⟧/g;
const SENTINEL_LOOSE_RE = /HU_BRAND_SITE_NAME/i;

export function countBrandTransportSentinels(text: string): number {
  const ascii = text.match(SENTINEL_RE)?.length ?? 0;
  const legacy = text.match(SENTINEL_LEGACY_RE)?.length ?? 0;
  return ascii + legacy;
}

export function classifyProviderResponseShape(parsed: unknown): ProviderResponseShape {
  if (parsed === null || parsed === undefined) {
    return "INVALID";
  }
  if (typeof parsed === "string") {
    return "STRING";
  }
  if (Array.isArray(parsed)) {
    return "ARRAY";
  }
  if (typeof parsed === "object") {
    return "OBJECT";
  }
  return "INVALID";
}

/**
 * Classify first-loss Brand token boundary for one semantic path (no prose).
 */
export function classifyBrandPathForensics(input: {
  readonly path: string;
  readonly canonicalSource: string;
  readonly protectedBeforeSerialize: string;
  readonly rawAfterParse: string | null;
  readonly afterFlatten: string | null;
  readonly afterRestore: string | null;
  readonly pathPresentInProviderObject: boolean;
}): BrandPathForensicReport | null {
  const expected = countBrandSiteNameTokens(input.canonicalSource);
  if (expected === 0) {
    return null;
  }

  const protectedCount = countBrandTransportSentinels(input.protectedBeforeSerialize);
  const afterParse = input.rawAfterParse;
  const afterFlatten = input.afterFlatten;
  const afterRestore = input.afterRestore;

  const parseCount =
    afterParse == null ? 0 : countBrandTransportSentinels(afterParse);
  const flattenCount =
    afterFlatten == null ? 0 : countBrandTransportSentinels(afterFlatten);
  const restoreCount =
    afterRestore == null ? 0 : countBrandSiteNameTokens(afterRestore);
  const finalCount = restoreCount;

  let state: BrandTokenForensicState;
  if (!input.pathPresentInProviderObject || afterParse == null) {
    state = "MISSING_AFTER_PARSE";
  } else if (parseCount === 0) {
    // Path present in parsed object but sentinel already gone.
    state =
      SENTINEL_LOOSE_RE.test(afterParse) || afterParse.includes("__HU_")
        ? "UNMAPPABLE"
        : "MISSING_AFTER_PROVIDER";
  } else if (afterFlatten == null) {
    state = "MISSING_AFTER_FLATTEN";
  } else if (flattenCount === 0 && parseCount > 0) {
    state = "MISSING_AFTER_FLATTEN";
  } else if (afterRestore == null) {
    state = "RESTORE_FAILED";
  } else if (
    restoreCount === 0 &&
    (flattenCount > 0 || countBrandTransportSentinels(afterRestore) > 0)
  ) {
    state = "RESTORE_FAILED";
  } else if (restoreCount === 0) {
    state = "MISSING_AFTER_PROVIDER";
  } else if (restoreCount > expected) {
    state = "DUPLICATED";
  } else if (restoreCount !== expected) {
    state = "ALTERED";
  } else if (
    templateHasBrandSiteNameToken(afterRestore) &&
    countBrandSiteNameTokens(afterRestore) === expected
  ) {
    state = "PRESERVED";
  } else {
    state = "UNMAPPABLE";
  }

  return {
    SEMANTIC_PATH: input.path,
    EXPECTED_TOKEN_COUNT: expected,
    PROTECTED_TOKEN_COUNT_BEFORE_SERIALIZE: protectedCount,
    TOKEN_COUNT_AFTER_PROVIDER_PARSE: parseCount,
    TOKEN_COUNT_AFTER_FLATTEN: flattenCount,
    TOKEN_COUNT_AFTER_RESTORE: restoreCount,
    FINAL_CANONICAL_TOKEN_COUNT: finalCount,
    TOKEN_STATE: state,
    PROVIDER_PATH_PRESENT: input.pathPresentInProviderObject,
  };
}

export function classifyNewsPathForensics(input: {
  readonly path: string;
  readonly canonicalSource: string;
  readonly returnedValue: string | undefined;
  readonly locale: string;
  readonly mappedToExpectedPath: boolean;
}): NewsPathForensicState {
  const present = typeof input.returnedValue === "string";
  const nonEmpty = present && input.returnedValue!.trim().length > 0;
  const value = nonEmpty ? input.returnedValue!.trim() : "";
  const source = input.canonicalSource.trim().replace(/\s+/g, " ");
  const norm = value.replace(/\s+/g, " ");
  const identical = nonEmpty && norm === source;
  const targetAccepted =
    input.locale === "en" ? nonEmpty : nonEmpty && !identical;
  const integrityAccepted = nonEmpty && (input.locale === "en" || !identical);

  return {
    PATH: input.path,
    PATH_PRESENT: present,
    NON_EMPTY: nonEmpty,
    TARGET_LANGUAGE_ACCEPTED: targetAccepted,
    INTEGRITY_ACCEPTED: integrityAccepted,
    MAPPED_TO_EXPECTED_PATH: input.mappedToExpectedPath,
  };
}

export function deriveProviderPartialSubreason(input: {
  readonly parseFailed?: boolean;
  readonly pathStates: readonly NewsPathForensicState[];
  readonly missingPaths: readonly string[];
  readonly unexpectedPaths: readonly string[];
}): ProviderPartialSubreason {
  if (input.parseFailed) {
    return "PARSE_FAILURE";
  }
  if (input.missingPaths.length > 0) {
    return "MISSING_PATH";
  }
  const empty = input.pathStates.filter((p) => p.PATH_PRESENT && !p.NON_EMPTY);
  if (empty.length > 0) {
    return "EMPTY_VALUE";
  }
  const unmapped = input.pathStates.filter((p) => !p.MAPPED_TO_EXPECTED_PATH);
  if (unmapped.length > 0 || input.unexpectedPaths.length > 0) {
    return "PATH_MAPPING_FAILURE";
  }
  const wrongLang = input.pathStates.filter(
    (p) => p.NON_EMPTY && !p.TARGET_LANGUAGE_ACCEPTED,
  );
  if (wrongLang.length > 0) {
    const allWrong =
      wrongLang.length === input.pathStates.filter((p) => p.NON_EMPTY).length;
    return allWrong ? "WRONG_TARGET_LANGUAGE" : "CONTENT_INTEGRITY_FAILURE";
  }
  const integrity = input.pathStates.filter(
    (p) => p.NON_EMPTY && !p.INTEGRITY_ACCEPTED,
  );
  if (integrity.length > 0) {
    return "CONTENT_INTEGRITY_FAILURE";
  }
  return "OTHER_STRUCTURAL_FAILURE";
}

/** Compact path forensic encoding for durable lastError (no prose). */
export function formatBrandPathForensicCompact(
  row: BrandPathForensicReport,
): string {
  return [
    row.SEMANTIC_PATH,
    row.TOKEN_STATE,
    row.EXPECTED_TOKEN_COUNT,
    row.PROTECTED_TOKEN_COUNT_BEFORE_SERIALIZE,
    row.TOKEN_COUNT_AFTER_PROVIDER_PARSE,
    row.TOKEN_COUNT_AFTER_FLATTEN,
    row.TOKEN_COUNT_AFTER_RESTORE,
    row.FINAL_CANONICAL_TOKEN_COUNT,
    row.PROVIDER_PATH_PRESENT ? 1 : 0,
  ].join(":");
}

export function formatNewsPathForensicCompact(row: NewsPathForensicState): string {
  return [
    row.PATH,
    row.PATH_PRESENT ? 1 : 0,
    row.NON_EMPTY ? 1 : 0,
    row.TARGET_LANGUAGE_ACCEPTED ? 1 : 0,
    row.INTEGRITY_ACCEPTED ? 1 : 0,
    row.MAPPED_TO_EXPECTED_PATH ? 1 : 0,
  ].join(":");
}

/**
 * Forensics-first durable encoding. Must stay well under sanitize slice limit.
 * Order: codes → brand paths → news paths → path inventories.
 */
export function formatProviderForensicsSafe(
  forensics: ProviderBoundaryForensics | undefined,
): string {
  if (!forensics) {
    return "";
  }
  const parts: string[] = [];
  if (forensics.PROVIDER_PARTIAL_SUBREASON) {
    parts.push(
      `PROVIDER_PARTIAL_SUBREASON=${forensics.PROVIDER_PARTIAL_SUBREASON}`,
    );
  }
  parts.push(`PROVIDER_RESPONSE_SHAPE=${forensics.PROVIDER_RESPONSE_SHAPE}`);

  const brandFail = forensics.BRAND_TOKEN_PATH_STATES.filter(
    (r) => r.TOKEN_STATE !== "PRESERVED",
  );
  if (brandFail.length > 0 || forensics.BRAND_TOKEN_PATH_STATES.length > 0) {
    const rows = (
      brandFail.length > 0 ? brandFail : forensics.BRAND_TOKEN_PATH_STATES
    ).slice(0, 12);
    parts.push(
      `BRAND_TOKEN_PATHS=${rows.map(formatBrandPathForensicCompact).join("|")}`,
    );
  }

  if (forensics.NEWS_PATH_STATES.length > 0) {
    parts.push(
      `PATH_STATES=${forensics.NEWS_PATH_STATES.map(formatNewsPathForensicCompact).join("|")}`,
    );
  }
  if (forensics.MISSING_MACHINE_PATHS.length > 0) {
    parts.push(
      `MISSING_MACHINE_PATHS=${forensics.MISSING_MACHINE_PATHS.slice(0, 24).join("|")}`,
    );
  }
  if (forensics.EXPECTED_MACHINE_PATHS.length > 0) {
    parts.push(
      `EXPECTED_MACHINE_PATHS=${forensics.EXPECTED_MACHINE_PATHS.slice(0, 24).join("|")}`,
    );
  }
  return parts.length > 0 ? parts.join(";") : "";
}

export function isProviderPartialSubtypeRetryable(
  subreason: ProviderPartialSubreason | null | undefined,
): boolean {
  if (!subreason) {
    return false;
  }
  switch (subreason) {
    case "MISSING_PATH":
    case "EMPTY_VALUE":
    case "WRONG_TARGET_LANGUAGE":
    case "PARSE_FAILURE":
      return true;
    case "PATH_MAPPING_FAILURE":
    case "CONTENT_INTEGRITY_FAILURE":
    case "OTHER_STRUCTURAL_FAILURE":
      return false;
    default:
      return false;
  }
}

/** Lookup a flat or lightly-nested string at an expected machine path. */
export function readParsedStringAtPath(
  parsed: unknown,
  path: string,
): string | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const direct = (parsed as Record<string, unknown>)[path];
  if (typeof direct === "string") {
    return direct;
  }
  return null;
}

export function emptyForensics(input: {
  readonly expectedPaths: readonly string[];
  readonly shape?: ProviderResponseShape;
}): ProviderBoundaryForensics {
  return {
    PROVIDER_RESPONSE_SHAPE: input.shape ?? "INVALID",
    BRAND_TOKEN_PATH_STATES: [],
    NEWS_PATH_STATES: [],
    PROVIDER_PARTIAL_SUBREASON: null,
    EXPECTED_MACHINE_PATHS: [...input.expectedPaths].sort(),
    RETURNED_MACHINE_PATHS: [],
    MISSING_MACHINE_PATHS: [...input.expectedPaths].sort(),
    UNEXPECTED_MACHINE_PATHS: [],
  };
}

void BRAND_SITE_NAME_MACHINE_SENTINEL;
void BRAND_SITE_NAME_MACHINE_SENTINEL_LEGACY;
