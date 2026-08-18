/**
 * Phase 03 — Initiative Lifecycle Experience Shell helpers.
 *
 * Read-only presentation over Phase 02 resolver outputs already embedded in
 * `PublicInitiativeExperienceProjection`. Never invents a second lifecycle
 * state authority. Hash/selection is DISPLAY-ONLY.
 */

import type {
  InitiativeLifecycleProfile,
  PublicInitiativeExperienceProjection,
  PublicInitiativeLifecycleStageNavItem,
  PublicInitiativeOptionalStageDiagnostics,
} from "@hu/types";
import {
  PUBLIC_INITIATIVE_EXPERIENCE_STAGES,
  resolveInitiativeLifecycleProfile,
} from "@hu/types";

import { parseDiscussionCommentFocusFromHash } from "./discussion-comment-deep-link";
import { isLifecycleStageSelectable } from "./lifecycle-stage-navigation";

/** Display/navigation selection — never mutates lifecycle progression. */
export type LifecycleShellSelectedStageId = string;

export type LifecycleShellHashResolution =
  | { kind: "manage" }
  | { kind: "discussion_tab"; focusCommentId?: string }
  | { kind: "collaboration"; tab: "channel" | "sessions" }
  | { kind: "lifecycle_stage"; stageId: string; hash: string; selectable: boolean }
  | { kind: "fallback_overview"; reason: "empty" | "invalid" | "locked" | "not_applicable" };

/**
 * Final Certification Fix 02 — Archive Author workspace prerequisite.
 * Uses the canonical profile resolver only (no second progression engine).
 * STANDARD: Public Impact remains required. PUBLIC_CHOICE: not required.
 */
export function requiresPublicImpactBeforeCivicArchive(
  lifecycleProfile: InitiativeLifecycleProfile | string | null | undefined,
): boolean {
  return resolveInitiativeLifecycleProfile(lifecycleProfile) !== "PUBLIC_CHOICE";
}

/**
 * Final Certification Fix 03 — Collective Decision Author workspace prerequisite.
 * Uses the canonical profile resolver only (no second progression engine).
 * STANDARD: Decision Session remains required. PUBLIC_CHOICE: not required.
 */
export function requiresDecisionSessionBeforeCollectiveDecision(
  lifecycleProfile: InitiativeLifecycleProfile | string | null | undefined,
): boolean {
  return resolveInitiativeLifecycleProfile(lifecycleProfile) !== "PUBLIC_CHOICE";
}

/**
 * Stages shown in the Lifecycle nav. NOT_APPLICABLE stages are omitted so
 * PUBLIC_CHOICE does not render STANDARD-only stages as broken/missing.
 * Full stage list remains on `experience.lifecycleStages` for Guide/read models.
 */
export function selectLifecycleNavStagesForDisplay(
  stages: readonly PublicInitiativeLifecycleStageNavItem[],
): PublicInitiativeLifecycleStageNavItem[] {
  return stages.filter((stage) => stage.state !== "not_applicable");
}

export function resolveLifecycleStageFromHash(hash: string): string | null {
  const normalized = hash.replace(/^#/, "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const stage = PUBLIC_INITIATIVE_EXPERIENCE_STAGES.find((item) => item.hash === normalized);
  return stage?.stageId ?? null;
}

/**
 * Canonical hash/URL behavior for the Initiative experience shell.
 *
 * - `#discussion` opens the Center Discussion tab (reuses Center-tab contract;
 *   does not invent a second Discussion workspace).
 * - `#comment-{commentId}` opens the same Discussion tab and focuses that
 *   comment (Collaborative Analysis "View in Discussion" deep link).
 * - Lifecycle stage hashes open the stage panel when selectable.
 * - Invalid / locked / not_applicable hashes fall back to Overview (do not
 *   mutate currentStage; do not show false "missing" errors).
 */
export function resolveLifecycleShellHash(
  hash: string,
  stages: readonly PublicInitiativeLifecycleStageNavItem[],
  options?: { allowManage?: boolean },
): LifecycleShellHashResolution {
  const normalized = hash.replace(/^#/, "").trim().toLowerCase();

  if (!normalized) {
    return { kind: "fallback_overview", reason: "empty" };
  }

  if (normalized === "manage") {
    return options?.allowManage ? { kind: "manage" } : { kind: "fallback_overview", reason: "invalid" };
  }

  if (normalized === "discussion") {
    return { kind: "discussion_tab" };
  }

  const focusCommentId = parseDiscussionCommentFocusFromHash(hash);
  if (focusCommentId) {
    return { kind: "discussion_tab", focusCommentId };
  }

  if (normalized === "collaboration-channel") {
    return { kind: "collaboration", tab: "channel" };
  }

  if (normalized === "collaboration-sessions") {
    return { kind: "collaboration", tab: "sessions" };
  }

  const stageId = resolveLifecycleStageFromHash(hash);
  if (!stageId) {
    return { kind: "fallback_overview", reason: "invalid" };
  }

  const stage = stages.find((item) => item.stageId === stageId);
  if (!stage || stage.state === "not_applicable") {
    return { kind: "fallback_overview", reason: "not_applicable" };
  }

  if (!isLifecycleStageSelectable(stages, stageId)) {
    return { kind: "fallback_overview", reason: "locked" };
  }

  return { kind: "lifecycle_stage", stageId, hash: stage.hash, selectable: true };
}

/**
 * Read-only model for a future Lifecycle Guide sidebar.
 * Never owns or mutates lifecycle state.
 */
export interface InitiativeLifecycleGuideReadModel {
  readonly lifecycleProfile: InitiativeLifecycleProfile;
  readonly currentStageId: string;
  readonly selectedStageId: string;
  readonly completedStageIds: readonly string[];
  readonly availableStageIds: readonly string[];
  readonly lockedStageIds: readonly string[];
  readonly notApplicableStageIds: readonly string[];
  readonly nextStageId: string | null;
  readonly viewerIsSteward: boolean;
  readonly optionalStageDiagnostics?: PublicInitiativeOptionalStageDiagnostics;
  readonly stages: readonly PublicInitiativeLifecycleStageNavItem[];
}

export function buildLifecycleGuideReadModel(input: {
  experience: PublicInitiativeExperienceProjection;
  selectedStageId: string;
  viewerIsSteward?: boolean;
}): InitiativeLifecycleGuideReadModel {
  const { experience } = input;
  const stages = experience.lifecycleStages;
  const completedStageIds = stages
    .filter((stage) => stage.state === "completed" || stage.state === "archived" || stage.state === "published")
    .map((stage) => stage.stageId);
  const availableStageIds = stages
    .filter((stage) => isLifecycleStageSelectable(stages, stage.stageId))
    .map((stage) => stage.stageId);
  const lockedStageIds = stages
    .filter((stage) => stage.state === "not_started" && !isLifecycleStageSelectable(stages, stage.stageId))
    .map((stage) => stage.stageId);
  const notApplicableStageIds = stages
    .filter((stage) => stage.state === "not_applicable")
    .map((stage) => stage.stageId);

  const currentIndex = stages.findIndex((stage) => stage.stageId === experience.currentStageId);
  const nextStageId =
    currentIndex >= 0 && currentIndex < stages.length - 1
      ? (stages.slice(currentIndex + 1).find((stage) => stage.state !== "not_applicable")?.stageId ??
        null)
      : null;

  return {
    lifecycleProfile: resolveInitiativeLifecycleProfile(experience.lifecycleProfile),
    currentStageId: experience.currentStageId,
    selectedStageId: input.selectedStageId,
    completedStageIds,
    availableStageIds,
    lockedStageIds,
    notApplicableStageIds,
    nextStageId,
    viewerIsSteward: Boolean(input.viewerIsSteward ?? experience.viewerIsSteward),
    optionalStageDiagnostics: experience.optionalStageDiagnostics,
    stages,
  };
}

/** Author Mode eligibility for the shell — stewardship + stage applicability, never Allies. */
export function resolveShellAuthorModeEligible(input: {
  viewerIsSteward: boolean;
  selectedStageId: string | null;
  isAuthorWorkspaceStage: (stageId: string) => boolean;
}): boolean {
  if (!input.viewerIsSteward || !input.selectedStageId) {
    return false;
  }
  return input.isAuthorWorkspaceStage(input.selectedStageId);
}

export function publicSafeOptionalSectionMessage(
  diagnostics: PublicInitiativeOptionalStageDiagnostics | undefined,
  section: "petition" | "civicArchive",
): string | null {
  const entry = diagnostics?.[section];
  if (!entry || entry.health !== "unavailable") {
    return null;
  }
  return section === "petition"
    ? "Petition information is temporarily unavailable."
    : "Civic Archive information is temporarily unavailable.";
}
