/**
 * Staging warm — exact-record force rematerialization (no corpus discovery).
 *
 * `--source-record-id` + single `--kinds=` + `--locales=` + `--force-current`
 * rebuilds usable machine CURRENT translations for only those identities.
 * Human / author-approved rows remain protected.
 */

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";

import { getOrCreateContentTranslation, loadTranslatableSource } from "./content-translation.service.js";
import { assertCanonicalSourceEligibleForTranslation } from "./content-translation-eligibility.js";
import { auditContentTranslationMaterialization } from "./content-translation-staging-warm-repair.js";
import {
  StagingWarmCliValidationError,
  isWarmRecoveryKind,
  type StagingWarmSourceKind,
} from "./content-translation-staging-warm-operator-scope.js";
import { assertAutomaticContentTranslationTargetLocale } from "./content-translation-warm-targets.js";

export const STAGING_EXACT_FORCE_MAX_LOCALES = 10;

export type StagingExactForceLocaleAction =
  | "WOULD_FORCE_REBUILD"
  | "FORCE_REBUILT"
  | "PROTECTED_SKIPPED"
  | "INELIGIBLE_SKIPPED"
  | "FAILED";

export type StagingExactForceLocaleRow = {
  readonly targetLanguage: LanguageCode;
  readonly state: "CURRENT" | "MISSING" | "STALE" | "INELIGIBLE";
  readonly sourceVersion: string | null;
  readonly action: StagingExactForceLocaleAction;
  readonly error?: string;
};

export type StagingExactForceResult = {
  readonly mode: "dry-run" | "execute";
  readonly sourceKind: StagingWarmSourceKind;
  readonly sourceRecordId: string;
  readonly sourceVersion: string | null;
  readonly requestedLocales: readonly LanguageCode[];
  readonly locales: readonly StagingExactForceLocaleRow[];
  readonly broadDiscoveryBypassed: true;
  readonly providerCalls: number;
  readonly writes: number;
};

export type StagingExactForceCliOptions = {
  readonly sourceRecordId: string;
  readonly sourceKind: StagingWarmSourceKind;
  readonly locales: readonly string[];
  readonly forceCurrent: true;
};

function parseEqualsFlag(argv: readonly string[], prefix: string): string | undefined {
  const match = argv.find((entry) => entry.startsWith(prefix));
  if (!match) {
    return undefined;
  }
  return match.slice(prefix.length);
}

/**
 * Parse exact-force CLI flags. Returns null when `--source-record-id` is absent
 * (normal warm/repair modes).
 */
export function parseStagingWarmExactForceFromArgv(
  argv: readonly string[] = process.argv,
  kinds: readonly StagingWarmSourceKind[] | undefined = undefined,
): StagingExactForceCliOptions | null {
  const sourceRecordIdRaw = parseEqualsFlag(argv, "--source-record-id=");
  const forceCurrent = argv.includes("--force-current");
  const localesRaw = parseEqualsFlag(argv, "--locales=");

  if (sourceRecordIdRaw === undefined && !forceCurrent && localesRaw === undefined) {
    return null;
  }

  if (forceCurrent && sourceRecordIdRaw === undefined) {
    throw new StagingWarmCliValidationError(
      "--force-current requires --source-record-id=<id>.",
    );
  }

  if (sourceRecordIdRaw === undefined) {
    throw new StagingWarmCliValidationError(
      "--locales= requires --source-record-id= (exact-record mode).",
    );
  }

  const sourceRecordId = sourceRecordIdRaw.trim();
  if (!sourceRecordId) {
    throw new StagingWarmCliValidationError(
      "Invalid --source-record-id=: value must be non-empty.",
    );
  }

  if (!forceCurrent) {
    throw new StagingWarmCliValidationError(
      "--source-record-id requires --force-current for exact-record rematerialization.",
    );
  }

  if (argv.includes("--repair")) {
    throw new StagingWarmCliValidationError(
      "Exact-record --force-current cannot be combined with --repair.",
    );
  }

  if (!kinds || kinds.length === 0) {
    throw new StagingWarmCliValidationError(
      "--force-current requires exactly one --kinds= value.",
    );
  }
  if (kinds.length !== 1) {
    throw new StagingWarmCliValidationError(
      "--force-current requires exactly one --kinds= value (got multiple).",
    );
  }
  const sourceKind = kinds[0]!;
  if (!isWarmRecoveryKind(sourceKind)) {
    throw new StagingWarmCliValidationError(
      `Unsupported --kinds value for exact-record force: ${sourceKind}.`,
    );
  }

  if (localesRaw === undefined) {
    throw new StagingWarmCliValidationError(
      "--force-current requires explicit --locales=a,b (no Registry expansion).",
    );
  }
  const localeTokens = localesRaw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (localeTokens.length === 0) {
    throw new StagingWarmCliValidationError(
      "Invalid --locales=: provide at least one locale.",
    );
  }
  if (localeTokens.length > STAGING_EXACT_FORCE_MAX_LOCALES) {
    throw new StagingWarmCliValidationError(
      `--locales= accepts at most ${STAGING_EXACT_FORCE_MAX_LOCALES} locales (got ${localeTokens.length}).`,
    );
  }

  return {
    sourceRecordId,
    sourceKind,
    locales: localeTokens,
    forceCurrent: true,
  };
}

/**
 * Exact-record hydrate: only the store needed to load that kind — never Initiative walk.
 */
export function resolveExactRecordHydrateScopes(sourceKind: StagingWarmSourceKind): {
  readonly initiative: boolean;
  readonly collaborativeAnalysis: boolean;
  readonly collectiveDecision: boolean;
} {
  return {
    initiative: sourceKind === "initiative",
    collaborativeAnalysis: sourceKind === "collaborative_analysis",
    collectiveDecision: sourceKind === "collective_decision",
  };
}

export async function resolveExactForceTargetLocales(
  rawLocales: readonly string[],
): Promise<readonly LanguageCode[]> {
  const resolved: LanguageCode[] = [];
  const seen = new Set<string>();
  for (const raw of rawLocales) {
    const locale = await assertAutomaticContentTranslationTargetLocale(raw);
    if (seen.has(locale)) {
      continue;
    }
    seen.add(locale);
    resolved.push(locale);
  }
  return resolved;
}

function isProtectedTranslationKind(
  translationKind: string | null | undefined,
): boolean {
  return translationKind === "human" || translationKind === "author-approved";
}

/**
 * Dry-run or execute exact-record force rematerialization.
 * Dry-run: zero provider calls / zero writes.
 * Execute: serial getOrCreate with forceRegenerate (provider concurrency 1 via worker slot).
 */
export async function runStagingExactRecordForceCurrent(input: {
  readonly execute: boolean;
  readonly sourceKind: StagingWarmSourceKind;
  readonly sourceRecordId: string;
  readonly locales: readonly string[];
  readonly deps?: {
    readonly loadSource?: typeof loadTranslatableSource;
    readonly auditLocale?: typeof auditContentTranslationMaterialization;
    readonly materialize?: typeof getOrCreateContentTranslation;
    readonly resolveLocales?: typeof resolveExactForceTargetLocales;
  };
}): Promise<StagingExactForceResult> {
  const resolveLocales = input.deps?.resolveLocales ?? resolveExactForceTargetLocales;
  const loadSource = input.deps?.loadSource ?? loadTranslatableSource;
  const auditLocale = input.deps?.auditLocale ?? auditContentTranslationMaterialization;
  const materialize = input.deps?.materialize ?? getOrCreateContentTranslation;

  const requestedLocales = await resolveLocales(input.locales);
  const source = await loadSource({
    sourceKind: input.sourceKind as ContentTranslationSourceKind,
    sourceRecordId: input.sourceRecordId,
  });

  if (!source) {
    throw new StagingWarmCliValidationError(
      `Exact source record not found: ${input.sourceKind} / ${input.sourceRecordId}. Broad discovery was not used.`,
    );
  }

  try {
    assertCanonicalSourceEligibleForTranslation({
      source: {
        sourceKind: source.sourceKind,
        sourceRecordId: source.sourceRecordId,
        sourceLanguage: source.sourceLanguage,
        fields: source.fields,
        sourceVersion: source.sourceVersion,
        isPublished: source.isPublished,
        safetyCleared: true,
      },
      intent: "automatic_warm",
    });
  } catch (error) {
    throw new StagingWarmCliValidationError(
      `Exact source record ineligible for automatic translation: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const localeRows: StagingExactForceLocaleRow[] = [];
  let providerCalls = 0;
  let writes = 0;

  const normalizeAuditState = (
    state: string,
  ): StagingExactForceLocaleRow["state"] => {
    if (
      state === "CURRENT" ||
      state === "MISSING" ||
      state === "STALE" ||
      state === "INELIGIBLE"
    ) {
      return state;
    }
    return "INELIGIBLE";
  };

  for (const targetLanguage of requestedLocales) {
    const audited = await auditLocale({
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
      targetLanguage,
    });
    const state = normalizeAuditState(audited.state);

    if (state === "INELIGIBLE") {
      localeRows.push({
        targetLanguage,
        state: "INELIGIBLE",
        sourceVersion: audited.sourceVersion,
        action: "INELIGIBLE_SKIPPED",
      });
      continue;
    }

    if (!input.execute) {
      localeRows.push({
        targetLanguage,
        state,
        sourceVersion: audited.sourceVersion,
        action: "WOULD_FORCE_REBUILD",
      });
      continue;
    }

    try {
      const result = await materialize({
        sourceKind: input.sourceKind,
        sourceRecordId: input.sourceRecordId,
        targetLanguage,
        generateIfMissing: true,
        intent: "automatic_warm",
        forceRegenerate: true,
      });

      if (
        result.translation &&
        isProtectedTranslationKind(result.translation.translationKind) &&
        !result.generated
      ) {
        localeRows.push({
          targetLanguage,
          state,
          sourceVersion: audited.sourceVersion,
          action: "PROTECTED_SKIPPED",
        });
        continue;
      }

      if (result.generated) {
        providerCalls += 1;
        writes += 1;
        localeRows.push({
          targetLanguage,
          state: "CURRENT",
          sourceVersion: result.source.sourceVersion,
          action: "FORCE_REBUILT",
        });
      } else {
        localeRows.push({
          targetLanguage,
          state,
          sourceVersion: audited.sourceVersion,
          action: "PROTECTED_SKIPPED",
        });
      }
    } catch (error) {
      localeRows.push({
        targetLanguage,
        state,
        sourceVersion: audited.sourceVersion,
        action: "FAILED",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    mode: input.execute ? "execute" : "dry-run",
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
    sourceVersion: source.sourceVersion,
    requestedLocales,
    locales: localeRows,
    broadDiscoveryBypassed: true,
    providerCalls: input.execute ? providerCalls : 0,
    writes: input.execute ? writes : 0,
  };
}
