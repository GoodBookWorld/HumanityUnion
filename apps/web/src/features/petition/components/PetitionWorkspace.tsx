"use client";

import type { CollaborativeAnalysis, CollectiveDecision, Initiative, Petition } from "@hu/types";
import { useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";

import { ContributionRecognition } from "./ContributionRecognition";
import { DecisionContext } from "./DecisionContext";
import { NextMeaningfulAction } from "./NextMeaningfulAction";
import { PetitionOutcomeSection } from "./PetitionOutcomeSection";
import { PetitionStatus } from "./PetitionStatus";
import { PetitionSubject } from "./PetitionSubject";
import { RelatedLinks } from "./RelatedLinks";
import { SignatureSection } from "./SignatureSection";
import { SupportMetrics } from "./SupportMetrics";

import { BOOTSTRAP_PARTICIPANT_ID, participantHasSigned } from "../petition-utils";

import "./workspace.css";

interface PetitionWorkspaceProps {
  initialPetition: Petition;
  collectiveDecision: CollectiveDecision | null;
  initiative: Initiative | null;
  collaborativeAnalysis: CollaborativeAnalysis | null;
}

export function PetitionWorkspace({
  initialPetition,
  collectiveDecision,
  initiative,
  collaborativeAnalysis,
}: PetitionWorkspaceProps) {
  const [petition, setPetition] = useState(initialPetition);
  const [showRecognition, setShowRecognition] = useState(
    participantHasSigned(initialPetition, BOOTSTRAP_PARTICIPANT_ID),
  );

  return (
    <div className="petition-workspace">
      <ProfileSection title="Petition Status">
        <PetitionStatus petition={petition} />
      </ProfileSection>

      <ProfileSection title="Petition Subject">
        <PetitionSubject petition={petition} />
      </ProfileSection>

      <ProfileSection title="Decision Context">
        <DecisionContext
          collectiveDecision={collectiveDecision}
          initiative={initiative}
          collaborativeAnalysis={collaborativeAnalysis}
        />
      </ProfileSection>

      <ProfileSection title="Signature">
        <SignatureSection
          petition={petition}
          onPetitionUpdated={setPetition}
          onSignatureRecorded={() => setShowRecognition(true)}
        />
      </ProfileSection>

      <ProfileSection title="Support Metrics">
        <SupportMetrics petition={petition} />
      </ProfileSection>

      <ProfileSection title="Petition Outcome">
        <PetitionOutcomeSection petition={petition} />
      </ProfileSection>

      <ProfileSection title="Contribution Recognition">
        <ContributionRecognition visible={showRecognition} />
      </ProfileSection>

      <ProfileSection title="Next Meaningful Action">
        <NextMeaningfulAction petition={petition} />
      </ProfileSection>

      <ProfileSection title="Related Links">
        <RelatedLinks petition={petition} />
      </ProfileSection>
    </div>
  );
}
