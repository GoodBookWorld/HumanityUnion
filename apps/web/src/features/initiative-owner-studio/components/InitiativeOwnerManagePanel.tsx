"use client";

import type { Initiative } from "@hu/types";
import Link from "next/link";
import { useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { InitiativeAnalysisWorkspace } from "../../initiative-collaborative-analysis/components/InitiativeAnalysisWorkspace";
import { InitiativeDraftEditor } from "../../initiatives/components/InitiativeDraftEditor";
import { InitiativePublishedEditor } from "../../initiatives/components/InitiativePublishedEditor";
import { ViewCollaborativeAnalysisLink } from "../../initiatives/components/ViewCollaborativeAnalysisLink";
import { ViewCollectiveDecisionLink } from "../../collective-decision/components/ViewCollectiveDecisionLink";
import { ViewPetitionLink } from "../../petition/components/ViewPetitionLink";
import { getPublicInitiativeExperience } from "../../public-initiative-experience/api";
import { buildWorkspaceInitiativesHref } from "../initiative-experience-routes";

import "./initiative-owner-manage-panel.css";

interface InitiativeOwnerManagePanelProps {
  initiative: Initiative;
  onInitiativeUpdated: (initiative: Initiative) => void;
}

function renderManagementEditor(
  initiative: Initiative,
  onUpdated: (initiative: Initiative) => void,
) {
  if (initiative.lifecyclePhase === "draft") {
    return <InitiativeDraftEditor initiative={initiative} onUpdated={onUpdated} />;
  }

  if (
    initiative.lifecyclePhase === "published" ||
    initiative.lifecyclePhase === "projected" ||
    initiative.lifecyclePhase === "archived"
  ) {
    return <InitiativePublishedEditor initiative={initiative} onUpdated={onUpdated} />;
  }

  return null;
}

export function InitiativeOwnerManagePanel({
  initiative,
  onInitiativeUpdated,
}: InitiativeOwnerManagePanelProps) {
  const [currentInitiative, setCurrentInitiative] = useState(initiative);

  async function handleUpdated(updated: Initiative) {
    setCurrentInitiative(updated);
    onInitiativeUpdated(updated);

    if (updated.lifecyclePhase === "projected") {
      try {
        await getPublicInitiativeExperience(updated.initiativeId);
        window.location.reload();
      } catch {
        // Public projection may lag; owner view remains authoritative.
      }
    }
  }

  return (
    <div className="initiative-owner-manage-panel">
      <p className="initiative-owner-manage-panel__back">
        <Link href={buildWorkspaceInitiativesHref()}>Back to Workspace Initiatives</Link>
      </p>

      <ProfileSection title="Manage Initiative" id="manage-initiative">
        {renderManagementEditor(currentInitiative, (updated) => void handleUpdated(updated))}
        <ViewCollaborativeAnalysisLink initiativeId={currentInitiative.initiativeId} />
        <ViewCollectiveDecisionLink initiativeId={currentInitiative.initiativeId} />
        <ViewPetitionLink initiativeId={currentInitiative.initiativeId} />
      </ProfileSection>

      <ProfileSection title="Collaborative Analysis" id="collaborative-analysis">
        <InitiativeAnalysisWorkspace initiative={currentInitiative} />
      </ProfileSection>
    </div>
  );
}
