/**
 * Pack 08K.1 — shared real-corpus PublicLocalizedPresentation discovery + coverage.
 *
 * Architectural invariant:
 *   DIAGNOSTIC_DISCOVERY === RECONCILIATION_DISCOVERY
 *
 * Counter semantics (normative — do not silently redefine):
 * - SOURCE_PRESENTATION_COUNT: discovered public presentation identities
 *   (sourceKind + sourceRecordId). Formerly IDENTITY_COUNT.
 * - TARGET_TRANSLATION_IDENTITIES: SOURCE_PRESENTATION_COUNT × enabled
 *   content-translation locales.
 * - MISSING_TARGET_TRANSLATION_IDENTITIES: presentation × target-locale slots
 *   lacking a CURRENT (non-stale) translation for the live sourceVersion.
 *   Formerly MISSING_TRANSLATION_IDENTITIES.
 * - PRESENTATIONS_WITH_ANY_FALLBACK: source presentations with ≥1 canonical
 *   fallback semantic node across inspected locales.
 *
 * Node totals (TOTAL_SEMANTIC_NODES / CURRENT_LOCALIZED_NODES /
 * CANONICAL_FALLBACK_NODES) count auto-translatable nodes × target locales.
 */

import {
  PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  type ContentTranslationSourceKind,
  type LanguageCode,
  type PublicPresentationIdentity,
  type PublicPresentationNode,
  type TranslatedContentRecord,
} from "@hu/types";

import {
  CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS,
  discoverStagingInitiativePathWarmSources,
  type StagingWarmCandidate,
  type StagingWarmDiscoveryDeps,
  type StagingWarmDiscoveryKindCounts,
  type StagingWarmSourceKind,
} from "./content-translation-staging-warm-backfill.js";
import { loadTranslatableSource } from "./content-translation.service.js";
import { listAutomaticContentTranslationTargetLocales } from "./content-translation-warm-targets.js";
import { listContentTranslationsForSource } from "./persistence/content-translation.repository.js";
import {
  collectAutoTranslatableNodes,
  fingerprintPublicPresentation,
} from "./public-localized-presentation.js";
import { resolveContentTranslationWarmOutboxDisposition } from "./content-translation-warm-enqueue.js";

export type PublicLocalizationDiscoveryStatus = "COMPLETE" | "PARTIAL" | "FAILED";

export type PublicLocalizationTargetTranslationState =
  | "CURRENT"
  | "MISSING"
  | "MISSING_AFTER_DISPATCH"
  | "STALE"
  | "FAILED"
  | "QUEUED"
  | "PROCESSING"
  | "RETRYING"
  | "PENDING"
  | "MANUAL_PRESERVED";

export interface PublicLocalizationCorpusFamilyCounts {
  readonly family: string;
  readonly SOURCE_PRESENTATION_COUNT: number;
  readonly PRESENTATIONS_WITH_ANY_FALLBACK: number;
  readonly TOTAL_SEMANTIC_NODES: number;
  readonly CURRENT_LOCALIZED_NODES: number;
  readonly CANONICAL_FALLBACK_NODES: number;
  readonly PROTECTED_NODES: number;
  readonly MISSING_TARGET_TRANSLATION_IDENTITIES: number;
  readonly STALE_TARGET_TRANSLATION_IDENTITIES: number;
  readonly FAILED_TARGET_TRANSLATION_IDENTITIES: number;
  readonly WORK_ITEMS_REQUIRED: number;
  /** @deprecated Pack 08K.1 alias of SOURCE_PRESENTATION_COUNT */
  readonly IDENTITY_COUNT: number;
  /** @deprecated Pack 08K.1 alias of MISSING_TARGET_TRANSLATION_IDENTITIES */
  readonly MISSING_TRANSLATION_IDENTITIES: number;
}

export interface PublicLocalizationCorpusTotals
  extends Omit<PublicLocalizationCorpusFamilyCounts, "family"> {
  readonly TARGET_TRANSLATION_IDENTITIES: number;
}

export interface PublicLocalizationWorkItem {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly sourceVersion: string;
  readonly targetLanguage: LanguageCode;
  readonly state: PublicLocalizationTargetTranslationState;
  readonly autoNodeCount: number;
  readonly missingOrStaleNodeCount: number;
  readonly fallbackPaths: readonly string[];
}

export interface PublicLocalizationCorpusAudit {
  readonly discoveryStatus: PublicLocalizationDiscoveryStatus;
  readonly discoveryHint: string | null;
  readonly discoveryByKind: readonly StagingWarmDiscoveryKindCounts[];
  readonly targetLocales: readonly LanguageCode[];
  readonly schemaVersion: string;
  readonly byFamily: readonly PublicLocalizationCorpusFamilyCounts[];
  readonly byLocale: readonly {
    readonly targetLanguage: LanguageCode;
    readonly MISSING_TARGET_TRANSLATION_IDENTITIES: number;
    readonly STALE_TARGET_TRANSLATION_IDENTITIES: number;
    readonly FAILED_TARGET_TRANSLATION_IDENTITIES: number;
    readonly CURRENT_TARGET_TRANSLATION_IDENTITIES: number;
    readonly WORK_ITEMS_REQUIRED: number;
  }[];
  readonly totals: PublicLocalizationCorpusTotals;
  readonly workItems: readonly PublicLocalizationWorkItem[];
  readonly candidates: readonly StagingWarmCandidate[];
}

function emptyFamily(family: string): PublicLocalizationCorpusFamilyCounts {
  return {
    family,
    SOURCE_PRESENTATION_COUNT: 0,
    PRESENTATIONS_WITH_ANY_FALLBACK: 0,
    TOTAL_SEMANTIC_NODES: 0,
    CURRENT_LOCALIZED_NODES: 0,
    CANONICAL_FALLBACK_NODES: 0,
    PROTECTED_NODES: 0,
    MISSING_TARGET_TRANSLATION_IDENTITIES: 0,
    STALE_TARGET_TRANSLATION_IDENTITIES: 0,
    FAILED_TARGET_TRANSLATION_IDENTITIES: 0,
    WORK_ITEMS_REQUIRED: 0,
    IDENTITY_COUNT: 0,
    MISSING_TRANSLATION_IDENTITIES: 0,
  };
}

function withAliases(
  row: Omit<
    PublicLocalizationCorpusFamilyCounts,
    "IDENTITY_COUNT" | "MISSING_TRANSLATION_IDENTITIES"
  >,
): PublicLocalizationCorpusFamilyCounts {
  return {
    ...row,
    IDENTITY_COUNT: row.SOURCE_PRESENTATION_COUNT,
    MISSING_TRANSLATION_IDENTITIES: row.MISSING_TARGET_TRANSLATION_IDENTITIES,
  };
}

export function fieldsAsPublicPresentation(
  fields: Record<string, string>,
): PublicPresentationNode {
  return { ...fields };
}

export function translatedFieldsFromRecord(
  translatedContent: Record<string, unknown> | string,
): Record<string, string> {
  if (typeof translatedContent === "string") {
    return { text: translatedContent };
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(translatedContent)) {
    if (typeof value === "string" && value.trim()) {
      out[key] = value;
    }
  }
  return out;
}

export function countLocalizedAutoNodes(
  autoNodes: readonly { path: string; value: string }[],
  translatedFields: Record<string, string>,
): { localized: number; fallback: number; fallbackPaths: string[] } {
  let localized = 0;
  let fallback = 0;
  const fallbackPaths: string[] = [];
  for (const node of autoNodes) {
    const leaf = node.path.split(".").pop() ?? node.path;
    if (
      (typeof translatedFields[node.path] === "string" &&
        translatedFields[node.path]!.trim()) ||
      (typeof translatedFields[leaf] === "string" && translatedFields[leaf]!.trim())
    ) {
      localized += 1;
    } else {
      fallback += 1;
      fallbackPaths.push(node.path);
    }
  }
  return { localized, fallback, fallbackPaths };
}

export function buildPublicPresentationIdentity(input: {
  readonly sourceKind: string;
  readonly sourceRecordId: string;
}): PublicPresentationIdentity {
  return {
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
    presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  };
}

function isAuthoritativeManualTranslation(row: TranslatedContentRecord): boolean {
  return row.translationKind === "human" || row.translationKind === "author-approved";
}

/**
 * Pure presentation × locale coverage planner (no I/O).
 * Recursive auto-translatable paths — no field allowlists.
 */
export function planPresentationLocaleCoverage(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly sourceLanguage: LanguageCode;
  readonly sourceVersion: string;
  readonly presentation: PublicPresentationNode;
  readonly targetLanguage: LanguageCode;
  readonly translationRows: readonly TranslatedContentRecord[];
  readonly outboxDisposition?: "pending" | "failed" | "none" | "published";
}): {
  readonly localizedNodes: number;
  readonly fallbackNodes: number;
  readonly protectedNodes: number;
  readonly state: PublicLocalizationTargetTranslationState;
  readonly workItem: PublicLocalizationWorkItem | null;
  readonly fallbackPaths: readonly string[];
} {
  const autoNodes = collectAutoTranslatableNodes(input.presentation);
  const protectedNodes = 0;

  if (input.targetLanguage === input.sourceLanguage) {
    return {
      localizedNodes: autoNodes.length,
      fallbackNodes: 0,
      protectedNodes,
      state: "CURRENT",
      workItem: null,
      fallbackPaths: [],
    };
  }

  const matching = input.translationRows.filter(
    (row) => row.targetLanguage === input.targetLanguage,
  );
  const current = matching.find(
    (row) =>
      row.sourceVersion === input.sourceVersion &&
      row.freshness === "current" &&
      row.stale !== true,
  );
  const stale = matching.find(
    (row) =>
      row.stale === true ||
      row.freshness === "stale" ||
      (row.sourceVersion !== input.sourceVersion && row.freshness === "current"),
  );

  if (current && isAuthoritativeManualTranslation(current)) {
    const translatedFields = translatedFieldsFromRecord(current.translatedContent);
    const counted = countLocalizedAutoNodes(autoNodes, translatedFields);
    return {
      localizedNodes: counted.localized,
      fallbackNodes: counted.fallback,
      protectedNodes,
      state: "MANUAL_PRESERVED",
      workItem: null,
      fallbackPaths: counted.fallbackPaths,
    };
  }

  if (current) {
    const translatedFields = translatedFieldsFromRecord(current.translatedContent);
    const counted = countLocalizedAutoNodes(autoNodes, translatedFields);
    if (counted.fallback === 0) {
      return {
        localizedNodes: counted.localized,
        fallbackNodes: 0,
        protectedNodes,
        state: "CURRENT",
        workItem: null,
        fallbackPaths: [],
      };
    }
    return {
      localizedNodes: counted.localized,
      fallbackNodes: counted.fallback,
      protectedNodes,
      state: "STALE",
      workItem: {
        sourceKind: input.sourceKind,
        sourceRecordId: input.sourceRecordId,
        sourceVersion: input.sourceVersion,
        targetLanguage: input.targetLanguage,
        state: "STALE",
        autoNodeCount: autoNodes.length,
        missingOrStaleNodeCount: counted.fallback,
        fallbackPaths: counted.fallbackPaths,
      },
      fallbackPaths: counted.fallbackPaths,
    };
  }

  let state: PublicLocalizationTargetTranslationState = "MISSING";
  if (input.outboxDisposition === "failed") {
    state = "FAILED";
  } else if (input.outboxDisposition === "pending") {
    state = "QUEUED";
  } else if (input.outboxDisposition === "published") {
    // Pack 08K.2 — outbox consumed/acked but no CURRENT row.
    state = "MISSING_AFTER_DISPATCH";
  } else if (stale) {
    state = "STALE";
  }

  return {
    localizedNodes: 0,
    fallbackNodes: autoNodes.length,
    protectedNodes,
    state,
    workItem: {
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
      sourceVersion: input.sourceVersion,
      targetLanguage: input.targetLanguage,
      state,
      autoNodeCount: autoNodes.length,
      missingOrStaleNodeCount: autoNodes.length,
      fallbackPaths: autoNodes.map((n) => n.path),
    },
    fallbackPaths: autoNodes.map((n) => n.path),
  };
}

/**
 * Discover the same public presentation corpus used by diagnose + reconcile.
 */
export async function discoverPublicLocalizationCorpus(input?: {
  readonly kinds?: readonly StagingWarmSourceKind[];
  readonly deps?: StagingWarmDiscoveryDeps;
}): Promise<{
  readonly candidates: readonly StagingWarmCandidate[];
  readonly discoveryByKind: readonly StagingWarmDiscoveryKindCounts[];
  readonly discoveryHint: string | null;
  readonly discoveryStatus: PublicLocalizationDiscoveryStatus;
}> {
  const kinds = input?.kinds?.length
    ? input.kinds
    : [...CONTENT_TRANSLATION_RECOVERY_SOURCE_KINDS];

  const discovered = await discoverStagingInitiativePathWarmSources({
    kinds,
    deps: input?.deps,
  });

  const discoveryByKind = [...discovered.discoveryByKind.values()].sort((a, b) =>
    a.sourceKind.localeCompare(b.sourceKind),
  );

  const sourceRecordsDiscovered = discoveryByKind.reduce(
    (sum, row) => sum + row.sourceRecordsDiscovered,
    0,
  );
  const publicRecords = discoveryByKind.reduce((sum, row) => sum + row.publicRecords, 0);

  let discoveryStatus: PublicLocalizationDiscoveryStatus = "COMPLETE";
  if (sourceRecordsDiscovered === 0 && publicRecords === 0) {
    discoveryStatus = "FAILED";
  } else if (
    discovered.discoveryHint ||
    discovered.candidates.length === 0 ||
    discoveryByKind.some(
      (row) => row.sourceRecordsDiscovered > 0 && row.publicRecords === 0,
    )
  ) {
    discoveryStatus = discovered.candidates.length === 0 ? "FAILED" : "PARTIAL";
  }

  return {
    candidates: discovered.candidates,
    discoveryByKind,
    discoveryHint: discovered.discoveryHint,
    discoveryStatus,
  };
}

/**
 * Audit coverage for the shared corpus. Read-only — no provider / outbox writes.
 */
export async function auditPublicLocalizationCorpus(input?: {
  readonly kinds?: readonly StagingWarmSourceKind[];
  readonly deps?: StagingWarmDiscoveryDeps;
  readonly targetLocales?: readonly LanguageCode[];
  readonly discovery?: Awaited<ReturnType<typeof discoverPublicLocalizationCorpus>>;
}): Promise<PublicLocalizationCorpusAudit> {
  const discovery =
    input?.discovery ??
    (await discoverPublicLocalizationCorpus({
      kinds: input?.kinds,
      deps: input?.deps,
    }));

  let targetLocales: readonly LanguageCode[] = input?.targetLocales?.length
    ? input.targetLocales
    : [];
  if (targetLocales.length === 0) {
    try {
      targetLocales = await listAutomaticContentTranslationTargetLocales();
    } catch {
      targetLocales = [];
    }
  }
  if (targetLocales.length === 0) {
    targetLocales = ["uk", "zh-Hant", "ar"] as LanguageCode[];
  }

  const byFamilyMap = new Map<string, PublicLocalizationCorpusFamilyCounts>();
  const byLocaleMap = new Map<
    LanguageCode,
    {
      MISSING_TARGET_TRANSLATION_IDENTITIES: number;
      STALE_TARGET_TRANSLATION_IDENTITIES: number;
      FAILED_TARGET_TRANSLATION_IDENTITIES: number;
      CURRENT_TARGET_TRANSLATION_IDENTITIES: number;
      WORK_ITEMS_REQUIRED: number;
    }
  >();
  for (const locale of targetLocales) {
    byLocaleMap.set(locale, {
      MISSING_TARGET_TRANSLATION_IDENTITIES: 0,
      STALE_TARGET_TRANSLATION_IDENTITIES: 0,
      FAILED_TARGET_TRANSLATION_IDENTITIES: 0,
      CURRENT_TARGET_TRANSLATION_IDENTITIES: 0,
      WORK_ITEMS_REQUIRED: 0,
    });
  }

  const workItems: PublicLocalizationWorkItem[] = [];

  for (const candidate of discovery.candidates) {
    const family = candidate.sourceKind;
    const source = await loadTranslatableSource({
      sourceKind: candidate.sourceKind,
      sourceRecordId: candidate.sourceRecordId,
    });

    const prev = byFamilyMap.get(family) ?? emptyFamily(family);

    if (!source) {
      byFamilyMap.set(
        family,
        withAliases({
          family,
          SOURCE_PRESENTATION_COUNT: prev.SOURCE_PRESENTATION_COUNT + 1,
          PRESENTATIONS_WITH_ANY_FALLBACK: prev.PRESENTATIONS_WITH_ANY_FALLBACK + 1,
          TOTAL_SEMANTIC_NODES: prev.TOTAL_SEMANTIC_NODES,
          CURRENT_LOCALIZED_NODES: prev.CURRENT_LOCALIZED_NODES,
          CANONICAL_FALLBACK_NODES: prev.CANONICAL_FALLBACK_NODES,
          PROTECTED_NODES: prev.PROTECTED_NODES,
          MISSING_TARGET_TRANSLATION_IDENTITIES:
            prev.MISSING_TARGET_TRANSLATION_IDENTITIES + targetLocales.length,
          STALE_TARGET_TRANSLATION_IDENTITIES: prev.STALE_TARGET_TRANSLATION_IDENTITIES,
          FAILED_TARGET_TRANSLATION_IDENTITIES: prev.FAILED_TARGET_TRANSLATION_IDENTITIES,
          WORK_ITEMS_REQUIRED: prev.WORK_ITEMS_REQUIRED + targetLocales.length,
        }),
      );
      for (const locale of targetLocales) {
        const localeRow = byLocaleMap.get(locale)!;
        localeRow.MISSING_TARGET_TRANSLATION_IDENTITIES += 1;
        localeRow.WORK_ITEMS_REQUIRED += 1;
        workItems.push({
          sourceKind: candidate.sourceKind,
          sourceRecordId: candidate.sourceRecordId,
          sourceVersion: "unloaded",
          targetLanguage: locale,
          state: "MISSING",
          autoNodeCount: 0,
          missingOrStaleNodeCount: 0,
          fallbackPaths: [],
        });
      }
      continue;
    }

    const presentation = fieldsAsPublicPresentation(source.fields);
    const autoNodes = collectAutoTranslatableNodes(presentation);
    const sourceVersion =
      source.sourceVersion || fingerprintPublicPresentation(presentation);

    const rows = await listContentTranslationsForSource({
      sourceKind: candidate.sourceKind,
      sourceRecordId: candidate.sourceRecordId,
    });

    const outboxDisposition = await resolveContentTranslationWarmOutboxDisposition({
      sourceKind: candidate.sourceKind,
      sourceRecordId: candidate.sourceRecordId,
    });

    let localizedNodes = 0;
    let fallbackNodes = 0;
    let missingTargets = 0;
    let staleTargets = 0;
    let failedTargets = 0;
    let workRequired = 0;
    let presentationHasFallback = false;

    for (const locale of targetLocales) {
      const planned = planPresentationLocaleCoverage({
        sourceKind: candidate.sourceKind,
        sourceRecordId: candidate.sourceRecordId,
        sourceLanguage: source.sourceLanguage,
        sourceVersion,
        presentation,
        targetLanguage: locale,
        translationRows: rows,
        outboxDisposition,
      });

      localizedNodes += planned.localizedNodes;
      fallbackNodes += planned.fallbackNodes;
      if (planned.fallbackNodes > 0) {
        presentationHasFallback = true;
      }

      const localeRow = byLocaleMap.get(locale)!;

      if (planned.workItem) {
        workRequired += 1;
        localeRow.WORK_ITEMS_REQUIRED += 1;
        workItems.push(planned.workItem);

        if (planned.state === "STALE") {
          staleTargets += 1;
          localeRow.STALE_TARGET_TRANSLATION_IDENTITIES += 1;
        } else if (planned.state === "FAILED") {
          failedTargets += 1;
          localeRow.FAILED_TARGET_TRANSLATION_IDENTITIES += 1;
        } else {
          missingTargets += 1;
          localeRow.MISSING_TARGET_TRANSLATION_IDENTITIES += 1;
        }
      } else {
        localeRow.CURRENT_TARGET_TRANSLATION_IDENTITIES += 1;
      }
    }

    byFamilyMap.set(
      family,
      withAliases({
        family,
        SOURCE_PRESENTATION_COUNT: prev.SOURCE_PRESENTATION_COUNT + 1,
        PRESENTATIONS_WITH_ANY_FALLBACK:
          prev.PRESENTATIONS_WITH_ANY_FALLBACK + (presentationHasFallback ? 1 : 0),
        TOTAL_SEMANTIC_NODES:
          prev.TOTAL_SEMANTIC_NODES + autoNodes.length * targetLocales.length,
        CURRENT_LOCALIZED_NODES: prev.CURRENT_LOCALIZED_NODES + localizedNodes,
        CANONICAL_FALLBACK_NODES: prev.CANONICAL_FALLBACK_NODES + fallbackNodes,
        PROTECTED_NODES: prev.PROTECTED_NODES,
        MISSING_TARGET_TRANSLATION_IDENTITIES:
          prev.MISSING_TARGET_TRANSLATION_IDENTITIES + missingTargets,
        STALE_TARGET_TRANSLATION_IDENTITIES:
          prev.STALE_TARGET_TRANSLATION_IDENTITIES + staleTargets,
        FAILED_TARGET_TRANSLATION_IDENTITIES:
          prev.FAILED_TARGET_TRANSLATION_IDENTITIES + failedTargets,
        WORK_ITEMS_REQUIRED: prev.WORK_ITEMS_REQUIRED + workRequired,
      }),
    );
  }

  const byFamily = [...byFamilyMap.values()].sort((a, b) => a.family.localeCompare(b.family));
  const byLocale = targetLocales.map((targetLanguage) => ({
    targetLanguage,
    ...byLocaleMap.get(targetLanguage)!,
  }));

  const totalsBase = byFamily.reduce(
    (acc, row) => ({
      SOURCE_PRESENTATION_COUNT:
        acc.SOURCE_PRESENTATION_COUNT + row.SOURCE_PRESENTATION_COUNT,
      PRESENTATIONS_WITH_ANY_FALLBACK:
        acc.PRESENTATIONS_WITH_ANY_FALLBACK + row.PRESENTATIONS_WITH_ANY_FALLBACK,
      TOTAL_SEMANTIC_NODES: acc.TOTAL_SEMANTIC_NODES + row.TOTAL_SEMANTIC_NODES,
      CURRENT_LOCALIZED_NODES: acc.CURRENT_LOCALIZED_NODES + row.CURRENT_LOCALIZED_NODES,
      CANONICAL_FALLBACK_NODES: acc.CANONICAL_FALLBACK_NODES + row.CANONICAL_FALLBACK_NODES,
      PROTECTED_NODES: acc.PROTECTED_NODES + row.PROTECTED_NODES,
      MISSING_TARGET_TRANSLATION_IDENTITIES:
        acc.MISSING_TARGET_TRANSLATION_IDENTITIES +
        row.MISSING_TARGET_TRANSLATION_IDENTITIES,
      STALE_TARGET_TRANSLATION_IDENTITIES:
        acc.STALE_TARGET_TRANSLATION_IDENTITIES + row.STALE_TARGET_TRANSLATION_IDENTITIES,
      FAILED_TARGET_TRANSLATION_IDENTITIES:
        acc.FAILED_TARGET_TRANSLATION_IDENTITIES +
        row.FAILED_TARGET_TRANSLATION_IDENTITIES,
      WORK_ITEMS_REQUIRED: acc.WORK_ITEMS_REQUIRED + row.WORK_ITEMS_REQUIRED,
    }),
    {
      SOURCE_PRESENTATION_COUNT: 0,
      PRESENTATIONS_WITH_ANY_FALLBACK: 0,
      TOTAL_SEMANTIC_NODES: 0,
      CURRENT_LOCALIZED_NODES: 0,
      CANONICAL_FALLBACK_NODES: 0,
      PROTECTED_NODES: 0,
      MISSING_TARGET_TRANSLATION_IDENTITIES: 0,
      STALE_TARGET_TRANSLATION_IDENTITIES: 0,
      FAILED_TARGET_TRANSLATION_IDENTITIES: 0,
      WORK_ITEMS_REQUIRED: 0,
    },
  );

  const totals: PublicLocalizationCorpusTotals = {
    ...withAliases({ family: "*", ...totalsBase }),
    TARGET_TRANSLATION_IDENTITIES:
      totalsBase.SOURCE_PRESENTATION_COUNT * targetLocales.length,
  };

  return {
    discoveryStatus: discovery.discoveryStatus,
    discoveryHint: discovery.discoveryHint,
    discoveryByKind: discovery.discoveryByKind,
    targetLocales,
    schemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
    byFamily,
    byLocale,
    totals,
    workItems,
    candidates: discovery.candidates,
  };
}

/** Unique source presentations that require at least one locale work item. */
export function uniquePresentationsRequiringWork(
  workItems: readonly PublicLocalizationWorkItem[],
): readonly StagingWarmCandidate[] {
  const seen = new Set<string>();
  const out: StagingWarmCandidate[] = [];
  for (const item of workItems) {
    if (item.state !== "MISSING" && item.state !== "STALE" && item.state !== "FAILED" && item.state !== "MISSING_AFTER_DISPATCH") {
      continue;
    }
    const key = `${item.sourceKind}::${item.sourceRecordId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push({
      sourceKind: item.sourceKind as StagingWarmSourceKind,
      sourceRecordId: item.sourceRecordId,
    });
  }
  return out;
}
