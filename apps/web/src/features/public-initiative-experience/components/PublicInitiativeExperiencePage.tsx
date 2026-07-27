"use client";

import type { Initiative, PublicInitiativeExperienceProjection } from "@hu/types";
import { useCallback, useEffect, useRef, useState } from "react";

import { toggleInitiativeBookmark, updateInitiativeSupportSignal } from "../api";
import { PublicCivicRecordExperienceLayout } from "./PublicCivicRecordExperienceLayout";
import { PublicExperienceHero, buildInitiativeHeroProps } from "./PublicExperienceHero";
import { PublicExperienceSidebar } from "./PublicExperienceSidebar";
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
  const [supportBusy, setSupportBusy] = useState(false);
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

  const handleStageSelect = (stageId: string, hash: string) => {
    setActiveStageId(stageId);
    setShowLifecyclePanel(true);
    ownerMode?.onShowManageTabChange(false);
    window.history.replaceState(null, "", `#${hash}`);
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
      hero={<PublicExperienceHero {...buildInitiativeHeroProps(experience.hero)} />}
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
          managePanel={
            ownerMode ? (
              <InitiativeOwnerManagePanel
                initiative={ownerMode.initiative}
                onInitiativeUpdated={ownerMode.onInitiativeUpdated}
              />
            ) : null
          }
        />
      }
      sidebar={
        <PublicExperienceSidebar
          initiativeId={experience.initiativeId}
          statistics={experience.supportStatistics}
          revisionHistory={experience.revisionHistory}
          latestInitiatives={experience.latestInitiatives}
          onSignalChange={(signal) => void handleSignalChange(signal)}
          onBookmarkToggle={() => void handleBookmarkToggle()}
          onRevisionSelect={handleRevisionSelect}
          supportBusy={supportBusy}
        />
      }
    />
  );
}
