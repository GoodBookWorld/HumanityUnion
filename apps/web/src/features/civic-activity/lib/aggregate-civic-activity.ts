import type {
  DecisionSession,
  Initiative,
  InitiativeCollaborativeAnalysis,
  InitiativeImprovementProposal,
} from "@hu/types";

import type {
  ActiveActivityGroup,
  CivicActivityGroup,
  CivicActivitySnapshot,
  CivicActivitySourceData,
  CivicTimelineEntry,
  DeferredActivityGroup,
  MyDecisionVoteRecord,
} from "../types";

function latestDate(values: Array<string | null | undefined>): string | null {
  const timestamps = values.filter((value): value is string => Boolean(value));

  if (timestamps.length === 0) {
    return null;
  }

  return timestamps.sort((left, right) => right.localeCompare(left))[0] ?? null;
}

function buildInitiativesGroup(initiatives: Initiative[]): ActiveActivityGroup {
  const draft = initiatives.filter((initiative) => initiative.lifecyclePhase === "draft").length;
  const published = initiatives.filter(
    (initiative) =>
      initiative.lifecyclePhase === "published" || initiative.lifecyclePhase === "projected",
  ).length;
  const completed = initiatives.filter(
    (initiative) => initiative.lifecyclePhase === "archived",
  ).length;

  return {
    kind: "active",
    id: "initiatives",
    title: "My Initiatives",
    metrics: {
      total: initiatives.length,
      draft,
      published,
      completed,
      latestActivityDate: latestDate(initiatives.map((initiative) => initiative.updatedAt)),
    },
  };
}

function buildAnalysesGroup(analyses: InitiativeCollaborativeAnalysis[]): ActiveActivityGroup {
  const draft = analyses.filter((analysis) => analysis.status === "draft").length;
  const published = analyses.filter((analysis) => analysis.status === "published").length;
  const completed = analyses.filter((analysis) => analysis.status === "archived").length;

  return {
    kind: "active",
    id: "analyses",
    title: "My Collaborative Analyses",
    metrics: {
      total: analyses.length,
      draft,
      published,
      completed,
      latestActivityDate: latestDate(
        analyses.flatMap((analysis) => [analysis.updatedAt, analysis.publishedAt]),
      ),
    },
  };
}

function buildProposalsGroup(proposals: InitiativeImprovementProposal[]): ActiveActivityGroup {
  const draft = proposals.filter((proposal) => proposal.status === "draft").length;
  const submitted = proposals.filter((proposal) => proposal.status === "submitted").length;
  const completed = proposals.filter((proposal) =>
    ["accepted", "partially_accepted", "declined", "archived"].includes(proposal.status),
  ).length;

  return {
    kind: "active",
    id: "proposals",
    title: "My Improvement Proposals",
    metrics: {
      total: proposals.length,
      draft,
      submitted,
      completed,
      latestActivityDate: latestDate(
        proposals.flatMap((proposal) => [proposal.updatedAt, proposal.decidedAt]),
      ),
    },
  };
}

function buildDecisionParticipationGroup(
  decisionSessions: DecisionSession[],
  votes: MyDecisionVoteRecord[],
): ActiveActivityGroup {
  const draft = decisionSessions.filter((session) => session.status === "draft").length;
  const published = decisionSessions.filter((session) => session.status === "published").length;
  const completed = decisionSessions.filter((session) =>
    ["closed", "archived"].includes(session.status),
  ).length;

  return {
    kind: "active",
    id: "decision-participation",
    title: "My Decision Participation",
    metrics: {
      total: decisionSessions.length + votes.length,
      draft,
      published,
      active: published,
      completed,
      votesCast: votes.length,
      latestActivityDate: latestDate([
        ...decisionSessions.flatMap((session) => [
          session.updatedAt,
          session.publishedAt,
          session.closedAt,
        ]),
        ...votes.map((record) => record.vote.updatedAt),
      ]),
    },
    note:
      votes.length === 0
        ? "Vote counts reflect decisions linked to your initiatives. A participant-wide votes API is not connected yet."
        : "Vote counts reflect decisions linked to your initiatives.",
  };
}

function buildDeferredGroup(id: string, title: string, reason: string): DeferredActivityGroup {
  return {
    kind: "deferred",
    id,
    title,
    reason,
  };
}

function pushTimelineEntry(entries: CivicTimelineEntry[], entry: CivicTimelineEntry): void {
  entries.push(entry);
}

function buildInitiativeTimelineEntries(initiatives: Initiative[]): CivicTimelineEntry[] {
  const entries: CivicTimelineEntry[] = [];

  for (const initiative of initiatives) {
    pushTimelineEntry(entries, {
      id: `initiative-created-${initiative.initiativeId}`,
      type: "initiative_created",
      label: "Initiative created",
      detail: initiative.title,
      occurredAt: initiative.createdAt,
      href: "/initiatives",
    });

    for (const event of initiative.timeline) {
      if (event.eventType === "initiative_published") {
        pushTimelineEntry(entries, {
          id: `initiative-published-${event.eventId}`,
          type: "initiative_published",
          label: "Initiative published",
          detail: initiative.title,
          occurredAt: event.timestamp,
          href: `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`,
        });
      }
    }
  }

  return entries;
}

function buildAnalysisTimelineEntries(
  analyses: InitiativeCollaborativeAnalysis[],
): CivicTimelineEntry[] {
  return analyses
    .filter((analysis) => analysis.status === "published" && analysis.publishedAt)
    .map((analysis) => ({
      id: `analysis-published-${analysis.analysisId}`,
      type: "analysis_published" as const,
      label: "Analysis published",
      detail: analysis.title,
      occurredAt: analysis.publishedAt ?? analysis.updatedAt,
      href: `/initiative-analyses/public/${encodeURIComponent(analysis.analysisId)}`,
    }));
}

function buildProposalTimelineEntries(
  proposals: InitiativeImprovementProposal[],
): CivicTimelineEntry[] {
  const entries: CivicTimelineEntry[] = [];

  for (const proposal of proposals) {
    if (["submitted", "accepted", "partially_accepted", "declined"].includes(proposal.status)) {
      pushTimelineEntry(entries, {
        id: `proposal-submitted-${proposal.proposalId}`,
        type: "proposal_submitted",
        label: "Proposal submitted",
        detail: proposal.targetSection,
        occurredAt: proposal.updatedAt,
        href: `/improvement-proposals/public/${encodeURIComponent(proposal.proposalId)}`,
      });
    }

    if (proposal.status === "accepted" || proposal.status === "partially_accepted") {
      pushTimelineEntry(entries, {
        id: `proposal-accepted-${proposal.proposalId}`,
        type: "proposal_accepted",
        label:
          proposal.status === "partially_accepted"
            ? "Proposal partially accepted"
            : "Proposal accepted",
        detail: proposal.targetSection,
        occurredAt: proposal.decidedAt ?? proposal.updatedAt,
        href: `/improvement-proposals/public/${encodeURIComponent(proposal.proposalId)}`,
      });
    }

    if (proposal.status === "declined") {
      pushTimelineEntry(entries, {
        id: `proposal-declined-${proposal.proposalId}`,
        type: "proposal_declined",
        label: "Proposal declined",
        detail: proposal.targetSection,
        occurredAt: proposal.decidedAt ?? proposal.updatedAt,
        href: `/improvement-proposals/public/${encodeURIComponent(proposal.proposalId)}`,
      });
    }
  }

  return entries;
}

function buildVoteTimelineEntries(votes: MyDecisionVoteRecord[]): CivicTimelineEntry[] {
  return votes.map((record) => ({
    id: `vote-${record.vote.voteId}-${record.vote.version}`,
    type: record.vote.version > 1 ? ("vote_updated" as const) : ("vote_cast" as const),
    label: record.vote.version > 1 ? "Vote updated" : "Vote cast",
    detail: `${record.decisionQuestion} · ${record.vote.choice.replace(/_/g, " ")}`,
    occurredAt: record.vote.updatedAt,
    href: `/collective-decisions/public/${encodeURIComponent(record.vote.decisionId)}`,
  }));
}

function buildDecisionSessionTimelineEntries(
  decisionSessions: DecisionSession[],
): CivicTimelineEntry[] {
  return decisionSessions
    .filter((session) => session.publishedAt)
    .map((session) => ({
      id: `decision-session-published-${session.sessionId}`,
      type: "decision_session_published" as const,
      label: "Decision session published",
      detail: session.title,
      occurredAt: session.publishedAt ?? session.updatedAt,
      href: `/decision-sessions/public/${encodeURIComponent(session.sessionId)}`,
    }));
}

export function buildCivicActivitySnapshot(source: CivicActivitySourceData): CivicActivitySnapshot {
  const groups: CivicActivityGroup[] = [
    buildInitiativesGroup(source.initiatives),
    buildAnalysesGroup(source.analyses),
    buildProposalsGroup(source.proposals),
    buildDecisionParticipationGroup(source.decisionSessions, source.votes),
    buildDeferredGroup(
      "implementation-commitments",
      "My Implementation Commitments",
      "Personal commitment aggregation API is not connected to the workspace yet.",
    ),
    buildDeferredGroup(
      "implementation-tracking",
      "My Implementation Tracking",
      "Personal tracking aggregation API is not connected to the workspace yet.",
    ),
    buildDeferredGroup(
      "public-impact",
      "My Public Impact",
      "Personal public impact aggregation API is not connected to the workspace yet.",
    ),
  ];

  const timeline = [
    ...buildInitiativeTimelineEntries(source.initiatives),
    ...buildAnalysisTimelineEntries(source.analyses),
    ...buildProposalTimelineEntries(source.proposals),
    ...buildVoteTimelineEntries(source.votes),
    ...buildDecisionSessionTimelineEntries(source.decisionSessions),
  ]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 40);

  return {
    groups,
    timeline,
    loadedAt: new Date().toISOString(),
  };
}

export function createEmptyCivicActivitySnapshot(): CivicActivitySnapshot {
  return buildCivicActivitySnapshot({
    initiatives: [],
    analyses: [],
    proposals: [],
    decisionSessions: [],
    votes: [],
  });
}
