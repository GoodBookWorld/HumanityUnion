"use client";

import type { Initiative } from "@hu/types";
import { useCallback, useEffect, useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { getInitiativeById } from "../api";

import { InitiativeExplorer } from "./InitiativeExplorer";
import { InitiativeOverview } from "./InitiativeOverview";
import { StartNewInitiativeButton } from "./StartNewInitiativeButton";
import { ViewCollaborativeAnalysisLink } from "./ViewCollaborativeAnalysisLink";
import { ViewCollectiveDecisionLink } from "../../collective-decision/components/ViewCollectiveDecisionLink";
import { ViewPetitionLink } from "../../petition/components/ViewPetitionLink";

interface InitiativeWorkspaceProps {
  initialInitiatives: Initiative[];
}

export function InitiativeWorkspace({ initialInitiatives }: InitiativeWorkspaceProps) {
  const [initiatives, setInitiatives] = useState(initialInitiatives);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialInitiatives[0]?.initiativeId ?? null,
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
    }
  }, [loadInitiative, selectedId]);

  function handleSelect(initiativeId: string) {
    setSelectedId(initiativeId);
  }

  function handleCreated(initiative: Initiative) {
    setInitiatives((current) => [...current, initiative]);
    setSelectedId(initiative.initiativeId);
  }

  return (
    <>
      <ProfileSection title="Explorer">
        <InitiativeExplorer
          initiatives={initiatives}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </ProfileSection>

      <ProfileSection title="Overview">
        <InitiativeOverview initiative={selectedInitiative} loading={loadingOverview} />
      </ProfileSection>

      <ProfileSection title="Actions">
        <ViewCollaborativeAnalysisLink initiativeId={selectedId} />
        <ViewCollectiveDecisionLink initiativeId={selectedId} />
        <ViewPetitionLink initiativeId={selectedId} />
        <StartNewInitiativeButton onCreated={handleCreated} />
      </ProfileSection>
    </>
  );
}
