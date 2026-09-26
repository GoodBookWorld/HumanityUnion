/**
 * STEP 15D.14.C — Gate C: unified localization reconciliation planner.
 *
 * Consumes Gate B / B.2 classification semantics. Does not invent currentness.
 *
 * READY           → preserve (no provider work)
 * MISSING         → generate
 * STALE           → regenerate (sourceVersion and/or localizationInputVersion)
 * INVALID         → regenerate (deterministic / terminology / structure)
 * BLOCKED         → preserve/report
 * NOT_APPLICABLE  → no work (incl. SOURCE_ORIGINAL)
 *
 * Priority (deterministic, language-agnostic): INVALID → STALE → MISSING.
 * One planner for CT + genuinely translatable PLP owners.
 */

import type { ContentTranslationReconciliationState } from "./content-translation-validity.js";

export type LocalizationReconciliationOwner =
  | "CT"
  | "PLP"
  | "SOURCE_ORIGINAL"
  | "NOT_APPLICABLE";

export type LocalizationReconciliationWorkAction =
  | "PRESERVE"
  | "GENERATE"
  | "REGENERATE"
  | "REPORT_BLOCKED"
  | "NO_WORK";

export type LocalizationReconciliationPlanItem = {
  readonly owner: LocalizationReconciliationOwner;
  readonly entityType: string;
  readonly entityId: string;
  readonly targetLocale: string;
  readonly sourceVersion: string | null;
  readonly localizationInputVersion: string | null;
  readonly reconciliationState: ContentTranslationReconciliationState;
  readonly action: LocalizationReconciliationWorkAction;
  readonly priority: number;
  readonly workRemaining: boolean;
  readonly reasons: readonly string[];
};

/** Lower number = higher priority. */
export function reconciliationWorkPriority(
  state: ContentTranslationReconciliationState,
): number {
  switch (state) {
    case "INVALID":
      return 1;
    case "STALE":
      return 2;
    case "MISSING":
      return 3;
    case "BLOCKED":
      return 4;
    case "READY":
    case "NOT_APPLICABLE":
      return 100;
    default:
      return 50;
  }
}

export function reconciliationActionForState(
  state: ContentTranslationReconciliationState,
): LocalizationReconciliationWorkAction {
  switch (state) {
    case "READY":
      return "PRESERVE";
    case "MISSING":
      return "GENERATE";
    case "STALE":
    case "INVALID":
      return "REGENERATE";
    case "BLOCKED":
      return "REPORT_BLOCKED";
    case "NOT_APPLICABLE":
      return "NO_WORK";
    default:
      return "NO_WORK";
  }
}

/**
 * Build one plan item from an already-classified reconciliation state.
 * Callers supply owner/entity identity; planner never invents classification.
 */
export function planLocalizationReconciliationItem(input: {
  readonly owner: LocalizationReconciliationOwner;
  readonly entityType: string;
  readonly entityId: string;
  readonly targetLocale: string;
  readonly sourceVersion?: string | null;
  readonly localizationInputVersion?: string | null;
  readonly reconciliationState: ContentTranslationReconciliationState;
  readonly reasons?: readonly string[];
}): LocalizationReconciliationPlanItem {
  const action = reconciliationActionForState(input.reconciliationState);
  const workRemaining =
    action === "GENERATE" ||
    action === "REGENERATE" ||
    action === "REPORT_BLOCKED";
  return {
    owner: input.owner,
    entityType: input.entityType,
    entityId: input.entityId,
    targetLocale: input.targetLocale,
    sourceVersion: input.sourceVersion ?? null,
    localizationInputVersion: input.localizationInputVersion ?? null,
    reconciliationState: input.reconciliationState,
    action,
    priority: reconciliationWorkPriority(input.reconciliationState),
    workRemaining,
    reasons: input.reasons ?? [],
  };
}

/** Sort INVALID → STALE → MISSING, then stable by entity/locale. */
export function sortLocalizationReconciliationPlan(
  items: readonly LocalizationReconciliationPlanItem[],
): LocalizationReconciliationPlanItem[] {
  return [...items].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    const owner = a.owner.localeCompare(b.owner);
    if (owner !== 0) {
      return owner;
    }
    const type = a.entityType.localeCompare(b.entityType);
    if (type !== 0) {
      return type;
    }
    const id = a.entityId.localeCompare(b.entityId);
    if (id !== 0) {
      return id;
    }
    return a.targetLocale.localeCompare(b.targetLocale);
  });
}

export function isProviderWorkAction(
  action: LocalizationReconciliationWorkAction,
): boolean {
  return action === "GENERATE" || action === "REGENERATE";
}

/**
 * SOURCE_ORIGINAL / NOT_APPLICABLE owners never produce provider work.
 * participant_public biography/skills and Public News use this exclusion.
 */
export function planSourceOriginalExclusion(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly targetLocale: string;
  readonly reason: string;
}): LocalizationReconciliationPlanItem {
  return planLocalizationReconciliationItem({
    owner: "SOURCE_ORIGINAL",
    entityType: input.entityType,
    entityId: input.entityId,
    targetLocale: input.targetLocale,
    reconciliationState: "NOT_APPLICABLE",
    reasons: [input.reason],
  });
}
