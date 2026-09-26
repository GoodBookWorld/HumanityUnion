/**
 * STEP 15D.14.C.2 — durable localization reconciliation driver.
 *
 * Closes the C.1 gap: completed (or running) languages with WEB_UI READY and
 * actionable MISSING/STALE/INVALID work converge without Activate/Resume and
 * without reopening activation.status.
 *
 * Reuses Gate C residual retry + PLP consumer enqueue + outbox/warm pipeline.
 * Does not redefine READY/MISSING/STALE/INVALID.
 *
 * Read paths must never call schedule/run APIs in this module.
 */

import type { LanguageCode } from "@hu/types";
import { normalizeLanguageRegistryLocaleKey } from "@hu/types";

import { logger } from "../../shared/observability/logger.js";
import { listAutomaticContentTranslationTargetLocales } from "./content-translation-warm-targets.js";
import { resolveLanguageRegistryLocale } from "./language-registry/language-registry.repository.js";
import { assessWebUiCatalogReadinessForLocale } from "./language-localization-activation/assess-web-ui-catalog-readiness.js";
import { measureLiveActivationCtCoverage } from "./live-residual-ct-coverage.js";
import { runPublicLocalizationResidualRetry } from "./public-localization-residual-retry.js";
import { planLanguageHistoricalBackfill } from "./language-localization-activation/language-historical-backfill-planner.js";

/** Bounded CT residual presentations enqueued per driver pass. */
export const LOCALIZATION_RECONCILIATION_MAX_PRESENTATIONS_PER_PASS = 25;

/** Delay before re-evaluating remaining work (not a hot loop). */
export const LOCALIZATION_RECONCILIATION_CONTINUATION_DELAY_MS = 60_000;

export type LocalizationReconciliationWakeReason =
  | "boot"
  | "activation_web_ui_ready"
  | "activation_completed_with_work"
  | "activation_residual_pass"
  | "continuation"
  | "cooldown_wake"
  | "source_mutation"
  | "terminology_mutation"
  | "test";

export type LocalizationReconciliationEligibility = {
  readonly eligible: boolean;
  readonly canonicalLocale: string;
  readonly reason:
    | "ok"
    | "empty_locale"
    | "source_locale"
    | "registry_ineligible"
    | "web_ui_not_ready"
    | "no_actionable_work";
  readonly workItemsRequired: number;
};

export type LocalizationReconciliationPassResult = {
  readonly locale: string;
  readonly ran: boolean;
  readonly reason: string;
  readonly presentationsScheduled: number;
  readonly presentationsDeduped: number;
  readonly retryReadyIdentities: number;
  readonly workItemsRequiredAfter: number;
  readonly continuationScheduled: boolean;
};

export type LocalizationReconciliationDriverDeps = {
  readonly resolveLocale?: typeof resolveLanguageRegistryLocale;
  readonly assessWebUi?: typeof assessWebUiCatalogReadinessForLocale;
  readonly measureCtWork?: typeof measureLiveActivationCtCoverage;
  readonly planBackfill?: typeof planLanguageHistoricalBackfill;
  readonly runResidual?: typeof runPublicLocalizationResidualRetry;
  readonly enqueuePlp?: (locales: readonly string[]) => Promise<void>;
  readonly listTargetLocales?: typeof listAutomaticContentTranslationTargetLocales;
  readonly continuationDelayMs?: number;
  readonly maxPresentationsPerPass?: number;
  readonly nowMs?: () => number;
};

let depsOverride: LocalizationReconciliationDriverDeps | null = null;

const inFlight = new Set<string>();
const pendingWake = new Set<string>();
const delayedTimers = new Map<string, ReturnType<typeof setTimeout>>();
const delayedReasons = new Map<string, LocalizationReconciliationWakeReason>();

function canonicalKey(locale: string): string {
  return normalizeLanguageRegistryLocaleKey(locale.trim());
}

function activeDeps(): LocalizationReconciliationDriverDeps {
  return depsOverride ?? {};
}

export function setLocalizationReconciliationDriverDepsForTests(
  deps: LocalizationReconciliationDriverDeps | null,
): void {
  depsOverride = deps;
}

export function resetLocalizationReconciliationDriverForTests(): void {
  inFlight.clear();
  pendingWake.clear();
  for (const timer of delayedTimers.values()) {
    clearTimeout(timer);
  }
  delayedTimers.clear();
  delayedReasons.clear();
  depsOverride = null;
}

export function peekLocalizationReconciliationDriverStateForTests(): {
  readonly inFlight: readonly string[];
  readonly pendingWake: readonly string[];
  readonly delayedLocales: readonly string[];
} {
  return {
    inFlight: [...inFlight],
    pendingWake: [...pendingWake],
    delayedLocales: [...delayedTimers.keys()],
  };
}

/**
 * Registry + WEB_UI 15D.9.1 + actionable CT/PLP work.
 * Does not consult activation.status.
 */
export async function assessLocalizationReconciliationEligibility(
  localeInput: string,
  deps?: LocalizationReconciliationDriverDeps,
): Promise<LocalizationReconciliationEligibility> {
  const d = { ...activeDeps(), ...(deps ?? {}) };
  const raw = localeInput.trim();
  if (!raw) {
    return {
      eligible: false,
      canonicalLocale: "",
      reason: "empty_locale",
      workItemsRequired: 0,
    };
  }
  const resolve = d.resolveLocale ?? resolveLanguageRegistryLocale;
  const record = await resolve(raw);
  const canonicalLocale = record?.locale ?? raw;
  if (canonicalKey(canonicalLocale) === "en") {
    return {
      eligible: false,
      canonicalLocale,
      reason: "source_locale",
      workItemsRequired: 0,
    };
  }
  if (record?.enabled !== true || record.contentTranslationEnabled !== true) {
    return {
      eligible: false,
      canonicalLocale,
      reason: "registry_ineligible",
      workItemsRequired: 0,
    };
  }

  const assess = d.assessWebUi ?? assessWebUiCatalogReadinessForLocale;
  const publicWebUi = await assess({ locale: canonicalLocale });
  const participantWebUi = await assess({
    locale: canonicalLocale,
    scope: "participant",
  });
  if (publicWebUi.dataReady !== true || participantWebUi.dataReady !== true) {
    return {
      eligible: false,
      canonicalLocale,
      reason: "web_ui_not_ready",
      workItemsRequired: 0,
    };
  }

  const measureCt = d.measureCtWork ?? measureLiveActivationCtCoverage;
  const ctCoverage = await measureCt({ locale: canonicalLocale });
  const planBackfill = d.planBackfill ?? planLanguageHistoricalBackfill;
  const plan = await planBackfill({
    locale: canonicalLocale,
    registryEligible: true,
    mode: "dry-run",
  });
  // CT counts come from live residual (includes INVALID). PLP from Gate C planner.
  const workItemsRequired =
    ctCoverage.ct.workItemsRequired + plan.summary.plpWorkItems;

  if (workItemsRequired <= 0) {
    return {
      eligible: false,
      canonicalLocale,
      reason: "no_actionable_work",
      workItemsRequired: 0,
    };
  }

  return {
    eligible: true,
    canonicalLocale,
    reason: "ok",
    workItemsRequired,
  };
}

async function enqueuePlpForLocale(locale: string, deps: LocalizationReconciliationDriverDeps): Promise<boolean> {
  const planBackfill = deps.planBackfill ?? planLanguageHistoricalBackfill;
  const plan = await planBackfill({
    locale,
    registryEligible: true,
    mode: "execute",
  });
  const needsPlp = plan.items.some(
    (item) => item.owner === "PLP" && item.workItemsRequired > 0,
  );
  if (!needsPlp) {
    return false;
  }
  if (deps.enqueuePlp) {
    await deps.enqueuePlp([locale]);
    return true;
  }
  const { enqueueConsumerVisibleMediaPlpBuildsForLocales } = await import(
    "./published-localized-presentation/universal/media-consumer-plp-activation-enqueue.js"
  );
  await enqueueConsumerVisibleMediaPlpBuildsForLocales({ locales: [locale] });
  return true;
}

/**
 * One bounded reconciliation pass for a single canonical locale.
 * Enqueues via Gate C residual + PLP consumer; never calls the provider directly.
 */
export async function runLocalizationReconciliationPass(
  localeInput: string,
  deps?: LocalizationReconciliationDriverDeps,
): Promise<LocalizationReconciliationPassResult> {
  const d = { ...activeDeps(), ...(deps ?? {}) };
  const eligibility = await assessLocalizationReconciliationEligibility(localeInput, d);
  if (!eligibility.eligible) {
    return {
      locale: eligibility.canonicalLocale || localeInput,
      ran: false,
      reason: eligibility.reason,
      presentationsScheduled: 0,
      presentationsDeduped: 0,
      retryReadyIdentities: 0,
      workItemsRequiredAfter: eligibility.workItemsRequired,
      continuationScheduled: false,
    };
  }

  const locale = eligibility.canonicalLocale;
  const maxPresentations =
    d.maxPresentationsPerPass ?? LOCALIZATION_RECONCILIATION_MAX_PRESENTATIONS_PER_PASS;
  const runResidual = d.runResidual ?? runPublicLocalizationResidualRetry;

  const residual = await runResidual({
    execute: true,
    targetLocales: [locale as LanguageCode],
    maxPresentations,
  });

  let plpEnqueued = false;
  try {
    plpEnqueued = await enqueuePlpForLocale(locale, d);
  } catch (error) {
    logger.warn("localization.reconciliation.plp_enqueue_failed", {
      component: "localization-reconciliation-driver",
      locale,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const workAfter = await assessLocalizationReconciliationEligibility(locale, d);
  const progressMade =
    residual.presentationsScheduled > 0 ||
    residual.presentationsDeduped > 0 ||
    plpEnqueued;

  const truncated =
    residual.RETRY_READY_IDENTITIES > residual.presentationsToEnqueue &&
    residual.presentationsToEnqueue > 0;

  // Continue when more actionable work remains after progress or a bounded slice.
  // Transient/no-progress cases use delayed cooldown wake (not a hot loop).
  const shouldContinue =
    workAfter.eligible &&
    workAfter.workItemsRequired > 0 &&
    (progressMade || truncated);

  const cooldownContinue =
    !shouldContinue &&
    workAfter.eligible &&
    workAfter.workItemsRequired > 0 &&
    (residual.RETRY_BLOCKED_IDENTITIES > 0 || residual.presentationsFailed > 0);

  return {
    locale,
    ran: true,
    reason: cooldownContinue ? "cooldown_deferred" : "ok",
    presentationsScheduled: residual.presentationsScheduled,
    presentationsDeduped: residual.presentationsDeduped,
    retryReadyIdentities: residual.RETRY_READY_IDENTITIES,
    workItemsRequiredAfter: workAfter.workItemsRequired,
    continuationScheduled: shouldContinue || cooldownContinue,
  };
}

function clearDelayed(localeKey: string): void {
  const timer = delayedTimers.get(localeKey);
  if (timer) {
    clearTimeout(timer);
  }
  delayedTimers.delete(localeKey);
  delayedReasons.delete(localeKey);
}

/**
 * Idempotent wake. Coalesces duplicate schedules for one locale.
 * Never performs provider work synchronously.
 */
export function scheduleLocalizationReconciliation(input: {
  readonly locale: string;
  readonly reason: LocalizationReconciliationWakeReason;
  readonly delayMs?: number;
}): { readonly accepted: boolean; readonly localeKey: string } {
  const localeKey = canonicalKey(input.locale);
  if (!localeKey || localeKey === "en") {
    return { accepted: false, localeKey };
  }

  const delayMs = input.delayMs ?? 0;

  if (delayMs > 0) {
    const existingAt = delayedReasons.get(localeKey);
    if (existingAt && delayedTimers.has(localeKey)) {
      // Coalesce: keep existing timer (earlier wake wins by not resetting).
      return { accepted: true, localeKey };
    }
    clearDelayed(localeKey);
    delayedReasons.set(localeKey, input.reason);
    const timer = setTimeout(() => {
      delayedTimers.delete(localeKey);
      delayedReasons.delete(localeKey);
      scheduleLocalizationReconciliation({
        locale: localeKey,
        reason: "continuation",
        delayMs: 0,
      });
    }, delayMs);
    // Do not keep the API process / test runner alive solely for delayed wakes.
    if (typeof timer.unref === "function") {
      timer.unref();
    }
    delayedTimers.set(localeKey, timer);
    return { accepted: true, localeKey };
  }

  if (inFlight.has(localeKey)) {
    pendingWake.add(localeKey);
    return { accepted: true, localeKey };
  }

  inFlight.add(localeKey);
  queueMicrotask(() => {
    void (async () => {
      try {
        const result = await runLocalizationReconciliationPass(localeKey);
        logger.info("localization.reconciliation.pass", {
          component: "localization-reconciliation-driver",
          locale: localeKey,
          wakeReason: input.reason,
          ran: result.ran,
          reason: result.reason,
          presentationsScheduled: result.presentationsScheduled,
          presentationsDeduped: result.presentationsDeduped,
          retryReadyIdentities: result.retryReadyIdentities,
          workItemsRequiredAfter: result.workItemsRequiredAfter,
          continuationScheduled: result.continuationScheduled,
        });
        if (result.continuationScheduled) {
          const delay =
            activeDeps().continuationDelayMs ??
            LOCALIZATION_RECONCILIATION_CONTINUATION_DELAY_MS;
          const wakeReason: LocalizationReconciliationWakeReason =
            result.reason === "cooldown_deferred" ? "cooldown_wake" : "continuation";
          scheduleLocalizationReconciliation({
            locale: localeKey,
            reason: wakeReason,
            delayMs: delay,
          });
        }
      } catch (error) {
        logger.warn("localization.reconciliation.pass_failed", {
          component: "localization-reconciliation-driver",
          locale: localeKey,
          wakeReason: input.reason,
          error: error instanceof Error ? error.message : String(error),
        });
        // Transient failure: durable delayed retry, not a hot loop.
        const delay =
          activeDeps().continuationDelayMs ??
          LOCALIZATION_RECONCILIATION_CONTINUATION_DELAY_MS;
        scheduleLocalizationReconciliation({
          locale: localeKey,
          reason: "cooldown_wake",
          delayMs: delay,
        });
      } finally {
        inFlight.delete(localeKey);
        if (pendingWake.has(localeKey)) {
          pendingWake.delete(localeKey);
          scheduleLocalizationReconciliation({
            locale: localeKey,
            reason: input.reason,
            delayMs: 0,
          });
        }
      }
    })();
  });

  return { accepted: true, localeKey };
}

/**
 * Lightweight wake for all automatic CT target locales (mutations / terminology).
 * Schedules only — no synchronous corpus work.
 */
export function scheduleLocalizationReconciliationForAutomaticLocales(input: {
  readonly reason: LocalizationReconciliationWakeReason;
}): void {
  void (async () => {
    try {
      const list =
        activeDeps().listTargetLocales ?? listAutomaticContentTranslationTargetLocales;
      const locales = await list();
      for (const locale of locales) {
        scheduleLocalizationReconciliation({
          locale,
          reason: input.reason,
        });
      }
    } catch (error) {
      logger.warn("localization.reconciliation.broadcast_wake_failed", {
        component: "localization-reconciliation-driver",
        reason: input.reason,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}

/**
 * API boot: schedule reconciliation for CT-enabled locales.
 * Does not synchronously hydrate/translate the corpus.
 */
export async function resumeLocalizationReconciliationOnBoot(): Promise<{
  readonly scheduled: number;
}> {
  const list =
    activeDeps().listTargetLocales ?? listAutomaticContentTranslationTargetLocales;
  const locales = await list();
  let scheduled = 0;
  for (const locale of locales) {
    const result = scheduleLocalizationReconciliation({
      locale,
      reason: "boot",
    });
    if (result.accepted) {
      scheduled += 1;
    }
  }
  return { scheduled };
}

/**
 * Activation process wake — call after WEB_UI READY / residual / completed.
 * Does not mutate activation.status.
 */
export function wakeLocalizationReconciliationAfterActivation(input: {
  readonly locale: string;
  readonly webUiReady: boolean;
  readonly activationStatus: string;
  readonly workItemsRequired: number;
}): void {
  if (!input.webUiReady) {
    return;
  }
  if (input.workItemsRequired <= 0) {
    return;
  }
  const reason: LocalizationReconciliationWakeReason =
    input.activationStatus === "completed"
      ? "activation_completed_with_work"
      : "activation_web_ui_ready";
  scheduleLocalizationReconciliation({
    locale: input.locale,
    reason,
  });
}
