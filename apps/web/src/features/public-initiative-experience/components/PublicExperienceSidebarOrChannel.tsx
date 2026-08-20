"use client";

import { type ComponentProps, useEffect, useState } from "react";

import {
  isInitiativeLifecycleAuthorWorkspaceStage,
  PUBLIC_INITIATIVE_EXPERIENCE_STAGES,
  type InitiativeLifecycleProfile,
} from "@hu/types";

import { getInitiativeActiveAlliesTeam } from "../../initiative-active-allies/api";
import { InitiativeLifecycleWorkingSidebar } from "../../initiative-lifecycle-stage-workspace";
import { InitiativeCollaborationWorkspace, type CollaborationTab } from "./InitiativeCollaborationWorkspace";
import { PublicExperienceSidebar } from "./PublicExperienceSidebar";

const ANALYSIS_STAGE_INDEX = PUBLIC_INITIATIVE_EXPERIENCE_STAGES.findIndex(
  (stage) => stage.stageId === "analysis",
);

function isAtOrBeyondCollaborativeAnalysis(currentStageId: string): boolean {
  const currentIndex = PUBLIC_INITIATIVE_EXPERIENCE_STAGES.findIndex(
    (stage) => stage.stageId === currentStageId,
  );

  return currentIndex >= 0 && ANALYSIS_STAGE_INDEX >= 0 && currentIndex >= ANALYSIS_STAGE_INDEX;
}

type PublicExperienceSidebarProps = ComponentProps<typeof PublicExperienceSidebar>;

interface PublicExperienceSidebarOrChannelProps extends PublicExperienceSidebarProps {
  /**
   * Communication UX Pack 03.5 Part 3 — the Initiative's server-computed
   * overall lifecycle progress (never the ephemeral, nav-selected
   * `activeStageId`): the Channel is a persistent working tool once the
   * Initiative has genuinely reached Collaborative Analysis, not a panel
   * that flips back to the public sidebar whenever the Author scrolls the
   * lifecycle nav back to view an earlier stage's public record.
   */
  currentStageId: string;
  /** Canonical Lifecycle Profile from the experience projection (Fix 02 Archive gating). */
  lifecycleProfile?: InitiativeLifecycleProfile | string | null;
  /** Communication UX Pack 03.7 Part 10 — forwarded to `InitiativeCollaborationWorkspace` so a Shared Document notification can deep-link straight to the right tab. */
  collaborationTab?: CollaborationTab;
  /**
   * Initiative Lifecycle — Part A Completion Part 4/6 — the nav-SELECTED
   * stage (`null` when the lifecycle panel is not showing), distinct from
   * `currentStageId` (the Initiative's overall progress, used only by the
   * pre-existing Channel-swap rule above). Author working-sidebar tools
   * are contextual to whichever stage the Author is actively viewing, so
   * this must track navigation, not overall progress.
   */
  workspaceStageId?: string | null;
  onOpenPublicPreview?: () => void;
  onNavigateStage?: (stageId: string, hash: string) => void;
  /**
   * Initiative Lifecycle — Part B, Section 7 (Public Preview): while the
   * Author has toggled the shared shell into Public Preview, the sidebar
   * must show exactly what a visitor would see — the Public Sidebar —
   * never the Author's own Working Sidebar or the Collaboration Channel.
   */
  isStagePreviewMode?: boolean;
  /**
   * Phase 02 — when Allies team fetch fails, stewards must still resolve as
   * Author so Author Mode tools do not disappear due to an optional Allies
   * projection failure.
   */
  isInitiativeSteward?: boolean;
}

/**
 * Communication UX Pack 03.5 Part 2/3 (extended by Pack 03.6 Part 1) — the
 * one sidebar-slot decision point: the Collaboration Workspace (Channel +
 * Sessions tabs) replaces the public sidebar for the Author AND every
 * Active Ally (both have full access to both, Part 2) once the Initiative
 * has reached Collaborative Analysis; every other viewer (a guest, or a
 * Participant who is neither, Part 2) keeps seeing the unchanged public
 * sidebar. Self-fetching (mirrors `InitiativeActiveAlliesWidget`'s Part 23
 * convention) so this is the only new data dependency
 * `PublicInitiativeExperiencePage` needs.
 */
export function PublicExperienceSidebarOrChannel({
  currentStageId,
  lifecycleProfile,
  collaborationTab,
  workspaceStageId,
  onOpenPublicPreview,
  onNavigateStage,
  isStagePreviewMode = false,
  isInitiativeSteward = false,
  ...sidebarProps
}: PublicExperienceSidebarOrChannelProps) {
  const [viewerRole, setViewerRole] = useState<"author" | "active_ally" | "other" | "loading">(
    () => (isInitiativeSteward ? "author" : "loading"),
  );

  useEffect(() => {
    let cancelled = false;
    if (!isInitiativeSteward) {
      setViewerRole("loading");
    } else {
      setViewerRole("author");
    }

    getInitiativeActiveAlliesTeam(sidebarProps.initiativeId)
      .then((team) => {
        if (cancelled) {
          return;
        }

        // Phase 03 — stewardship wins over Allies projection for Author Mode.
        if (isInitiativeSteward) {
          setViewerRole("author");
          return;
        }

        setViewerRole(
          team.viewerRole === "author" || team.viewerRole === "active_ally" ? team.viewerRole : "other",
        );
      })
      .catch(() => {
        if (!cancelled) {
          setViewerRole(isInitiativeSteward ? "author" : "other");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sidebarProps.initiativeId, isInitiativeSteward]);

  // Initiative Lifecycle Part A Completion Part 4/6 — the Author's working
  // sidebar takes priority over the pre-existing Channel swap below, but
  // ONLY for the Author and ONLY while a stage-specific lifecycle panel
  // (Collaborative Analysis or later) is actually selected. An Active Ally
  // is deliberately excluded here — Part 4 keeps Active Ally in Public
  // Mode with no Author editing tools, and this Part does not alter the
  // Active Ally's existing Collaboration Channel sidebar access below
  // (scope protection). The Channel itself remains fully reachable for the
  // Author too via the unified Messages workspace, not removed —
  // only no longer the default sidebar slot while working a stage.
  if (
    !isStagePreviewMode &&
    viewerRole === "author" &&
    workspaceStageId &&
    isInitiativeLifecycleAuthorWorkspaceStage(workspaceStageId) &&
    onOpenPublicPreview &&
    onNavigateStage
  ) {
    return (
      <InitiativeLifecycleWorkingSidebar
        initiativeId={sidebarProps.initiativeId}
        stageId={workspaceStageId}
        lifecycleProfile={lifecycleProfile}
        onOpenPublicPreview={onOpenPublicPreview}
        onNavigateNextStage={onNavigateStage}
        supportStatistics={sidebarProps.statistics}
        onSupportSignalChange={sidebarProps.onSignalChange}
        onSupportBookmarkToggle={sidebarProps.onBookmarkToggle}
        supportBusy={sidebarProps.supportBusy}
      />
    );
  }

  const showChannel =
    !isStagePreviewMode &&
    (viewerRole === "author" || viewerRole === "active_ally") &&
    isAtOrBeyondCollaborativeAnalysis(currentStageId);

  if (showChannel) {
    return <InitiativeCollaborationWorkspace initiativeId={sidebarProps.initiativeId} initialTab={collaborationTab} />;
  }

  return <PublicExperienceSidebar {...sidebarProps} lifecycleProfile={lifecycleProfile} />;
}
