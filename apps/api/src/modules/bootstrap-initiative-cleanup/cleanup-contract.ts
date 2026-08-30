import type { Document, Filter } from "mongodb";

import { BOOTSTRAP_INITIATIVE_CLEANUP_ID } from "./constants.js";

export type CleanupFilterKind =
  | "root"
  | "initiativeId"
  | "subject.initiativeId"
  | "aggregateId"
  | "contentRef";

export interface CleanupContractEntry {
  readonly collection: string;
  readonly kind: CleanupFilterKind;
  readonly notes?: string;
}

/**
 * Collections/filters covered by the cleanup contract.
 * Documents matching these filters for the allow-listed ID may be deleted.
 * Any civic reference outside this contract fails closed.
 */
export const BOOTSTRAP_INITIATIVE_CLEANUP_CONTRACT: readonly CleanupContractEntry[] = [
  { collection: "initiatives", kind: "root" },
  { collection: "initiative_analyses", kind: "initiativeId" },
  { collection: "initiative_improvement_proposals", kind: "initiativeId" },
  { collection: "initiative_improvement_proposals_collections", kind: "initiativeId" },
  { collection: "initiative_version_revisions", kind: "initiativeId" },
  { collection: "initiative_revision_drafts", kind: "initiativeId" },
  { collection: "initiative_discussion_completions", kind: "initiativeId" },
  { collection: "initiative_discussion_proposal_candidates", kind: "initiativeId" },
  { collection: "initiative_petition_drafts", kind: "initiativeId" },
  { collection: "initiative_decision_session_drafts", kind: "initiativeId" },
  { collection: "initiative_decision_session_recommendations", kind: "initiativeId" },
  { collection: "initiative_collective_decision_lifecycle_drafts", kind: "initiativeId" },
  { collection: "initiative_implementation_commitment_lifecycle_drafts", kind: "initiativeId" },
  { collection: "initiative_implementation_commitment_packages", kind: "initiativeId" },
  { collection: "initiative_implementation_commitments", kind: "initiativeId" },
  { collection: "initiative_implementation_tracking_lifecycle_drafts", kind: "initiativeId" },
  { collection: "initiative_implementation_tracking_packages", kind: "initiativeId" },
  { collection: "initiative_implementation_trackings", kind: "initiativeId" },
  { collection: "initiative_official_response_lifecycle_drafts", kind: "initiativeId" },
  { collection: "initiative_official_response_packages", kind: "initiativeId" },
  { collection: "initiative_official_response_package_records", kind: "initiativeId" },
  { collection: "initiative_public_impact_lifecycle_drafts", kind: "initiativeId" },
  { collection: "initiative_public_impact_reports", kind: "initiativeId" },
  { collection: "initiative_public_impacts", kind: "initiativeId" },
  { collection: "initiative_civic_archive_lifecycle_drafts", kind: "initiativeId" },
  { collection: "initiative_civic_archive_versions", kind: "initiativeId" },
  { collection: "initiative_comments", kind: "initiativeId" },
  { collection: "initiative_comment_reactions", kind: "initiativeId" },
  { collection: "initiative_analysis_reactions", kind: "initiativeId" },
  { collection: "initiative_proposal_reactions", kind: "initiativeId" },
  { collection: "initiative_revision_reactions", kind: "initiativeId" },
  { collection: "initiative_support_registered_signals", kind: "initiativeId" },
  { collection: "initiative_support_visitor_signals", kind: "initiativeId" },
  { collection: "initiative_support_bookmarks", kind: "initiativeId" },
  { collection: "initiative_support_views", kind: "initiativeId" },
  { collection: "initiative_allies", kind: "initiativeId" },
  { collection: "initiative_collaboration_channel_messages", kind: "initiativeId" },
  { collection: "initiative_collaboration_channel_reads", kind: "initiativeId" },
  { collection: "initiative_collaboration_sessions", kind: "initiativeId" },
  { collection: "initiative_collective_decisions", kind: "initiativeId" },
  { collection: "decision_sessions", kind: "initiativeId" },
  { collection: "public_choice_candidates", kind: "initiativeId" },
  { collection: "shared_documents", kind: "initiativeId" },
  { collection: "petitions", kind: "subject.initiativeId" },
  { collection: "official_responses", kind: "initiativeId" },
  { collection: "public_civic_archive_records", kind: "initiativeId" },
  { collection: "public_news_articles", kind: "initiativeId" },
  { collection: "media_resources", kind: "initiativeId" },
  { collection: "media_upload_records", kind: "initiativeId" },
  { collection: "participant_actions", kind: "initiativeId" },
  { collection: "workspace_projections", kind: "initiativeId" },
  { collection: "content_translations", kind: "contentRef" },
  { collection: "outbox", kind: "aggregateId" },
  { collection: "processed_events", kind: "aggregateId" },
  // Legacy Pack 02 excluded names — still fail-closed if present
  { collection: "activities", kind: "initiativeId" },
  { collection: "discussions", kind: "initiativeId" },
  { collection: "proposals", kind: "initiativeId" },
  { collection: "decisions", kind: "initiativeId" },
] as const;

/**
 * Parent-linked collections: presence tied to this Initiative is unexpected
 * unless parents were also found under the contract (cascade not auto-executed).
 * Counts here with no covering parent delete → fail closed.
 */
export const BOOTSTRAP_INITIATIVE_UNEXPECTED_PARENT_COLLECTIONS = [
  "initiative_decision_votes",
  "initiative_decision_vote_history",
  "petition_signatures",
  "initiative_collaboration_session_attendances",
  "implementation_tracking_updates",
  "public_impact_evidence",
] as const;

export function buildCleanupFilter(
  kind: CleanupFilterKind,
  initiativeId: string = BOOTSTRAP_INITIATIVE_CLEANUP_ID,
): Filter<Document> {
  switch (kind) {
    case "root":
      return {
        $or: [{ _id: initiativeId }, { initiativeId }],
      } as Filter<Document>;
    case "initiativeId":
      return { initiativeId };
    case "subject.initiativeId":
      return {
        $or: [{ "subject.initiativeId": initiativeId }, { initiativeId }],
      };
    case "aggregateId":
      return { aggregateId: initiativeId };
    case "contentRef":
      return {
        $or: [
          { contentId: initiativeId },
          { entityId: initiativeId },
          { initiativeId },
          { "ref.initiativeId": initiativeId },
        ],
      };
    default: {
      throw new Error(`Unsupported cleanup filter kind: ${String(kind)}`);
    }
  }
}

export const CONTRACT_COLLECTION_NAMES = new Set(
  BOOTSTRAP_INITIATIVE_CLEANUP_CONTRACT.map((entry) => entry.collection),
);
