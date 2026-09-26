/**
 * Closure 07 — language localization readiness evaluator.
 * Provider-free, write-free, Registry-driven.
 *
 * Pack 02: corpus counts come from bounded PWA civic coverage (no full hydrate).
 * PWA civic readiness is a distinct slice that does not require WEB_UI / CV /
 * Brand / Legal completeness.
 */

import {
  LANGUAGE_ACTIVATION_CT_OWNED_KINDS,
  LANGUAGE_ACTIVATION_NO_OWNER_KIND_IDS,
  LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS,
  LANGUAGE_ACTIVATION_PLP_OWNED_PARTICIPANT_ENTITY_TYPES,
  buildLanguagePwaCivicReadinessSlice,
  deriveLanguageLocalizationReadinessState,
  emptyLanguageLocalizationCountBucket,
  emptyPwaCivicCoverageScalars,
  isLocalizationReadyForSearch,
  isLocalizationReadyForSeo,
  normalizeLanguageRegistryLocaleKey,
  type LanguageLocalizationKindStatusRow,
  type LanguageLocalizationReadinessReport,
  type LanguageRegistryRecord,
} from "@hu/types";

import { listBrandLocalizations } from "../../brand-localization/brand-localization.repository.js";
import { getLegalLocalization } from "../../legal-localization/legal-localization.repository.js";
import { resolveLanguageRegistryLocale } from "../language-registry/index.js";
import { assessControlledVocabularyReadinessForLocale } from "./assess-controlled-vocabulary-readiness.js";
import { assessWebUiCatalogReadinessForLocale } from "./assess-web-ui-catalog-readiness.js";
import {
  measureBoundedPwaCivicCoverage,
  type BoundedPwaCivicCoverageDeps,
  type BoundedPwaCivicCoverageReport,
} from "./bounded-pwa-civic-coverage.js";

export type EvaluateLanguageLocalizationReadinessInput = {
  readonly locale: string;
  readonly registryRecord?: LanguageRegistryRecord | null;
  readonly assessWebUi?: typeof assessWebUiCatalogReadinessForLocale;
  readonly assessControlledVocabulary?: typeof assessControlledVocabularyReadinessForLocale;
  readonly assessHigherAuthority?: typeof assessHigherAuthority;
  readonly skipCorpusPlan?: boolean;
  /** Injected count buckets when skipCorpusPlan or tests supply measured state. */
  readonly ctCounts?: ReturnType<typeof emptyLanguageLocalizationCountBucket>;
  readonly plpCounts?: ReturnType<typeof emptyLanguageLocalizationCountBucket>;
  /** STEP 15D.14.B.2 — participant_public PLP data for Gate F (optional inject). */
  readonly plpParticipantCounts?: ReturnType<typeof emptyLanguageLocalizationCountBucket>;
  readonly pwaCivicCoverage?: BoundedPwaCivicCoverageReport;
  readonly coverageDeps?: BoundedPwaCivicCoverageDeps;
  /**
   * @deprecated Pack 02 — hydrate planner is no longer used for readiness.
   * Kept for call-site compatibility; ignored.
   */
  readonly plannerDeps?: unknown;
};

function brandLocaleMatches(entryLocale: string, canonicalLocale: string): boolean {
  return (
    normalizeLanguageRegistryLocaleKey(entryLocale) ===
    normalizeLanguageRegistryLocaleKey(canonicalLocale)
  );
}

async function assessHigherAuthority(locale: string): Promise<{
  brandPublished: boolean | null;
  legalPublished: boolean | null;
  note: string | null;
}> {
  let brandPublished: boolean | null = null;
  let legalPublished: boolean | null = null;
  try {
    const brands = await listBrandLocalizations();
    const row = brands.find((entry) => brandLocaleMatches(entry.locale, locale));
    brandPublished = row ? row.status === "published" : false;
  } catch {
    brandPublished = null;
  }
  try {
    const privacy = await getLegalLocalization("privacy", locale);
    const terms = await getLegalLocalization("terms", locale);
    if (!privacy && !terms) {
      legalPublished = false;
    } else {
      legalPublished =
        (privacy?.status === "published" || !privacy) &&
        (terms?.status === "published" || !terms);
      if (privacy || terms) {
        legalPublished =
          (!privacy || privacy.status === "published") &&
          (!terms || terms.status === "published");
      }
    }
  } catch {
    legalPublished = null;
  }
  return {
    brandPublished,
    legalPublished,
    note:
      "Brand/Legal published status is advisory; English canonical fallback remains allowed where ownership permits.",
  };
}

/**
 * Compute localization readiness for one Registry locale.
 * Does not hydrate the full public localization corpus.
 * Does not flip seoIndexingEnabled / searchEnabled.
 */
export async function evaluateLanguageLocalizationReadiness(
  input: EvaluateLanguageLocalizationReadinessInput,
): Promise<LanguageLocalizationReadinessReport> {
  const requestedLocale = input.locale.trim();
  const record =
    input.registryRecord !== undefined
      ? input.registryRecord
      : await resolveLanguageRegistryLocale(requestedLocale);
  /** Gate A — owner assessments use Registry CANONICAL LOCALE, not job identity key. */
  const locale = record?.locale ?? requestedLocale;

  const registry = {
    enabled: record?.enabled === true,
    contentTranslationEnabled: record?.contentTranslationEnabled === true,
    searchEnabled: record?.searchEnabled === true,
    seoIndexingEnabled: record?.seoIndexingEnabled === true,
    pwaPersistedReadingEnabled: record?.pwaPersistedReadingEnabled === true,
  };

  const engineReady =
    registry.enabled === true && registry.contentTranslationEnabled === true;

  const assessWebUi = input.assessWebUi ?? assessWebUiCatalogReadinessForLocale;
  const assessControlledVocabulary =
    input.assessControlledVocabulary ?? assessControlledVocabularyReadinessForLocale;
  const assessHigher =
    input.assessHigherAuthority ?? assessHigherAuthority;

  const webUi = await assessWebUi({ locale });
  const participantWebUi = await assessWebUi({ locale, scope: "participant" });
  const controlledVocabulary = await assessControlledVocabulary({ locale });
  const higherAuthority = await assessHigher(locale);

  let ct = input.ctCounts ?? emptyLanguageLocalizationCountBucket();
  let plpMedia = input.plpCounts ?? emptyLanguageLocalizationCountBucket();
  // Gate F data surface — participant_public PLP; not folded into Closure 07 READY %.
  const plpParticipant =
    input.plpParticipantCounts ?? emptyLanguageLocalizationCountBucket();
  let bounded: BoundedPwaCivicCoverageReport | null = input.pwaCivicCoverage ?? null;

  if (
    !input.skipCorpusPlan &&
    engineReady &&
    !input.ctCounts &&
    !input.plpCounts &&
    !input.pwaCivicCoverage
  ) {
    bounded = await measureBoundedPwaCivicCoverage({
      locale,
      deps: input.coverageDeps,
    });
    ct = bounded.ct;
    plpMedia = bounded.plpMedia;
  } else if (input.pwaCivicCoverage) {
    ct = input.ctCounts ?? input.pwaCivicCoverage.ct;
    plpMedia = input.plpCounts ?? input.pwaCivicCoverage.plpMedia;
  }

  const pwaCoverage = bounded?.coverage ?? emptyPwaCivicCoverageScalars();
  const pwaCivic = buildLanguagePwaCivicReadinessSlice({
    enabled: registry.enabled,
    contentTranslationEnabled: registry.contentTranslationEnabled,
    pwaPersistedReadingEnabled: registry.pwaPersistedReadingEnabled,
    coverage:
      input.skipCorpusPlan && !bounded
        ? {
            ...emptyPwaCivicCoverageScalars(),
            ...{
              current: ct.current + plpMedia.current,
              missing: ct.missing + plpMedia.missing,
              stale: ct.stale + plpMedia.stale,
              invalid: ct.invalid + plpMedia.invalid,
              failed: ct.failed + plpMedia.failed,
              pending: ct.pending + plpMedia.pending,
              workItemsRequired: ct.workItemsRequired + plpMedia.workItemsRequired,
              measuredKindCount: 1,
              unmeasuredKindCount: 0,
              coverageMeasurement: "complete" as const,
            },
          }
        : pwaCoverage,
  });

  const state = deriveLanguageLocalizationReadinessState({
    enabled: registry.enabled,
    contentTranslationEnabled: registry.contentTranslationEnabled,
    webUiDataReady: webUi.dataReady,
    participantWebUiDataReady: participantWebUi.dataReady,
    controlledVocabularyPresentationReady: controlledVocabulary.presentationReady,
    ct,
    plpMedia,
  });

  const languageDataReady =
    webUi.dataReady &&
    participantWebUi.dataReady &&
    controlledVocabulary.presentationReady &&
    state === "READY";

  const kindRows: LanguageLocalizationKindStatusRow[] = [
    ...LANGUAGE_ACTIVATION_CT_OWNED_KINDS.map((kindId) => {
      const measured = bounded?.kindRows.find((row) => row.kindId === kindId);
      return {
        kindId,
        ownership: "CT_OWNED" as const,
        counts: measured?.counts ?? null,
        note:
          measured?.status === "UNMEASURED"
            ? measured.reason
            : measured
              ? null
              : "Outside bounded PWA civic measure set — not counted as complete.",
      };
    }),
    {
      kindId: "civic_media_editorial",
      ownership: "PLP_OWNED",
      counts: plpMedia,
      note: "PLP HU-owned Media editorial",
    },
    ...LANGUAGE_ACTIVATION_PLP_OWNED_PARTICIPANT_ENTITY_TYPES.map((kindId) => ({
      kindId,
      ownership: "PLP_OWNED" as const,
      counts: plpParticipant,
      note:
        "PLP participant_public (biography / public skills). Data for Gate F — not Closure 07 READY gate.",
    })),
    ...LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS.map((kindId) => ({
      kindId,
      ownership: "PROTECTED_EXCLUDED" as const,
      counts: null,
      note: "RSS / protected original — never machine-translated",
    })),
    ...LANGUAGE_ACTIVATION_NO_OWNER_KIND_IDS.map((kindId) => ({
      kindId,
      ownership: "NO_TRANSLATION_OWNER" as const,
      counts: null,
      note: "NOT_TRANSLATABLE_BY_CURRENT_ARCHITECTURE — Knowledge debt (Closure 06)",
    })),
    {
      kindId: "web_ui_catalog",
      ownership: "WEB_UI_CATALOG",
      counts: null,
      note: "Catalog data readiness — not CT/PLP backfill",
    },
  ];

  const gaps: string[] = [];
  if (!engineReady) {
    gaps.push("Registry not enabled+contentTranslationEnabled");
  }
  if (!registry.pwaPersistedReadingEnabled) {
    gaps.push("pwaPersistedReadingEnabled=false (PWA civic gate closed)");
  }
  if (!webUi.dataReady) {
    gaps.push(
      `Public WEB_UI catalog not ready (missing=${webUi.missingKeyCount}, empty=${webUi.emptyKeyCount}, englishFallback=${webUi.englishFallbackKeyCount})`,
    );
  }
  if (!participantWebUi.dataReady) {
    gaps.push(
      `Participant WEB_UI catalog not ready (missing=${participantWebUi.missingKeyCount}, empty=${participantWebUi.emptyKeyCount}, englishFallback=${participantWebUi.englishFallbackKeyCount})`,
    );
  }
  if (!controlledVocabulary.presentationReady) {
    gaps.push(
      `Controlled vocabulary missing localized labels (${controlledVocabulary.conceptsMissingLocalizedLabel})`,
    );
  }
  if (controlledVocabulary.conceptsWithWebUiFallbackOnly > 0) {
    gaps.push(
      `Terminology preferredTerm gaps covered by WEB_UI (${controlledVocabulary.conceptsWithWebUiFallbackOnly})`,
    );
  }
  if (ct.workItemsRequired > 0) {
    gaps.push(`CT backfill work items: ${ct.workItemsRequired}`);
  }
  if (ct.failed > 0) {
    gaps.push(`CT blocked current-version failures: ${ct.failed}`);
  }
  if (plpMedia.workItemsRequired > 0) {
    gaps.push(`PLP Media backfill work items: ${plpMedia.workItemsRequired}`);
  }
  if (plpParticipant.workItemsRequired > 0) {
    gaps.push(
      `PLP participant_public work items: ${plpParticipant.workItemsRequired} (Gate F surface; does not flip Closure 07 READY)`,
    );
  }
  if (plpParticipant.invalid > 0) {
    gaps.push(`PLP participant_public INVALID: ${plpParticipant.invalid}`);
  }
  if (plpParticipant.stale > 0) {
    gaps.push(`PLP participant_public STALE: ${plpParticipant.stale}`);
  }
  if (plpParticipant.missing > 0) {
    gaps.push(`PLP participant_public MISSING: ${plpParticipant.missing}`);
  }
  if (pwaCivic.coverage.unmeasuredKindCount > 0) {
    gaps.push(
      `PWA civic unmeasured kinds: ${pwaCivic.coverage.unmeasuredKindCount} (not reported as complete)`,
    );
  }
  if (pwaCivic.pwaCivicReadinessStatus !== "READY" && registry.pwaPersistedReadingEnabled) {
    gaps.push(`PWA civic status: ${pwaCivic.pwaCivicReadinessStatus}`);
  }
  for (const kindId of LANGUAGE_ACTIVATION_NO_OWNER_KIND_IDS) {
    gaps.push(`${kindId}: NO_TRANSLATION_OWNER (does not block READY)`);
  }

  const report: LanguageLocalizationReadinessReport = {
    pack: "closure07",
    locale,
    languageId: record?.languageId ?? null,
    registry,
    engineReady,
    languageDataReady,
    state,
    webUi,
    participantWebUi,
    controlledVocabulary,
    higherAuthority,
    pwaCivic,
    ct,
    plpMedia,
    plpParticipant,
    kindRows,
    seoReady: false,
    searchLocalizationReady: false,
    PROVIDER_CALLS: 0,
    WRITES_PERFORMED: 0,
    gaps,
  };

  return {
    ...report,
    seoReady: isLocalizationReadyForSeo(report),
    searchLocalizationReady: isLocalizationReadyForSearch(report),
  };
}
