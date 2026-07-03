"use client";

import type {
  CollectiveDecision,
  ImplementationCommitment,
  Initiative,
  Petition,
} from "@hu/types";
import { useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";

import { CommunityCapacitySection } from "./CommunityCapacitySection";
import { CommunityNeedsSection } from "./CommunityNeedsSection";
import { ContributionProfileSection } from "./ContributionProfileSection";
import { FrozenPolicySection } from "./FrozenPolicySection";
import { HumanityAssistantPanel } from "./HumanityAssistantPanel";
import { ImplementationReadinessSection } from "./ImplementationReadinessSection";
import { InitiativeContextSection } from "./InitiativeContextSection";
import { NextMeaningfulActionSection } from "./NextMeaningfulActionSection";
import { ParticipantCommitmentSection } from "./ParticipantCommitmentSection";
import { RelatedNavigationSection } from "./RelatedNavigationSection";

import "./workspace.css";

interface ImplementationCommitmentWorkspaceProps {
  initialCommitment: ImplementationCommitment;
  initiative: Initiative | null;
  collectiveDecision: CollectiveDecision | null;
  petition: Petition | null;
}

export function ImplementationCommitmentWorkspace({
  initialCommitment,
  initiative,
  collectiveDecision,
  petition,
}: ImplementationCommitmentWorkspaceProps) {
  const [commitment, setCommitment] = useState(initialCommitment);

  return (
    <div className="implementation-commitment-workspace">
      <ProfileSection title="Initiative Context">
        <InitiativeContextSection
          commitment={commitment}
          initiative={initiative}
          collectiveDecision={collectiveDecision}
          petition={petition}
        />
      </ProfileSection>

      <ProfileSection title="Current Implementation Readiness">
        <ImplementationReadinessSection commitment={commitment} />
      </ProfileSection>

      <ProfileSection title="Community Capacity">
        <CommunityCapacitySection commitment={commitment} />
      </ProfileSection>

      <ProfileSection title="Frozen Policy">
        <FrozenPolicySection commitment={commitment} />
      </ProfileSection>

      <ProfileSection title="Participant Commitment">
        <ParticipantCommitmentSection
          commitment={commitment}
          onCommitmentUpdated={setCommitment}
        />
      </ProfileSection>

      <ProfileSection title="Contribution Profile">
        <ContributionProfileSection
          commitment={commitment}
          onCommitmentUpdated={setCommitment}
        />
      </ProfileSection>

      <ProfileSection title="Community Needs">
        <CommunityNeedsSection commitment={commitment} />
      </ProfileSection>

      <ProfileSection title="Next Meaningful Action">
        <NextMeaningfulActionSection commitment={commitment} />
      </ProfileSection>

      <ProfileSection title="Humanity Assistant">
        <HumanityAssistantPanel commitment={commitment} />
      </ProfileSection>

      <ProfileSection title="Related Navigation">
        <RelatedNavigationSection commitment={commitment} />
      </ProfileSection>
    </div>
  );
}
