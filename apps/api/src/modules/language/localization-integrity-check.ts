/**
 * Localization Authority Closure 08 — bounded localization integrity check.
 *
 * Exactly one locale + explicit kind scope. Read-only. No provider / writes / enqueue.
 * Safe for 512 MB Render: does not hydrate the full corpus.
 */

import {
  LANGUAGE_ACTIVATION_CT_OWNED_KINDS,
  LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES,
  LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY,
  buildLocalizationIntegrityReport,
  emptyLanguageLocalizationCountBucket,
  type LanguageCode,
  type LocalizationIntegrityArtifactRow,
  type LocalizationIntegrityReport,
} from "@hu/types";

import { auditPublicLocalizationCorpus } from "./public-localization-corpus.js";
import type { StagingWarmSourceKind } from "./content-translation-staging-warm-operator-scope.js";
import {
  classifyMediaEditorialLocalizationForLocale,
  type MediaHuLocalizationIntegrityStatus,
} from "./media-hu-localization-integrity.js";
import { assessMediaCarouselPlpPresenceForLocale } from "./assess-media-carousel-plp-presence.js";
import { evaluateLanguageLocalizationReadiness } from "./language-localization-activation/language-localization-readiness-evaluator.js";
import { resolveLanguageRegistryLocale } from "./language-registry/index.js";

const CT_KIND_SET = new Set<string>(LANGUAGE_ACTIVATION_CT_OWNED_KINDS);
const PLP_KIND_SET = new Set<string>(LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES);
const HU_CAROUSEL_KINDS = new Set([
  "civic_media_principle",
  "civic_media_trusted",
  "civic_media_fact_check",
  "civic_media_propaganda",
  "public_news",
]);

function mapMediaStatus(
  status: MediaHuLocalizationIntegrityStatus,
): LocalizationIntegrityArtifactRow["state"] {
  switch (status) {
    case "CURRENT_PUBLISHED_COMPLETE":
      return "CURRENT";
    case "MISSING":
      return "MISSING";
    case "STALE":
      return "STALE";
    case "FAILED":
      return "FAILED";
    case "PENDING":
      return "PENDING";
    default:
      return "MISSING";
  }
}

function mapCtCounts(input: {
  readonly missing: number;
  readonly stale: number;
  readonly failed: number;
  readonly current: number;
  readonly workItemsRequired: number;
}): LocalizationIntegrityArtifactRow["state"] {
  if (input.failed > 0 && input.current === 0 && input.missing === 0 && input.stale === 0) {
    return "FAILED";
  }
  if (input.stale > 0) return "STALE";
  if (input.missing > 0 || input.workItemsRequired > 0) return "MISSING";
  return "CURRENT";
}

export type RunLocalizationIntegrityCheckInput = {
  readonly locale: string;
  /** Exactly one kind, or a small explicit list (never "all"). */
  readonly kinds: readonly string[];
  readonly pageSize?: number;
  readonly evaluateReadiness?: typeof evaluateLanguageLocalizationReadiness;
  readonly auditCorpus?: typeof auditPublicLocalizationCorpus;
  readonly classifyEditorial?: typeof classifyMediaEditorialLocalizationForLocale;
  readonly assessCarousel?: typeof assessMediaCarouselPlpPresenceForLocale;
};

/**
 * Bounded integrity diagnostic for one locale + scoped kinds.
 */
export async function runLocalizationIntegrityCheck(
  input: RunLocalizationIntegrityCheckInput,
): Promise<LocalizationIntegrityReport> {
  const locale = input.locale.trim();
  if (!locale) {
    throw new Error("locale is required");
  }
  if (locale.includes(",") || /\s/.test(locale)) {
    throw new Error("Check exactly one locale at a time.");
  }
  if (!input.kinds.length) {
    throw new Error("At least one --kind is required (bounded scope).");
  }
  if (input.kinds.some((kind) => kind === "all" || kind === "*")) {
    throw new Error("Refusing unbounded kind scope (all/*). Pass explicit kinds.");
  }

  const pageSize = Math.max(1, Math.min(input.pageSize ?? 50, 100));
  const evaluate = input.evaluateReadiness ?? evaluateLanguageLocalizationReadiness;
  const auditCorpus = input.auditCorpus ?? auditPublicLocalizationCorpus;
  const classifyEditorial =
    input.classifyEditorial ?? classifyMediaEditorialLocalizationForLocale;
  const assessCarousel =
    input.assessCarousel ?? assessMediaCarouselPlpPresenceForLocale;

  const record = await resolveLanguageRegistryLocale(locale);
  const ctKinds = input.kinds.filter((kind) => CT_KIND_SET.has(kind));
  const plpKinds = input.kinds.filter((kind) => PLP_KIND_SET.has(kind));
  const otherKinds = input.kinds.filter(
    (kind) => !CT_KIND_SET.has(kind) && !PLP_KIND_SET.has(kind),
  );

  const artifacts: LocalizationIntegrityArtifactRow[] = [];
  let ctBucket = emptyLanguageLocalizationCountBucket();
  let plpBucket = emptyLanguageLocalizationCountBucket();
  let corpusDiscoveryBlocked = false;

  for (const kind of ctKinds) {
    const audit = await auditCorpus({
      kinds: [kind as StagingWarmSourceKind],
      targetLocales: [locale as LanguageCode],
    });

    // Align with warm staging safety: silent empty / failed discovery is not
    // CURRENT and must not yield READY. Genuinely complete discovery with
    // zero work remains eligible for CURRENT/READY.
    const discovered =
      audit.discoveryByKind?.reduce(
        (sum, row) => sum + (row.sourceRecordsDiscovered ?? 0),
        0,
      ) ?? 0;
    const candidateCount = audit.candidates?.length ?? 0;
    const discoveryFailed =
      audit.discoveryStatus === "FAILED" ||
      (audit.discoveryStatus !== "COMPLETE" && candidateCount === 0) ||
      (discovered === 0 && candidateCount === 0 && audit.discoveryStatus !== "COMPLETE");

    // discoveryStatus COMPLETE with zero candidates means an empty eligible
    // public corpus for this kind (nothing to translate) — not a silent failure.
    const silentEmpty =
      audit.discoveryStatus === "FAILED" ||
      (candidateCount === 0 && discovered === 0 && audit.discoveryStatus !== "COMPLETE");

    if (silentEmpty || discoveryFailed) {
      corpusDiscoveryBlocked = true;
      artifacts.push({
        kindId: kind,
        ownership: "CT_OWNED",
        state: "NO_CORPUS",
        detail:
          `discoveryStatus=${audit.discoveryStatus} candidates=${candidateCount} ` +
          `sourceRecordsDiscovered=${discovered}` +
          (audit.discoveryHint ? ` hint=${audit.discoveryHint}` : ""),
      });
      continue;
    }

    const row = audit.byLocale.find((entry) => entry.targetLanguage === locale);
    const counts = {
      current: row?.CURRENT_TARGET_TRANSLATION_IDENTITIES ?? 0,
      missing: row?.MISSING_TARGET_TRANSLATION_IDENTITIES ?? 0,
      stale: row?.STALE_TARGET_TRANSLATION_IDENTITIES ?? 0,
      failed: row?.FAILED_TARGET_TRANSLATION_IDENTITIES ?? 0,
      pending: 0,
      workItemsRequired: row?.WORK_ITEMS_REQUIRED ?? 0,
    };
    const cappedWork = Math.min(counts.workItemsRequired, pageSize);
    ctBucket = {
      current: ctBucket.current + counts.current,
      missing: ctBucket.missing + counts.missing,
      stale: ctBucket.stale + counts.stale,
      failed: ctBucket.failed + counts.failed,
      pending: ctBucket.pending,
      workItemsRequired: ctBucket.workItemsRequired + counts.workItemsRequired,
    };
    artifacts.push({
      kindId: kind,
      ownership: "CT_OWNED",
      state: mapCtCounts(counts),
      detail:
        `current=${counts.current} missing=${counts.missing} stale=${counts.stale} ` +
        `failed=${counts.failed} work=${counts.workItemsRequired}` +
        (counts.workItemsRequired > pageSize
          ? ` (summary capped pageSize=${pageSize}, shownWork=${cappedWork})`
          : ""),
    });
  }

  for (const kind of plpKinds) {
    if (kind === "civic_media_editorial") {
      const status = await classifyEditorial(locale);
      const state = mapMediaStatus(status);
      if (state === "CURRENT") {
        plpBucket = { ...plpBucket, current: plpBucket.current + 1 };
      } else if (state === "STALE") {
        plpBucket = {
          ...plpBucket,
          stale: plpBucket.stale + 1,
          workItemsRequired: plpBucket.workItemsRequired + 1,
        };
      } else if (state === "FAILED") {
        plpBucket = {
          ...plpBucket,
          failed: plpBucket.failed + 1,
          workItemsRequired: plpBucket.workItemsRequired + 1,
        };
      } else if (state === "PENDING") {
        plpBucket = {
          ...plpBucket,
          pending: plpBucket.pending + 1,
          workItemsRequired: plpBucket.workItemsRequired + 1,
        };
      } else {
        plpBucket = {
          ...plpBucket,
          missing: plpBucket.missing + 1,
          workItemsRequired: plpBucket.workItemsRequired + 1,
        };
      }
      artifacts.push({
        kindId: kind,
        ownership: "PLP_OWNED",
        state,
        detail: `editorial status=${status}`,
      });
      continue;
    }

    if (!HU_CAROUSEL_KINDS.has(kind)) {
      artifacts.push({
        kindId: kind,
        ownership: "PLP_OWNED",
        state: "NO_OWNER",
        detail: "Unrecognized PLP kind in integrity scope",
      });
      continue;
    }

    const presence = await assessCarousel({
      locale,
      pageSize,
      entityType: kind,
    });
    const measured = presence.byKind[0]?.counts ?? emptyLanguageLocalizationCountBucket();
    plpBucket = {
      current: plpBucket.current + measured.current,
      missing: plpBucket.missing + measured.missing,
      stale: plpBucket.stale + measured.stale,
      failed: plpBucket.failed + measured.failed,
      pending: plpBucket.pending + measured.pending,
      workItemsRequired: plpBucket.workItemsRequired + measured.workItemsRequired,
    };
    artifacts.push({
      kindId: kind,
      ownership: "PLP_OWNED",
      state: measured.missing > 0 ? "MISSING" : "CURRENT",
      detail: `staticCatalog checked≤${pageSize} current=${measured.current} missing=${measured.missing}`,
    });
  }

  for (const kind of otherKinds) {
    if (LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.protectedExcluded.includes(kind as never)) {
      artifacts.push({
        kindId: kind,
        ownership: "PROTECTED_EXCLUDED",
        state: "PROTECTED",
        detail: "Excluded from machine translation",
      });
      continue;
    }
    if (LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.noOwner.includes(kind as never)) {
      artifacts.push({
        kindId: kind,
        ownership: "NO_TRANSLATION_OWNER",
        state: "NO_OWNER",
        detail:
          "Knowledge body: canonical/no owner. Chrome via WEB_UI. Does not block READY.",
      });
      continue;
    }
    if (
      LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.manualAuthor.includes(kind as never)
    ) {
      artifacts.push({
        kindId: kind,
        ownership: "MANUAL_AUTHOR",
        state: "CURRENT",
        detail: "No MANUAL_AUTHOR public kinds after Implementation 01 (Part D is CT-owned)",
      });
      continue;
    }
    if (kind === "web_ui" || kind === "web_ui_catalog") {
      artifacts.push({
        kindId: kind,
        ownership: "WEB_UI_CATALOG",
        state: "CURRENT",
        detail: "Assessed via WEB_UI catalog readiness slice",
      });
      continue;
    }
    artifacts.push({
      kindId: kind,
      ownership: "NO_TRANSLATION_OWNER",
      state: "NO_OWNER",
      detail: "Unknown/unsupported kind for this integrity scope",
    });
  }

  const readiness = await evaluate({
    locale,
    registryRecord: record,
    skipCorpusPlan: true,
    ctCounts: ctBucket,
    plpCounts: plpBucket,
  });

  return buildLocalizationIntegrityReport({
    readiness,
    kindScope: input.kinds,
    artifacts,
    controlledEnglishLeakCount: 0,
    canonicalFallbackTruthful: true,
    corpusDiscoveryBlocked,
  });
}
