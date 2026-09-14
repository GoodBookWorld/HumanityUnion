/**
 * Closure 07 — language activation / historical backfill orchestrator.
 *
 * Default DRY RUN. --execute delegates to existing bounded CT residual retry
 * + consumer-visible Media PLP enqueue (all /media families). Provider
 * concurrency remains existing policy (≤1).
 */

import {
  LANGUAGE_ACTIVATION_CT_OWNED_KINDS,
  type LanguageHistoricalBackfillPlan,
  type LanguageLocalizationReadinessReport,
} from "@hu/types";

import { resolveLanguageRegistryLocale } from "../language-registry/index.js";
import { runPublicLocalizationResidualRetry } from "../public-localization-residual-retry.js";
import type { StagingWarmSourceKind } from "../content-translation-staging-warm-operator-scope.js";
import { evaluateLanguageLocalizationReadiness } from "./language-localization-readiness-evaluator.js";
import {
  planLanguageHistoricalBackfill,
  type LanguageHistoricalBackfillPlannerDeps,
} from "./language-historical-backfill-planner.js";

export type LanguageActivationResult = {
  readonly pack: "closure07";
  readonly locale: string;
  readonly mode: "dry-run" | "execute";
  readonly readiness: LanguageLocalizationReadinessReport;
  readonly plan: LanguageHistoricalBackfillPlan;
  readonly execute: {
    readonly attempted: boolean;
    readonly ctKindsEnqueued: number;
    readonly plpEditorialEnqueued: boolean;
    readonly notes: readonly string[];
  };
  readonly PROVIDER_CALLS: 0;
  readonly WRITES_PERFORMED: number;
  /** Confirms Admin seoIndexingEnabled was not mutated. */
  readonly seoIndexingEnabledUnchanged: true;
};

export type ActivateLanguageLocalizationInput = {
  readonly locale: string;
  readonly execute?: boolean;
  readonly kinds?: readonly StagingWarmSourceKind[];
  readonly plannerDeps?: LanguageHistoricalBackfillPlannerDeps;
  readonly enqueuePlpEditorial?: (locales: readonly string[]) => Promise<void>;
  /** Optional override for full consumer-visible Media PLP activation enqueue. */
  readonly enqueuePlpMediaConsumer?: (locales: readonly string[]) => Promise<void>;
  readonly runResidualRetry?: typeof runPublicLocalizationResidualRetry;
  /**
   * When true, skip corpus discovery in readiness (tests / status-only).
   * Planner may still use injected deps.
   */
  readonly skipCorpusInReadiness?: boolean;
};

/**
 * Single logical activation contract for one locale.
 * Dry-run: plan + readiness only (zero writes).
 * Execute: residual CT retry for eligible kinds + Media consumer PLP enqueue.
 */
export async function activateLanguageLocalization(
  input: ActivateLanguageLocalizationInput,
): Promise<LanguageActivationResult> {
  const locale = input.locale.trim();
  if (!locale) {
    throw new Error("locale is required");
  }
  if (locale.includes(",") || /\s/.test(locale)) {
    throw new Error("Activate exactly one locale at a time.");
  }

  const record = await resolveLanguageRegistryLocale(locale);
  const registryEligible =
    record?.enabled === true && record.contentTranslationEnabled === true;

  const readiness = await evaluateLanguageLocalizationReadiness({
    locale,
    registryRecord: record,
    plannerDeps: input.plannerDeps,
    skipCorpusPlan: input.skipCorpusInReadiness === true,
  });

  const plan = await planLanguageHistoricalBackfill({
    locale,
    registryEligible,
    mode: input.execute ? "execute" : "dry-run",
    deps: input.plannerDeps,
  });

  const notes: string[] = [];
  let ctKindsEnqueued = 0;
  let plpEditorialEnqueued = false;
  let writes = 0;

  if (!input.execute) {
    notes.push("Dry-run only — no outbox enqueue, no PLP enqueue, no provider calls.");
  } else if (!registryEligible) {
    notes.push(
      "Execute skipped: locale is not enabled with contentTranslationEnabled.",
    );
  } else {
    const kinds = (input.kinds?.length
      ? input.kinds
      : [...LANGUAGE_ACTIVATION_CT_OWNED_KINDS]) as StagingWarmSourceKind[];

    const runResidual =
      input.runResidualRetry ?? runPublicLocalizationResidualRetry;
    const residual = await runResidual({
      execute: true,
      kinds,
      targetLocales: [locale as never],
    });
    ctKindsEnqueued = residual.presentationsScheduled;
    writes += residual.presentationsScheduled;
    notes.push(
      `CT residual retry scheduled presentations=${residual.presentationsScheduled} deduped=${residual.presentationsDeduped}`,
    );

    const needsPlp = plan.items.some(
      (item) => item.owner === "PLP" && item.workItemsRequired > 0,
    );
    if (needsPlp) {
      const enqueue =
        input.enqueuePlpMediaConsumer ??
        input.enqueuePlpEditorial ??
        (async (locales: readonly string[]) => {
          const { enqueueConsumerVisibleMediaPlpBuildsForLocales } = await import(
            "../published-localized-presentation/universal/media-consumer-plp-activation-enqueue.js"
          );
          await enqueueConsumerVisibleMediaPlpBuildsForLocales({
            locales: [...locales],
          });
        });
      await enqueue([locale]);
      plpEditorialEnqueued = true;
      writes += 1;
      notes.push(
        "PLP Media consumer enqueue requested for locale " +
          "(editorial + principles/trusted/fact/propaganda + bounded news).",
      );
    } else {
      notes.push("PLP Media consumer families already CURRENT — no enqueue.");
    }

    notes.push(
      "seoIndexingEnabled was not mutated; Admin retains SEO control.",
    );
  }

  return {
    pack: "closure07",
    locale,
    mode: input.execute ? "execute" : "dry-run",
    readiness,
    plan,
    execute: {
      attempted: input.execute === true,
      ctKindsEnqueued,
      plpEditorialEnqueued,
      notes,
    },
    PROVIDER_CALLS: 0,
    WRITES_PERFORMED: writes,
    seoIndexingEnabledUnchanged: true,
  };
}
