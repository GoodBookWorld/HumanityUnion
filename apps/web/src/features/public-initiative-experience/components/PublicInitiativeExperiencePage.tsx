"use client";

import type { Initiative, PublicInitiativeExperienceProjection } from "@hu/types";
import { isInitiativeLifecycleAuthorWorkspaceStage } from "@hu/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toggleInitiativeBookmark, updateInitiativeSupportSignal } from "../api";
import { InitiativeExperienceRefreshProvider } from "../initiative-experience-refresh-context";
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
import { buildInitiativeExperienceHref } from "../../initiative-owner-studio/initiative-experience-routes";

import "../public-initiative-experience.css";

interface PublicInitiativeExperiencePageProps {
  experience: PublicInitiativeExperienceProjection;
  /** Steward Manage panel record — loaded only when viewer is steward; never grants Manage by itself. */
  manageInitiative?: Initiative | null;
  onManageInitiativeUpdated?: (initiative: Initiative) => void;
  /** Refetch canonical experience (lifecycleStages, viewerIsSteward, sidebar). */
  onExperienceRefetch?: () => Promise<void>;
}

export function PublicInitiativeExperiencePage({
  experience: initialExperience,
  manageInitiative = null,
  onManageInitiativeUpdated,
  onExperienceRefetch,
}: PublicInitiativeExperiencePageProps) {
  const [experience, setExperience] = useState(initialExperience);
  const [showManageTab, setShowManageTab] = useState(false);
  const [activeTab, setActiveTab] = useState<CenterTab>("overview");
  /** DISPLAY-ONLY selected stage — never mutates experience.currentStageId. */
  const [selectedStageId, setSelectedStageId] = useState(initialExperience.currentStageId);
  const [showLifecyclePanel, setShowLifecyclePanel] = useState(false);
  const [isStagePreviewMode, setIsStagePreviewMode] = useState(false);
  const [supportBusy, setSupportBusy] = useState(false);
  const [initialDiscussionFilter, setInitialDiscussionFilter] = useState<"collaboration" | undefined>(
    undefined,
  );
  const [focusDiscussionCommentId, setFocusDiscussionCommentId] = useState<string | undefined>(
    undefined,
  );
  const [collaborationTab, setCollaborationTab] = useState<CollaborationTab | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);

  const viewerIsSteward = Boolean(experience.viewerIsSteward);
  const canShowManage = viewerIsSteward && manageInitiative != null;
  const navStages = useMemo(
    () => selectLifecycleNavStagesForDisplay(experience.lifecycleStages),
    [experience.lifecycleStages],
  );
  const petitionDegradedMessage = publicSafeOptionalSectionMessage(
    experience.optionalStageDiagnostics,
    "petition",
  );
  const returnToInitiativeHref = buildInitiativeExperienceHref(experience.initiativeId);

  const refreshExperience = useCallback(async () => {
    if (onExperienceRefetch) {
      await onExperienceRefetch();
      return;
    }

    const { getPublicInitiativeExperience } = await import("../api");
    const next = await getPublicInitiativeExperience(experience.initiativeId);
    setExperience(next);
  }, [experience.initiativeId, onExperienceRefetch]);

  useEffect(() => {
    setExperience(initialExperience);
  }, [initialExperience]);

  useEffect(() => {
    if (showManageTab && canShowManage) {
      setActiveTab("manage");
      setShowLifecyclePanel(false);
    }
  }, [showManageTab, canShowManage]);

  const scrollToContent = useCallback(() => {
    contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const applyHash = useCallback(
    (hash: string) => {
      const resolution = resolveLifecycleShellHash(hash, experience.lifecycleStages, {
        allowManage: canShowManage,
        viewerIsSteward,
      });

      switch (resolution.kind) {
        case "manage":
          setShowLifecyclePanel(false);
          setActiveTab("manage");
          setFocusDiscussionCommentId(undefined);
          setShowManageTab(true);
          return;
        case "discussion_tab":
          setShowLifecyclePanel(false);
          setActiveTab("discussion");
          setSelectedStageId("discussion");
          setFocusDiscussionCommentId(resolution.focusCommentId);
          setShowManageTab(false);
          return;
        case "collaboration":
          setCollaborationTab(resolution.tab);
          setShowLifecyclePanel(false);
          setActiveTab("overview");
          setFocusDiscussionCommentId(undefined);
          setShowManageTab(false);
          return;
        case "lifecycle_stage":
          setSelectedStageId(resolution.stageId);
          setShowLifecyclePanel(true);
          setFocusDiscussionCommentId(undefined);
          setShowManageTab(false);
          return;
        case "fallback_overview":
        default:
          setShowLifecyclePanel(false);
          setActiveTab("overview");
          setFocusDiscussionCommentId(undefined);
          setShowManageTab(false);
      }
    },
    [experience.lifecycleStages, canShowManage, viewerIsSteward],
  );

  useEffect(() => {
    applyHash(window.location.hash);

    const onHashChange = () => applyHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);

    return () => window.removeEventListener("hashchange", onHashChange);
  }, [applyHash]);

  const applyQueryParams = useCallback((search: string) => {
    const filterParam = new URLSearchParams(search).get("filter");

    if (filterParam !== "collaboration") {
      return;
    }

    setShowLifecyclePanel(false);
    setActiveTab("discussion");
    setShowManageTab(false);
    setInitialDiscussionFilter("collaboration");
  }, []);

  useEffect(() => {
    applyQueryParams(window.location.search);
  }, [applyQueryParams]);

  const handleStageSelect = (stageId: string, hash: string) => {
    if (
      !isLifecycleStageSelectable(experience.lifecycleStages, stageId, {
        viewerIsSteward,
      })
    ) {
      return;
    }

    if (stageId === "discussion") {
      setSelectedStageId("discussion");
      setShowLifecyclePanel(false);
      setActiveTab("discussion");
      setIsStagePreviewMode(false);
      setFocusDiscussionCommentId(undefined);
      setShowManageTab(false);
      window.history.replaceState(null, "", "#discussion");
      scrollToContent();
      return;
    }

    setSelectedStageId(stageId);
    setShowLifecyclePanel(true);
    setIsStagePreviewMode(false);
    setShowManageTab(false);
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
      setShowManageTab(true);
      window.history.replaceState(null, "", "#manage");
    } else if (tab === "discussion") {
      setSelectedStageId("discussion");
      setFocusDiscussionCommentId(undefined);
      setShowManageTab(false);
      window.history.replaceState(null, "", "#discussion");
    } else {
      setShowManageTab(false);
      window.history.replaceState(null, "", window.location.pathname);
    }

    scrollToContent();
  };

  const handleRevisionSelect = (version: number) => {
    const href = `${returnToInitiativeHref}/revisions/${version}`;
    window.location.assign(href);
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

  const refreshApi = useMemo(
    () => ({
      refresh: refreshExperience,
    }),
    [refreshExperience],
  );

  return (
    <InitiativeExperienceRefreshProvider value={refreshApi}>
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
            viewerIsSteward={viewerIsSteward}
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
              showManageTab={canShowManage}
              initialDiscussionFilter={initialDiscussionFilter}
              focusDiscussionCommentId={focusDiscussionCommentId}
              managePanel={
                canShowManage && manageInitiative ? (
                  <InitiativeOwnerManagePanel
                    initiative={manageInitiative}
                    onInitiativeUpdated={(updated) => {
                      onManageInitiativeUpdated?.(updated);
                      void refreshExperience();
                    }}
                  />
                ) : null
              }
              onNavigateStage={handleStageSelect}
              returnToInitiativeHref={returnToInitiativeHref}
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
    </InitiativeExperienceRefreshProvider>
  );
}
