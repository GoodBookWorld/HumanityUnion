"use client";

import type {
  CollectiveDecision,
  Implementation,
  ImplementationCommitment,
  Initiative,
  Petition,
} from "@hu/types";
import { useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";

import { AchievementRecordingPanel } from "./AchievementRecordingPanel";
import { AchievementsSection } from "./AchievementsSection";
import { CollectiveProgressSection } from "./CollectiveProgressSection";
import { CompletionAssessmentSection } from "./CompletionAssessmentSection";
import { CurrentPhaseSection } from "./CurrentPhaseSection";
import { EvidenceAttachmentPanel } from "./EvidenceAttachmentPanel";
import { EvidenceSection } from "./EvidenceSection";
import { HumanityAssistantPanel } from "./HumanityAssistantPanel";
import { ImplementationStatusSection } from "./ImplementationStatusSection";
import { InitiativeContextSection } from "./InitiativeContextSection";
import { MilestonesSection } from "./MilestonesSection";
import { NextMeaningfulObservationSection } from "./NextMeaningfulObservationSection";
import { RelatedNavigationSection } from "./RelatedNavigationSection";

import "./workspace.css";

interface ImplementationWorkspaceProps {
  initialImplementation: Implementation;
  initiative: Initiative | null;
  collectiveDecision: CollectiveDecision | null;
  petition: Petition | null;
  commitment: ImplementationCommitment | null;
}

export function ImplementationWorkspace({
  initialImplementation,
  initiative,
  collectiveDecision,
  petition,
  commitment,
}: ImplementationWorkspaceProps) {
  const [implementation, setImplementation] = useState(initialImplementation);

  return (
    <div className="implementation-workspace">
      <ProfileSection title="Initiative Context">
        <InitiativeContextSection
          implementation={implementation}
          initiative={initiative}
          collectiveDecision={collectiveDecision}
          petition={petition}
          commitment={commitment}
        />
      </ProfileSection>

      <ProfileSection title="Implementation Status">
        <ImplementationStatusSection implementation={implementation} />
      </ProfileSection>

      <ProfileSection title="Collective Progress">
        <CollectiveProgressSection implementation={implementation} />
      </ProfileSection>

      <ProfileSection title="Current Phase">
        <CurrentPhaseSection implementation={implementation} />
      </ProfileSection>

      <ProfileSection title="Milestones">
        <MilestonesSection implementation={implementation} />
      </ProfileSection>

      <ProfileSection title="Achievements">
        <AchievementRecordingPanel
          implementation={implementation}
          onImplementationUpdated={setImplementation}
        />
        <AchievementsSection implementation={implementation} />
      </ProfileSection>

      <ProfileSection title="Evidence">
        <EvidenceAttachmentPanel
          implementation={implementation}
          onImplementationUpdated={setImplementation}
        />
        <EvidenceSection implementation={implementation} />
      </ProfileSection>

      <ProfileSection title="Completion Assessment">
        <CompletionAssessmentSection implementation={implementation} />
      </ProfileSection>

      <ProfileSection title="Next Meaningful Observation">
        <NextMeaningfulObservationSection implementation={implementation} />
      </ProfileSection>

      <ProfileSection title="Humanity Assistant">
        <HumanityAssistantPanel implementation={implementation} />
      </ProfileSection>

      <ProfileSection title="Related Navigation">
        <RelatedNavigationSection implementation={implementation} />
      </ProfileSection>
    </div>
  );
}
