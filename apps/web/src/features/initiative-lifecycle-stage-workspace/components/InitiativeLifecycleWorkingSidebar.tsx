"use client";

import { useEffect, useState, type ComponentProps } from "react";

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

import { InitiativeActiveAlliesWidget } from "../../initiative-active-allies/components/InitiativeActiveAlliesWidget";
import { PublicInitiativeSupportStatistics } from "../../public-initiative-experience/components/PublicInitiativeSupportStatistics";
import { PublicChoiceElectionSidebarWidget } from "../../public-initiative-experience/components/PublicChoiceElectionSidebarWidget";
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
  /**
   * Public Choice Experience Pack 01 — restore Initiative Support as the
   * first right-sidebar widget even while the Author working tools replace
   * the public sidebar composition.
   */
  readonly supportStatistics?: ComponentProps<typeof PublicInitiativeSupportStatistics>["statistics"];
  readonly onSupportSignalChange?: ComponentProps<
    typeof PublicInitiativeSupportStatistics
  >["onSignalChange"];
  readonly onSupportBookmarkToggle?: () => void;
  readonly supportBusy?: boolean;
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
    <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-ai-title">
      <h3 id="lsw-sidebar-ai-title" className="lsw-sidebar__section-title">
        Humanity Union Assistant
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId={surfaceId}
        initiativeId={initiativeId}
        stageId={stageId}
        label="Ask Assistant"
        className="lifecycle-ai-modal__open-button"
      />
      <p className="lsw-sidebar__placeholder">
        Ask about this stage or Humanity Union. Suggestions are advisory only.
      </p>
    </section>
  );
}

/**
 * Initiative Lifecycle — Part B, Section 6 (AI Assistant Sidebar).
 * Self-fetches the full Source Snapshot and derives every field from it
 * via `deriveAiAssistantInsights` — no AI chat, no external call.
 */
function AnalysisAiAssistantSlot({ initiativeId }: { initiativeId: string }) {
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
        Humanity Union Assistant
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="analysis"
        initiativeId={initiativeId}
        stageId="analysis"
        label="Ask Assistant"
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">Could not load Assistant data.</p>
      ) : !snapshot ? (
        <p className="lsw-sidebar__loading">Loading…</p>
      ) : (
        <AnalysisAiAssistantContent snapshot={snapshot} />
      )}
    </section>
  );
}

function AnalysisAiAssistantContent({ snapshot }: { snapshot: InitiativeAnalysisSourceSnapshot }) {
  const insights = deriveAiAssistantInsights(snapshot);

  return (
    <div className="ica-ai-assistant">
      <div className="ica-ai-assistant__group">
        <h4>Sources Used</h4>
        <p>{insights.sourcesUsedSummary}</p>
      </div>

      <div className="ica-ai-assistant__group">
        <h4>Missing Evidence</h4>
        {insights.missingEvidence.length > 0 ? (
          <ul>
            {insights.missingEvidence.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="ica-ai-assistant__empty">No evidence gaps identified.</p>
        )}
      </div>

      <div className="ica-ai-assistant__group">
        <h4>Repeated Arguments</h4>
        {insights.repeatedArguments.length > 0 ? (
          <ul>
            {insights.repeatedArguments.map((item) => (
              <li key={item.commentId}>
                &ldquo;{item.excerpt}&rdquo; ({item.helpfulCount} Helpful)
              </li>
            ))}
          </ul>
        ) : (
          <p className="ica-ai-assistant__empty">None identified yet.</p>
        )}
      </div>

      <div className="ica-ai-assistant__group">
        <h4>Possible Contradictions</h4>
        {insights.possibleContradictions.length > 0 ? (
          <ul>
            {insights.possibleContradictions.map((item) => (
              <li key={item.topic}>&ldquo;{item.topic}&rdquo; — supported and disputed in different comments</li>
            ))}
          </ul>
        ) : (
          <p className="ica-ai-assistant__empty">None identified yet.</p>
        )}
      </div>

      <div className="ica-ai-assistant__group">
        <h4>Unanswered Questions</h4>
        {insights.unansweredQuestions.length > 0 ? (
          <ul>
            {insights.unansweredQuestions.map((item) => (
              <li key={item.commentId}>&ldquo;{item.excerpt}&rdquo;</li>
            ))}
          </ul>
        ) : (
          <p className="ica-ai-assistant__empty">None identified yet.</p>
        )}
      </div>

      <div className="ica-ai-assistant__group">
        <h4>Proposal Coverage</h4>
        <p>
          {insights.proposalCoverage.proposalCount} of {insights.proposalCoverage.commentCount} comments (
          {insights.proposalCoverage.percentage}%) are proposal-marked.
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
        Humanity Union Assistant
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="proposal"
        initiativeId={initiativeId}
        stageId="proposal"
        label="Ask Assistant"
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">Could not load Assistant data.</p>
      ) : !snapshot ? (
        <p className="lsw-sidebar__loading">Loading…</p>
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
  const insights = deriveProposalAiAssistantInsights(snapshot, draftProposals);

  return (
    <div className="iip-ai-assistant">
      <div className="iip-ai-assistant__group">
        <h4>Sources Used</h4>
        <p>{insights.sourcesUsedSummary}</p>
      </div>

      <div className="iip-ai-assistant__group">
        <h4>Possible Duplicates to Merge</h4>
        {insights.duplicateGroups.length > 0 ? (
          <ul>
            {insights.duplicateGroups.map((group) => (
              <li key={group.groupId}>
                &ldquo;{group.representativeExcerpt}&rdquo; ({group.memberCount} similar mentions)
              </li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">No likely duplicates identified.</p>
        )}
      </div>

      <div className="iip-ai-assistant__group">
        <h4>Ungrouped Candidates</h4>
        {insights.ungroupedCandidateGroups.length > 0 ? (
          <ul>
            {insights.ungroupedCandidateGroups.map((group) => (
              <li key={group.groupId}>&ldquo;{group.representativeExcerpt}&rdquo; — not yet drafted</li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">Every detected group has a draft proposal.</p>
        )}
      </div>

      <div className="iip-ai-assistant__group">
        <h4>Incomplete Proposals</h4>
        {insights.incompleteProposals.length > 0 ? (
          <ul>
            {insights.incompleteProposals.map(({ proposal, missingFields }) => (
              <li key={proposal.proposalId}>
                &ldquo;{proposal.title || "Untitled Proposal"}&rdquo; — missing {missingFields.join(", ")}
              </li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">No incomplete proposals identified.</p>
        )}
      </div>

      <div className="iip-ai-assistant__group">
        <h4>Open Proposal Questions</h4>
        <p>{insights.openProposalQuestionCount} unresolved question(s) in Discussion.</p>
      </div>

      <div className="iip-ai-assistant__group">
        <h4>Suggested Treatment (advisory)</h4>
        {insights.suggestedTreatments.length > 0 ? (
          <ul>
            {insights.suggestedTreatments.map((entry) => (
              <li key={entry.proposalId}>
                &ldquo;{entry.title || "Untitled"}&rdquo; — {entry.suggestion.replace(/_/g, " ")}:{" "}
                {entry.rationale}
              </li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">No undecided proposals to review.</p>
        )}
        <p className="iip-ai-assistant__empty">
          Assistant never publishes automatically. Author confirms Accept / Partial / Decline and
          commits the Initiative version.
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
        Humanity Union Assistant
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="revision"
        initiativeId={initiativeId}
        stageId="revision"
        label="Ask Assistant"
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">Could not load Assistant data.</p>
      ) : !snapshot ? (
        <p className="lsw-sidebar__loading">Loading…</p>
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
  const insights = deriveRevisionAiAssistantInsights(snapshot, draftChanges);

  return (
    <div className="iip-ai-assistant">
      <div className="iip-ai-assistant__group">
        <h4>Sources Used</h4>
        <p>{insights.sourcesUsedSummary}</p>
      </div>

      <div className="iip-ai-assistant__group">
        <h4>Alignment with Analysis</h4>
        <p>{insights.analysisAlignmentSummary}</p>
      </div>

      <div className="iip-ai-assistant__group">
        <h4>Unresolved Proposals</h4>
        <p>{insights.unresolvedProposalCount} proposal(s) not yet included or explicitly skipped.</p>
      </div>

      <div className="iip-ai-assistant__group">
        <h4>Missing References</h4>
        {insights.missingReferenceProposalIds.length > 0 ? (
          <ul>
            {insights.missingReferenceProposalIds.map((proposalId) => (
              <li key={proposalId}>
                Proposal {proposalId} marked &ldquo;Included in Revision&rdquo; has no change yet.
              </li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">Every included Proposal has a backing change.</p>
        )}
      </div>

      <div className="iip-ai-assistant__group">
        <h4>Conflict Warnings</h4>
        {insights.conflictWarnings.length > 0 ? (
          <ul>
            {insights.conflictWarnings.map((warning) => (
              <li key={warning.section}>{warning.message}</li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">No conflicting changes detected.</p>
        )}
      </div>

      <div className="iip-ai-assistant__group">
        <h4>Untraced Changes</h4>
        {insights.untracedChanges.length > 0 ? (
          <ul>
            {insights.untracedChanges.map((change) => (
              <li key={change.changeId}>
                &ldquo;{change.sectionLabel}&rdquo; is missing a Proposal reference or Author-originated
                reason.
              </li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">Every drafted change is fully traceable.</p>
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
        Humanity Union Assistant
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="petition"
        initiativeId={initiativeId}
        stageId="petition"
        label="Ask Assistant"
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">Could not load Assistant data.</p>
      ) : !snapshot ? (
        <p className="lsw-sidebar__loading">Loading…</p>
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
  const insights = derivePetitionAiAssistantInsights(snapshot, draft);

  return (
    <div className="iip-ai-assistant">
      <div className="iip-ai-assistant__group">
        <h4>Sources Used</h4>
        <p>{insights.sourcesUsedSummary}</p>
      </div>

      <div className="iip-ai-assistant__group">
        <h4>Alignment with Analysis</h4>
        <p>{insights.analysisAlignmentSummary}</p>
      </div>

      <div className="iip-ai-assistant__group">
        <h4>Clarity</h4>
        {insights.clarityWarnings.length > 0 ? (
          <ul>
            {insights.clarityWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">No clarity issues identified.</p>
        )}
      </div>

      <div className="iip-ai-assistant__group">
        <h4>Missing Context</h4>
        {insights.missingContextWarnings.length > 0 ? (
          <ul>
            {insights.missingContextWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">No missing context identified.</p>
        )}
      </div>

      <div className="iip-ai-assistant__group">
        <h4>Consistency Checks</h4>
        {insights.consistencyWarnings.length > 0 ? (
          <ul>
            {insights.consistencyWarnings.map((check) => (
              <li key={check.checkId}>{check.detail}</li>
            ))}
          </ul>
        ) : (
          <p className="iip-ai-assistant__empty">No consistency warnings identified.</p>
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
        Humanity Union Assistant
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="decision_session"
        initiativeId={initiativeId}
        stageId="decision_session"
        label="Ask Assistant"
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">Could not load Assistant data.</p>
      ) : !insights ? (
        <p className="lsw-sidebar__loading">Loading…</p>
      ) : (
        <div className="iip-ai-assistant">
          <div className="iip-ai-assistant__group">
            <h4>Sources Used</h4>
            <p>{insights.sourcesUsedSummary}</p>
          </div>
          <div className="iip-ai-assistant__group">
            <h4>Missing / Duplicated Options</h4>
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
              <p className="iip-ai-assistant__empty">No option issues identified.</p>
            )}
          </div>
          <div className="iip-ai-assistant__group">
            <h4>Risks & Feasibility</h4>
            {[...insights.riskVisibilityWarnings, ...insights.feasibilityWarnings].length > 0 ? (
              <ul>
                {[...insights.riskVisibilityWarnings, ...insights.feasibilityWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p className="iip-ai-assistant__empty">No risk or feasibility gaps identified.</p>
            )}
          </div>
          <div className="iip-ai-assistant__group">
            <h4>Clarity & Evidence</h4>
            {[...insights.clarityWarnings, ...insights.unsupportedArgumentWarnings].length > 0 ? (
              <ul>
                {[...insights.clarityWarnings, ...insights.unsupportedArgumentWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p className="iip-ai-assistant__empty">No clarity or evidence issues identified.</p>
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
        Humanity Union Assistant
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="collective_decision"
        initiativeId={initiativeId}
        stageId="collective_decision"
        label="Ask Assistant"
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">Could not load Assistant data.</p>
      ) : !insights ? (
        <p className="lsw-sidebar__loading">Loading…</p>
      ) : (
        <div className="iip-ai-assistant">
          <div className="iip-ai-assistant__group">
            <h4>Sources Used</h4>
            <p>{insights.sourcesUsedSummary}</p>
          </div>
          <div className="iip-ai-assistant__group">
            <h4>Missing / Duplicated Actions</h4>
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
              <p className="iip-ai-assistant__empty">No action issues identified.</p>
            )}
          </div>
          <div className="iip-ai-assistant__group">
            <h4>Roles & Timeline</h4>
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
              <p className="iip-ai-assistant__empty">No role or timeline gaps identified.</p>
            )}
          </div>
          <div className="iip-ai-assistant__group">
            <h4>Risks & Success Criteria</h4>
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
              <p className="iip-ai-assistant__empty">No risk or success-criteria gaps identified.</p>
            )}
          </div>
          <div className="iip-ai-assistant__group">
            <h4>Clarity & Support</h4>
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
              <p className="iip-ai-assistant__empty">No clarity or support issues identified.</p>
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
        Humanity Union Assistant
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="commitment"
        initiativeId={initiativeId}
        stageId="commitment"
        label="Ask Assistant"
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">Could not load Assistant data.</p>
      ) : !insights ? (
        <p className="lsw-sidebar__loading">Loading…</p>
      ) : (
        <div className="iic-assistant-block">
          <div className="iic-assistant-block">
            <h4>Sources Used</h4>
            <p>{insights.sourcesUsedSummary}</p>
          </div>
          <div className="iic-assistant-block">
            <h4>Unassigned Actions</h4>
            {insights.unassignedActionsWarnings.length > 0 ? (
              <ul>
                {insights.unassignedActionsWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>Every Candidate has a proposed Participant.</p>
            )}
          </div>
          <div className="iic-assistant-block">
            <h4>Role Balance & Resources</h4>
            {[...insights.overloadedRoleWarnings, ...insights.missingResourcesWarnings].length > 0 ? (
              <ul>
                {[...insights.overloadedRoleWarnings, ...insights.missingResourcesWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p>No role or resource gaps identified.</p>
            )}
          </div>
          <div className="iic-assistant-block">
            <h4>Timeline & Risks</h4>
            {[...insights.emptyTimelineWarnings, ...insights.unresolvedRisksWarnings].length > 0 ? (
              <ul>
                {[...insights.emptyTimelineWarnings, ...insights.unresolvedRisksWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p>No timeline or risk gaps identified.</p>
            )}
          </div>
          <div className="iic-assistant-block">
            <h4>Clarity</h4>
            {insights.clarityWarnings.length > 0 ? (
              <ul>
                {insights.clarityWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>No clarity issues identified.</p>
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
        Humanity Union Assistant
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="tracking"
        initiativeId={initiativeId}
        stageId="tracking"
        label="Ask Assistant"
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">Could not load Assistant data.</p>
      ) : !insights ? (
        <p className="lsw-sidebar__loading">Loading…</p>
      ) : (
        <div className="iit-assistant-block">
          <div className="iit-assistant-block">
            <h4>Sources Used</h4>
            <p>{insights.sourcesUsedSummary}</p>
          </div>
          <div className="iit-assistant-block">
            <h4>Overdue & Blocked</h4>
            {[...insights.overdueWarnings, ...insights.blockedWarnings].length > 0 ? (
              <ul>
                {[...insights.overdueWarnings, ...insights.blockedWarnings].map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>No overdue or blocked Candidates identified.</p>
            )}
          </div>
          <div className="iit-assistant-block">
            <h4>Missing Evidence & Stalled</h4>
            {[...insights.missingEvidenceWarnings, ...insights.stalledWarnings].length > 0 ? (
              <ul>
                {[...insights.missingEvidenceWarnings, ...insights.stalledWarnings].map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>No missing evidence or stalled Candidates identified.</p>
            )}
          </div>
          <div className="iit-assistant-block">
            <h4>Timeline Conflicts</h4>
            {insights.timelineConflictWarnings.length > 0 ? (
              <ul>
                {insights.timelineConflictWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>No timeline conflicts identified.</p>
            )}
          </div>
          <div className="iit-assistant-block">
            <h4>Clarity</h4>
            {insights.clarityWarnings.length > 0 ? (
              <ul>
                {insights.clarityWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>No clarity issues identified.</p>
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
        Humanity Union Assistant
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="official_response"
        initiativeId={initiativeId}
        stageId="official_response"
        label="Ask Assistant"
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">Could not load Assistant data.</p>
      ) : !insights ? (
        <p className="lsw-sidebar__loading">Loading…</p>
      ) : (
        <div className="ior-assistant-block">
          <div className="ior-assistant-block">
            <h4>Sources Used</h4>
            <p>{insights.sourcesUsedSummary}</p>
          </div>
          <div className="ior-assistant-block">
            <h4>Incomplete & Duplicate Candidates</h4>
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
              <p>No incomplete or duplicate Candidates identified.</p>
            )}
          </div>
          <div className="ior-assistant-block">
            <h4>Missing Institutions & References</h4>
            {[...insights.missingInstitutionWarnings, ...insights.missingReferenceWarnings].length > 0 ? (
              <ul>
                {[...insights.missingInstitutionWarnings, ...insights.missingReferenceWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p>Every Candidate names an institution or organization and cites a source.</p>
            )}
          </div>
          <div className="ior-assistant-block">
            <h4>Unsupported Summaries & Dates</h4>
            {[...insights.unsupportedSummaryWarnings, ...insights.inconsistentDateWarnings].length > 0 ? (
              <ul>
                {[...insights.unsupportedSummaryWarnings, ...insights.inconsistentDateWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p>No unsupported summaries or inconsistent dates identified.</p>
            )}
          </div>
          <div className="ior-assistant-block">
            <h4>Clarity</h4>
            {insights.clarityWarnings.length > 0 ? (
              <ul>
                {insights.clarityWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>No clarity issues identified.</p>
            )}
          </div>
          <div className="ior-assistant-block">
            <h4>Advisory (AI cannot publish)</h4>
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
        Humanity Union Assistant
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="public_impact"
        initiativeId={initiativeId}
        stageId="public_impact"
        label="Ask Assistant"
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">Could not load Assistant data.</p>
      ) : !insights ? (
        <p className="lsw-sidebar__loading">Loading…</p>
      ) : (
        <div className="ipi-assistant-block">
          <div className="ipi-assistant-block">
            <h4>Sources Used</h4>
            <p>{insights.sourcesUsedSummary}</p>
          </div>
          <div className="ipi-assistant-block">
            <h4>Missing Evidence & Unsupported Conclusions</h4>
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
              <p>No missing evidence or unsupported conclusions identified.</p>
            )}
          </div>
          <div className="ipi-assistant-block">
            <h4>Inconsistent Stats & Duplicated Claims</h4>
            {[...insights.inconsistentStatsWarnings, ...insights.duplicatedClaimWarnings].length > 0 ? (
              <ul>
                {[...insights.inconsistentStatsWarnings, ...insights.duplicatedClaimWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p>No inconsistent statistics or duplicated claims identified.</p>
            )}
          </div>
          <div className="ipi-assistant-block">
            <h4>Missing Institutions & Outcomes</h4>
            {insights.missingInstitutionOutcomeWarnings.length > 0 ? (
              <ul>
                {insights.missingInstitutionOutcomeWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>Official Response institutions and outcome summaries look complete.</p>
            )}
          </div>
          <div className="ipi-assistant-block">
            <h4>Clarity & Neutrality</h4>
            {insights.clarityWarnings.length > 0 ? (
              <ul>
                {insights.clarityWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>No clarity or neutrality issues identified.</p>
            )}
          </div>
          <div className="ipi-assistant-block">
            <h4>Advisory (AI cannot publish)</h4>
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
        Humanity Union Assistant
      </h3>
      <HumanityUnionAssistantOpenButton
        surfaceId="archive"
        initiativeId={initiativeId}
        stageId="archive"
        label="Ask Assistant"
        className="lifecycle-ai-modal__open-button"
      />
      {loadFailed ? (
        <p className="lsw-sidebar__error">Could not load Assistant data.</p>
      ) : !insights ? (
        <p className="lsw-sidebar__loading">Loading…</p>
      ) : (
        <div className="ica-assistant-block">
          <div className="ica-assistant-block">
            <h4>Sources Used</h4>
            <p>{insights.sourcesUsedSummary}</p>
          </div>
          <div className="ica-assistant-block">
            <h4>Completeness & Final Fields</h4>
            {[...insights.completenessWarnings, ...insights.missingFinalFieldWarnings].length > 0 ? (
              <ul>
                {[...insights.completenessWarnings, ...insights.missingFinalFieldWarnings].map(
                  (warning) => (
                    <li key={warning}>{warning}</li>
                  ),
                )}
              </ul>
            ) : (
              <p>Sources and final contribution fields look ready.</p>
            )}
          </div>
          <div className="ica-assistant-block">
            <h4>Outstanding Work</h4>
            {insights.outstandingWorkWarnings.length > 0 ? (
              <ul>
                {insights.outstandingWorkWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>No outstanding Tracking or Commitment gaps identified.</p>
            )}
          </div>
          <div className="ica-assistant-block">
            <h4>Neutrality & Clarity</h4>
            {[...insights.neutralityWarnings, ...insights.clarityWarnings].length > 0 ? (
              <ul>
                {[...insights.neutralityWarnings, ...insights.clarityWarnings].map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p>No neutrality or clarity issues identified.</p>
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
  supportStatistics,
  onSupportSignalChange,
  onSupportBookmarkToggle,
  supportBusy = false,
}: InitiativeLifecycleWorkingSidebarProps) {
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

  return (
    <div className="lsw-sidebar" aria-label="Stage working tools">
      {supportStatistics && onSupportSignalChange && onSupportBookmarkToggle ? (
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
          Stage Status
        </h3>
        {loadFailed ? (
          <p className="lsw-sidebar__error">Could not load stage status.</p>
        ) : projection ? (
          <WorkspaceStatusBadge status={projection.metadata.presentationStatus} />
        ) : (
          <p className="lsw-sidebar__loading">Loading…</p>
        )}
      </section>

      {!isDraftCapableStage ? (
        <>
          <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-sources-title">
            <h3 id="lsw-sidebar-sources-title" className="lsw-sidebar__section-title">
              Sources Used
            </h3>
            <p className="lsw-sidebar__placeholder">
              {projection?.sourceSnapshot.isEmpty ?? true
                ? "No sources collected yet."
                : `${projection?.sourceSnapshot.items.length ?? 0} source(s) collected.`}
            </p>
          </section>

          <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-questions-title">
            <h3 id="lsw-sidebar-questions-title" className="lsw-sidebar__section-title">
              Unresolved Questions
            </h3>
            <p className="lsw-sidebar__placeholder">None identified yet.</p>
          </section>

          <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-completeness-title">
            <h3 id="lsw-sidebar-completeness-title" className="lsw-sidebar__section-title">
              Draft Completeness
            </h3>
            <p className="lsw-sidebar__placeholder">Not started.</p>
          </section>

          <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-primary-action-title">
            <h3 id="lsw-sidebar-primary-action-title" className="lsw-sidebar__section-title">
              Primary Action
            </h3>
            <WorkspaceDeferredActions
              title="Drafting tools coming soon"
              note="This stage's drafting workspace is not implemented yet."
              actions={["Generate Draft"]}
              tooltip="Available once this stage's workspace is implemented."
              authorWorkflow
            />
          </section>
        </>
      ) : (
        <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-completeness-title">
          <h3 id="lsw-sidebar-completeness-title" className="lsw-sidebar__section-title">
            Draft Completeness
          </h3>
          <p className="lsw-sidebar__placeholder">
            {loadFailed
              ? "Could not load draft status."
              : !projection
                ? "Loading…"
                : projection.metadata.hasUnpublishedChanges
                  ? `Draft in progress${projection.metadata.draftUpdatedAt ? " — use Save Draft in the main workspace to keep your changes" : ""}.`
                  : projection.metadata.publishedAt
                    ? isProposalStage
                      ? "Published — generate a new draft to prepare an updated round of proposals."
                      : isRevisionStage
                        ? "Published — start a new Revision draft to prepare the next update."
                        : isPetitionStage
                          ? "Published — this Initiative's Petition has been published and opened for signatures."
                          : isDecisionSessionStage
                            ? "Published — Collective Decision is now unlocked."
                    : isCollectiveDecisionStage
                      ? "Published — Implementation Commitments are now unlocked."
                    : isCommitmentStage
                      ? "Published — Implementation Tracking is now unlocked."
                      : isTrackingStage
                        ? "Published — Official Responses is now unlocked."
                        : isOfficialResponseStage
                          ? "Published — Public Impact is now unlocked."
                          : isPublicImpactStage
                            ? "Published — Civic Archive is now unlocked."
                            : isArchiveStage
                              ? "Published — generate again to prepare the next immutable Archive version."
                          : "Published — generate a new draft to prepare an update."
                : isProposalStage
                  ? "No draft yet — use Generate Improvement Proposals Draft in the main workspace to begin."
                  : isRevisionStage
                    ? "No draft yet — use Start Revision Draft in the main workspace to begin."
                    : isPetitionStage
                      ? "No draft yet — use Generate Petition Draft in the main workspace to begin."
                      : isDecisionSessionStage
                        ? "No draft yet — use Generate Decision Draft in the main workspace to begin."
                        : isCollectiveDecisionStage
                          ? "No draft yet — use Generate Collective Decision Draft in the main workspace to begin."
                          : isCommitmentStage
                            ? "No draft yet — use Generate Implementation Commitments Draft in the main workspace to begin."
                            : isTrackingStage
                              ? "No draft yet — use Generate Implementation Tracking Draft in the main workspace to begin."
                              : isOfficialResponseStage
                                ? "No draft yet — use Generate Official Responses Draft in the main workspace to begin."
                                : isPublicImpactStage
                                  ? "No draft yet — use Generate Public Impact Draft in the main workspace to begin."
                                  : isArchiveStage
                                    ? "No draft yet — use Generate Civic Archive Draft in the main workspace to begin."
                                : "No draft yet — use Generate Analysis Draft in the main workspace to begin."}
          </p>
        </section>
      )}

      {isCommitmentStage ? (
        <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-proposal-inbox-title">
          <h3 id="lsw-sidebar-proposal-inbox-title" className="lsw-sidebar__section-title">
            My Proposed Commitments
          </h3>
          <InitiativeImplementationCommitmentProposalInbox initiativeId={initiativeId} />
        </section>
      ) : null}

      {isTrackingStage ? (
        <section className="lsw-sidebar__section" aria-labelledby="lsw-sidebar-progress-inbox-title">
          <h3 id="lsw-sidebar-progress-inbox-title" className="lsw-sidebar__section-title">
            My Implementation Tracking
          </h3>
          <InitiativeImplementationTrackingProgressInbox initiativeId={initiativeId} />
        </section>
      ) : null}

      <section className="lsw-sidebar__section lsw-sidebar__actions" aria-label="Stage actions">
        <WorkspaceButton variant="secondary" onClick={onOpenPublicPreview}>
          Public Preview
        </WorkspaceButton>
        {projection?.nextStage ? (
          <WorkspaceButton
            variant="primary"
            disabled={
              projection.stageId !== "initiative" &&
              !projection.metadata.canViewPublicResult &&
              projection.metadata.presentationStatus !== "published"
            }
            onClick={() => onNavigateNextStage(projection.nextStage!.stageId, projection.nextStage!.hash)}
          >
            {isPublicImpactStage && projection.nextStage.stageId === "archive"
              ? "Open Civic Archive"
              : `Next Stage: ${projection.nextStage.label}`}
          </WorkspaceButton>
        ) : null}
      </section>

      <InitiativeActiveAlliesWidget initiativeId={initiativeId} />
    </div>
  );
}
