"use client";

import type { Initiative } from "@hu/types";
import { useCallback, useEffect, useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { getInitiativeById } from "../api";
import { BOOTSTRAP_STEWARD_ID } from "../initiative-lifecycle-labels";

import { InitiativeDraftEditor } from "./InitiativeDraftEditor";
import { InitiativeLifecycleTimeline } from "./InitiativeLifecycleTimeline";
import { InitiativeOverview } from "./InitiativeOverview";
import { InitiativePublishedEditor } from "./InitiativePublishedEditor";
import { MyInitiativesDashboard } from "./MyInitiativesDashboard";
import { StartNewInitiativeButton } from "./StartNewInitiativeButton";
import { ViewCollaborativeAnalysisLink } from "./ViewCollaborativeAnalysisLink";
import { ViewCollectiveDecisionLink } from "../../collective-decision/components/ViewCollectiveDecisionLink";
import { ViewPetitionLink } from "../../petition/components/ViewPetitionLink";

interface InitiativeWorkspaceProps {
  initialInitiatives: Initiative[];
}

function isMyInitiative(initiative: Initiative): boolean {
  return initiative.stewardId === BOOTSTRAP_STEWARD_ID;
}

export function InitiativeWorkspace({ initialInitiatives }: InitiativeWorkspaceProps) {
  const myInitiatives = initialInitiatives.filter(isMyInitiative);
  const [initiatives, setInitiatives] = useState(myInitiatives);
  const [selectedId, setSelectedId] = useState<string | null>(
    myInitiatives[0]?.initiativeId ?? null,
  );
  const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const loadInitiative = useCallback(async (initiativeId: string) => {
    setLoadingOverview(true);

    try {
      const initiative = await getInitiativeById(initiativeId);
      setSelectedInitiative(initiative);
    } catch {
      setSelectedInitiative(null);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadInitiative(selectedId);
    } else {
      setSelectedInitiative(null);
    }
  }, [loadInitiative, selectedId]);

  function handleSelect(initiativeId: string) {
    setSelectedId(initiativeId);
  }

  function handleCreated(initiative: Initiative) {
    setInitiatives((current) => [...current, initiative]);
    setSelectedId(initiative.initiativeId);
  }

  function handleUpdated(initiative: Initiative) {
    setInitiatives((current) =>
      current.map((item) => (item.initiativeId === initiative.initiativeId ? initiative : item)),
    );
    setSelectedInitiative(initiative);
  }

  function renderManagementEditor() {
    if (!selectedInitiative) {
      return null;
    }

    if (selectedInitiative.lifecyclePhase === "draft") {
      return <InitiativeDraftEditor initiative={selectedInitiative} onUpdated={handleUpdated} />;
    }

    if (
      selectedInitiative.lifecyclePhase === "published" ||
      selectedInitiative.lifecyclePhase === "projected" ||
      selectedInitiative.lifecyclePhase === "archived"
    ) {
      return (
        <InitiativePublishedEditor initiative={selectedInitiative} onUpdated={handleUpdated} />
      );
    }

    return null;
  }

  return (
    <>
      <ProfileSection title="My Initiatives">
        <MyInitiativesDashboard
          initiatives={initiatives}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </ProfileSection>

      <ProfileSection title="Overview">
        <InitiativeOverview initiative={selectedInitiative} loading={loadingOverview} />
      </ProfileSection>

      <ProfileSection title="Lifecycle Timeline">
        <InitiativeLifecycleTimeline initiative={selectedInitiative} />
      </ProfileSection>

      <ProfileSection title="Manage Initiative">
        {renderManagementEditor()}
        <ViewCollaborativeAnalysisLink initiativeId={selectedId} />
        <ViewCollectiveDecisionLink initiativeId={selectedId} />
        <ViewPetitionLink initiativeId={selectedId} />
        <StartNewInitiativeButton onCreated={handleCreated} />
      </ProfileSection>
    </>
  );
}
