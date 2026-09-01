"use client";

import { useEffect, useState } from "react";

import type { PublicCivicArchiveProjection } from "@hu/types";

import { getPublicCivicArchive } from "../../public-civic-archive/api";
import {
  CivicPublicTranslatedSection,
  joinLinesForDisplay,
} from "../../language";

interface CivicArchiveTranslatedNarrativeProps {
  readonly archiveRecordId: string;
  /** Lifecycle title/summary used until projection loads (and as soft fallback). */
  readonly titleFallback: string;
  readonly summaryFallback: string;
}

function buildArchiveFallbackFields(
  projection: PublicCivicArchiveProjection | null,
  titleFallback: string,
  summaryFallback: string,
): Record<string, string> {
  if (!projection) {
    return {
      title: titleFallback,
      summary: summaryFallback,
      implementationPeriod: "",
      initiativeSummary: "",
      civicChallenge: "",
      implementationStory: "",
      verifiedPublicImpact: "",
      lessonsLearned_whatWorked: "",
      lessonsLearned_whatDidNotWork: "",
      lessonsLearned_recommendationsForFuture: "",
      lessonsLearned_transferableExperience: "",
      knowledgeContribution_socialBenefits: "",
      knowledgeContribution_environmentalBenefits: "",
      knowledgeContribution_economicBenefits: "",
      knowledgeContribution_governanceBenefits: "",
      knowledgeContribution_educationalBenefits: "",
      knowledgeContribution_additionalObservations: "",
      timelineLabels: "",
    };
  }

  return {
    title: projection.title,
    summary: projection.summary,
    implementationPeriod: projection.implementationPeriod,
    initiativeSummary: projection.initiativeSummary,
    civicChallenge: projection.civicChallenge,
    implementationStory: projection.implementationStory,
    verifiedPublicImpact: projection.verifiedPublicImpact,
    lessonsLearned_whatWorked: projection.lessonsLearned.whatWorked,
    lessonsLearned_whatDidNotWork: projection.lessonsLearned.whatDidNotWork,
    lessonsLearned_recommendationsForFuture: projection.lessonsLearned.recommendationsForFuture,
    lessonsLearned_transferableExperience: projection.lessonsLearned.transferableExperience,
    knowledgeContribution_socialBenefits: projection.knowledgeContribution.socialBenefits,
    knowledgeContribution_environmentalBenefits:
      projection.knowledgeContribution.environmentalBenefits,
    knowledgeContribution_economicBenefits: projection.knowledgeContribution.economicBenefits,
    knowledgeContribution_governanceBenefits: projection.knowledgeContribution.governanceBenefits,
    knowledgeContribution_educationalBenefits:
      projection.knowledgeContribution.educationalBenefits,
    knowledgeContribution_additionalObservations:
      projection.knowledgeContribution.additionalObservations,
    timelineLabels: joinLinesForDisplay(
      projection.historicalTimeline.map((entry) => entry.label),
    ),
  };
}

/**
 * Pack 02G Task 05 — civic archive narrative translation against TASK-037 projection.
 * Lifecycle timeline/meta remain on the parent page (not translation allowlist).
 */
export function CivicArchiveTranslatedNarrative({
  archiveRecordId,
  titleFallback,
  summaryFallback,
}: CivicArchiveTranslatedNarrativeProps) {
  const [projection, setProjection] = useState<PublicCivicArchiveProjection | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getPublicCivicArchive(archiveRecordId)
      .then((result) => {
        if (!cancelled) {
          setProjection(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProjection(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [archiveRecordId]);

  return (
    <CivicPublicTranslatedSection
      sourceKind="civic_archive"
      sourceRecordId={archiveRecordId}
      fallbackFields={buildArchiveFallbackFields(projection, titleFallback, summaryFallback)}
    />
  );
}
