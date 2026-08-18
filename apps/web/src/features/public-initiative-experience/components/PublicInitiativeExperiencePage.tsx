"use client";

import type { Initiative, PublicInitiativeExperienceProjection } from "@hu/types";
import { isInitiativeLifecycleAuthorWorkspaceStage } from "@hu/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toggleInitiativeBookmark, updateInitiativeSupportSignal } from "../api";
import { isLifecycleStageSelectable } from "../lifecycle-stage-navigation";
import {
  publicSafeOptionalSectionMessage,
  resolveLifecycleShellHash,
  selectLifecycleNavStagesForDisplay,
} from "../initiative-lifecycle-shell";
import { PublicCivicRecordExperienceLayout } from "./PublicCivicRecordExperienceLayout";
import { PublicExperienceHero, buildInitiativeHeroProps } from "./PublicExperienceHero";
import { PublicExperienceSidebarOrChannel } from "./PublicExperienceSidebarOrChannel";
import type { CollaborationTab } from "./InitiativeCollaborationWorkspace";
import { PublicInitiativeCenterPanel, type CenterTab } from "./PublicInitiativeCenterPanel";
import { PublicInitiativeLifecycleNav } from "./PublicInitiativeLifecycleNav";
import { InitiativeOwnerManagePanel } from "../../initiative-owner-studio/components/InitiativeOwnerManagePanel";

import "../public-initiative-experience.css";

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
  /** DISPLAY-ONLY selected stage — never mutates experience.currentStageId. */
  const [selectedStageId, setSelectedStageId] = useState(initialExperience.currentStageId);
  const [showLifecyclePanel, setShowLifecyclePanel] = useState(false);
  const [isStagePreviewMode, setIsStagePreviewMode] = useState(false);
  const [supportBusy, setSupportBusy] = useState(false);
  const [initialDiscussionFilter, setInitialDiscussionFilter] = useState<"collaboration" | undefined>(
    undefined,
  );
  const [collaborationTab, setCollaborationTab] = useState<CollaborationTab | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);

  const viewerIsSteward = Boolean(ownerMode || experience.viewerIsSteward);
  const navStages = useMemo(
    () => selectLifecycleNavStagesForDisplay(experience.lifecycleStages),
    [experience.lifecycleStages],
  );
  const petitionDegradedMessage = publicSafeOptionalSectionMessage(
    experience.optionalStageDiagnostics,
    "petition",
  );

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
      const resolution = resolveLifecycleShellHash(hash, experience.lifecycleStages, {
        allowManage: Boolean(ownerMode),
      });

      switch (resolution.kind) {
        case "manage":
          setShowLifecyclePanel(false);
          setActiveTab("manage");
          ownerMode?.onShowManageTabChange(true);
          return;
        case "discussion_tab":
          // Discussion stage reuses the Center-tab Discussion contract.
          setShowLifecyclePanel(false);
          setActiveTab("discussion");
          setSelectedStageId("discussion");
          ownerMode?.onShowManageTabChange(false);
          return;
        case "collaboration":
          setCollaborationTab(resolution.tab);
          setShowLifecyclePanel(false);
          setActiveTab("overview");
          ownerMode?.onShowManageTabChange(false);
          return;
        case "lifecycle_stage":
          setSelectedStageId(resolution.stageId);
          setShowLifecyclePanel(true);
          ownerMode?.onShowManageTabChange(false);
          return;
        case "fallback_overview":
        default:
          setShowLifecyclePanel(false);
          setActiveTab("overview");
          ownerMode?.onShowManageTabChange(false);
      }
    },
    [experience.lifecycleStages, ownerMode],
  );

  useEffect(() => {
    applyHash(window.location.hash);

    const onHashChange = () => applyHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);

    return () => window.removeEventListener("hashchange", onHashChange);
  }, [applyHash]);

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

    // Discussion lifecycle stage → Center Discussion tab (no second Discussion UI).
    if (stageId === "discussion") {
      setSelectedStageId("discussion");
      setShowLifecyclePanel(false);
      setActiveTab("discussion");
      setIsStagePreviewMode(false);
      ownerMode?.onShowManageTabChange(false);
      window.history.replaceState(null, "", "#discussion");
      scrollToContent();
      return;
    }

    setSelectedStageId(stageId);
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
      setSelectedStageId("discussion");
      ownerMode?.onShowManageTabChange(false);
      window.history.replaceState(null, "", "#discussion");
    } else {
      ownerMode?.onShowManageTabChange(false);
      window.history.replaceState(null, "", window.location.pathname);
    }

    scrollToContent();
  };

  const handleRevisionSelect = (version: number) => {
    setSelectedStageId("revision");
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
          stages={navStages}
          currentStageId={experience.currentStageId}
          selectedStageId={selectedStageId}
          onStageSelect={handleStageSelect}
        />
      }
      center={
        <>
          {petitionDegradedMessage &&
          showLifecyclePanel &&
          selectedStageId === "petition" ? (
            <p className="pie-optional-degraded" role="status">
              {petitionDegradedMessage}
            </p>
          ) : null}
          <PublicInitiativeCenterPanel
            experience={experience}
            activeTab={activeTab}
            activeStageId={selectedStageId}
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
            isOwnerRoute={viewerIsSteward}
            isStagePreviewMode={isStagePreviewMode}
            onToggleStagePreviewMode={() => setIsStagePreviewMode((current) => !current)}
          />
        </>
      }
      sidebar={
        <PublicExperienceSidebarOrChannel
          initiativeId={experience.initiativeId}
          currentStageId={experience.currentStageId}
          lifecycleProfile={experience.lifecycleProfile}
          workspaceStageId={
            showLifecyclePanel && isInitiativeLifecycleAuthorWorkspaceStage(selectedStageId)
              ? selectedStageId
              : null
          }
          isStagePreviewMode={isStagePreviewMode}
          isInitiativeSteward={viewerIsSteward}
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
          participationJourney={experience.participationJourney ?? null}
          viewerIsSteward={viewerIsSteward}
        />
      }
    />
  );
}
