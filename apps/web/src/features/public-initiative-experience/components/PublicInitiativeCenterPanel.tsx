"use client";

import type { RefObject, ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type {
  InitiativeLifecycleProfile,
  PublicInitiativeExperienceProjection,
  PublicInitiativeLifecycleRecordItem,
  PublicInitiativeLifecycleStageContent,
  PublicInitiativeProjection,
} from "@hu/types";
import {
  getInitiativeLifecycleProfilePresentation,
  isInitiativeLifecycleAuthorWorkspaceStage,
  isPublicChoiceCandidateElectionBallot,
  resolveParticipantFacingCurrentStageId,
} from "@hu/types";

import { formatPublicGeography } from "@hu/geography";
import {
  formatInitiativeExperienceDate,
  formatInitiativeExperienceLanguageName,
  resolveActivityAreaDisplayLabel,
  resolveLifecycleStageDisplayLabel,
} from "../initiative-experience-i18n";
import { resolveInitiativeDetailPresentation } from "../resolve-initiative-detail-presentation";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";
import { looksLikeRawI18nKey } from "../normalize-initiative-status-code";
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
import { LifecycleTranslatedRecordCard } from "./LifecycleTranslatedRecordCard";
import { useInitiativeExperienceRefresh } from "../initiative-experience-refresh-context";
import { PublicDiscussionPanel } from "./PublicDiscussionPanel";
import { PublicChoiceOverviewCandidateIntake } from "../../public-choice-candidate/components/PublicChoiceOverviewCandidateIntake";
import { PublicChoiceCollectiveDecisionStage } from "../../public-choice-candidate/components/PublicChoiceCollectiveDecisionStage";
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

/** Pack 08I.8 — Overview full description uses shared Initiative detail presentation. */
function OverviewTranslatedDescription({
  initiativeId,
  canonicalDescription,
  label,
  initialDescription,
}: {
  initiativeId: string;
  canonicalDescription: string;
  label: string;
  /** Pack 08I.9 — SSR-localized description seed. */
  initialDescription?: string;
}) {
  const readingContext = usePublicContentReadingContext();
  const [description, setDescription] = useState(
    () => initialDescription || canonicalDescription,
  );

  useEffect(() => {
    // Pack 08I.9 — keep SSR seed until reading context is ready.
    if (!readingContext.ready) {
      if (!initialDescription) {
        setDescription(canonicalDescription);
      }
      return;
    }
    let cancelled = false;
    void resolveInitiativeDetailPresentation({
      initiativeId,
      canonical: {
        title: "",
        description: canonicalDescription,
      },
      readingContext,
    }).then((presentation) => {
      if (!cancelled) {
        setDescription(presentation.description);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    initiativeId,
    canonicalDescription,
    initialDescription,
    readingContext.ready,
    readingContext.readingLanguage,
    readingContext.translationPreference,
  ]);

  return <OverviewSection label={label} value={description} />;
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
  authorLabel,
}: {
  displayName: string;
  profileUrl?: string;
  authorLabel: string;
}) {
  return (
    <div className="pie-overview__item">
      <h3>{authorLabel}</h3>
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
  lifecycleProfile,
  currentStageId,
  currentStageLabel,
  openCandidateSubmit = false,
  onOpenCandidateSubmitConsumed,
  initialDescription,
}: {
  initiative: PublicInitiativeProjection;
  lifecycleProfile?: InitiativeLifecycleProfile | string | null;
  currentStageId: string;
  currentStageLabel: string;
  openCandidateSubmit?: boolean;
  onOpenCandidateSubmitConsumed?: () => void;
  initialDescription?: string;
}) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();
  const metadata = initiative.metadata;
  const activityAreaRaw =
    metadata.activityArea === "Other" && metadata.activityAreaOther
      ? metadata.activityAreaOther
      : metadata.activityArea;
  const activityArea =
    metadata.activityArea === "Other" && metadata.activityAreaOther
      ? activityAreaRaw
      : resolveActivityAreaDisplayLabel(activityAreaRaw, t);
  const presentation = getInitiativeLifecycleProfilePresentation(lifecycleProfile);
  const showCandidateIntake =
    presentation.isPublicChoice && isPublicChoiceCandidateElectionBallot(metadata.ballotMode);
  const communityAssociationLabel = presentation.isPublicChoice
    ? t("overview.electionName")
    : t("overview.communityAssociation");

  return (
    <div className="pie-overview">
      <CurrentLifecycleStageBanner
        initiativeId={initiative.initiativeId}
        stageId={currentStageId}
        stageLabel={currentStageLabel}
      />
      {showCandidateIntake ? (
        <PublicChoiceOverviewCandidateIntake
          initiativeId={initiative.initiativeId}
          openSubmitInitially={openCandidateSubmit}
          onOpenSubmitConsumed={onOpenCandidateSubmitConsumed}
        />
      ) : null}
      {!presentation.isPublicChoice ? (
        <>
          <OverviewTranslatedDescription
            initiativeId={initiative.initiativeId}
            canonicalDescription={initiative.description}
            initialDescription={initialDescription}
            label={t("overview.fullDescription")}
          />
          <div className="pie-overview__grid">
            <div className="pie-overview__column">
              {presentation.showActivityArea ? (
                <OverviewMetadataItem label={t("overview.activityArea")} value={activityArea} />
              ) : null}
              <OverviewMetadataItem label={t("overview.category")} value={metadata.category} />
              <OverviewMetadataItem
                label={t("overview.startDate")}
                value={
                  metadata.startDate
                    ? formatInitiativeExperienceDate(locale, metadata.startDate)
                    : undefined
                }
              />
              <OverviewAuthorItem
                displayName={initiative.stewardDisplayName}
                profileUrl={initiative.stewardProfileUrl}
                authorLabel={t("overview.author")}
              />
              <OverviewMetadataItem
                label={t("common.currentVersion")}
                value={t("common.versionN", { version: initiative.currentVersion })}
              />
            </div>
            <div className="pie-overview__column">
              <OverviewMetadataItem
                label={t("overview.geographicScope")}
                value={formatPublicGeography({
                  countryCode: metadata.countrySlug,
                  regionCode: metadata.regionSlug,
                  communitySlug: metadata.communitySlug,
                  regionLabel: metadata.region,
                  communityAssociation: metadata.communityAssociation,
                })}
              />
              <OverviewMetadataItem
                label={communityAssociationLabel}
                value={metadata.communityAssociation ?? metadata.communitySlug}
              />
              <OverviewMetadataItem
                label={t("overview.language")}
                value={formatInitiativeExperienceLanguageName(locale, metadata.language)}
              />
              <OverviewMetadataItem
                label={t("overview.completionDate")}
                value={
                  metadata.completionDate
                    ? formatInitiativeExperienceDate(locale, metadata.completionDate)
                    : undefined
                }
              />
              <OverviewMetadataItem label={t("overview.status")} value={currentStageLabel} />
              <OverviewMetadataItem
                label={t("overview.tags")}
                value={formatList(metadata.tags) ?? undefined}
              />
            </div>
          </div>
          {initiative.sourceReferences?.map((reference) => (
            <section
              key={`${reference.type}-${reference.sourceRecordId}`}
              className="pie-overview__section"
            >
              <h3>{t("common.sourceArticle")}</h3>
              <p className="pie-overview__meta">{reference.sourceName}</p>
              <p>{reference.title}</p>
              {reference.summary ? <p>{reference.summary}</p> : null}
              <p className="pie-overview__meta">
                {t("common.publishedPrefix", {
                  date: formatInitiativeExperienceDate(locale, reference.publishedAt),
                })}
              </p>
              <p>
                <a href={reference.articleUrl} target="_blank" rel="noopener noreferrer">
                  {t("common.viewOriginalSource")}
                </a>
              </p>
            </section>
          ))}
        </>
      ) : null}
    </div>
  );
}

function LifecycleRecordCard({ record }: { record: PublicInitiativeLifecycleRecordItem }) {
  return <LifecycleTranslatedRecordCard record={record} />;
}

function LifecycleStagePanel({ stage }: { stage: PublicInitiativeLifecycleStageContent }) {
  const t = useTranslations("initiativeExperience");

  if (stage.records.length === 0) {
    const code = stage.emptyStateCode ?? `stage_${stage.stageId}_default`;
    const key = `lifecycleEmpty.${code}`;
    let message = stage.emptyStateMessage;
    try {
      const localized = t(key);
      if (localized.trim() && !looksLikeRawI18nKey(localized) && localized !== key) {
        message = localized;
      }
    } catch {
      // keep API compatibility English
    }
    return <p className="pie-empty">{message}</p>;
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
  /** Pack 03 — open Overview candidate form immediately (no reload). */
  openCandidateSubmit?: boolean;
  onOpenCandidateSubmitConsumed?: () => void;
  /** Pack 08I.9 — SSR-localized title/description seed for Overview. */
  initialPresentation?: {
    readonly title: string;
    readonly description: string;
  };
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
  openCandidateSubmit = false,
  onOpenCandidateSubmitConsumed,
  initialPresentation,
}: PublicInitiativeCenterPanelProps) {
  const t = useTranslations("initiativeExperience");
  const experienceRefresh = useInitiativeExperienceRefresh();
  const [discussionCompletedOverride, setDiscussionCompletedOverride] = useState(false);
  const activeStage = experience.stageContent.find((stage) => stage.stageId === activeStageId);
  const isPublicChoice =
    getInitiativeLifecycleProfilePresentation(experience.lifecycleProfile).isPublicChoice;
  /**
   * Fix 05 — PUBLIC_CHOICE Collective Decision never uses STANDARD Author Workspace.
   * All roles mount PublicChoiceCollectiveDecisionStage (election results board).
   */
  const showPublicChoiceCollectiveDecision =
    showLifecyclePanel && isPublicChoice && activeStageId === "collective_decision";
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
    !showPublicChoiceCollectiveDecision &&
    (activeStageId === "analysis" ||
      activeStageId === "proposal" ||
      activeStageId === "petition" ||
      activeStageId === "decision_session" ||
      activeStageId === "collective_decision" ||
      activeStageId === "commitment" ||
      activeStageId === "tracking" ||
      activeStageId === "official_response" ||
      activeStageId === "public_impact" ||
      activeStageId === "archive" ||
      (isOwnerRoute && isInitiativeLifecycleAuthorWorkspaceStage(activeStageId)));
  const tabs: Array<[CenterTab, string]> = showManageTab
    ? [
        ["manage", t("tabs.manage")],
        ["overview", t("tabs.overview")],
        ["discussion", t("tabs.discussion")],
      ]
    : [
        ["overview", t("tabs.overview")],
        ["discussion", t("tabs.discussion")],
      ];

  return (
    <div className="pie-center">
      <div className="pie-center__nav">
        <div className="pie-center__tabs" role="tablist" aria-label={t("common.initiativeContentAria")}>
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
        <div className="pie-center__nav-aside" aria-label={t("common.authorAndShareAria")}>
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
            ariaLabel={t("common.shareInitiative", { title: experience.initiative.title })}
          />
          <InitiativeAuthorIdentity
            className="pie-center__author-identity"
            displayName={experience.initiative.stewardDisplayName}
            avatarUrl={experience.initiative.stewardAvatarUrl}
            profileUrl={experience.initiative.stewardProfileUrl}
            roleLabel={t("common.author")}
            avatarSize={32}
          />
        </div>
      </div>

      <div ref={contentRef} className="pie-center__content">
        {showPublicChoiceCollectiveDecision ? (
          <section
            className="pie-center__panel"
            aria-label={t("common.electionResultsAria")}
          >
            <PublicChoiceCollectiveDecisionStage initiativeId={experience.initiativeId} />
          </section>
        ) : null}

        {showLifecyclePanel && activeStage && showLifecycleWorkspaceShell && onNavigateStage && returnToInitiativeHref ? (
          <section
            className="pie-center__panel"
            aria-label={t("common.lifecycleStageAria", {
              stage: resolveLifecycleStageDisplayLabel(activeStage.stageId, t, activeStage.stageId),
            })}
          >            <InitiativeLifecycleStageWorkspace
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
                                      viewerIsSteward={Boolean(experience.viewerIsSteward)}
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
            {(() => {
              const facingStageId = resolveParticipantFacingCurrentStageId(
                experience.currentStageId,
                experience.lifecycleProfile,
              );
              const facingLabel =
                experience.lifecycleStages.find((stage) => stage.stageId === facingStageId)?.label ??
                "Initiative";
              return (
                <PublicInitiativeOverview
                  initiative={experience.initiative}
                  lifecycleProfile={experience.lifecycleProfile}
                  currentStageId={facingStageId}
                  currentStageLabel={facingLabel}
                  openCandidateSubmit={openCandidateSubmit}
                  onOpenCandidateSubmitConsumed={onOpenCandidateSubmitConsumed}
                  initialDescription={initialPresentation?.description}
                />
              );
            })()}
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
