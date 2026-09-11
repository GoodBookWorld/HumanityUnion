import type { WorkspaceHomeTimelineEntry } from "./workspace-home.types.js";
import type { DecisionSession } from "@hu/types";
import type {
  Initiative,
  InitiativeCollaborativeAnalysis,
  InitiativeImplementationCommitment,
  InitiativeImplementationTracking,
  InitiativeImprovementProposal,
  InitiativePublicImpact,
} from "@hu/types";

interface WorkspaceHomeTimelineSource {
  initiatives: Initiative[];
  analyses: InitiativeCollaborativeAnalysis[];
  proposals: InitiativeImprovementProposal[];
  decisionSessions: DecisionSession[];
  commitments: InitiativeImplementationCommitment[];
  trackings: InitiativeImplementationTracking[];
  impacts: InitiativePublicImpact[];
}

function pushEntry(entries: WorkspaceHomeTimelineEntry[], entry: WorkspaceHomeTimelineEntry): void {
  entries.push(entry);
}

/**
 * Timeline `label` is a stable event code for WEB_UI mapping
 * (civicActivity.timeline.events.* / workspace.home.activityEvents.*).
 */
export function buildWorkspaceHomeTimeline(
  source: WorkspaceHomeTimelineSource,
): WorkspaceHomeTimelineEntry[] {
  const entries: WorkspaceHomeTimelineEntry[] = [];

  for (const initiative of source.initiatives) {
    pushEntry(entries, {
      id: `initiative-created-${initiative.initiativeId}`,
      label: "initiative_created",
      detail: initiative.title,
      occurredAt: initiative.createdAt,
      href: "/initiatives",
    });

    for (const event of initiative.timeline) {
      if (event.eventType === "initiative_published") {
        pushEntry(entries, {
          id: `initiative-published-${event.eventId}`,
          label: "initiative_published",
          detail: initiative.title,
          occurredAt: event.timestamp,
          href: `/initiatives/public/${encodeURIComponent(initiative.initiativeId)}`,
        });
      }
    }
  }

  for (const analysis of source.analyses) {
    if (analysis.status === "published" && analysis.publishedAt) {
      pushEntry(entries, {
        id: `analysis-published-${analysis.analysisId}`,
        label: "analysis_published",
        detail: analysis.title,
        occurredAt: analysis.publishedAt,
        href: `/initiative-analyses/public/${encodeURIComponent(analysis.analysisId)}`,
      });
    }
  }

  for (const proposal of source.proposals) {
    if (["submitted", "accepted", "partially_accepted", "declined"].includes(proposal.status)) {
      pushEntry(entries, {
        id: `proposal-submitted-${proposal.proposalId}`,
        label: "proposal_submitted",
        detail: proposal.targetSection,
        occurredAt: proposal.updatedAt,
        href: `/improvement-proposals/public/${encodeURIComponent(proposal.proposalId)}`,
      });
    }
  }

  for (const session of source.decisionSessions) {
    if (session.publishedAt) {
      pushEntry(entries, {
        id: `decision-session-published-${session.sessionId}`,
        label: "decision_session_published",
        detail: session.title,
        occurredAt: session.publishedAt,
        href: `/decision-sessions/public/${encodeURIComponent(session.sessionId)}`,
      });
    }
  }

  for (const commitment of source.commitments) {
    if (commitment.status === "published" && commitment.publishedAt) {
      pushEntry(entries, {
        id: `commitment-published-${commitment.commitmentId}`,
        label: "commitment_published",
        detail: commitment.commitmentTitle,
        occurredAt: commitment.publishedAt,
        href: `/initiative-implementation-commitments/public/${encodeURIComponent(commitment.commitmentId)}`,
      });
    }
  }

  for (const tracking of source.trackings) {
    if (tracking.activatedAt) {
      pushEntry(entries, {
        id: `tracking-activated-${tracking.trackingId}`,
        label: "implementation_tracking_activated",
        detail: tracking.summary,
        occurredAt: tracking.activatedAt,
        href: `/implementation-tracking/public/${encodeURIComponent(tracking.trackingId)}`,
      });
    }
  }

  for (const impact of source.impacts) {
    if (impact.publishedAt) {
      pushEntry(entries, {
        id: `public-impact-published-${impact.impactId}`,
        label: "public_impact_published",
        detail: impact.title,
        occurredAt: impact.publishedAt,
        href: `/public-impact/${encodeURIComponent(impact.impactId)}`,
      });
    }
  }

  return entries
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 20);
}
