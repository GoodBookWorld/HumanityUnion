"use client";

import type { RefObject, ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import type {
  PublicInitiativeExperienceProjection,
  PublicInitiativeLifecycleRecordItem,
  PublicInitiativeLifecycleStageContent,
  PublicInitiativeProjection,
} from "@hu/types";
import { isInitiativeLifecycleAuthorWorkspaceStage } from "@hu/types";

import { formatPublicGeography } from "@hu/geography";
import { InitiativeLifecycleStageWorkspace } from "../../initiative-lifecycle-stage-workspace";
import { InitiativeCollaborativeAnalysisAuthorWorkspace } from "../../initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisAuthorWorkspace";
import { InitiativeCollaborativeAnalysisDraftPreview } from "../../initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisDraftPreview";
import { InitiativeCollaborativeAnalysisPublicResult } from "../../initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisPublicResult";
import { InitiativeImprovementProposalsAuthorWorkspace } from "../../initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsAuthorWorkspace";
import { InitiativeImprovementProposalsDraftPreview } from "../../initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsDraftPreview";
import { InitiativeImprovementProposalsPublicResult } from "../../initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsPublicResult";
import { InitiativePetitionAuthorWorkspace } from "../../initiative-petition-lifecycle/components/InitiativePetitionAuthorWorkspace";
import { InitiativePetitionDraftPreview } from "../../initiative-petition-lifecycle/components/InitiativePetitionDraftPreview";
import { InitiativePetitionPublicResult } from "../../initiative-petition-lifecycle/components/InitiativePetitionPublicResult";
import { InitiativeDecisionSessionAuthorWorkspace } from "../../initiative-decision-session-lifecycle/components/InitiativeDecisionSessionAuthorWorkspace";
import { InitiativeDecisionSessionDraftPreview } from "../../initiative-decision-session-lifecycle/components/InitiativeDecisionSessionDraftPreview";
import { InitiativeDecisionSessionPublicResult } from "../../initiative-decision-session-lifecycle/components/InitiativeDecisionSessionPublicResult";
import { InitiativeCollectiveDecisionAuthorWorkspace } from "../../initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionAuthorWorkspace";
import { InitiativeCollectiveDecisionDraftPreview } from "../../initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionDraftPreview";
import { InitiativeCollectiveDecisionPublicResult } from "../../initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionPublicResult";
import { InitiativeImplementationCommitmentAuthorWorkspace } from "../../initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentAuthorWorkspace";
import { InitiativeImplementationCommitmentDraftPreview } from "../../initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentDraftPreview";
import { InitiativeImplementationCommitmentPublicResult } from "../../initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentPublicResult";
import { InitiativeImplementationTrackingAuthorWorkspace } from "../../initiative-implementation-tracking-lifecycle/components/InitiativeImplementationTrackingAuthorWorkspace";
import { InitiativeImplementationTrackingDraftPreview } from "../../initiative-implementation-tracking-lifecycle/components/InitiativeImplementationTrackingDraftPreview";
import { InitiativeImplementationTrackingPublicResult } from "../../initiative-implementation-tracking-lifecycle/components/InitiativeImplementationTrackingPublicResult";
import { InitiativeOfficialResponseAuthorWorkspace } from "../../initiative-official-response-lifecycle/components/InitiativeOfficialResponseAuthorWorkspace";
import { InitiativeOfficialResponseDraftPreview } from "../../initiative-official-response-lifecycle/components/InitiativeOfficialResponseDraftPreview";
import { InitiativeOfficialResponsePublicResult } from "../../initiative-official-response-lifecycle/components/InitiativeOfficialResponsePublicResult";
import { InitiativePublicImpactAuthorWorkspace } from "../../initiative-public-impact-lifecycle/components/InitiativePublicImpactAuthorWorkspace";
import { InitiativePublicImpactDraftPreview } from "../../initiative-public-impact-lifecycle/components/InitiativePublicImpactDraftPreview";
import { InitiativePublicImpactPublicResult } from "../../initiative-public-impact-lifecycle/components/InitiativePublicImpactPublicResult";
import { InitiativeCivicArchiveAuthorWorkspace } from "../../initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveAuthorWorkspace";
import { InitiativeCivicArchiveDraftPreview } from "../../initiative-civic-archive-lifecycle/components/InitiativeCivicArchiveDraftPreview";
import { InitiativeCivicArchivePublicResult } from "../../initiative-civic-archive-lifecycle/components/InitiativeCivicArchivePublicResult";
import { CurrentLifecycleStageBanner } from "./CurrentLifecycleStageBanner";
import { DiscussionLifecycleCompletionBanner } from "./DiscussionLifecycleCompletionBanner";
import { useInitiativeExperienceRefresh } from "../initiative-experience-refresh-context";
import { PublicDiscussionPanel } from "./PublicDiscussionPanel";
import { InitiativeAuthorIdentity } from "../../initiative-active-allies/components/InitiativeAuthorIdentity";
import {
  buildPublicInitiativeSharePayload,
  CivicShareButton,
} from "../../civic-share";

/**
 * UX Evolution Pack 02.4 Part 2 — "Related Civic Records" removed from the
 * Single Initiative page menu (no longer a reachable tab). The underlying
 * `experience.relatedCivicRecords` data, its projection, and its type are
 * untouched and may still be used elsewhere; only this page's now-dead menu
 * entry, panel section, and local rendering are removed.
 */
export type CenterTab = "manage" | "overview" | "discussion";

function formatList(values: string[]): string | null {
  return values.length > 0 ? values.join(", ") : null;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function OverviewSection({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }

  return (
    <section className="pie-overview__section">
      <h3>{label}</h3>
      <p>{value}</p>
    </section>
  );
}

function OverviewMetadataItem({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) {
    return null;
  }

  return (
    <div className="pie-overview__item">
      <h3>{label}</h3>
      <p>{value}</p>
    </div>
  );
}

/**
 * UX Evolution Pack 02.4 Part 3 — the real Initiative author/steward
 * identity. `profileUrl` is only ever present for an active, publicly
 * visible profile (see `resolvePublicAuthorIdentity`), so this never
 * hardcodes or invents a route: no URL means plain text, exactly like the
 * Discussion comment author link.
 */
function OverviewAuthorItem({
  displayName,
  profileUrl,
}: {
  displayName: string;
  profileUrl?: string;
}) {
  return (
    <div className="pie-overview__item">
      <h3>Author</h3>
      {profileUrl ? (
        <p>
          <Link href={profileUrl} className="pie-overview__author-link">
            {displayName}
          </Link>
        </p>
      ) : (
        <p>{displayName}</p>
      )}
    </div>
  );
}

function PublicInitiativeOverview({
  initiative,
  currentStageId,
  currentStageLabel,
}: {
  initiative: PublicInitiativeProjection;
  currentStageId: string;
  currentStageLabel: string;
}) {
  const metadata = initiative.metadata;
  const activityArea =
    metadata.activityArea === "Other" && metadata.activityAreaOther
      ? metadata.activityAreaOther
      : metadata.activityArea;

  return (
    <div className="pie-overview">
      <CurrentLifecycleStageBanner
        initiativeId={initiative.initiativeId}
        stageId={currentStageId}
        stageLabel={currentStageLabel}
      />
      <OverviewSection label="Full Description" value={initiative.description} />
      <div className="pie-overview__grid">
        <div className="pie-overview__column">
          <OverviewMetadataItem label="Activity Area" value={activityArea} />
          <OverviewMetadataItem label="Category" value={metadata.category} />
          <OverviewMetadataItem
            label="Start Date"
            value={metadata.startDate ? formatDate(metadata.startDate) : undefined}
          />
          <OverviewAuthorItem
            displayName={initiative.stewardDisplayName}
            profileUrl={initiative.stewardProfileUrl}
          />
          <OverviewMetadataItem
            label="Current Version"
            value={`Version ${initiative.currentVersion}`}
          />
        </div>
        <div className="pie-overview__column">
          <OverviewMetadataItem
            label="Geographic Scope"
            value={formatPublicGeography({
              countryCode: metadata.countrySlug,
              regionCode: metadata.regionSlug,
              communitySlug: metadata.communitySlug,
              regionLabel: metadata.region,
              communityAssociation: metadata.communityAssociation,
            })}
          />
          <OverviewMetadataItem
            label="Community Association"
            value={metadata.communityAssociation ?? metadata.communitySlug}
          />
          <OverviewMetadataItem label="Language" value={metadata.language} />
          <OverviewMetadataItem
            label="Completion Date"
            value={metadata.completionDate ? formatDate(metadata.completionDate) : undefined}
          />
          {/*
            Lifecycle UX Completion Pack 02 Part 8 — Overview Status reflects
            the current Lifecycle stage from publication metadata, never the
            independent Initiative.status domain value (often stuck on
            "proposal" after later stages have published).
          */}
          <OverviewMetadataItem label="Status" value={currentStageLabel} />
          <OverviewMetadataItem label="Tags" value={formatList(metadata.tags) ?? undefined} />
        </div>
      </div>
      {initiative.sourceReferences?.map((reference) => (
        <section key={`${reference.type}-${reference.sourceRecordId}`} className="pie-overview__section">
          <h3>Source article</h3>
          <p className="pie-overview__meta">{reference.sourceName}</p>
          <p>{reference.title}</p>
          {reference.summary ? <p>{reference.summary}</p> : null}
          <p className="pie-overview__meta">Published {formatDate(reference.publishedAt)}</p>
          <p>
            <a href={reference.articleUrl} target="_blank" rel="noopener noreferrer">
              View original source
            </a>
          </p>
        </section>
      ))}
    </div>
  );
}

function LifecycleRecordCard({ record }: { record: PublicInitiativeLifecycleRecordItem }) {
  const content = (
    <>
      <h3>{record.title}</h3>
      {record.summary ? <p>{record.summary}</p> : null}
      <p className="pie-record__meta">
        {[record.status, record.authorDisplayName, record.detail].filter(Boolean).join(" · ")}
        {record.updatedAt ? ` · ${formatDate(record.updatedAt)}` : ""}
      </p>
    </>
  );

  if (record.publicHref) {
    return (
      <article className="pie-record">
        <Link href={record.publicHref}>{content}</Link>
      </article>
    );
  }

  return <article className="pie-record">{content}</article>;
}

function LifecycleStagePanel({ stage }: { stage: PublicInitiativeLifecycleStageContent }) {
  if (stage.records.length === 0) {
    return <p className="pie-empty">{stage.emptyStateMessage}</p>;
  }

  return (
    <div className="pie-stage-panel">
      {stage.records.map((record) => (
        <LifecycleRecordCard key={record.recordId} record={record} />
      ))}
    </div>
  );
}

function DiscussionPanel({
  initiativeId,
  discussion,
  initialDiscussionFilter,
  focusCommentId,
  focusCollaborationParticipantId,
  isOwnerRoute,
  discussionStageState,
  onDiscussionCompleted,
  lifecycleProfile,
}: {
  initiativeId: string;
  discussion: PublicInitiativeExperienceProjection["discussion"];
  initialDiscussionFilter?: "collaboration";
  focusCommentId?: string;
  focusCollaborationParticipantId?: string;
  isOwnerRoute: boolean;
  discussionStageState?: string;
  onDiscussionCompleted: () => void;
  lifecycleProfile?: PublicInitiativeExperienceProjection["lifecycleProfile"];
}) {
  const discussionCompleted =
    discussionStageState === "completed" || discussionStageState === "published";
  const canComplete =
    isOwnerRoute &&
    !discussionCompleted &&
    (discussionStageState === "in_progress" || discussionStageState === "not_started");

  return (
    <>
      <DiscussionLifecycleCompletionBanner
        initiativeId={initiativeId}
        discussionCompleted={discussionCompleted}
        canComplete={canComplete}
        onCompleted={onDiscussionCompleted}
      />
      <PublicDiscussionPanel
        initiativeId={initiativeId}
        initialComments={discussion.initialComments}
        commentCount={discussion.commentCount}
        hasMoreComments={discussion.hasMoreComments}
        initialFilter={initialDiscussionFilter}
        focusCommentId={focusCommentId}
        focusCollaborationParticipantId={focusCollaborationParticipantId}
        lifecycleProfile={lifecycleProfile}
      />
    </>
  );
}

interface PublicInitiativeCenterPanelProps {
  experience: PublicInitiativeExperienceProjection;
  activeTab: CenterTab;
  activeStageId: string;
  showLifecyclePanel: boolean;
  onTabChange: (tab: CenterTab) => void;
  contentRef: RefObject<HTMLDivElement | null>;
  showManageTab?: boolean;
  managePanel?: ReactNode;
  /** Profile UX Pack 01 Part 4 — deep-link from the collaboration-request notification. */
  initialDiscussionFilter?: "collaboration";
  /** Collaborative Analysis "View in Discussion" — scroll to `#comment-{id}`. */
  focusDiscussionCommentId?: string;
  /** Lifecycle Staging Fix 05D — Ally-row participant from notification query. */
  focusCollaborationParticipantId?: string;
  /**
   * Initiative Lifecycle — Part A Completion Part 4/5 — Previous/Next
   * stage navigation from inside the shared
   * `InitiativeLifecycleStageWorkspace` shell mirrors the existing
   * lifecycle-nav stage-select behavior exactly (same hash convention).
   */
  onNavigateStage?: (stageId: string, hash: string) => void;
  /** `/initiatives/{id}` — no hash, so it always lands on the Initiative stage. */
  returnToInitiativeHref?: string;
  /** Part 9 — lifted so the Author working sidebar's Preview button and the shell's own toggle stay in sync. */
  isStagePreviewMode?: boolean;
  onToggleStagePreviewMode?: () => void;
  /**
   * True when the authenticated viewer is the Initiative steward
   * (`experience.viewerIsSteward`). Stage Author Mode is still confirmed
   * server-side via the lifecycle-stage projection.
   */
  isOwnerRoute?: boolean;
}

export function PublicInitiativeCenterPanel({
  experience,
  activeTab,
  activeStageId,
  showLifecyclePanel,
  onTabChange,
  contentRef,
  showManageTab = false,
  managePanel = null,
  initialDiscussionFilter,
  focusDiscussionCommentId,
  focusCollaborationParticipantId,
  onNavigateStage,
  returnToInitiativeHref,
  isOwnerRoute = false,
  isStagePreviewMode,
  onToggleStagePreviewMode,
}: PublicInitiativeCenterPanelProps) {
  const experienceRefresh = useInitiativeExperienceRefresh();
  const [discussionCompletedOverride, setDiscussionCompletedOverride] = useState(false);
  const activeStage = experience.stageContent.find((stage) => stage.stageId === activeStageId);
  /**
   * Initiative Lifecycle — Part B, Section 0 (Mandatory Architectural
   * Rule): Collaborative Analysis was the first stage with a real
   * implementation behind every Presentation Mode; Part D extends this to
   * Improvement Proposals, Part F extends it identically to Petition, and Part G extends it
   * identically to Decision Session. Revision is content/history only (not a lifecycle stage).
   * These stages render through the
   * shared shell for EVERY viewer — Author, Public Preview, and Public
   * Viewer alike — never a second guest-only page. Remaining stages still
   * only mount the shell for the owner-route Author until their own Part
   * lands.
   */
  const showLifecycleWorkspaceShell =
    activeStageId === "analysis" ||
    activeStageId === "proposal" ||
    activeStageId === "petition" ||
    activeStageId === "decision_session" ||
    activeStageId === "collective_decision" ||
    activeStageId === "commitment" ||
    activeStageId === "tracking" ||
    activeStageId === "official_response" ||
    activeStageId === "public_impact" ||
    activeStageId === "archive" ||
    (isOwnerRoute && isInitiativeLifecycleAuthorWorkspaceStage(activeStageId));
  const tabs: Array<[CenterTab, string]> = showManageTab
    ? [
        ["manage", "Manage"],
        ["overview", "Overview"],
        ["discussion", "Discussion"],
      ]
    : [
        ["overview", "Overview"],
        ["discussion", "Discussion"],
      ];

  return (
    <div className="pie-center">
      <div className="pie-center__nav">
        <div className="pie-center__tabs" role="tablist" aria-label="Initiative content">
          {tabs.map(([tabId, label]) => (
            <button
              key={tabId}
              type="button"
              role="tab"
              id={`pie-tab-${tabId}`}
              aria-selected={activeTab === tabId && !showLifecyclePanel}
              aria-controls={`pie-panel-${tabId}`}
              className={`pie-center__tab${activeTab === tabId && !showLifecyclePanel ? " pie-center__tab--active" : ""}`}
              onClick={() => onTabChange(tabId)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="pie-center__nav-aside" aria-label="Initiative author and share">
          <CivicShareButton
            payload={buildPublicInitiativeSharePayload({
              initiativeId: experience.initiativeId,
              title: experience.initiative.title,
              image:
                experience.hero.imageUrl ??
                experience.initiative.metadata.imageUrl ??
                experience.initiative.metadata.coverMedia?.thumbnailUrl ??
                experience.initiative.metadata.coverMedia?.url,
              optionalText: experience.hero.summary || experience.initiative.description,
            })}
            ariaLabel={`Share initiative: ${experience.initiative.title}`}
          />
          <InitiativeAuthorIdentity
            className="pie-center__author-identity"
            displayName={experience.initiative.stewardDisplayName}
            avatarUrl={experience.initiative.stewardAvatarUrl}
            profileUrl={experience.initiative.stewardProfileUrl}
            roleLabel="Author"
            avatarSize={32}
          />
        </div>
      </div>

      <div ref={contentRef} className="pie-center__content">
        {showLifecyclePanel && activeStage && showLifecycleWorkspaceShell && onNavigateStage && returnToInitiativeHref ? (
          <section className="pie-center__panel" aria-label={`${activeStage.stageId} lifecycle stage`}>
            <InitiativeLifecycleStageWorkspace
              initiativeId={experience.initiativeId}
              stageId={activeStage.stageId}
              lifecycleProfile={experience.lifecycleProfile}
              onNavigateStage={onNavigateStage}
              returnToInitiativeHref={returnToInitiativeHref}
              isPreviewMode={isStagePreviewMode}
              onTogglePreview={onToggleStagePreviewMode}
              authorEditorSlot={
                activeStage.stageId === "analysis" ? (
                  <InitiativeCollaborativeAnalysisAuthorWorkspace
                    initiativeId={experience.initiativeId}
                    onTogglePreview={onToggleStagePreviewMode ?? (() => undefined)}
                  />
                ) : activeStage.stageId === "proposal" ? (
                  <InitiativeImprovementProposalsAuthorWorkspace
                    initiativeId={experience.initiativeId}
                    onTogglePreview={onToggleStagePreviewMode ?? (() => undefined)}
                    onNavigate={onNavigateStage}
                  />
                ) : activeStage.stageId === "petition" ? (
                  <InitiativePetitionAuthorWorkspace
                    initiativeId={experience.initiativeId}
                    onTogglePreview={onToggleStagePreviewMode ?? (() => undefined)}
                  />
                ) : activeStage.stageId === "decision_session" ? (
                  <InitiativeDecisionSessionAuthorWorkspace
                    initiativeId={experience.initiativeId}
                    onTogglePreview={onToggleStagePreviewMode ?? (() => undefined)}
                  />
                ) : activeStage.stageId === "collective_decision" ? (
                  <InitiativeCollectiveDecisionAuthorWorkspace
                    initiativeId={experience.initiativeId}
                    lifecycleProfile={experience.lifecycleProfile}
                    onTogglePreview={onToggleStagePreviewMode ?? (() => undefined)}
                    onNavigate={onNavigateStage}
                  />
                ) : activeStage.stageId === "commitment" ? (
                  <InitiativeImplementationCommitmentAuthorWorkspace
                    initiativeId={experience.initiativeId}
                    onTogglePreview={onToggleStagePreviewMode ?? (() => undefined)}
                    onNavigate={onNavigateStage}
                  />
                ) : activeStage.stageId === "tracking" ? (
                  <InitiativeImplementationTrackingAuthorWorkspace
                    initiativeId={experience.initiativeId}
                    onTogglePreview={onToggleStagePreviewMode ?? (() => undefined)}
                    onNavigate={onNavigateStage}
                  />
                ) : activeStage.stageId === "official_response" ? (
                  <InitiativeOfficialResponseAuthorWorkspace
                    initiativeId={experience.initiativeId}
                    onTogglePreview={onToggleStagePreviewMode ?? (() => undefined)}
                    onNavigate={onNavigateStage}
                  />
                ) : activeStage.stageId === "public_impact" ? (
                  <InitiativePublicImpactAuthorWorkspace
                    initiativeId={experience.initiativeId}
                    onTogglePreview={onToggleStagePreviewMode ?? (() => undefined)}
                    onNavigate={onNavigateStage}
                  />
                ) : activeStage.stageId === "archive" ? (
                  <InitiativeCivicArchiveAuthorWorkspace
                    initiativeId={experience.initiativeId}
                    lifecycleProfile={experience.lifecycleProfile}
                    onTogglePreview={onToggleStagePreviewMode ?? (() => undefined)}
                  />
                ) : undefined
              }
              publicResultSlot={
                activeStage.stageId === "analysis"
                  ? (projection) =>
                      projection.metadata.publishedRecordId ? (
                        <InitiativeCollaborativeAnalysisPublicResult
                          analysisId={projection.metadata.publishedRecordId}
                          isPreview={isStagePreviewMode}
                        />
                      ) : isStagePreviewMode ? (
                        <InitiativeCollaborativeAnalysisDraftPreview initiativeId={experience.initiativeId} />
                      ) : null
                  : activeStage.stageId === "proposal"
                    ? (projection) =>
                        projection.metadata.publishedRecordId ? (
                          <InitiativeImprovementProposalsPublicResult
                            collectionId={projection.metadata.publishedRecordId}
                            isPreview={isStagePreviewMode}
                          />
                        ) : isStagePreviewMode ? (
                          <InitiativeImprovementProposalsDraftPreview initiativeId={experience.initiativeId} />
                        ) : null
                    : activeStage.stageId === "petition"
                        ? (projection) =>
                            projection.metadata.publishedRecordId ? (
                              <InitiativePetitionPublicResult
                                petitionId={projection.metadata.publishedRecordId}
                                isPreview={isStagePreviewMode}
                              />
                            ) : isStagePreviewMode ? (
                              <InitiativePetitionDraftPreview initiativeId={experience.initiativeId} />
                            ) : null
                        : activeStage.stageId === "decision_session"
                          ? (projection) =>
                              projection.metadata.publishedRecordId ? (
                                <InitiativeDecisionSessionPublicResult
                                  sessionId={projection.metadata.publishedRecordId}
                                  isPreview={isStagePreviewMode}
                                />
                              ) : isStagePreviewMode ? (
                                <InitiativeDecisionSessionDraftPreview
                                  initiativeId={experience.initiativeId}
                                />
                              ) : null
                          : activeStage.stageId === "collective_decision"
                            ? (projection) =>
                                projection.metadata.publishedRecordId ? (
                                  <InitiativeCollectiveDecisionPublicResult
                                    decisionId={projection.metadata.publishedRecordId}
                                    isPreview={isStagePreviewMode}
                                  />
                                ) : isStagePreviewMode ? (
                                  <InitiativeCollectiveDecisionDraftPreview
                                    initiativeId={experience.initiativeId}
                                  />
                                ) : null
                            : activeStage.stageId === "commitment"
                              ? (projection) =>
                                  projection.metadata.publishedRecordId ? (
                                    <InitiativeImplementationCommitmentPublicResult
                                      initiativeId={experience.initiativeId}
                                      isPreview={isStagePreviewMode}
                                    />
                                  ) : isStagePreviewMode ? (
                                    <InitiativeImplementationCommitmentDraftPreview
                                      initiativeId={experience.initiativeId}
                                    />
                                  ) : null
                              : activeStage.stageId === "tracking"
                                ? (projection) =>
                                    projection.metadata.publishedRecordId ? (
                                      <InitiativeImplementationTrackingPublicResult
                                        initiativeId={experience.initiativeId}
                                        isPreview={isStagePreviewMode}
                                      />
                                    ) : isStagePreviewMode ? (
                                      <InitiativeImplementationTrackingDraftPreview
                                        initiativeId={experience.initiativeId}
                                      />
                                    ) : null
                                : activeStage.stageId === "official_response"
                                  ? (projection) =>
                                      projection.metadata.publishedRecordId ? (
                                        <InitiativeOfficialResponsePublicResult
                                          initiativeId={experience.initiativeId}
                                          isPreview={isStagePreviewMode}
                                        />
                                      ) : isStagePreviewMode ? (
                                        <InitiativeOfficialResponseDraftPreview
                                          initiativeId={experience.initiativeId}
                                        />
                                      ) : null
                                  : activeStage.stageId === "public_impact"
                                    ? (projection) =>
                                        projection.metadata.publishedRecordId ? (
                                          <InitiativePublicImpactPublicResult
                                            initiativeId={experience.initiativeId}
                                            isPreview={isStagePreviewMode}
                                          />
                                        ) : isStagePreviewMode ? (
                                          <InitiativePublicImpactDraftPreview
                                            initiativeId={experience.initiativeId}
                                          />
                                        ) : null
                                    : activeStage.stageId === "archive"
                                      ? (projection) =>
                                          projection.metadata.publishedRecordId ? (
                                            <InitiativeCivicArchivePublicResult
                                              initiativeId={experience.initiativeId}
                                              isPreview={isStagePreviewMode}
                                            />
                                          ) : isStagePreviewMode ? (
                                            <InitiativeCivicArchiveDraftPreview
                                              initiativeId={experience.initiativeId}
                                            />
                                          ) : null
                                      : undefined
              }
            />
          </section>
        ) : null}

        {showLifecyclePanel && activeStage && !showLifecycleWorkspaceShell ? (
          <section
            className="pie-center__panel"
            aria-labelledby={`pie-stage-${activeStage.stageId}`}
          >
            <h2 id={`pie-stage-${activeStage.stageId}`}>
              {experience.lifecycleStages.find((stage) => stage.stageId === activeStage.stageId)
                ?.label ?? "Lifecycle"}
            </h2>
            <LifecycleStagePanel stage={activeStage} />
          </section>
        ) : null}

        {!showLifecyclePanel && showManageTab && activeTab === "manage" ? (
          <section
            id="pie-panel-manage"
            role="tabpanel"
            aria-labelledby="pie-tab-manage"
            className="pie-center__panel pie-center__panel--manage"
          >
            {managePanel}
          </section>
        ) : null}

        {!showLifecyclePanel && activeTab === "overview" ? (
          <section
            id="pie-panel-overview"
            role="tabpanel"
            aria-labelledby="pie-tab-overview"
            className="pie-center__panel"
          >
            <PublicInitiativeOverview
              initiative={experience.initiative}
              currentStageId={experience.currentStageId}
              currentStageLabel={
                experience.lifecycleStages.find((stage) => stage.stageId === experience.currentStageId)
                  ?.label ?? "Initiative"
              }
            />
          </section>
        ) : null}

        {!showLifecyclePanel && activeTab === "discussion" ? (
          <section
            id="pie-panel-discussion"
            role="tabpanel"
            aria-labelledby="pie-tab-discussion"
            className="pie-center__panel"
          >
            <DiscussionPanel
              initiativeId={experience.initiativeId}
              discussion={experience.discussion}
              initialDiscussionFilter={initialDiscussionFilter}
              focusCommentId={focusDiscussionCommentId}
              focusCollaborationParticipantId={focusCollaborationParticipantId}
              isOwnerRoute={isOwnerRoute}
              discussionStageState={
                discussionCompletedOverride
                  ? "completed"
                  : experience.lifecycleStages.find((stage) => stage.stageId === "discussion")?.state
              }
              onDiscussionCompleted={() => {
                setDiscussionCompletedOverride(true);
                void experienceRefresh?.refresh();
              }}
              lifecycleProfile={experience.lifecycleProfile}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
