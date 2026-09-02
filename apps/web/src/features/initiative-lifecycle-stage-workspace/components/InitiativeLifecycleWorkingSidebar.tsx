"use client";

import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import type {
  InitiativeAnalysisSourceSnapshot,
  InitiativeCollectiveDecisionIntelligenceSnapshot,
  InitiativeCollectiveDecisionLifecycleDraft,
  InitiativeDecisionSessionDraft,
  InitiativeDecisionSessionIntelligenceSnapshot,
  InitiativeImplementationCommitmentIntelligenceSnapshot,
  InitiativeImplementationCommitmentLifecycleDraft,
  InitiativeImplementationTrackingIntelligenceSnapshot,
  InitiativeImplementationTrackingLifecycleDraft,
  InitiativeLifecycleStageProjection,
  InitiativeOfficialResponseIntelligenceSnapshot,
  InitiativeOfficialResponseLifecycleDraft,
  InitiativePublicImpactIntelligenceSnapshot,
  InitiativePublicImpactLifecycleDraft,
  InitiativeCivicArchiveIntelligenceSnapshot,
  InitiativeCivicArchiveLifecycleDraft,
  InitiativeLifecycleProfile,
  InitiativePetitionIntelligenceSnapshot,
  InitiativeProposalIntelligenceSnapshot,
  InitiativeRevisionDraft,
  InitiativeRevisionIntelligenceSnapshot,
  InitiativeStructuredProposal,
} from "@hu/types";
import {
  resolveInitiativeLifecycleProfile,
} from "@hu/types";

import { InitiativeActiveAlliesWidget } from "../../initiative-active-allies/components/InitiativeActiveAlliesWidget";
import { PublicInitiativeSupportStatistics } from "../../public-initiative-experience/components/PublicInitiativeSupportStatistics";
import { PublicChoiceElectionSidebarWidget } from "../../public-initiative-experience/components/PublicChoiceElectionSidebarWidget";
import {
  resolveLifecycleStageDisplayLabel,
  resolvePresentationStatusDisplayLabel,
} from "../../public-initiative-experience/initiative-experience-i18n";
import { getInitiativeAnalysisSourceSnapshot } from "../../initiative-collaborative-analysis/api";
import { deriveAiAssistantInsights } from "../../initiative-collaborative-analysis/derive-ai-assistant-insights";
import "../../initiative-collaborative-analysis/components/initiative-collaborative-analysis-workspace.css";
import {
  getInitiativeProposalIntelligenceSnapshot,
  getMyCurrentImprovementProposalsCollection,
} from "../../initiative-improvement-proposals-stage/api";
import { deriveProposalAiAssistantInsights } from "../../initiative-improvement-proposals-stage/derive-proposal-ai-assistant-insights";
import "../../initiative-improvement-proposals-stage/components/initiative-improvement-proposals-stage-workspace.css";
import { getInitiativeRevisionWorkspace } from "../../initiative-version-revision/api";
import { deriveRevisionAiAssistantInsights } from "../../initiative-version-revision/derive-revision-ai-assistant-insights";
import "../../initiative-version-revision/components/initiative-revision-stage-workspace.css";
import { getInitiativePetitionWorkspace } from "../../initiative-petition-lifecycle/api";
import "../../initiative-petition-lifecycle/components/initiative-petition-stage-workspace.css";
import { derivePetitionAiAssistantInsights } from "../../initiative-petition-lifecycle/derive-petition-ai-assistant-insights";
import { getInitiativeDecisionSessionWorkspace } from "../../initiative-decision-session-lifecycle/api";
import "../../initiative-decision-session-lifecycle/components/initiative-decision-session-stage-workspace.css";
import { deriveDecisionSessionAiAssistantInsights } from "../../initiative-decision-session-lifecycle/derive-decision-session-ai-assistant-insights";
import { getInitiativeCollectiveDecisionWorkspace } from "../../initiative-collective-decision-lifecycle/api";
import "../../initiative-collective-decision-lifecycle/components/initiative-collective-decision-stage-workspace.css";
import { deriveCollectiveDecisionAiAssistantInsights } from "../../initiative-collective-decision-lifecycle/derive-collective-decision-ai-assistant-insights";
import { getInitiativeImplementationCommitmentWorkspace } from "../../initiative-implementation-commitment-lifecycle/api";
import "../../initiative-implementation-commitment-lifecycle/components/initiative-implementation-commitment-stage-workspace.css";
import { deriveImplementationCommitmentAiAssistantInsights } from "../../initiative-implementation-commitment-lifecycle/derive-implementation-commitment-ai-assistant-insights";
import { InitiativeImplementationCommitmentProposalInbox } from "../../initiative-implementation-commitment-lifecycle/components/InitiativeImplementationCommitmentProposalInbox";
import { getInitiativeImplementationTrackingWorkspace } from "../../initiative-implementation-tracking-lifecycle/api";
import "../../initiative-implementation-tracking-lifecycle/components/initiative-implementation-tracking-stage-workspace.css";
import { deriveImplementationTrackingAiAssistantInsights } from "../../initiative-implementation-tracking-lifecycle/derive-implementation-tracking-ai-assistant-insights";
import { InitiativeImplementationTrackingProgressInbox } from "../../initiative-implementation-tracking-lifecycle/components/InitiativeImplementationTrackingProgressInbox";
import { getInitiativeOfficialResponseWorkspace } from "../../initiative-official-response-lifecycle/api";
import "../../initiative-official-response-lifecycle/components/initiative-official-response-stage-workspace.css";
import { deriveOfficialResponseAiAssistantInsights } from "../../initiative-official-response-lifecycle/derive-official-response-ai-assistant-insights";
import { getInitiativePublicImpactWorkspace } from "../../initiative-public-impact-lifecycle/api";
import "../../initiative-public-impact-lifecycle/components/initiative-public-impact-stage-workspace.css";
import { derivePublicImpactAiAssistantInsights } from "../../initiative-public-impact-lifecycle/derive-public-impact-ai-assistant-insights";
import { getInitiativeCivicArchiveWorkspace } from "../../initiative-civic-archive-lifecycle/api";
import "../../initiative-civic-archive-lifecycle/components/initiative-civic-archive-stage-workspace.css";
import { deriveCivicArchiveAiAssistantInsights } from "../../initiative-civic-archive-lifecycle/derive-civic-archive-ai-assistant-insights";
import { WorkspaceButton, WorkspaceDeferredActions, WorkspaceStatusBadge } from "../../initiative-workspace-ux";
import { HumanityUnionAssistantOpenButton } from "../../humanity-union-assistant";
import { getInitiativeLifecycleStageProjection } from "../api";
import { resolveSidebarAdvisoryDisplay } from "../resolve-sidebar-advisory-display";

import "../initiative-lifecycle-stage-workspace.css";

/**
 * Initiative Lifecycle — Part A Completion Part 6: the reusable Author
 * working sidebar.
 *
 * Replaces ordinary public sidebar widgets (Initiative Support, public
 * statistics, general history cards) for the Initiative Author once a
 * stage has reached Collaborative Analysis or later — those remain exactly
 * as-is for every Public Mode viewer (Part 7), including an Active Ally,
 * whose own sidebar slot (the existing Collaboration Channel swap) is
 * intentionally left untouched by this Part per scope protection.
 *
 * Lifecycle stages open the canonical Humanity Union Assistant modal (provider-
 * independent). Other stages keep deterministic insight sidebars until
 * their assist operations are enabled.
 */
export interface InitiativeLifecycleWorkingSidebarProps {
  readonly initiativeId: string;
  readonly stageId: string;
  readonly onOpenPublicPreview: () => void;
  readonly onNavigateNextStage: (stageId: string, hash: string) => void;
  /** Canonical profile from the Lifecycle shell — Archive assistant gating only. */
  readonly lifecycleProfile?: InitiativeLifecycleProfile | string | null;
  /** Pack 04 — hide Initiative Support for all PUBLIC_CHOICE. */
  readonly ballotMode?: string | null;
  /**
   * Public Choice Experience Pack 01 — restore Initiative Support as the
   * first right-sidebar widget even while the Author working tools replace
   * the public sidebar composition (except PUBLIC_CHOICE Pack 04).
   */
  readonly supportStatistics?: ComponentProps<typeof PublicInitiativeSupportStatistics>["statistics"];
  readonly onSupportSignalChange?: ComponentProps<
    typeof PublicInitiativeSupportStatistics
  >["onSignalChange"];
  readonly onSupportBookmarkToggle?: () => void;
  readonly supportBusy?: boolean;
}


function WorkingSidebarAssistantChrome({
  initiativeId,
  surfaceId,
  stageId,
  children,
  loadFailed = false,
  loading = false,
  hint = false,
}: {
  initiativeId: string;
  surfaceId: ComponentProps<typeof HumanityUnionAssistantOpenButton>["surfaceId"];
  stageId: ComponentProps<typeof HumanityUnionAssistantOpenButton>["stageId"];
  children?: ReactNode;
  loadFailed?: boolean;
  loading?: boolean;
  hint?: boolean;
}) {
  const t = useTranslations("initiativeExperience");

  return (
    <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-ai-title">
      <h3 id="lsw-sidebar-ai-title" className="lsw-sidebar__section-title">
        {t("author.sidebar.assistantTitle")}
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId={surfaceId}
        initiativeId={initiativeId}
        stageId={stageId}
        label={t("author.sidebar.askAssistant")}
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">{t("author.sidebar.assistantLoadFailed")}</p>
      ) : loading ? (
        <p className="lsw-sidebar__loading">{t("author.sidebar.loading")}</p>
      ) : hint ? (
        <p className="lsw-sidebar__placeholder">{t("author.sidebar.assistantGenericHint")}</p>
      ) : (
        children
      )}
    </section>
  );
}

function AiAssistantSlot({
  initiativeId,
  surfaceId,
  stageId,
}: {
  initiativeId: string;
  surfaceId:
    | "initiative"
    | "analysis"
    | "proposal"
    | "revision"
    | "petition"
    | "decision_session"
    | "collective_decision"
    | "commitment"
    | "tracking"
    | "official_response"
    | "public_impact"
    | "archive";
  stageId:
    | "initiative"
    | "analysis"
    | "proposal"
    | "revision"
    | "petition"
    | "decision_session"
    | "collective_decision"
    | "commitment"
    | "tracking"
    | "official_response"
    | "public_impact"
    | "archive";
}) {
  return (
    <WorkingSidebarAssistantChrome
      initiativeId={initiativeId}
      surfaceId={surfaceId}
      stageId={stageId}
      hint
    />
  );
}

/**
 * Initiative Lifecycle — Part B, Section 6 (AI Assistant Sidebar).
 * Self-fetches the full Source Snapshot and derives every field from it
 * via `deriveAiAssistantInsights` — no AI chat, no external call.
 */
function AnalysisAiAssistantSlot({ initiativeId }: { initiativeId: string }) {
  const t = useTranslations("initiativeExperience");
  const [snapshot, setSnapshot] = useState<InitiativeAnalysisSourceSnapshot | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setLoadFailed(false);

    getInitiativeAnalysisSourceSnapshot(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setSnapshot(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  return (
    <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-ai-title">
      <h3 id="lsw-sidebar-ai-title" className="lsw-sidebar__section-title">
        {t("author.sidebar.assistantTitle")}
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="analysis"
        initiativeId={initiativeId}
        stageId="analysis"
        label={t("author.sidebar.askAssistant")}
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">{t("author.sidebar.assistantLoadFailed")}</p>
      ) : !snapshot ? (
        <p className="lsw-sidebar__loading">{t("author.sidebar.loading")}</p>
      ) : (
        <AnalysisAiAssistantContent snapshot={snapshot} />
      )}
    </section>
  );
}

function AnalysisAiAssistantContent({ snapshot }: { snapshot: InitiativeAnalysisSourceSnapshot }) {
  const t = useTranslations("initiativeExperience");
  const insights = deriveAiAssistantInsights(snapshot);

  return (
    <div className="ica-ai-assistant">
      <div className="ica-ai-assistant__group">
        <h4>{t("author.sidebar.sourcesUsed")}</h4>
        <p>{resolveSidebarAdvisoryDisplay(insights.sourcesSummary, t).text}</p>
      </div>

      <div className="ica-ai-assistant__group">
        <h4>{t("author.sidebar.insights.missingEvidence")}</h4>
        {insights.missingEvidence.length > 0 ? (
          <ul>
            {insights.missingEvidence.map((item) => (
              <li key={item.code}>{resolveSidebarAdvisoryDisplay(item, t).text}</li>
            ))}
          </ul>
        ) : (
          <p className="ica-ai-assistant__empty">{t("author.sidebar.insights.emptyNoEvidenceGaps")}</p>
        )}
      </div>

      <div className="ica-ai-assistant__group">
        <h4>{t("author.sidebar.insights.repeatedArguments")}</h4>
        {insights.repeatedArguments.length > 0 ? (
          <ul>
            {insights.repeatedArguments.map((item) => (
              <li key={item.commentId}>
                &ldquo;{item.excerpt}&rdquo; {t("author.sidebar.insights.helpfulCount", { count: item.helpfulCount })}
              </li>
            ))}
          </ul>
        ) : (
          <p className="ica-ai-assistant__empty">{t("author.sidebar.noneIdentified")}</p>
        )}
      </div>

      <div className="ica-ai-assistant__group">
        <h4>{t("author.sidebar.insights.possibleContradictions")}</h4>
        {insights.possibleContradictions.length > 0 ? (
          <ul>
            {insights.possibleContradictions.map((item) => (
              <li key={item.advisory.civic?.subject ?? item.advisory.code}>
                {resolveSidebarAdvisoryDisplay(item.advisory, t).text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="ica-ai-assistant__empty">{t("author.sidebar.noneIdentified")}</p>
        )}
      </div>

      <div className="ica-ai-assistant__group">
        <h4>{t("author.sidebar.insights.unansweredQuestions")}</h4>
        {insights.unansweredQuestions.length > 0 ? (
          <ul>
            {insights.unansweredQuestions.map((item) => (
              <li key={item.commentId}>&ldquo;{item.excerpt}&rdquo;</li>
            ))}
          </ul>
        ) : (
          <p className="ica-ai-assistant__empty">{t("author.sidebar.noneIdentified")}</p>
        )}
      </div>

      <div className="ica-ai-assistant__group">
        <h4>{t("author.sidebar.insights.proposalCoverage")}</h4>
        <p>
          {t("author.sidebar.insights.proposalCoverageSummary", {
            proposalCount: insights.proposalCoverage.proposalCount,
            commentCount: insights.proposalCoverage.commentCount,
            percentage: insights.proposalCoverage.percentage,
          })}
        </p>
      </div>
    </div>
  );
}

/**
 * Initiative Lifecycle — Part D, Section 3/4 (Proposal Intelligence / AI
 * Assistant Sidebar). Self-fetches the Proposal Intelligence Snapshot AND
 * the Author's current draft proposals, then derives every field via
 * `deriveProposalAiAssistantInsights` — no AI chat, no external call, and
 * (Part 4) never a decision-making control (Accept/Reject/Include/
 * Exclude/Priority stay exclusively in the main Proposal Editor).
 */
function ProposalAiAssistantSlot({ initiativeId }: { initiativeId: string }) {
  const t = useTranslations("initiativeExperience");
  const [snapshot, setSnapshot] = useState<InitiativeProposalIntelligenceSnapshot | null>(null);
  const [draftProposals, setDraftProposals] = useState<readonly InitiativeStructuredProposal[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setLoadFailed(false);

    Promise.all([
      getInitiativeProposalIntelligenceSnapshot(initiativeId),
      getMyCurrentImprovementProposalsCollection(initiativeId),
    ])
      .then(([snapshotResult, collection]) => {
        if (!cancelled) {
          setSnapshot(snapshotResult);
          setDraftProposals(collection?.proposals ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  return (
    <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-ai-title">
      <h3 id="lsw-sidebar-ai-title" className="lsw-sidebar__section-title">
        {t("author.sidebar.assistantTitle")}
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="proposal"
        initiativeId={initiativeId}
        stageId="proposal"
        label={t("author.sidebar.askAssistant")}
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">{t("author.sidebar.assistantLoadFailed")}</p>
      ) : !snapshot ? (
        <p className="lsw-sidebar__loading">{t("author.sidebar.loading")}</p>
      ) : (
        <ProposalAiAssistantContent snapshot={snapshot} draftProposals={draftProposals} />
      )}
    </section>
  );
}

function ProposalAiAssistantContent({
  snapshot,
  draftProposals,
}: {
  snapshot: InitiativeProposalIntelligenceSnapshot;
  draftProposals: readonly InitiativeStructuredProposal[];
}) {
  const t = useTranslations("initiativeExperience");
  const insights = deriveProposalAiAssistantInsights(snapshot, draftProposals);

  return (
    <div className="iip-ai-assistant">
      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.sourcesUsed")}</h4>
        <p>{insights.sourcesUsedSummary}</p>
      </div>

      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.insights.possibleDuplicates")}</h4>
        {insights.duplicateGroups.length > 0 ? (
          <ul>
            {insights.duplicateGroups.map((group) => (
              <li key={group.groupId}>
                &ldquo;{group.representativeExcerpt}&rdquo; {t("author.sidebar.insights.similarMentions", { count: group.memberCount })}
              </li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyNoDuplicates")}</p>
        )}
      </div>

      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.insights.ungroupedCandidates")}</h4>
        {insights.ungroupedCandidateGroups.length > 0 ? (
          <ul>
            {insights.ungroupedCandidateGroups.map((group) => (
              <li key={group.groupId}>&ldquo;{group.representativeExcerpt}&rdquo; {t("author.sidebar.insights.notYetDrafted")}</li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyEveryGroupDrafted")}</p>
        )}
      </div>

      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.insights.incompleteProposals")}</h4>
        {insights.incompleteProposals.length > 0 ? (
          <ul>
            {insights.incompleteProposals.map(({ proposal, missingFields }) => (
              <li key={proposal.proposalId}>
                &ldquo;{proposal.title || t("author.sidebar.insights.untitledProposal")}&rdquo; {t("author.sidebar.insights.missingFieldsSuffix", { fields: missingFields.join(", ") })}
              </li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyNoIncompleteProposals")}</p>
        )}
      </div>

      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.insights.openProposalQuestions")}</h4>
        <p>{t("author.sidebar.insights.openProposalQuestionsCount", { count: insights.openProposalQuestionCount })}</p>
      </div>

      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.insights.suggestedTreatment")}</h4>
        {insights.suggestedTreatments.length > 0 ? (
          <ul>
            {insights.suggestedTreatments.map((entry) => (
              <li key={entry.proposalId}>
                &ldquo;{entry.title || t("author.sidebar.insights.untitled")}&rdquo; — {entry.suggestion.replace(/_/g, " ")}:{" "}
                {entry.rationale}
              </li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyNoUndecidedProposals")}</p>
        )}
        <p className="iip-ai-assistant__empty">
          {t("author.sidebar.insights.neverPublishesAutomatically")}
        </p>
      </div>
    </div>
  );
}

/**
 * Initiative Lifecycle — Part E, Section 3/4 (Revision Intelligence / AI
 * Assistant Sidebar). Self-fetches the Revision workspace context (the
 * Intelligence Snapshot AND the Author's current draft changes in a
 * single request), then derives every field via
 * `deriveRevisionAiAssistantInsights` — no AI chat, no external call, and
 * never a decision-making control (Generate/Edit/Remove/Apply stay
 * exclusively in the main Revision Editor).
 */
function RevisionAiAssistantSlot({ initiativeId }: { initiativeId: string }) {
  const t = useTranslations("initiativeExperience");
  const [snapshot, setSnapshot] = useState<InitiativeRevisionIntelligenceSnapshot | null>(null);
  const [draft, setDraft] = useState<InitiativeRevisionDraft | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setLoadFailed(false);

    getInitiativeRevisionWorkspace(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setSnapshot(result.intelligenceSnapshot);
          setDraft(result.draft);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  return (
    <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-ai-title">
      <h3 id="lsw-sidebar-ai-title" className="lsw-sidebar__section-title">
        {t("author.sidebar.assistantTitle")}
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="revision"
        initiativeId={initiativeId}
        stageId="revision"
        label={t("author.sidebar.askAssistant")}
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">{t("author.sidebar.assistantLoadFailed")}</p>
      ) : !snapshot ? (
        <p className="lsw-sidebar__loading">{t("author.sidebar.loading")}</p>
      ) : (
        <RevisionAiAssistantContent snapshot={snapshot} draftChanges={draft?.changes ?? []} />
      )}
    </section>
  );
}

function RevisionAiAssistantContent({
  snapshot,
  draftChanges,
}: {
  snapshot: InitiativeRevisionIntelligenceSnapshot;
  draftChanges: InitiativeRevisionDraft["changes"];
}) {
  const t = useTranslations("initiativeExperience");
  const insights = deriveRevisionAiAssistantInsights(snapshot, draftChanges);

  return (
    <div className="iip-ai-assistant">
      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.sourcesUsed")}</h4>
        <p>{insights.sourcesUsedSummary}</p>
      </div>

      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.insights.alignmentWithAnalysis")}</h4>
        <p>{insights.analysisAlignmentSummary}</p>
      </div>

      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.insights.unresolvedProposals")}</h4>
        <p>{t("author.sidebar.insights.unresolvedProposalsCount", { count: insights.unresolvedProposalCount })}</p>
      </div>

      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.insights.missingReferences")}</h4>
        {insights.missingReferenceProposalIds.length > 0 ? (
          <ul>
            {insights.missingReferenceProposalIds.map((proposalId) => (
              <li key={proposalId}>
                {t("author.sidebar.insights.missingReferenceProposal", { proposalId })}
              </li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyEveryIncludedHasChange")}</p>
        )}
      </div>

      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.insights.conflictWarnings")}</h4>
        {insights.conflictWarnings.length > 0 ? (
          <ul>
            {insights.conflictWarnings.map((warning) => (
              <li key={warning.section}>{warning.message}</li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyNoConflicts")}</p>
        )}
      </div>

      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.insights.untracedChanges")}</h4>
        {insights.untracedChanges.length > 0 ? (
          <ul>
            {insights.untracedChanges.map((change) => (
              <li key={change.changeId}>
                {t("author.sidebar.insights.untracedChangeNote", { sectionLabel: change.sectionLabel })}
              </li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyEveryChangeTraceable")}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Initiative Lifecycle — Part F, Section 3/4 (Petition Intelligence / AI
 * Assistant Sidebar). Self-fetches the Petition workspace context (the
 * Intelligence Snapshot AND the Author's current draft in a single
 * request), then derives every field via `derivePetitionAiAssistantInsights`
 * — no AI chat, no external call, and never a decision-making control
 * (Generate/Edit/Publish stay exclusively in the main Petition Editor).
 */
function PetitionAiAssistantSlot({ initiativeId }: { initiativeId: string }) {
  const t = useTranslations("initiativeExperience");
  const [snapshot, setSnapshot] = useState<InitiativePetitionIntelligenceSnapshot | null>(null);
  const [draft, setDraft] = useState<InitiativeLifecycleWorkingSidebarPetitionDraft>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setLoadFailed(false);

    getInitiativePetitionWorkspace(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setSnapshot(result.intelligenceSnapshot);
          setDraft(result.draft);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  return (
    <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-ai-title">
      <h3 id="lsw-sidebar-ai-title" className="lsw-sidebar__section-title">
        {t("author.sidebar.assistantTitle")}
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="petition"
        initiativeId={initiativeId}
        stageId="petition"
        label={t("author.sidebar.askAssistant")}
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">{t("author.sidebar.assistantLoadFailed")}</p>
      ) : !snapshot ? (
        <p className="lsw-sidebar__loading">{t("author.sidebar.loading")}</p>
      ) : (
        <PetitionAiAssistantContent snapshot={snapshot} draft={draft} />
      )}
    </section>
  );
}

type InitiativeLifecycleWorkingSidebarPetitionDraft = Parameters<
  typeof derivePetitionAiAssistantInsights
>[1];

function PetitionAiAssistantContent({
  snapshot,
  draft,
}: {
  snapshot: InitiativePetitionIntelligenceSnapshot;
  draft: InitiativeLifecycleWorkingSidebarPetitionDraft;
}) {
  const t = useTranslations("initiativeExperience");
  const insights = derivePetitionAiAssistantInsights(snapshot, draft);

  return (
    <div className="iip-ai-assistant">
      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.sourcesUsed")}</h4>
        <p>{insights.sourcesUsedSummary}</p>
      </div>

      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.insights.alignmentWithAnalysis")}</h4>
        <p>{insights.analysisAlignmentSummary}</p>
      </div>

      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.insights.clarity")}</h4>
        {insights.clarityWarnings.length > 0 ? (
          <ul>
            {insights.clarityWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyNoClarity")}</p>
        )}
      </div>

      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.insights.missingContext")}</h4>
        {insights.missingContextWarnings.length > 0 ? (
          <ul>
            {insights.missingContextWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyNoMissingContext")}</p>
        )}
      </div>

      <div className="iip-ai-assistant__group">
        <h4>{t("author.sidebar.insights.consistencyChecks")}</h4>
        {insights.consistencyWarnings.length > 0 ? (
          <ul>
            {insights.consistencyWarnings.map((check) => (
              <li key={check.checkId}>{check.detail}</li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyNoConsistency")}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Initiative Lifecycle — Part G, Section 4/12 (Decision Assistant).
 * Advisory-only derived insights — never chooses an option, votes, or publishes.
 */
function DecisionSessionAiAssistantSlot({ initiativeId }: { initiativeId: string }) {
  const t = useTranslations("initiativeExperience");
  const [snapshot, setSnapshot] = useState<InitiativeDecisionSessionIntelligenceSnapshot | null>(
    null,
  );
  const [draft, setDraft] = useState<InitiativeDecisionSessionDraft | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setLoadFailed(false);

    getInitiativeDecisionSessionWorkspace(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setSnapshot(result.intelligenceSnapshot);
          setDraft(result.draft);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  const insights =
    snapshot !== null ? deriveDecisionSessionAiAssistantInsights(snapshot, draft) : null;

  return (
    <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-ai-title">
      <h3 id="lsw-sidebar-ai-title" className="lsw-sidebar__section-title">
        {t("author.sidebar.assistantTitle")}
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="decision_session"
        initiativeId={initiativeId}
        stageId="decision_session"
        label={t("author.sidebar.askAssistant")}
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">{t("author.sidebar.assistantLoadFailed")}</p>
      ) : !insights ? (
        <p className="lsw-sidebar__loading">{t("author.sidebar.loading")}</p>
      ) : (
        <div className="iip-ai-assistant">
          <div className="iip-ai-assistant__group">
            <h4>{t("author.sidebar.sourcesUsed")}</h4>
            <p>{insights.sourcesUsedSummary}</p>
          </div>
          <div className="iip-ai-assistant__group">
            <h4>{t("author.sidebar.insights.missingDuplicatedOptions")}</h4>
            {[...insights.missingOptionsWarnings, ...insights.duplicatedOptionsWarnings].length >
            0 ? (
              <ul>
                {[...insights.missingOptionsWarnings, ...insights.duplicatedOptionsWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyNoOptionIssues")}</p>
            )}
          </div>
          <div className="iip-ai-assistant__group">
            <h4>{t("author.sidebar.insights.risksFeasibility")}</h4>
            {[...insights.riskVisibilityWarnings, ...insights.feasibilityWarnings].length > 0 ? (
              <ul>
                {[...insights.riskVisibilityWarnings, ...insights.feasibilityWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyNoRiskFeasibility")}</p>
            )}
          </div>
          <div className="iip-ai-assistant__group">
            <h4>{t("author.sidebar.insights.clarityEvidence")}</h4>
            {[...insights.clarityWarnings, ...insights.unsupportedArgumentWarnings].length > 0 ? (
              <ul>
                {[...insights.clarityWarnings, ...insights.unsupportedArgumentWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyNoClarityEvidence")}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Initiative Lifecycle — Part H, Section 4/12 (Decision Assistant).
 * Advisory-only derived insights — never chooses an action, votes, or publishes.
 */
function CollectiveDecisionAiAssistantSlot({
  initiativeId,
  lifecycleProfile,
}: {
  initiativeId: string;
  lifecycleProfile?: InitiativeLifecycleProfile | string | null;
}) {
  const t = useTranslations("initiativeExperience");
  const [snapshot, setSnapshot] = useState<InitiativeCollectiveDecisionIntelligenceSnapshot | null>(
    null,
  );
  const [draft, setDraft] = useState<InitiativeCollectiveDecisionLifecycleDraft | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setLoadFailed(false);

    getInitiativeCollectiveDecisionWorkspace(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setSnapshot(result.intelligenceSnapshot);
          setDraft(result.draft);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  const insights =
    snapshot !== null
      ? deriveCollectiveDecisionAiAssistantInsights(snapshot, draft, lifecycleProfile)
      : null;

  return (
    <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-ai-title">
      <h3 id="lsw-sidebar-ai-title" className="lsw-sidebar__section-title">
        {t("author.sidebar.assistantTitle")}
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="collective_decision"
        initiativeId={initiativeId}
        stageId="collective_decision"
        label={t("author.sidebar.askAssistant")}
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">{t("author.sidebar.assistantLoadFailed")}</p>
      ) : !insights ? (
        <p className="lsw-sidebar__loading">{t("author.sidebar.loading")}</p>
      ) : (
        <div className="iip-ai-assistant">
          <div className="iip-ai-assistant__group">
            <h4>{t("author.sidebar.sourcesUsed")}</h4>
            <p>{insights.sourcesUsedSummary}</p>
          </div>
          <div className="iip-ai-assistant__group">
            <h4>{t("author.sidebar.insights.missingDuplicatedActions")}</h4>
            {[...insights.missingActionsWarnings, ...insights.duplicatedActionsWarnings].length >
            0 ? (
              <ul>
                {[...insights.missingActionsWarnings, ...insights.duplicatedActionsWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyNoActionIssues")}</p>
            )}
          </div>
          <div className="iip-ai-assistant__group">
            <h4>{t("author.sidebar.insights.rolesTimeline")}</h4>
            {[...insights.missingRolesWarnings, ...insights.unrealisticTimelineWarnings].length >
            0 ? (
              <ul>
                {[...insights.missingRolesWarnings, ...insights.unrealisticTimelineWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyNoRoleTimeline")}</p>
            )}
          </div>
          <div className="iip-ai-assistant__group">
            <h4>{t("author.sidebar.insights.risksSuccessCriteria")}</h4>
            {[...insights.unresolvedRisksWarnings, ...insights.missingSuccessCriteriaWarnings]
              .length > 0 ? (
              <ul>
                {[
                  ...insights.unresolvedRisksWarnings,
                  ...insights.missingSuccessCriteriaWarnings,
                ].map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyNoRiskSuccess")}</p>
            )}
          </div>
          <div className="iip-ai-assistant__group">
            <h4>{t("author.sidebar.insights.claritySupport")}</h4>
            {[...insights.clarityWarnings, ...insights.unsupportedConclusionsWarnings].length >
            0 ? (
              <ul>
                {[...insights.clarityWarnings, ...insights.unsupportedConclusionsWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p className="iip-ai-assistant__empty">{t("author.sidebar.insights.emptyNoClaritySupport")}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Initiative Lifecycle — Part I, Section 4/12 (Implementation Assistant).
 * Advisory-only derived insights — never assigns a Participant, edits a
 * Candidate, or publishes.
 */
function CommitmentAiAssistantSlot({ initiativeId }: { initiativeId: string }) {
  const t = useTranslations("initiativeExperience");
  const [snapshot, setSnapshot] = useState<InitiativeImplementationCommitmentIntelligenceSnapshot | null>(
    null,
  );
  const [draft, setDraft] = useState<InitiativeImplementationCommitmentLifecycleDraft | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setLoadFailed(false);

    getInitiativeImplementationCommitmentWorkspace(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setSnapshot(result.intelligenceSnapshot);
          setDraft(result.draft);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  const insights =
    snapshot !== null ? deriveImplementationCommitmentAiAssistantInsights(snapshot, draft) : null;

  return (
    <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-ai-title">
      <h3 id="lsw-sidebar-ai-title" className="lsw-sidebar__section-title">
        {t("author.sidebar.assistantTitle")}
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="commitment"
        initiativeId={initiativeId}
        stageId="commitment"
        label={t("author.sidebar.askAssistant")}
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">{t("author.sidebar.assistantLoadFailed")}</p>
      ) : !insights ? (
        <p className="lsw-sidebar__loading">{t("author.sidebar.loading")}</p>
      ) : (
        <div className="iic-assistant-block">
          <div className="iic-assistant-block">
            <h4>{t("author.sidebar.sourcesUsed")}</h4>
            <p>{insights.sourcesUsedSummary}</p>
          </div>
          <div className="iic-assistant-block">
            <h4>{t("author.sidebar.insights.unassignedActions")}</h4>
            {insights.unassignedActionsWarnings.length > 0 ? (
              <ul>
                {insights.unassignedActionsWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyEveryCandidateAssigned")}</p>
            )}
          </div>
          <div className="iic-assistant-block">
            <h4>{t("author.sidebar.insights.roleBalanceResources")}</h4>
            {[...insights.overloadedRoleWarnings, ...insights.missingResourcesWarnings].length > 0 ? (
              <ul>
                {[...insights.overloadedRoleWarnings, ...insights.missingResourcesWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyNoRoleResource")}</p>
            )}
          </div>
          <div className="iic-assistant-block">
            <h4>{t("author.sidebar.insights.timelineRisks")}</h4>
            {[...insights.emptyTimelineWarnings, ...insights.unresolvedRisksWarnings].length > 0 ? (
              <ul>
                {[...insights.emptyTimelineWarnings, ...insights.unresolvedRisksWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyNoTimelineRisk")}</p>
            )}
          </div>
          <div className="iic-assistant-block">
            <h4>{t("author.sidebar.insights.clarity")}</h4>
            {insights.clarityWarnings.length > 0 ? (
              <ul>
                {insights.clarityWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyNoClarity")}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Initiative Lifecycle — Part J, Section 4/12 (Implementation Assistant).
 * Advisory-only derived insights — never changes a Candidate's progress,
 * status, or dates.
 */
function TrackingAiAssistantSlot({ initiativeId }: { initiativeId: string }) {
  const t = useTranslations("initiativeExperience");
  const [snapshot, setSnapshot] = useState<InitiativeImplementationTrackingIntelligenceSnapshot | null>(
    null,
  );
  const [draft, setDraft] = useState<InitiativeImplementationTrackingLifecycleDraft | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setLoadFailed(false);

    getInitiativeImplementationTrackingWorkspace(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setSnapshot(result.intelligenceSnapshot);
          setDraft(result.draft);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  const insights =
    snapshot !== null ? deriveImplementationTrackingAiAssistantInsights(snapshot, draft) : null;

  return (
    <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-ai-title">
      <h3 id="lsw-sidebar-ai-title" className="lsw-sidebar__section-title">
        {t("author.sidebar.assistantTitle")}
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="tracking"
        initiativeId={initiativeId}
        stageId="tracking"
        label={t("author.sidebar.askAssistant")}
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">{t("author.sidebar.assistantLoadFailed")}</p>
      ) : !insights ? (
        <p className="lsw-sidebar__loading">{t("author.sidebar.loading")}</p>
      ) : (
        <div className="iit-assistant-block">
          <div className="iit-assistant-block">
            <h4>{t("author.sidebar.sourcesUsed")}</h4>
            <p>{insights.sourcesUsedSummary}</p>
          </div>
          <div className="iit-assistant-block">
            <h4>{t("author.sidebar.insights.overdueBlocked")}</h4>
            {[...insights.overdueWarnings, ...insights.blockedWarnings].length > 0 ? (
              <ul>
                {[...insights.overdueWarnings, ...insights.blockedWarnings].map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyNoOverdueBlocked")}</p>
            )}
          </div>
          <div className="iit-assistant-block">
            <h4>{t("author.sidebar.insights.missingEvidenceStalled")}</h4>
            {[...insights.missingEvidenceWarnings, ...insights.stalledWarnings].length > 0 ? (
              <ul>
                {[...insights.missingEvidenceWarnings, ...insights.stalledWarnings].map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyNoMissingEvidenceStalled")}</p>
            )}
          </div>
          <div className="iit-assistant-block">
            <h4>{t("author.sidebar.insights.timelineConflicts")}</h4>
            {insights.timelineConflictWarnings.length > 0 ? (
              <ul>
                {insights.timelineConflictWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyNoTimelineConflicts")}</p>
            )}
          </div>
          <div className="iit-assistant-block">
            <h4>{t("author.sidebar.insights.clarity")}</h4>
            {insights.clarityWarnings.length > 0 ? (
              <ul>
                {insights.clarityWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyNoClarity")}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Initiative Lifecycle — Part K, Section 9/11 (Response Assistant).
 * Advisory-only derived insights — never invents an institution/
 * organization name or a response the Author has not entered, and never
 * itself edits a Candidate or publishes.
 */
function OfficialResponseAiAssistantSlot({ initiativeId }: { initiativeId: string }) {
  const t = useTranslations("initiativeExperience");
  const [snapshot, setSnapshot] = useState<InitiativeOfficialResponseIntelligenceSnapshot | null>(null);
  const [draft, setDraft] = useState<InitiativeOfficialResponseLifecycleDraft | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setLoadFailed(false);

    getInitiativeOfficialResponseWorkspace(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setSnapshot(result.intelligenceSnapshot);
          setDraft(result.draft);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  const insights = snapshot !== null ? deriveOfficialResponseAiAssistantInsights(snapshot, draft) : null;

  return (
    <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-ai-title">
      <h3 id="lsw-sidebar-ai-title" className="lsw-sidebar__section-title">
        {t("author.sidebar.assistantTitle")}
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="official_response"
        initiativeId={initiativeId}
        stageId="official_response"
        label={t("author.sidebar.askAssistant")}
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">{t("author.sidebar.assistantLoadFailed")}</p>
      ) : !insights ? (
        <p className="lsw-sidebar__loading">{t("author.sidebar.loading")}</p>
      ) : (
        <div className="ior-assistant-block">
          <div className="ior-assistant-block">
            <h4>{t("author.sidebar.sourcesUsed")}</h4>
            <p>{insights.sourcesUsedSummary}</p>
          </div>
          <div className="ior-assistant-block">
            <h4>{t("author.sidebar.insights.incompleteDuplicateCandidates")}</h4>
            {[...insights.incompleteCandidateWarnings, ...insights.duplicateCandidateWarnings].length >
            0 ? (
              <ul>
                {[...insights.incompleteCandidateWarnings, ...insights.duplicateCandidateWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyNoIncompleteDuplicateCandidates")}</p>
            )}
          </div>
          <div className="ior-assistant-block">
            <h4>{t("author.sidebar.insights.missingInstitutionsReferences")}</h4>
            {[...insights.missingInstitutionWarnings, ...insights.missingReferenceWarnings].length > 0 ? (
              <ul>
                {[...insights.missingInstitutionWarnings, ...insights.missingReferenceWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyEveryCandidateCitesSource")}</p>
            )}
          </div>
          <div className="ior-assistant-block">
            <h4>{t("author.sidebar.insights.unsupportedSummariesDates")}</h4>
            {[...insights.unsupportedSummaryWarnings, ...insights.inconsistentDateWarnings].length > 0 ? (
              <ul>
                {[...insights.unsupportedSummaryWarnings, ...insights.inconsistentDateWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyNoUnsupportedSummariesDates")}</p>
            )}
          </div>
          <div className="ior-assistant-block">
            <h4>{t("author.sidebar.insights.clarity")}</h4>
            {insights.clarityWarnings.length > 0 ? (
              <ul>
                {insights.clarityWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyNoClarity")}</p>
            )}
          </div>
          <div className="ior-assistant-block">
            <h4>{t("author.sidebar.insights.advisoryCannotPublish")}</h4>
            <ul>
              {insights.advisoryNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Initiative Lifecycle — Part L, Section 9/11 (Impact Assistant).
 * Advisory-only derived insights — never invents achievements or judges
 * success/failure, and never itself edits a section or publishes.
 */
function PublicImpactAiAssistantSlot({ initiativeId }: { initiativeId: string }) {
  const t = useTranslations("initiativeExperience");
  const [snapshot, setSnapshot] = useState<InitiativePublicImpactIntelligenceSnapshot | null>(null);
  const [draft, setDraft] = useState<InitiativePublicImpactLifecycleDraft | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setLoadFailed(false);

    getInitiativePublicImpactWorkspace(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setSnapshot(result.intelligenceSnapshot);
          setDraft(result.draft);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  const insights = snapshot !== null ? derivePublicImpactAiAssistantInsights(snapshot, draft) : null;

  return (
    <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-ai-title">
      <h3 id="lsw-sidebar-ai-title" className="lsw-sidebar__section-title">
        {t("author.sidebar.assistantTitle")}
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="public_impact"
        initiativeId={initiativeId}
        stageId="public_impact"
        label={t("author.sidebar.askAssistant")}
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">{t("author.sidebar.assistantLoadFailed")}</p>
      ) : !insights ? (
        <p className="lsw-sidebar__loading">{t("author.sidebar.loading")}</p>
      ) : (
        <div className="ipi-assistant-block">
          <div className="ipi-assistant-block">
            <h4>{t("author.sidebar.sourcesUsed")}</h4>
            <p>{insights.sourcesUsedSummary}</p>
          </div>
          <div className="ipi-assistant-block">
            <h4>{t("author.sidebar.insights.missingEvidenceUnsupportedConclusions")}</h4>
            {[...insights.missingEvidenceWarnings, ...insights.unsupportedConclusionWarnings].length >
            0 ? (
              <ul>
                {[...insights.missingEvidenceWarnings, ...insights.unsupportedConclusionWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyNoMissingEvidenceConclusions")}</p>
            )}
          </div>
          <div className="ipi-assistant-block">
            <h4>{t("author.sidebar.insights.inconsistentStatsDuplicatedClaims")}</h4>
            {[...insights.inconsistentStatsWarnings, ...insights.duplicatedClaimWarnings].length > 0 ? (
              <ul>
                {[...insights.inconsistentStatsWarnings, ...insights.duplicatedClaimWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyNoInconsistentStats")}</p>
            )}
          </div>
          <div className="ipi-assistant-block">
            <h4>{t("author.sidebar.insights.missingInstitutionsOutcomes")}</h4>
            {insights.missingInstitutionOutcomeWarnings.length > 0 ? (
              <ul>
                {insights.missingInstitutionOutcomeWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyInstitutionsOutcomesReady")}</p>
            )}
          </div>
          <div className="ipi-assistant-block">
            <h4>{t("author.sidebar.insights.clarityNeutrality")}</h4>
            {insights.clarityWarnings.length > 0 ? (
              <ul>
                {insights.clarityWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyNoClarityNeutrality")}</p>
            )}
          </div>
          <div className="ipi-assistant-block">
            <h4>{t("author.sidebar.insights.advisoryCannotPublish")}</h4>
            <ul>
              {insights.advisoryNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Initiative Lifecycle — Part M, Section 4 (Archive Assistant).
 * Advisory-only — never praise/blame/success-wash, never edits or publishes.
 */
function CivicArchiveAiAssistantSlot({
  initiativeId,
  lifecycleProfile,
}: {
  initiativeId: string;
  lifecycleProfile?: InitiativeLifecycleProfile | string | null;
}) {
  const t = useTranslations("initiativeExperience");
  const [snapshot, setSnapshot] = useState<InitiativeCivicArchiveIntelligenceSnapshot | null>(null);
  const [draft, setDraft] = useState<InitiativeCivicArchiveLifecycleDraft | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setLoadFailed(false);

    getInitiativeCivicArchiveWorkspace(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setSnapshot(result.intelligenceSnapshot);
          setDraft(result.draft);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  const insights =
    snapshot !== null
      ? deriveCivicArchiveAiAssistantInsights(snapshot, draft, lifecycleProfile)
      : null;

  return (
    <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-ai-title">
      <h3 id="lsw-sidebar-ai-title" className="lsw-sidebar__section-title">
        {t("author.sidebar.assistantTitle")}
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="archive"
        initiativeId={initiativeId}
        stageId="archive"
        label={t("author.sidebar.askAssistant")}
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">{t("author.sidebar.assistantLoadFailed")}</p>
      ) : !insights ? (
        <p className="lsw-sidebar__loading">{t("author.sidebar.loading")}</p>
      ) : (
        <div className="ica-assistant-block">
          <div className="ica-assistant-block">
            <h4>{t("author.sidebar.sourcesUsed")}</h4>
            <p>{insights.sourcesUsedSummary}</p>
          </div>
          <div className="ica-assistant-block">
            <h4>{t("author.sidebar.insights.completenessFinalFields")}</h4>
            {[...insights.completenessWarnings, ...insights.missingFinalFieldWarnings].length > 0 ? (
              <ul>
                {[...insights.completenessWarnings, ...insights.missingFinalFieldWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyFieldsLookReady")}</p>
            )}
          </div>
          <div className="ica-assistant-block">
            <h4>{t("author.sidebar.insights.outstandingWork")}</h4>
            {insights.outstandingWorkWarnings.length > 0 ? (
              <ul>
                {insights.outstandingWorkWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyNoOutstandingWork")}</p>
            )}
          </div>
          <div className="ica-assistant-block">
            <h4>{t("author.sidebar.insights.neutralityClarity")}</h4>
            {[...insights.neutralityWarnings, ...insights.clarityWarnings].length > 0 ? (
              <ul>
                {[...insights.neutralityWarnings, ...insights.clarityWarnings].map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>{t("author.sidebar.insights.emptyNoNeutralityClarity")}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export function InitiativeLifecycleWorkingSidebar({
  initiativeId,
  stageId,
  onOpenPublicPreview,
  onNavigateNextStage,
  lifecycleProfile,
  ballotMode: _ballotMode = null,
  supportStatistics,
  onSupportSignalChange,
  onSupportBookmarkToggle,
  supportBusy = false,
}: InitiativeLifecycleWorkingSidebarProps) {
  const t = useTranslations("initiativeExperience");
  const [projection, setProjection] = useState<InitiativeLifecycleStageProjection | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProjection(null);
    setLoadFailed(false);

    getInitiativeLifecycleStageProjection(initiativeId, stageId)
      .then((result) => {
        if (!cancelled) {
          setProjection(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId, stageId]);

  const isAnalysisStage = stageId === "analysis";
  const isProposalStage = stageId === "proposal";
  const isRevisionStage = stageId === "revision";
  const isPetitionStage = stageId === "petition";
  const isDecisionSessionStage = stageId === "decision_session";
  const isCollectiveDecisionStage = stageId === "collective_decision";
  const isCommitmentStage = stageId === "commitment";
  const isTrackingStage = stageId === "tracking";
  const isOfficialResponseStage = stageId === "official_response";
  const isPublicImpactStage = stageId === "public_impact";
  const isArchiveStage = stageId === "archive";
  const isDraftCapableStage =
    isAnalysisStage ||
    isProposalStage ||
    isRevisionStage ||
    isPetitionStage ||
    isDecisionSessionStage ||
    isCollectiveDecisionStage ||
    isCommitmentStage ||
    isTrackingStage ||
    isOfficialResponseStage ||
    isPublicImpactStage ||
    isArchiveStage;


  function resolveDraftCompletenessCopy(): string {
    if (loadFailed) {
      return t("author.sidebar.draftStatusLoadFailed");
    }
    if (!projection) {
      return t("author.sidebar.loading");
    }
    if (projection.metadata.hasUnpublishedChanges) {
      return projection.metadata.draftUpdatedAt
        ? t("author.sidebar.completeness.draftInProgressSaveHint")
        : t("author.sidebar.completeness.draftInProgress");
    }

    const completenessStageId = (
      [
        "analysis",
        "proposal",
        "revision",
        "petition",
        "decision_session",
        "collective_decision",
        "commitment",
        "tracking",
        "official_response",
        "public_impact",
        "archive",
      ] as const
    ).includes(stageId as never)
      ? (stageId as
          | "analysis"
          | "proposal"
          | "revision"
          | "petition"
          | "decision_session"
          | "collective_decision"
          | "commitment"
          | "tracking"
          | "official_response"
          | "public_impact"
          | "archive")
      : "analysis";

    if (projection.metadata.publishedAt) {
      return t(`author.sidebar.completeness.published.${completenessStageId}`);
    }
    return t(`author.sidebar.completeness.empty.${completenessStageId}`);
  }

  return (
    <div className="lsw-sidebar" aria-label={t("author.sidebar.aria")}>
      {supportStatistics &&
      onSupportSignalChange &&
      onSupportBookmarkToggle &&
      resolveInitiativeLifecycleProfile(lifecycleProfile) !== "PUBLIC_CHOICE" ? (
        <PublicInitiativeSupportStatistics
          statistics={supportStatistics}
          onSignalChange={onSupportSignalChange}
          onBookmarkToggle={onSupportBookmarkToggle}
          busy={supportBusy}
        />
      ) : null}
      <PublicChoiceElectionSidebarWidget
        initiativeId={initiativeId}
        lifecycleProfile={lifecycleProfile}
      />
      {isAnalysisStage ? (
        <AnalysisAiAssistantSlot initiativeId={initiativeId} />
      ) : isProposalStage ? (
        <ProposalAiAssistantSlot initiativeId={initiativeId} />
      ) : isRevisionStage ? (
        <RevisionAiAssistantSlot initiativeId={initiativeId} />
      ) : isPetitionStage ? (
        <PetitionAiAssistantSlot initiativeId={initiativeId} />
      ) : isDecisionSessionStage ? (
        <DecisionSessionAiAssistantSlot initiativeId={initiativeId} />
      ) : isCollectiveDecisionStage ? (
        <CollectiveDecisionAiAssistantSlot
          initiativeId={initiativeId}
          lifecycleProfile={lifecycleProfile}
        />
      ) : isCommitmentStage ? (
        <CommitmentAiAssistantSlot initiativeId={initiativeId} />
      ) : isTrackingStage ? (
        <TrackingAiAssistantSlot initiativeId={initiativeId} />
      ) : isOfficialResponseStage ? (
        <OfficialResponseAiAssistantSlot initiativeId={initiativeId} />
      ) : isPublicImpactStage ? (
        <PublicImpactAiAssistantSlot initiativeId={initiativeId} />
      ) : isArchiveStage ? (
        <CivicArchiveAiAssistantSlot
          initiativeId={initiativeId}
          lifecycleProfile={lifecycleProfile}
        />
      ) : (
        <AiAssistantSlot
          initiativeId={initiativeId}
          surfaceId="initiative"
          stageId="initiative"
        />
      )}

      <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-status-title">
        <h3 id="lsw-sidebar-status-title" className="lsw-sidebar__section-title">
          {t("author.sidebar.stageStatus")}
        </h3>
        {loadFailed ? (
          <p className="lsw-sidebar__error">{t("author.sidebar.stageStatusLoadFailed")}</p>
        ) : projection ? (
          <WorkspaceStatusBadge
            status={projection.metadata.presentationStatus}
            label={resolvePresentationStatusDisplayLabel(projection.metadata.presentationStatus, t)}
          />
        ) : (
          <p className="lsw-sidebar__loading">{t("author.sidebar.loading")}</p>
        )}
      </section>

      {!isDraftCapableStage ? (
        <>
          <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-sources-title">
            <h3 id="lsw-sidebar-sources-title" className="lsw-sidebar__section-title">
              {t("author.sidebar.sourcesUsed")}
            </h3>
            <p className="lsw-sidebar__placeholder">
              {projection?.sourceSnapshot.isEmpty ?? true
                ? t("author.sidebar.sourcesNone")
                : t("author.sidebar.sourcesCollectedCount", {
                    count: projection?.sourceSnapshot.items.length ?? 0,
                  })}
            </p>
          </section>

          <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-questions-title">
            <h3 id="lsw-sidebar-questions-title" className="lsw-sidebar__section-title">
              {t("author.sidebar.unresolvedQuestions")}
            </h3>
            <p className="lsw-sidebar__placeholder">{t("author.sidebar.noneIdentified")}</p>
          </section>

          <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-completeness-title">
            <h3 id="lsw-sidebar-completeness-title" className="lsw-sidebar__section-title">
              {t("author.sidebar.draftCompleteness")}
            </h3>
            <p className="lsw-sidebar__placeholder">{t("author.sidebar.notStarted")}</p>
          </section>

          <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-primary-action-title">
            <h3 id="lsw-sidebar-primary-action-title" className="lsw-sidebar__section-title">
              {t("author.sidebar.primaryAction")}
            </h3>
            <WorkspaceDeferredActions
              title={t("author.sidebar.draftingComingSoonTitle")}
              note={t("author.sidebar.draftingComingSoonNote")}
              actions={[t("author.sidebar.generateDraft")]}
              tooltip={t("author.sidebar.draftingComingSoonTooltip")}
              authorWorkflow
            />
          </section>
        </>
      ) : (
        <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-completeness-title">
          <h3 id="lsw-sidebar-completeness-title" className="lsw-sidebar__section-title">
            {t("author.sidebar.draftCompleteness")}
          </h3>
          <p className="lsw-sidebar__placeholder">{resolveDraftCompletenessCopy()}</p>
        </section>
      )}

      {isCommitmentStage ? (
        <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-proposal-inbox-title">
          <h3 id="lsw-sidebar-proposal-inbox-title" className="lsw-sidebar__section-title">
            {t("author.sidebar.myProposedCommitments")}
          </h3>
          <InitiativeImplementationCommitmentProposalInbox initiativeId={initiativeId} />
        </section>
      ) : null}

      {isTrackingStage ? (
        <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-progress-inbox-title">
          <h3 id="lsw-sidebar-progress-inbox-title" className="lsw-sidebar__section-title">
            {t("author.sidebar.myImplementationTracking")}
          </h3>
          <InitiativeImplementationTrackingProgressInbox initiativeId={initiativeId} />
        </section>
      ) : null}

      <section
        className="lsw-sidebar__section lsw-sidebar__actions"
        aria-label={t("author.sidebar.actionsAria")}
      >
        <WorkspaceButton variant="secondary" onClick={onOpenPublicPreview}>
          {t("author.sidebar.publicPreview")}
        </WorkspaceButton>
        {projection?.nextStage ? (
          <WorkspaceButton
            variant="primary"
            disabled={
              projection.stageId !== "initiative" &&
              !projection.metadata.canViewPublicResult &&
              projection.metadata.presentationStatus !== "published"
            }
            onClick={() =>
              onNavigateNextStage(projection.nextStage!.stageId, projection.nextStage!.hash)
            }
          >
            {isPublicImpactStage && projection.nextStage.stageId === "archive"
              ? t("author.sidebar.openCivicArchive")
              : t("author.sidebar.nextStage", {
                  stage: resolveLifecycleStageDisplayLabel(
                    projection.nextStage.stageId,
                    t,
                    projection.nextStage.label,
                  ),
                })}
          </WorkspaceButton>
        ) : null}
      </section>

      <InitiativeActiveAlliesWidget initiativeId={initiativeId} />
    </div>
  );
}
