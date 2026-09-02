/**
 * Phase 03 — Initiative Lifecycle Experience Shell helpers.
 *
 * Read-only presentation over Phase 02 resolver outputs already embedded in
 * `PublicInitiativeExperienceProjection`. Never invents a second lifecycle
 * state authority. Hash/selection is DISPLAY-ONLY.
 *
 * Step 02 — Author stage freedom: stewardship unlocks all applicable stages;
 * recommended/current guidance never disables Author navigation.
 *
 * Step 03/04 — upstream artifacts are SOURCE_OPTIONAL; no hard prerequisite
 * helpers remain on this shell.
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
  resolveParticipantFacingCurrentStageId,
} from "@hu/types";

import { parseDiscussionCommentFocusFromHash } from "./discussion-comment-deep-link";
import {
  isLifecycleStageSelectable,
  resolveRecommendedLifecycleStageId,
} from "./lifecycle-stage-navigation";

/** Display/navigation selection — never mutates lifecycle progression. */
export type LifecycleShellSelectedStageId = string;

export type LifecycleShellHashResolution =
  | { kind: "manage" }
  | { kind: "discussion_tab"; focusCommentId?: string }
  | { kind: "collaboration"; tab: "channel" | "sessions" }
  | { kind: "lifecycle_stage"; stageId: string; hash: string; selectable: boolean }
  | { kind: "fallback_overview"; reason: "empty" | "invalid" | "locked" | "not_applicable" | "add_candidate" };

/**
 * Stages shown in the Lifecycle nav. NOT_APPLICABLE stages are omitted so
 * PUBLIC_CHOICE does not render STANDARD-only stages as broken/missing.
 * Fix 05 — PUBLIC_CHOICE also hides Civic Archive from visible nav (domain retained).
 * Full stage list remains on `experience.lifecycleStages` for Guide/read models.
 */
export function selectLifecycleNavStagesForDisplay(
  stages: readonly PublicInitiativeLifecycleStageNavItem[],
  lifecycleProfile?: InitiativeLifecycleProfile | string | null,
): PublicInitiativeLifecycleStageNavItem[] {
  const profile = resolveInitiativeLifecycleProfile(lifecycleProfile);
  return stages
    .filter((stage) => stage.state !== "not_applicable")
    .filter((stage) => !(profile === "PUBLIC_CHOICE" && stage.stageId === "archive"))
    .map((stage) => {
      if (profile === "PUBLIC_CHOICE" && stage.stageId === "collective_decision") {
        return { ...stage, label: "Collective Decision" };
      }
      return stage;
    });
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
 * - Lifecycle stage hashes open the stage panel when selectable for the viewer.
 * - Invalid / locked / not_applicable hashes fall back to Overview (do not
 *   mutate currentStage; do not show false "missing" errors).
 */
export function resolveLifecycleShellHash(
  hash: string,
  stages: readonly PublicInitiativeLifecycleStageNavItem[],
  options?: {
    allowManage?: boolean;
    viewerIsSteward?: boolean;
    lifecycleProfile?: InitiativeLifecycleProfile | string | null;
  },
): LifecycleShellHashResolution {
  const normalized = hash.replace(/^#/, "").trim().toLowerCase();
  const profile = resolveInitiativeLifecycleProfile(options?.lifecycleProfile);

  if (!normalized) {
    return { kind: "fallback_overview", reason: "empty" };
  }

  if (normalized === "manage") {
    return options?.allowManage ? { kind: "manage" } : { kind: "fallback_overview", reason: "invalid" };
  }

  if (normalized === "discussion") {
    return { kind: "discussion_tab" };
  }

  /** Pack 03 — candidate intake deep-link opens Overview (+ form via page state). */
  if (normalized === "add-candidate" || normalized === "overview") {
    return { kind: "fallback_overview", reason: normalized === "add-candidate" ? "add_candidate" : "empty" };
  }

  const focusCommentId = parseDiscussionCommentFocusFromHash(hash);
  if (focusCommentId) {
    return { kind: "discussion_tab", focusCommentId };
  }

  if (normalized === "collaboration-channel") {
    /** Fix 07B — PUBLIC_CHOICE has no Channel sidebar; ignore legacy deep-links. */
    if (profile === "PUBLIC_CHOICE") {
      return { kind: "fallback_overview", reason: "not_applicable" };
    }
    return { kind: "collaboration", tab: "channel" };
  }

  if (normalized === "collaboration-sessions") {
    if (profile === "PUBLIC_CHOICE") {
      return { kind: "fallback_overview", reason: "not_applicable" };
    }
    return { kind: "collaboration", tab: "sessions" };
  }

  const stageId = resolveLifecycleStageFromHash(hash);
  if (!stageId) {
    return { kind: "fallback_overview", reason: "invalid" };
  }

  /** Fix 05/07B — Civic Archive is not a visible PUBLIC_CHOICE stage. */
  if (profile === "PUBLIC_CHOICE" && stageId === "archive") {
    return { kind: "fallback_overview", reason: "not_applicable" };
  }

  const stage = stages.find((item) => item.stageId === stageId);
  if (!stage || stage.state === "not_applicable") {
    return { kind: "fallback_overview", reason: "not_applicable" };
  }

  if (
    !isLifecycleStageSelectable(stages, stageId, {
      viewerIsSteward: options?.viewerIsSteward,
    })
  ) {
    return { kind: "fallback_overview", reason: "locked" };
  }

  return { kind: "lifecycle_stage", stageId, hash: stage.hash, selectable: true };
}

/**
 * Read-only model for a future Lifecycle Guide sidebar.
 * Never owns or mutates lifecycle state.
 *
 * selectedStageId — UI choice only.
 * recommendedStageId — guidance cursor (best next unfinished); never locks Authors.
 * currentStageId — resolver progress cursor (same derivation family as recommended).
 */
export interface InitiativeLifecycleGuideReadModel {
  readonly lifecycleProfile: InitiativeLifecycleProfile;
  readonly currentStageId: string;
  readonly recommendedStageId: string;
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
  const viewerIsSteward = Boolean(input.viewerIsSteward ?? experience.viewerIsSteward);
  const selectOpts = { viewerIsSteward };

  const completedStageIds = stages
    .filter((stage) => stage.state === "completed" || stage.state === "archived" || stage.state === "published")
    .map((stage) => stage.stageId);
  const availableStageIds = stages
    .filter((stage) => isLifecycleStageSelectable(stages, stage.stageId, selectOpts))
    .map((stage) => stage.stageId);
  const lockedStageIds = stages
    .filter(
      (stage) =>
        stage.state !== "not_applicable" &&
        stage.state !== "unavailable" &&
        !isLifecycleStageSelectable(stages, stage.stageId, selectOpts),
    )
    .map((stage) => stage.stageId);
  const notApplicableStageIds = stages
    .filter((stage) => stage.state === "not_applicable")
    .map((stage) => stage.stageId);

  const recommendedStageId =
    experience.recommendedStageId ??
    resolveRecommendedLifecycleStageId(stages, experience.currentStageId);

  const profile = resolveInitiativeLifecycleProfile(experience.lifecycleProfile);
  /** Fix 07B — guide current stage uses the same participant-facing presentation resolver. */
  const currentStageId = resolveParticipantFacingCurrentStageId(
    experience.currentStageId,
    profile,
  );
  const currentIndex = stages.findIndex((stage) => stage.stageId === currentStageId);
  const nextStageId =
    currentIndex >= 0 && currentIndex < stages.length - 1
      ? (stages
          .slice(currentIndex + 1)
          .find(
            (stage) =>
              stage.state !== "not_applicable" &&
              !(profile === "PUBLIC_CHOICE" && stage.stageId === "archive"),
          )?.stageId ?? null)
      : null;

  return {
    lifecycleProfile: profile,
    currentStageId,
    recommendedStageId,
    selectedStageId: input.selectedStageId,
    completedStageIds,
    availableStageIds,
    lockedStageIds,
    notApplicableStageIds,
    nextStageId,
    viewerIsSteward,
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

/**
 * When an optional stage diagnostic is `unavailable`, returns the section id
 * so the shell can resolve a deterministic public-safe next-intl message.
 * Does not surface API/domain reason prose.
 */
export function publicSafeOptionalSectionMessage(
  diagnostics: PublicInitiativeOptionalStageDiagnostics | undefined,
  section: "petition" | "civicArchive",
): "petition" | "civicArchive" | null {
  const entry = diagnostics?.[section];
  if (!entry || entry.health !== "unavailable") {
    return null;
  }
  return section;
}
