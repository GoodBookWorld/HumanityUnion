/**
 * Closure 07 — language localization readiness evaluator.
 * Provider-free, write-free, Registry-driven.
 */

import {
  LANGUAGE_ACTIVATION_CT_OWNED_KINDS,
  LANGUAGE_ACTIVATION_NO_OWNER_KIND_IDS,
  LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS,
  deriveLanguageLocalizationReadinessState,
  emptyLanguageLocalizationCountBucket,
  isLocalizationReadyForSearch,
  isLocalizationReadyForSeo,
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
  aggregateCtCountsFromPlan,
  aggregatePlpCountsFromPlan,
  planLanguageHistoricalBackfill,
  type LanguageHistoricalBackfillPlannerDeps,
} from "./language-historical-backfill-planner.js";

export type EvaluateLanguageLocalizationReadinessInput = {
  readonly locale: string;
  readonly registryRecord?: LanguageRegistryRecord | null;
  readonly plannerDeps?: LanguageHistoricalBackfillPlannerDeps;
  readonly assessWebUi?: typeof assessWebUiCatalogReadinessForLocale;
  readonly assessControlledVocabulary?: typeof assessControlledVocabularyReadinessForLocale;
  readonly skipCorpusPlan?: boolean;
  /** Injected count buckets when skipCorpusPlan or tests supply measured state. */
  readonly ctCounts?: ReturnType<typeof emptyLanguageLocalizationCountBucket>;
  readonly plpCounts?: ReturnType<typeof emptyLanguageLocalizationCountBucket>;
};

async function assessHigherAuthority(locale: string): Promise<{
  brandPublished: boolean | null;
  legalPublished: boolean | null;
  note: string | null;
}> {
  let brandPublished: boolean | null = null;
  let legalPublished: boolean | null = null;
  try {
    const brands = await listBrandLocalizations();
    const row = brands.find((entry) => entry.locale === locale);
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
      // Honest: if neither document exists for locale, false; if any exists, require published.
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
 * Does not call TranslationProvider. Does not mutate localization state.
 * Does not flip seoIndexingEnabled / searchEnabled.
 */
export async function evaluateLanguageLocalizationReadiness(
  input: EvaluateLanguageLocalizationReadinessInput,
): Promise<LanguageLocalizationReadinessReport> {
  const locale = input.locale.trim();
  const record =
    input.registryRecord !== undefined
      ? input.registryRecord
      : await resolveLanguageRegistryLocale(locale);

  const registry = {
    enabled: record?.enabled === true,
    contentTranslationEnabled: record?.contentTranslationEnabled === true,
    searchEnabled: record?.searchEnabled === true,
    seoIndexingEnabled: record?.seoIndexingEnabled === true,
  };

  const engineReady =
    registry.enabled === true && registry.contentTranslationEnabled === true;

  const assessWebUi = input.assessWebUi ?? assessWebUiCatalogReadinessForLocale;
  const assessControlledVocabulary =
    input.assessControlledVocabulary ?? assessControlledVocabularyReadinessForLocale;

  const webUi = assessWebUi({ locale });
  const controlledVocabulary = await assessControlledVocabulary({ locale });
  const higherAuthority = await assessHigherAuthority(locale);

  let ct = input.ctCounts ?? emptyLanguageLocalizationCountBucket();
  let plpMedia = input.plpCounts ?? emptyLanguageLocalizationCountBucket();

  if (!input.skipCorpusPlan && engineReady && !input.ctCounts && !input.plpCounts) {
    const plan = await planLanguageHistoricalBackfill({
      locale,
      registryEligible: true,
      mode: "dry-run",
      deps: input.plannerDeps,
    });
    ct = aggregateCtCountsFromPlan(plan);
    plpMedia = aggregatePlpCountsFromPlan(plan);
  }

  const state = deriveLanguageLocalizationReadinessState({
    enabled: registry.enabled,
    contentTranslationEnabled: registry.contentTranslationEnabled,
    webUiDataReady: webUi.dataReady,
    controlledVocabularyPresentationReady: controlledVocabulary.presentationReady,
    ct,
    plpMedia,
  });

  const languageDataReady =
    webUi.dataReady &&
    controlledVocabulary.presentationReady &&
    state === "READY";

  const kindRows: LanguageLocalizationKindStatusRow[] = [
    ...LANGUAGE_ACTIVATION_CT_OWNED_KINDS.map((kindId) => ({
      kindId,
      ownership: "CT_OWNED" as const,
      counts: null,
      note: null,
    })),
    {
      kindId: "civic_media_editorial",
      ownership: "PLP_OWNED",
      counts: plpMedia,
      note: "PLP HU-owned Media editorial",
    },
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
  if (!webUi.dataReady) {
    gaps.push(
      `WEB_UI catalog not ready (missing=${webUi.missingKeyCount}, empty=${webUi.emptyKeyCount}, englishFallback=${webUi.englishFallbackKeyCount})`,
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
  if (plpMedia.workItemsRequired > 0) {
    gaps.push(`PLP Media backfill work items: ${plpMedia.workItemsRequired}`);
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
    controlledVocabulary,
    higherAuthority,
    ct,
    plpMedia,
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
