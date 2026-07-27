"use client";

import { useState } from "react";

import type {
  InitiativeSupportSignalKind,
  PublicInitiativeCollaborativeAnalysisProjection,
  PublicInitiativeExperienceProjection,
} from "@hu/types";

import { ProfileField } from "../../../components/member/ProfileField";
import { ProfileSection } from "../../../components/member/ProfileSection";
import { toggleInitiativeBookmark, updateInitiativeSupportSignal } from "../api";
import { PublicCivicRecordExperienceLayout } from "./PublicCivicRecordExperienceLayout";
import { PublicDiscussionPanel } from "./PublicDiscussionPanel";
import { PublicExperienceHero } from "./PublicExperienceHero";
import { PublicExperienceSidebar } from "./PublicExperienceSidebar";
import { PublicInitiativeLifecycleNav } from "./PublicInitiativeLifecycleNav";

import "../public-initiative-experience.css";

function formatPublishedDate(publishedAt: string): string {
  return new Date(publishedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface PublicInitiativeAnalysisExperiencePageProps {
  experience: PublicInitiativeExperienceProjection;
  analysis: PublicInitiativeCollaborativeAnalysisProjection;
}

export function PublicInitiativeAnalysisExperiencePage({
  experience: initialExperience,
  analysis,
}: PublicInitiativeAnalysisExperiencePageProps) {
  const [experience, setExperience] = useState(initialExperience);
  const [supportBusy, setSupportBusy] = useState(false);

  const initiativeHref = `/initiatives/public/${encodeURIComponent(experience.initiativeId)}`;

  const resolveStageHref = (stageId: string, hash: string) => {
    if (stageId === "analysis") {
      return null;
    }

    return `${initiativeHref}#${hash}`;
  };

  const lifecycleStages = experience.lifecycleStages.map((stage) =>
    stage.stageId === "analysis"
      ? { ...stage, state: "current" as const, stateLabel: "Current stage" }
      : stage.stageId === "initiative"
        ? { ...stage, state: "completed" as const, stateLabel: "Completed" }
        : stage,
  );

  const handleSignalChange = async (signal: InitiativeSupportSignalKind) => {
    setSupportBusy(true);

    try {
      const stats = await updateInitiativeSupportSignal(experience.initiativeId, signal);
      setExperience((current) => ({
        ...current,
        supportStatistics: {
          ...stats,
          currentUserSignal: stats.currentUserSignal,
          currentUserBookmarked: stats.currentUserBookmarked,
        },
      }));
    } finally {
      setSupportBusy(false);
    }
  };

  const handleBookmarkToggle = async () => {
    setSupportBusy(true);

    try {
      const stats = await toggleInitiativeBookmark(experience.initiativeId);
      setExperience((current) => ({
        ...current,
        supportStatistics: {
          ...stats,
          currentUserSignal: stats.currentUserSignal,
          currentUserBookmarked: stats.currentUserBookmarked,
        },
      }));
    } catch {
      // Bookmark requires authentication.
    } finally {
      setSupportBusy(false);
    }
  };

  return (
    <PublicCivicRecordExperienceLayout
      hero={
        <PublicExperienceHero
          title={analysis.title}
          summary={analysis.summary}
          imageUrl={experience.hero.imageUrl}
          parentLink={{
            href: initiativeHref,
            label: `Initiative: ${experience.hero.title}`,
          }}
          meta={[
            { label: "Activity Area", value: experience.hero.activityArea },
            { label: "Geography", value: experience.hero.geography.label },
            { label: "Status", value: "Collaborative Analysis" },
            { label: "Published", value: formatPublishedDate(analysis.publishedAt) },
            {
              label: "Initiative Version",
              value: `Version ${analysis.initiativeVersion}`,
            },
            { label: "Author", value: analysis.authorDisplayName },
          ]}
        />
      }
      lifecycle={
        <PublicInitiativeLifecycleNav
          stages={lifecycleStages}
          activeStageId="analysis"
          resolveStageHref={resolveStageHref}
          activeRecordId={analysis.analysisId}
        />
      }
      center={
        <div className="pie-center">
          <ProfileSection title="Analysis" id="analysis">
            <ProfileField label="Summary" value={analysis.summary} />
            <ProfileField label="Supporting evidence" value={analysis.supportingEvidence} />
            <ProfileField label="Risks" value={analysis.risks} />
            <ProfileField label="Suggested improvements" value={analysis.suggestedImprovements} />
            <ProfileField label="References" value={analysis.references} />
            <ProfileField label="Author" value={analysis.authorDisplayName} />
            <ProfileField
              label="Created for version"
              value={`Version ${analysis.initiativeVersion}`}
            />
            <ProfileField label="Published" value={formatPublishedDate(analysis.publishedAt)} />
          </ProfileSection>

          <div className="pie-center__content">
            <PublicDiscussionPanel
              initiativeId={experience.initiativeId}
              initialComments={experience.discussion.initialComments}
              commentCount={experience.discussion.commentCount}
              hasMoreComments={experience.discussion.hasMoreComments}
              panelId="pie-panel-discussion"
              scopeLabel="Comments are shared on the parent Initiative."
            />
          </div>
        </div>
      }
      sidebar={
        <PublicExperienceSidebar
          initiativeId={experience.initiativeId}
          supportLabel="Initiative Support"
          statistics={experience.supportStatistics}
          revisionHistory={experience.revisionHistory}
          latestInitiatives={experience.latestInitiatives}
          onSignalChange={(signal) => void handleSignalChange(signal)}
          onBookmarkToggle={() => void handleBookmarkToggle()}
          onRevisionSelect={() => {
            window.location.href = `${initiativeHref}#revision`;
          }}
          supportBusy={supportBusy}
        />
      }
    />
  );
}
