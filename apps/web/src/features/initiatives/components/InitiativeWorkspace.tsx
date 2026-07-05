"use client";

import type { Initiative } from "@hu/types";
import { useCallback, useEffect, useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { getInitiativeById } from "../api";

import { InitiativeDraftEditor } from "./InitiativeDraftEditor";
import { InitiativeLifecycleTimeline } from "./InitiativeLifecycleTimeline";
import { InitiativeOverview } from "./InitiativeOverview";
import { InitiativePublishedEditor } from "./InitiativePublishedEditor";
import { MyInitiativesDashboard } from "./MyInitiativesDashboard";
import { StartNewInitiativeButton } from "./StartNewInitiativeButton";
import { ViewCollaborativeAnalysisLink } from "./ViewCollaborativeAnalysisLink";
import { ViewCollectiveDecisionLink } from "../../collective-decision/components/ViewCollectiveDecisionLink";
import { ViewPetitionLink } from "../../petition/components/ViewPetitionLink";
import { InitiativeAnalysisWorkspace } from "../../initiative-collaborative-analysis/components/InitiativeAnalysisWorkspace";
import { InitiativeImprovementProposalStewardPanel } from "../../initiative-improvement-proposal/components/InitiativeImprovementProposalStewardPanel";
import { InitiativeRevisionWorkspace } from "../../initiative-version-revision/components/InitiativeRevisionWorkspace";
import { DecisionSessionWorkspace } from "../../decision-session/components/DecisionSessionWorkspace";
import { CivicCompatibilityReviewWorkspace } from "../../civic-compatibility-review/components/CivicCompatibilityReviewWorkspace";

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

      {selectedInitiative ? (
        <ProfileSection title="Collaborative Analysis">
          <InitiativeAnalysisWorkspace initiative={selectedInitiative} />
        </ProfileSection>
      ) : null}

      {selectedInitiative ? (
        <ProfileSection title="Improvement Proposal Decisions">
          <InitiativeImprovementProposalStewardPanel initiative={selectedInitiative} />
        </ProfileSection>
      ) : null}

      {selectedInitiative ? (
        <ProfileSection title="Initiative Revision">
          <InitiativeRevisionWorkspace
            initiative={selectedInitiative}
            onInitiativeUpdated={handleUpdated}
          />
        </ProfileSection>
      ) : null}

      {selectedInitiative ? (
        <ProfileSection title="Decision Session">
          <DecisionSessionWorkspace initiative={selectedInitiative} />
        </ProfileSection>
      ) : null}

      {selectedInitiative ? (
        <ProfileSection title="Civic Compatibility Review">
          <CivicCompatibilityReviewWorkspace initiative={selectedInitiative} />
        </ProfileSection>
      ) : null}
    </>
  );
}
