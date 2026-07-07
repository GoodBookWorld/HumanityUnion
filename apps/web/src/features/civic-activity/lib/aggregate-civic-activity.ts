import type {
  DecisionSession,
  ImplementationTrackingUpdate,
  Initiative,
  InitiativeCollaborativeAnalysis,
  InitiativeImplementationCommitment,
  InitiativeImplementationTracking,
  InitiativeImprovementProposal,
  InitiativePublicImpact,
} from "@hu/types";

import type {
  ActiveActivityGroup,
  CivicActivityGroup,
  CivicActivitySnapshot,
  CivicActivitySourceData,
  CivicTimelineEntry,
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

function buildCommitmentsGroup(
  commitments: InitiativeImplementationCommitment[],
): ActiveActivityGroup {
  const draft = commitments.filter((commitment) => commitment.status === "draft").length;
  const published = commitments.filter((commitment) => commitment.status === "published").length;
  const completed = commitments.filter((commitment) =>
    ["completed", "withdrawn"].includes(commitment.status),
  ).length;

  return {
    kind: "active",
    id: "implementation-commitments",
    title: "My Implementation Commitments",
    metrics: {
      total: commitments.length,
      draft,
      published,
      completed,
      latestActivityDate: latestDate(
        commitments.flatMap((commitment) => [
          commitment.updatedAt,
          commitment.publishedAt,
          commitment.completedAt,
          commitment.withdrawnAt,
        ]),
      ),
    },
  };
}

function buildTrackingGroup(trackings: InitiativeImplementationTracking[]): ActiveActivityGroup {
  const draft = trackings.filter((tracking) => tracking.status === "draft").length;
  const active = trackings.filter((tracking) => tracking.status === "active").length;
  const completed = trackings.filter((tracking) =>
    ["completed", "archived"].includes(tracking.status),
  ).length;

  return {
    kind: "active",
    id: "implementation-tracking",
    title: "My Implementation Tracking",
    metrics: {
      total: trackings.length,
      draft,
      active,
      completed,
      latestActivityDate: latestDate(
        trackings.flatMap((tracking) => [
          tracking.updatedAt,
          tracking.activatedAt,
          tracking.completedAt,
          tracking.archivedAt,
        ]),
      ),
    },
  };
}

function buildPublicImpactGroup(impacts: InitiativePublicImpact[]): ActiveActivityGroup {
  const draft = impacts.filter((impact) => impact.status === "draft").length;
  const published = impacts.filter((impact) => impact.status === "published").length;
  const verified = impacts.filter((impact) => impact.status === "verified").length;
  const completed = impacts.filter((impact) => impact.status === "archived").length;

  return {
    kind: "active",
    id: "public-impact",
    title: "My Public Impact",
    metrics: {
      total: impacts.length,
      draft,
      published,
      verified,
      completed,
      latestActivityDate: latestDate(
        impacts.flatMap((impact) => [
          impact.updatedAt,
          impact.publishedAt,
          impact.verifiedAt,
          impact.archivedAt,
        ]),
      ),
    },
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

function buildCommitmentTimelineEntries(
  commitments: InitiativeImplementationCommitment[],
): CivicTimelineEntry[] {
  return commitments
    .filter((commitment) => commitment.status === "published" && commitment.publishedAt)
    .map((commitment) => ({
      id: `commitment-published-${commitment.commitmentId}`,
      type: "commitment_published" as const,
      label: "Commitment published",
      detail: commitment.commitmentTitle,
      occurredAt: commitment.publishedAt ?? commitment.updatedAt,
      href: `/initiative-implementation-commitments/public/${encodeURIComponent(commitment.commitmentId)}`,
    }));
}

function buildTrackingTimelineEntries(
  trackings: InitiativeImplementationTracking[],
): CivicTimelineEntry[] {
  const entries: CivicTimelineEntry[] = [];

  for (const tracking of trackings) {
    if (tracking.activatedAt) {
      pushTimelineEntry(entries, {
        id: `tracking-activated-${tracking.trackingId}`,
        type: "implementation_tracking_activated",
        label: "Implementation tracking activated",
        detail: tracking.summary,
        occurredAt: tracking.activatedAt,
        href: `/implementation-tracking/public/${encodeURIComponent(tracking.trackingId)}`,
      });
    }

    if (tracking.completedAt) {
      pushTimelineEntry(entries, {
        id: `tracking-completed-${tracking.trackingId}`,
        type: "implementation_tracking_completed",
        label: "Implementation tracking completed",
        detail: tracking.summary,
        occurredAt: tracking.completedAt,
        href: `/implementation-tracking/public/${encodeURIComponent(tracking.trackingId)}`,
      });
    }
  }

  return entries;
}

function buildTrackingUpdateTimelineEntries(
  updates: ImplementationTrackingUpdate[],
): CivicTimelineEntry[] {
  return updates.map((update) => ({
    id: `tracking-update-${update.updateId}`,
    type: "implementation_update_added" as const,
    label: "Implementation update added",
    detail: update.title,
    occurredAt: update.createdAt,
    href: `/implementation-tracking/public/${encodeURIComponent(update.trackingId)}`,
  }));
}

function buildPublicImpactTimelineEntries(impacts: InitiativePublicImpact[]): CivicTimelineEntry[] {
  const entries: CivicTimelineEntry[] = [];

  for (const impact of impacts) {
    if (impact.publishedAt) {
      pushTimelineEntry(entries, {
        id: `public-impact-published-${impact.impactId}`,
        type: "public_impact_published",
        label: "Public impact published",
        detail: impact.title,
        occurredAt: impact.publishedAt,
        href: `/public-impact/${encodeURIComponent(impact.impactId)}`,
      });
    }

    if (impact.verifiedAt) {
      pushTimelineEntry(entries, {
        id: `public-impact-verified-${impact.impactId}`,
        type: "public_impact_verified",
        label: "Public impact verified",
        detail: impact.title,
        occurredAt: impact.verifiedAt,
        href: `/public-impact/${encodeURIComponent(impact.impactId)}`,
      });
    }
  }

  return entries;
}

export function buildCivicActivitySnapshot(source: CivicActivitySourceData): CivicActivitySnapshot {
  const groups: CivicActivityGroup[] = [
    buildInitiativesGroup(source.initiatives),
    buildAnalysesGroup(source.analyses),
    buildProposalsGroup(source.proposals),
    buildDecisionParticipationGroup(source.decisionSessions, source.votes),
    buildCommitmentsGroup(source.commitments),
    buildTrackingGroup(source.trackings),
    buildPublicImpactGroup(source.impacts),
  ];

  const timeline = [
    ...buildInitiativeTimelineEntries(source.initiatives),
    ...buildAnalysisTimelineEntries(source.analyses),
    ...buildProposalTimelineEntries(source.proposals),
    ...buildVoteTimelineEntries(source.votes),
    ...buildDecisionSessionTimelineEntries(source.decisionSessions),
    ...buildCommitmentTimelineEntries(source.commitments),
    ...buildTrackingTimelineEntries(source.trackings),
    ...buildTrackingUpdateTimelineEntries(source.trackingUpdates),
    ...buildPublicImpactTimelineEntries(source.impacts),
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
    commitments: [],
    trackings: [],
    trackingUpdates: [],
    impacts: [],
  });
}
