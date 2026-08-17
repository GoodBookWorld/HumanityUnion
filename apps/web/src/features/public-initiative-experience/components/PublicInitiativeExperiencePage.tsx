"use client";

import type { Initiative, PublicInitiativeExperienceProjection } from "@hu/types";
import { useCallback, useEffect, useRef, useState } from "react";

import { toggleInitiativeBookmark, updateInitiativeSupportSignal } from "../api";
import { isLifecycleStageSelectable } from "../lifecycle-stage-navigation";
import { PublicCivicRecordExperienceLayout } from "./PublicCivicRecordExperienceLayout";
import { PublicExperienceHero, buildInitiativeHeroProps } from "./PublicExperienceHero";
import { PublicExperienceSidebarOrChannel } from "./PublicExperienceSidebarOrChannel";
import type { CollaborationTab } from "./InitiativeCollaborationWorkspace";
import { PublicInitiativeCenterPanel, type CenterTab } from "./PublicInitiativeCenterPanel";
import { PublicInitiativeLifecycleNav } from "./PublicInitiativeLifecycleNav";
import { InitiativeOwnerManagePanel } from "../../initiative-owner-studio/components/InitiativeOwnerManagePanel";
import { PUBLIC_INITIATIVE_EXPERIENCE_STAGES } from "@hu/types";

import "../public-initiative-experience.css";

function resolveStageFromHash(hash: string): string | null {
  const normalized = hash.replace(/^#/, "").trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  const stage = PUBLIC_INITIATIVE_EXPERIENCE_STAGES.find((item) => item.hash === normalized);
  return stage?.stageId ?? null;
}

export interface InitiativeExperienceOwnerMode {
  initiative: Initiative;
  showManageTab: boolean;
  onShowManageTabChange: (active: boolean) => void;
  onInitiativeUpdated: (initiative: Initiative) => void;
}

interface PublicInitiativeExperiencePageProps {
  experience: PublicInitiativeExperienceProjection;
  ownerMode?: InitiativeExperienceOwnerMode;
}

export function PublicInitiativeExperiencePage({
  experience: initialExperience,
  ownerMode,
}: PublicInitiativeExperiencePageProps) {
  const [experience, setExperience] = useState(initialExperience);
  const [activeTab, setActiveTab] = useState<CenterTab>(
    ownerMode?.showManageTab ? "manage" : "overview",
  );
  const [activeStageId, setActiveStageId] = useState(initialExperience.currentStageId);
  const [showLifecyclePanel, setShowLifecyclePanel] = useState(false);
  /** Initiative Lifecycle Part A Completion Part 9 — lifted so the Author working sidebar's Preview button and the shell's own footer toggle stay in sync. */
  const [isStagePreviewMode, setIsStagePreviewMode] = useState(false);
  const [supportBusy, setSupportBusy] = useState(false);
  const [initialDiscussionFilter, setInitialDiscussionFilter] = useState<"collaboration" | undefined>(
    undefined,
  );
  /**
   * Communication UX Pack 03.7 Part 10 — "Notifications open the
   * communication context": a Shared Document notification's
   * `relatedUrl` deep-links to `#collaboration-channel` /
   * `#collaboration-sessions`, landing directly on that tab of the
   * Collaboration Workspace (Communication UX Pack 03.5/03.6's existing
   * sidebar-slot swap) instead of always defaulting to Channel.
   */
  const [collaborationTab, setCollaborationTab] = useState<CollaborationTab | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setExperience(initialExperience);
  }, [initialExperience]);

  useEffect(() => {
    if (ownerMode?.showManageTab) {
      setActiveTab("manage");
      setShowLifecyclePanel(false);
    }
  }, [ownerMode?.showManageTab]);

  const scrollToContent = useCallback(() => {
    contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const applyHash = useCallback(
    (hash: string) => {
      const normalized = hash.replace(/^#/, "").trim().toLowerCase();

      if (normalized === "manage" && ownerMode) {
        setShowLifecyclePanel(false);
        setActiveTab("manage");
        ownerMode.onShowManageTabChange(true);
        return;
      }

      if (normalized === "discussion") {
        setShowLifecyclePanel(false);
        setActiveTab("discussion");
        ownerMode?.onShowManageTabChange(false);
        return;
      }

      if (normalized === "collaboration-channel" || normalized === "collaboration-sessions") {
        setCollaborationTab(normalized === "collaboration-channel" ? "channel" : "sessions");
        setShowLifecyclePanel(false);
        setActiveTab("overview");
        ownerMode?.onShowManageTabChange(false);
        return;
      }

      const stageId = resolveStageFromHash(hash);

      if (stageId) {
        setActiveStageId(stageId);
        setShowLifecyclePanel(true);
        ownerMode?.onShowManageTabChange(false);
        return;
      }

      setShowLifecyclePanel(false);
      setActiveTab("overview");
      ownerMode?.onShowManageTabChange(false);
    },
    [ownerMode],
  );

  useEffect(() => {
    applyHash(window.location.hash);

    const onHashChange = () => applyHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);

    return () => window.removeEventListener("hashchange", onHashChange);
  }, [applyHash]);

  /**
   * Profile UX Pack 01 Part 4 — the collaboration-request notification's
   * "Review request" action links to
   * `/initiatives/public/{id}?filter=collaboration#discussion`. The `#discussion`
   * hash is already handled by `applyHash` above; this reads the
   * `filter=collaboration` query parameter (checked once, on initial load,
   * matching how deep links are normally consumed) to also land the viewer
   * directly on the Collaboration working list rather than "All".
   */
  const applyQueryParams = useCallback(
    (search: string) => {
      const filterParam = new URLSearchParams(search).get("filter");

      if (filterParam !== "collaboration") {
        return;
      }

      setShowLifecyclePanel(false);
      setActiveTab("discussion");
      ownerMode?.onShowManageTabChange(false);
      setInitialDiscussionFilter("collaboration");
    },
    [ownerMode],
  );

  useEffect(() => {
    applyQueryParams(window.location.search);
  }, [applyQueryParams]);

  const handleStageSelect = (stageId: string, hash: string) => {
    if (!isLifecycleStageSelectable(experience.lifecycleStages, stageId)) {
      return;
    }

    setActiveStageId(stageId);
    setShowLifecyclePanel(true);
    setIsStagePreviewMode(false);
    ownerMode?.onShowManageTabChange(false);
    window.history.replaceState(null, "", `#${hash}`);
    scrollToContent();
  };

  const handleOpenStagePublicPreview = () => {
    setIsStagePreviewMode(true);
    scrollToContent();
  };

  const handleTabChange = (tab: CenterTab) => {
    setActiveTab(tab);
    setShowLifecyclePanel(false);

    if (tab === "manage") {
      ownerMode?.onShowManageTabChange(true);
      window.history.replaceState(null, "", "#manage");
    } else if (tab === "discussion") {
      ownerMode?.onShowManageTabChange(false);
      window.history.replaceState(null, "", "#discussion");
    } else {
      ownerMode?.onShowManageTabChange(false);
      window.history.replaceState(null, "", window.location.pathname);
    }

    scrollToContent();
  };

  const handleRevisionSelect = (version: number) => {
    setActiveStageId("revision");
    setShowLifecyclePanel(true);
    ownerMode?.onShowManageTabChange(false);
    window.history.replaceState(null, "", "#revision");
    scrollToContent();
    void version;
  };

  const handleSignalChange = async (
    signal: Parameters<typeof updateInitiativeSupportSignal>[1],
  ) => {
    setSupportBusy(true);

    try {
      const stats = await updateInitiativeSupportSignal(experience.initiativeId, signal);
      setExperience((current) => ({
        ...current,
        supportStatistics: {
          ...stats,
          currentUserSignal: stats.currentUserSignal,
          currentUserBookmarked: stats.currentUserBookmarked,
        },
      }));
    } finally {
      setSupportBusy(false);
    }
  };

  const handleBookmarkToggle = async () => {
    setSupportBusy(true);

    try {
      const stats = await toggleInitiativeBookmark(experience.initiativeId);
      setExperience((current) => ({
        ...current,
        supportStatistics: {
          ...stats,
          currentUserSignal: stats.currentUserSignal,
          currentUserBookmarked: stats.currentUserBookmarked,
        },
      }));
    } catch {
      // Bookmark requires authentication.
    } finally {
      setSupportBusy(false);
    }
  };

  return (
    <PublicCivicRecordExperienceLayout
      hero={
        <PublicExperienceHero
          {...buildInitiativeHeroProps(experience.hero)}
          initiativeId={experience.initiativeId}
        />
      }
      lifecycle={
        <PublicInitiativeLifecycleNav
          stages={experience.lifecycleStages}
          activeStageId={activeStageId}
          onStageSelect={handleStageSelect}
        />
      }
      center={
        <PublicInitiativeCenterPanel
          experience={experience}
          activeTab={activeTab}
          activeStageId={activeStageId}
          showLifecyclePanel={showLifecyclePanel}
          onTabChange={handleTabChange}
          contentRef={contentRef}
          showManageTab={Boolean(ownerMode)}
          initialDiscussionFilter={initialDiscussionFilter}
          managePanel={
            ownerMode ? (
              <InitiativeOwnerManagePanel
                initiative={ownerMode.initiative}
                onInitiativeUpdated={ownerMode.onInitiativeUpdated}
              />
            ) : null
          }
          onNavigateStage={handleStageSelect}
          returnToInitiativeHref={
            ownerMode
              ? `/initiatives/${experience.initiativeId}`
              : `/initiatives/public/${experience.initiativeId}`
          }
          isOwnerRoute={Boolean(ownerMode)}
          isStagePreviewMode={isStagePreviewMode}
          onToggleStagePreviewMode={() => setIsStagePreviewMode((current) => !current)}
        />
      }
      sidebar={
        <PublicExperienceSidebarOrChannel
          initiativeId={experience.initiativeId}
          currentStageId={experience.currentStageId}
          workspaceStageId={showLifecyclePanel ? activeStageId : null}
          isStagePreviewMode={isStagePreviewMode}
          isInitiativeSteward={Boolean(ownerMode)}
          onOpenPublicPreview={handleOpenStagePublicPreview}
          onNavigateStage={handleStageSelect}
          collaborationTab={collaborationTab}
          statistics={experience.supportStatistics}
          revisionHistory={experience.revisionHistory}
          latestInitiatives={experience.latestInitiatives}
          relatedInitiatives={experience.relatedInitiatives ?? []}
          onSignalChange={(signal) => void handleSignalChange(signal)}
          onBookmarkToggle={() => void handleBookmarkToggle()}
          onRevisionSelect={handleRevisionSelect}
          supportBusy={supportBusy}
        />
      }
    />
  );
}
