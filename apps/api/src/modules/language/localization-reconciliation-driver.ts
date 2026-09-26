/**
 * STEP 15D.14.C.2 / C.3 — durable localization reconciliation driver.
 *
 * C.2: completed (or running) languages with WEB_UI READY and actionable
 * MISSING/STALE/INVALID work converge without Activate/Resume and without
 * reopening activation.status.
 *
 * C.3: useful progress required for normal continuation; unchanged work /
 * dedupe-only / provider pressure enter bounded increasing backoff.
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

/** Delay after useful progress when work remains (not a hot loop). */
export const LOCALIZATION_RECONCILIATION_CONTINUATION_DELAY_MS = 60_000;

/** First no-progress / provider-pressure deferred wake. */
export const LOCALIZATION_RECONCILIATION_NO_PROGRESS_BASE_DELAY_MS = 5 * 60_000;

/** Cap for repeated no-progress backoff. */
export const LOCALIZATION_RECONCILIATION_NO_PROGRESS_MAX_DELAY_MS = 30 * 60_000;

export type LocalizationReconciliationWakeReason =
  | "boot"
  | "activation_web_ui_ready"
  | "activation_completed_with_work"
  | "activation_residual_pass"
  | "continuation"
  | "cooldown_wake"
  | "no_progress_backoff"
  | "source_mutation"
  | "terminology_mutation"
  | "test";

export type LocalizationReconciliationContinuationKind =
  | "none"
  | "normal"
  | "no_progress_backoff"
  | "provider_pressure_backoff";

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
  readonly workItemsRequiredBefore: number;
  readonly workItemsRequiredAfter: number;
  readonly usefulProgress: boolean;
  readonly continuationKind: LocalizationReconciliationContinuationKind;
  readonly continuationScheduled: boolean;
  readonly continuationDelayMs: number;
  readonly noProgressStreak: number;
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
  readonly noProgressBaseDelayMs?: number;
  readonly noProgressMaxDelayMs?: number;
  readonly maxPresentationsPerPass?: number;
  readonly nowMs?: () => number;
};

let depsOverride: LocalizationReconciliationDriverDeps | null = null;

const inFlight = new Set<string>();
const pendingWake = new Set<string>();
const delayedTimers = new Map<string, ReturnType<typeof setTimeout>>();
const delayedReasons = new Map<string, LocalizationReconciliationWakeReason>();
const delayedDueAtMs = new Map<string, number>();
/** Consecutive no-progress passes per locale; reset on useful progress or idle. */
const noProgressStreakByLocale = new Map<string, number>();

const PROVIDER_PRESSURE_REASON =
  /rate_limited|timeout|unavailable|network_failure/i;

function canonicalKey(locale: string): string {
  return normalizeLanguageRegistryLocaleKey(locale.trim());
}

function activeDeps(): LocalizationReconciliationDriverDeps {
  return depsOverride ?? {};
}

function nowMs(): number {
  return (activeDeps().nowMs ?? Date.now)();
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
  delayedDueAtMs.clear();
  noProgressStreakByLocale.clear();
  depsOverride = null;
}

export function peekLocalizationReconciliationDriverStateForTests(): {
  readonly inFlight: readonly string[];
  readonly pendingWake: readonly string[];
  readonly delayedLocales: readonly string[];
  readonly delayedDueAtMs: Readonly<Record<string, number>>;
  readonly noProgressStreakByLocale: Readonly<Record<string, number>>;
} {
  return {
    inFlight: [...inFlight],
    pendingWake: [...pendingWake],
    delayedLocales: [...delayedTimers.keys()],
    delayedDueAtMs: Object.fromEntries(delayedDueAtMs),
    noProgressStreakByLocale: Object.fromEntries(noProgressStreakByLocale),
  };
}

function computeNoProgressDelayMs(streak: number): number {
  const d = activeDeps();
  const base =
    d.noProgressBaseDelayMs ?? LOCALIZATION_RECONCILIATION_NO_PROGRESS_BASE_DELAY_MS;
  const max =
    d.noProgressMaxDelayMs ?? LOCALIZATION_RECONCILIATION_NO_PROGRESS_MAX_DELAY_MS;
  const clampedStreak = Math.max(1, Math.min(streak, 8));
  const delay = base * 2 ** (clampedStreak - 1);
  return Math.min(max, delay);
}

function blockedLooksLikeProviderPressure(
  residual: Awaited<ReturnType<typeof runPublicLocalizationResidualRetry>>,
): boolean {
  if (residual.presentationsFailed > 0) {
    return true;
  }
  if (residual.RETRY_BLOCKED_IDENTITIES > 0) {
    for (const row of residual.blockedIdentities ?? []) {
      const reason = String(
        (row as { blockReason?: unknown }).blockReason ?? "",
      );
      if (PROVIDER_PRESSURE_REASON.test(reason)) {
        return true;
      }
    }
    // Blocked residual with zero newly scheduled work under load is treated as
    // retryable pressure (outbox/warm owns the durable retry contract).
    return residual.presentationsScheduled === 0;
  }
  return false;
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

async function enqueuePlpForLocale(
  locale: string,
  deps: LocalizationReconciliationDriverDeps,
): Promise<boolean> {
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
 * Useful progress: authoritative work decreased, or new work was newly
 * scheduled into the durable pipeline. Repeated dedupe of identical work is
 * NOT progress (C.3).
 */
export function classifyLocalizationReconciliationProgress(input: {
  readonly workItemsRequiredBefore: number;
  readonly workItemsRequiredAfter: number;
  readonly presentationsScheduled: number;
  readonly presentationsDeduped: number;
  readonly plpEnqueued: boolean;
  readonly retryReadyIdentities: number;
  readonly presentationsToEnqueue: number;
}): {
  readonly usefulProgress: boolean;
  readonly workDecreased: boolean;
  readonly newlyScheduled: boolean;
  readonly truncatedWithNewSchedule: boolean;
} {
  const workDecreased =
    input.workItemsRequiredAfter < input.workItemsRequiredBefore;
  const newlyScheduled =
    input.presentationsScheduled > 0 || input.plpEnqueued === true;
  const truncatedWithNewSchedule =
    input.retryReadyIdentities > input.presentationsToEnqueue &&
    input.presentationsScheduled > 0;
  return {
    usefulProgress: workDecreased || newlyScheduled || truncatedWithNewSchedule,
    workDecreased,
    newlyScheduled,
    truncatedWithNewSchedule,
  };
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
  const eligibility = await assessLocalizationReconciliationEligibility(
    localeInput,
    d,
  );
  if (!eligibility.eligible) {
    const key = canonicalKey(eligibility.canonicalLocale || localeInput);
    if (key) {
      noProgressStreakByLocale.delete(key);
    }
    return {
      locale: eligibility.canonicalLocale || localeInput,
      ran: false,
      reason: eligibility.reason,
      presentationsScheduled: 0,
      presentationsDeduped: 0,
      retryReadyIdentities: 0,
      workItemsRequiredBefore: eligibility.workItemsRequired,
      workItemsRequiredAfter: eligibility.workItemsRequired,
      usefulProgress: false,
      continuationKind: "none",
      continuationScheduled: false,
      continuationDelayMs: 0,
      noProgressStreak: 0,
    };
  }

  const locale = eligibility.canonicalLocale;
  const localeKey = canonicalKey(locale);
  const workBefore = eligibility.workItemsRequired;
  const maxPresentations =
    d.maxPresentationsPerPass ??
    LOCALIZATION_RECONCILIATION_MAX_PRESENTATIONS_PER_PASS;
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
  const progress = classifyLocalizationReconciliationProgress({
    workItemsRequiredBefore: workBefore,
    workItemsRequiredAfter: workAfter.workItemsRequired,
    presentationsScheduled: residual.presentationsScheduled,
    presentationsDeduped: residual.presentationsDeduped,
    plpEnqueued,
    retryReadyIdentities: residual.RETRY_READY_IDENTITIES,
    presentationsToEnqueue: residual.presentationsToEnqueue,
  });

  const workRemains =
    workAfter.eligible && workAfter.workItemsRequired > 0;

  if (!workRemains) {
    noProgressStreakByLocale.delete(localeKey);
    return {
      locale,
      ran: true,
      reason: "ok",
      presentationsScheduled: residual.presentationsScheduled,
      presentationsDeduped: residual.presentationsDeduped,
      retryReadyIdentities: residual.RETRY_READY_IDENTITIES,
      workItemsRequiredBefore: workBefore,
      workItemsRequiredAfter: workAfter.workItemsRequired,
      usefulProgress: progress.usefulProgress,
      continuationKind: "none",
      continuationScheduled: false,
      continuationDelayMs: 0,
      noProgressStreak: 0,
    };
  }

  if (progress.usefulProgress) {
    noProgressStreakByLocale.delete(localeKey);
    const delay =
      d.continuationDelayMs ?? LOCALIZATION_RECONCILIATION_CONTINUATION_DELAY_MS;
    return {
      locale,
      ran: true,
      reason: "ok",
      presentationsScheduled: residual.presentationsScheduled,
      presentationsDeduped: residual.presentationsDeduped,
      retryReadyIdentities: residual.RETRY_READY_IDENTITIES,
      workItemsRequiredBefore: workBefore,
      workItemsRequiredAfter: workAfter.workItemsRequired,
      usefulProgress: true,
      continuationKind: "normal",
      continuationScheduled: true,
      continuationDelayMs: delay,
      noProgressStreak: 0,
    };
  }

  // No useful progress: unchanged work and/or dedupe-only rediscovery.
  const streak = (noProgressStreakByLocale.get(localeKey) ?? 0) + 1;
  noProgressStreakByLocale.set(localeKey, streak);
  const providerPressure = blockedLooksLikeProviderPressure(residual);
  const delay = computeNoProgressDelayMs(streak);
  const continuationKind: LocalizationReconciliationContinuationKind =
    providerPressure ? "provider_pressure_backoff" : "no_progress_backoff";

  return {
    locale,
    ran: true,
    reason: continuationKind,
    presentationsScheduled: residual.presentationsScheduled,
    presentationsDeduped: residual.presentationsDeduped,
    retryReadyIdentities: residual.RETRY_READY_IDENTITIES,
    workItemsRequiredBefore: workBefore,
    workItemsRequiredAfter: workAfter.workItemsRequired,
    usefulProgress: false,
    continuationKind,
    continuationScheduled: true,
    continuationDelayMs: delay,
    noProgressStreak: streak,
  };
}

function clearDelayed(localeKey: string): void {
  const timer = delayedTimers.get(localeKey);
  if (timer) {
    clearTimeout(timer);
  }
  delayedTimers.delete(localeKey);
  delayedReasons.delete(localeKey);
  delayedDueAtMs.delete(localeKey);
}

function wakeReasonForContinuation(
  kind: LocalizationReconciliationContinuationKind,
): LocalizationReconciliationWakeReason {
  if (kind === "provider_pressure_backoff") {
    return "cooldown_wake";
  }
  if (kind === "no_progress_backoff") {
    return "no_progress_backoff";
  }
  return "continuation";
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
    const dueAt = nowMs() + delayMs;
    const existingDue = delayedDueAtMs.get(localeKey);
    if (
      existingDue != null &&
      delayedTimers.has(localeKey) &&
      existingDue <= dueAt
    ) {
      // Keep earlier (or equal) wake — do not accumulate timers.
      return { accepted: true, localeKey };
    }
    clearDelayed(localeKey);
    delayedReasons.set(localeKey, input.reason);
    delayedDueAtMs.set(localeKey, dueAt);
    const timer = setTimeout(() => {
      delayedTimers.delete(localeKey);
      delayedReasons.delete(localeKey);
      delayedDueAtMs.delete(localeKey);
      scheduleLocalizationReconciliation({
        locale: localeKey,
        reason: "continuation",
        delayMs: 0,
      });
    }, delayMs);
    if (typeof timer.unref === "function") {
      timer.unref();
    }
    delayedTimers.set(localeKey, timer);
    return { accepted: true, localeKey };
  }

  // Immediate wake while a deferred backoff/continuation is pending: coalesce
  // onto that timer so mutations/duplicates cannot recreate a short-cycle loop.
  if (delayedTimers.has(localeKey)) {
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
        const passResult = await runLocalizationReconciliationPass(localeKey);
        logger.info("localization.reconciliation.pass", {
          component: "localization-reconciliation-driver",
          locale: localeKey,
          wakeReason: input.reason,
          ran: passResult.ran,
          reason: passResult.reason,
          presentationsScheduled: passResult.presentationsScheduled,
          presentationsDeduped: passResult.presentationsDeduped,
          retryReadyIdentities: passResult.retryReadyIdentities,
          workItemsRequiredBefore: passResult.workItemsRequiredBefore,
          workItemsRequiredAfter: passResult.workItemsRequiredAfter,
          usefulProgress: passResult.usefulProgress,
          continuationKind: passResult.continuationKind,
          continuationScheduled: passResult.continuationScheduled,
          continuationDelayMs: passResult.continuationDelayMs,
          noProgressStreak: passResult.noProgressStreak,
        });
        if (passResult.continuationScheduled) {
          scheduleLocalizationReconciliation({
            locale: localeKey,
            reason: wakeReasonForContinuation(passResult.continuationKind),
            delayMs: passResult.continuationDelayMs,
          });
        }
      } catch (error) {
        logger.warn("localization.reconciliation.pass_failed", {
          component: "localization-reconciliation-driver",
          locale: localeKey,
          wakeReason: input.reason,
          error: error instanceof Error ? error.message : String(error),
        });
        const streak = (noProgressStreakByLocale.get(localeKey) ?? 0) + 1;
        noProgressStreakByLocale.set(localeKey, streak);
        scheduleLocalizationReconciliation({
          locale: localeKey,
          reason: "cooldown_wake",
          delayMs: computeNoProgressDelayMs(streak),
        });
      } finally {
        inFlight.delete(localeKey);
        if (pendingWake.has(localeKey)) {
          pendingWake.delete(localeKey);
          if (delayedTimers.has(localeKey)) {
            // Coalesce onto deferred wake already scheduled by this pass.
          } else {
            scheduleLocalizationReconciliation({
              locale: localeKey,
              reason: input.reason,
              delayMs: 0,
            });
          }
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
        activeDeps().listTargetLocales ??
        listAutomaticContentTranslationTargetLocales;
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
