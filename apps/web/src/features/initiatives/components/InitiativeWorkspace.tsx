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
import { DecisionResultWorkspace } from "../../execution-pipeline/components/DecisionResultWorkspace";
import { CivicDeliveryWorkspace } from "../../execution-pipeline/components/CivicDeliveryWorkspace";
import { CivicAccountabilityWorkspace } from "../../execution-pipeline/components/CivicAccountabilityWorkspace";
import { OfficialResponsesWorkspace } from "../../execution-pipeline/components/OfficialResponsesWorkspace";
import { InitiativeImplementationCommitmentWorkspace } from "../../execution-pipeline/components/InitiativeImplementationCommitmentWorkspace";
import { InitiativeImplementationTrackingWorkspace } from "../../execution-pipeline/components/InitiativeImplementationTrackingWorkspace";
import { InitiativePublicImpactWorkspace } from "../../execution-pipeline/components/InitiativePublicImpactWorkspace";
import { InitiativePublicCivicArchiveWorkspace } from "../../execution-pipeline/components/InitiativePublicCivicArchiveWorkspace";
import { WorkspaceCivicIntegrationPanel } from "../../capability02-integration/components/WorkspaceCivicIntegrationPanel";
import { WorkspaceCivicAssistant } from "../../workspace-civic-assistant/components/WorkspaceCivicAssistant";
import { INITIATIVE_WORKSPACE_SECTIONS } from "../../workspace-civic-assistant/initiative-workspace-sections";
import { useWorkspaceSectionTracker } from "../../workspace-civic-assistant/use-workspace-section-tracker";

import "./initiative-workspace-layout.css";
import "../../initiative-workspace-ux/initiative-workspace-ux.css";

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
  const currentSection = useWorkspaceSectionTracker(INITIATIVE_WORKSPACE_SECTIONS);

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
    <div className="initiative-workspace-layout">
      <div className="initiative-workspace-layout__content">
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
          <ProfileSection title="Decision Result">
            <DecisionResultWorkspace initiative={selectedInitiative} />
          </ProfileSection>
        ) : null}

        {selectedInitiative ? (
          <ProfileSection title="Civic Delivery">
            <CivicDeliveryWorkspace initiative={selectedInitiative} />
          </ProfileSection>
        ) : null}

        {selectedInitiative ? (
          <ProfileSection title="Official Responses">
            <OfficialResponsesWorkspace initiative={selectedInitiative} />
          </ProfileSection>
        ) : null}

        {selectedInitiative ? (
          <ProfileSection title="Civic Accountability">
            <CivicAccountabilityWorkspace initiative={selectedInitiative} />
          </ProfileSection>
        ) : null}

        {selectedInitiative ? (
          <ProfileSection title="Implementation Commitment">
            <InitiativeImplementationCommitmentWorkspace initiative={selectedInitiative} />
          </ProfileSection>
        ) : null}

        {selectedInitiative ? (
          <ProfileSection title="Implementation Tracking">
            <InitiativeImplementationTrackingWorkspace initiative={selectedInitiative} />
          </ProfileSection>
        ) : null}

        {selectedInitiative ? (
          <ProfileSection title="Public Impact">
            <InitiativePublicImpactWorkspace initiative={selectedInitiative} />
          </ProfileSection>
        ) : null}

        {selectedInitiative ? (
          <ProfileSection title="Public Civic Archive">
            <InitiativePublicCivicArchiveWorkspace initiative={selectedInitiative} />
          </ProfileSection>
        ) : null}

        {selectedInitiative ? (
          <WorkspaceCivicIntegrationPanel initiativeId={selectedInitiative.initiativeId} />
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
      </div>

      <WorkspaceCivicAssistant initiative={selectedInitiative} currentSection={currentSection} />
    </div>
  );
}
