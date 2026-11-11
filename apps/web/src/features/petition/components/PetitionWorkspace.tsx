"use client";

import type {
  CollaborativeAnalysis,
  CollectiveDecision,
  Initiative,
  PublicPetitionRecord,
} from "@hu/types";
import { useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { useViewerPetitionSignature } from "../use-viewer-petition-signature";

import { ContributionRecognition } from "./ContributionRecognition";
import { DecisionContext } from "./DecisionContext";
import { NextMeaningfulAction } from "./NextMeaningfulAction";
import { PetitionOutcomeSection } from "./PetitionOutcomeSection";
import { PetitionStatus } from "./PetitionStatus";
import { PetitionSubject } from "./PetitionSubject";
import { RelatedLinks } from "./RelatedLinks";
import { SignatureSection } from "./SignatureSection";
import { SupportMetrics } from "./SupportMetrics";

import "./workspace.css";

interface PetitionWorkspaceProps {
  initialPetition: PublicPetitionRecord;
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
  const authStatus = useClientAuthStatus();
  const { viewerSignature, registrationGatewayMessage, setViewerSignature, refresh } =
    useViewerPetitionSignature(initialPetition.petitionId, authStatus);
  const viewerHasSigned = authStatus === "authenticated" && viewerSignature === "signed";

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
          authStatus={authStatus}
          viewerSignature={viewerSignature}
          registrationGatewayMessage={registrationGatewayMessage}
          onPetitionUpdated={setPetition}
          onViewerSignatureChange={setViewerSignature}
          onSignatureStatusStale={refresh}
        />
      </ProfileSection>

      <ProfileSection title="Support Metrics">
        <SupportMetrics petition={petition} />
      </ProfileSection>

      <ProfileSection title="Petition Outcome">
        <PetitionOutcomeSection petition={petition} />
      </ProfileSection>

      <ProfileSection title="Contribution Recognition">
        <ContributionRecognition visible={viewerHasSigned} />
      </ProfileSection>

      <ProfileSection title="Next Meaningful Action">
        <NextMeaningfulAction petition={petition} viewerHasSigned={viewerHasSigned} />
      </ProfileSection>

      <ProfileSection title="Related Links">
        <RelatedLinks petition={petition} />
      </ProfileSection>
    </div>
  );
}
