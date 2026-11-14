"use client";

import type {
  CollaborativeAnalysis,
  CollectiveDecision,
  Initiative,
  PublicPetitionRecord,
} from "@hu/types";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import {
  petitionStatusSectionLabelKey,
  type PetitionStatusSectionId,
} from "../petition-status-i18n";
import { useInitiativeReadingText } from "../use-initiative-reading-text";
import { usePetitionReadingText } from "../use-petition-reading-text";
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
  const t = useTranslations("initiativeExperience");
  const [petition, setPetition] = useState(initialPetition);
  const authStatus = useClientAuthStatus();
  const { viewerSignature, setViewerSignature, refresh } = useViewerPetitionSignature(
    initialPetition.petitionId,
    authStatus,
  );
  const viewerHasSigned = authStatus === "authenticated" && viewerSignature === "signed";
  const readingText = usePetitionReadingText({
    petitionId: petition.petitionId,
    title: petition.subject.title,
    summary: petition.subject.summary,
    status: petition.status,
  });
  const initiativeText = useInitiativeReadingText({ initiative, petitionStatus: petition.status });
  const section = (id: PetitionStatusSectionId) => ({
    id,
    title: t(petitionStatusSectionLabelKey(id)),
  });

  return (
    <div className="petition-workspace">
      <ProfileSection {...section("petition-status")}>
        <PetitionStatus petition={petition} readingText={readingText} />
      </ProfileSection>

      <ProfileSection {...section("petition-subject")}>
        <PetitionSubject petition={petition} readingText={readingText} />
      </ProfileSection>

      <ProfileSection {...section("decision-context")}>
        <DecisionContext
          collectiveDecision={collectiveDecision}
          petition={petition}
          initiativeText={initiativeText}
          collaborativeAnalysis={collaborativeAnalysis}
        />
      </ProfileSection>

      <ProfileSection {...section("signature")}>
        <SignatureSection
          petition={petition}
          authStatus={authStatus}
          viewerSignature={viewerSignature}
          onPetitionUpdated={setPetition}
          onViewerSignatureChange={setViewerSignature}
          onSignatureStatusStale={refresh}
        />
      </ProfileSection>

      <ProfileSection {...section("support-metrics")}>
        <SupportMetrics petition={petition} />
      </ProfileSection>

      <ProfileSection {...section("petition-outcome")}>
        <PetitionOutcomeSection petition={petition} />
      </ProfileSection>

      <ProfileSection {...section("contribution-recognition")}>
        <ContributionRecognition visible={viewerHasSigned} />
      </ProfileSection>

      <ProfileSection {...section("next-meaningful-action")}>
        <NextMeaningfulAction petition={petition} viewerHasSigned={viewerHasSigned} />
      </ProfileSection>

      <ProfileSection {...section("related-links")}>
        <RelatedLinks petition={petition} />
      </ProfileSection>
    </div>
  );
}
