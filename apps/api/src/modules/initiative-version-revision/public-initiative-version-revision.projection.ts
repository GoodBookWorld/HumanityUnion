import type {
  InitiativeRevisionMetrics,
  InitiativeVersionRevision,
  PublicInitiativeVersionRevisionListItem,
  PublicInitiativeVersionRevisionProjection,
  PublicInitiativeWithVersionHistory,
} from "@hu/types";

import { getMemberById } from "../member/member.store.js";
import { listProposalsByInitiative } from "../initiative-improvement-proposal/initiative-improvement-proposal.store.js";
import {
  getCurrentPublishedVersion,
  getRevisionByInitiativeAndVersion,
  listRevisionsByInitiative,
} from "./initiative-version-revision.store.js";

function resolveAuthorDisplayName(authorId: string): string {
  const member = getMemberById(authorId);

  return member?.profile.displayName ?? "Unknown Steward";
}

export function computeInitiativeRevisionMetrics(initiativeId: string): InitiativeRevisionMetrics {
  const revisions = listRevisionsByInitiative(initiativeId);
  const decidedProposals = listProposalsByInitiative(initiativeId).filter(
    (proposal) => proposal.status === "accepted" || proposal.status === "partially_accepted",
  );
  const implementedProposalCount = decidedProposals.filter(
    (proposal) => proposal.implementedInVersion !== undefined,
  ).length;

  const totalAcceptedDecisions = decidedProposals.length;
  const acceptedProposalImplementationRate =
    totalAcceptedDecisions > 0 ? implementedProposalCount / totalAcceptedDecisions : 0;

  const totalAcceptedUsed = revisions.reduce(
    (sum, revision) => sum + revision.acceptedProposalIds.length,
    0,
  );
  const averageAcceptedPerRevision =
    revisions.length > 0 ? totalAcceptedUsed / revisions.length : 0;

  let averageRevisionIntervalDays: number | null = null;

  if (revisions.length > 1) {
    const ordered = [...revisions].sort((left, right) => left.version - right.version);
    const intervals: number[] = [];

    for (let index = 1; index < ordered.length; index += 1) {
      const previous = new Date(ordered[index - 1]!.publishedAt).getTime();
      const current = new Date(ordered[index]!.publishedAt).getTime();
      intervals.push((current - previous) / (1000 * 60 * 60 * 24));
    }

    averageRevisionIntervalDays =
      intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  }

  return {
    revisionCount: revisions.length,
    acceptedProposalImplementationRate,
    averageAcceptedPerRevision,
    averageRevisionIntervalDays,
    implementedProposalCount,
  };
}

export function toPublicInitiativeVersionRevisionListItem(
  revision: InitiativeVersionRevision,
  currentVersion: number,
): PublicInitiativeVersionRevisionListItem {
  return {
    revisionId: revision.revisionId,
    version: revision.version,
    revisionSummary: revision.revisionSummary,
    authorDisplayName: resolveAuthorDisplayName(revision.authorId),
    publishedAt: revision.publishedAt,
    isCurrent: revision.version === currentVersion,
  };
}

export function toPublicInitiativeVersionRevisionProjection(
  revision: InitiativeVersionRevision,
  currentVersion: number,
): PublicInitiativeVersionRevisionProjection {
  return {
    revisionId: revision.revisionId,
    initiativeId: revision.initiativeId,
    version: revision.version,
    previousVersion: revision.previousVersion,
    revisionSummary: revision.revisionSummary,
    title: revision.title,
    description: revision.description,
    authorDisplayName: resolveAuthorDisplayName(revision.authorId),
    publishedAt: revision.publishedAt,
    isCurrent: revision.version === currentVersion,
    acceptedProposalIds: [...revision.acceptedProposalIds],
    partiallyAcceptedProposalIds: [...revision.partiallyAcceptedProposalIds],
    declinedProposalIds: [...revision.declinedProposalIds],
  };
}

export function getPublicInitiativeVersionHistory(
  initiativeId: string,
): PublicInitiativeWithVersionHistory {
  const revisions = listRevisionsByInitiative(initiativeId);
  const currentVersion = getCurrentPublishedVersion(initiativeId);

  return {
    currentVersion,
    revisions: revisions.map((revision) =>
      toPublicInitiativeVersionRevisionListItem(revision, currentVersion),
    ),
    metrics: computeInitiativeRevisionMetrics(initiativeId),
  };
}

export function getPublicInitiativeVersionRevision(
  initiativeId: string,
  version: number,
): PublicInitiativeVersionRevisionProjection | null {
  const revision = getRevisionByInitiativeAndVersion(initiativeId, version);

  if (!revision) {
    return null;
  }

  return toPublicInitiativeVersionRevisionProjection(
    revision,
    getCurrentPublishedVersion(initiativeId),
  );
}
