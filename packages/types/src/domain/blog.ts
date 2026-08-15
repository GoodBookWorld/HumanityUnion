import type { LanguageCode } from "./language.js";
import type { LifecycleSafetyOutcome } from "./lifecycle-safety.js";
import type { PublicCommentAuthor } from "./initiative-comment.js";

/**
 * Blog Implementation Pack 02 — Publishing Domain core contracts.
 *
 * Persisted status vocabulary (Pack 02 refinement of Pack 01):
 * - draft
 * - submitted_for_review
 * - published
 * - archived
 *
 * Pack 01 "Preview" is a presentation/API mode, not a persisted status.
 * Pack 01 "Updated" is expressed via publishedVersion + updatedAt, not a status.
 */

export type BlogPostStatus =
  | "draft"
  | "submitted_for_review"
  | "published"
  | "archived";

export const BLOG_POST_STATUSES: readonly BlogPostStatus[] = [
  "draft",
  "submitted_for_review",
  "published",
  "archived",
] as const;

/** Editorial quality review — separate from Lifecycle Safety outcomes. */
export type BlogReviewStatus =
  | "none"
  | "pending"
  | "changes_requested"
  | "approved"
  | "declined";

export type BlogCapability =
  | "author_applicant"
  | "author"
  | "trusted_author"
  | "editor"
  | "administrator";

export const BLOG_CAPABILITIES: readonly BlogCapability[] = [
  "author_applicant",
  "author",
  "trusted_author",
  "editor",
  "administrator",
] as const;

export type BlogCategoryId =
  | "conscious_existence"
  | "human_security"
  | "our_life";

export interface BlogCategory {
  readonly categoryId: BlogCategoryId;
  readonly slug: string;
  readonly name: string;
}

export const BLOG_CATEGORIES: readonly BlogCategory[] = [
  {
    categoryId: "conscious_existence",
    slug: "conscious-existence",
    name: "Conscious Existence",
  },
  {
    categoryId: "human_security",
    slug: "human-security",
    name: "Human Security",
  },
  {
    categoryId: "our_life",
    slug: "our-life",
    name: "Our Life",
  },
] as const;

export interface BlogCoverMedia {
  readonly mediaId: string;
  readonly mediaUrl: string;
  /**
   * Publishing Workspace Pack 05 — Author-provided image description.
   * Used as accessible alt text on public/cover surfaces when present.
   */
  readonly altText?: string;
}

/** Internal-only HUWS migration fields — never appear in public projections. */
export interface BlogPostLegacyMigration {
  readonly legacySourceUrl?: string;
  readonly legacyPublishedAt?: string;
  readonly legacyAuthorName?: string;
  readonly legacyImportedAt?: string;
}

export interface BlogPostReviewMetadata {
  readonly reviewStatus: BlogReviewStatus;
  readonly reviewedByParticipantId?: string;
  readonly reviewedAt?: string;
  readonly reviewNote?: string;
}

/** Editorial Review Pack 06 — bounded accountability history (not a ticketing feed). */
export type BlogEditorialHistoryAction =
  | "submitted"
  | "changes_requested"
  | "resubmitted"
  | "approved_published"
  | "published_after_safety_review"
  | "declined"
  | "withdrawn"
  | "archived";

export interface BlogEditorialHistoryEntry {
  readonly at: string;
  readonly actorParticipantId: string;
  readonly action: BlogEditorialHistoryAction;
  readonly reviewNote?: string;
  readonly safetyOutcome?: LifecycleSafetyOutcome | null;
  readonly publishedVersion?: number;
  /** Post `updatedAt` at decision time — supports stale-review detection. */
  readonly contentUpdatedAt?: string;
}

/**
 * Canonical BlogPost aggregate.
 * `content` is server-sanitized HTML (TipTap-compatible subset).
 */
export interface BlogPost {
  readonly postId: string;
  readonly authorParticipantId: string;
  /** Snapshot at create time for public author fallback. */
  readonly authorDisplayNameSnapshot: string;
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string;
  /** Sanitized HTML. Canonical original language body. */
  readonly content: string;
  readonly categoryId: BlogCategoryId;
  readonly tags: readonly string[];
  readonly coverMedia: BlogCoverMedia | null;
  readonly status: BlogPostStatus;
  readonly originalLanguage: LanguageCode;
  readonly safetyOutcome: LifecycleSafetyOutcome | null;
  readonly review: BlogPostReviewMetadata;
  readonly publishedVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly submittedAt?: string;
  readonly submittedByParticipantId?: string;
  readonly publishedAt?: string;
  readonly publishedByParticipantId?: string;
  readonly archivedAt?: string;
  readonly archivedByParticipantId?: string;
  /** Editorial Review Pack 06 — append-only review/publish accountability trail. */
  readonly editorialHistory?: readonly BlogEditorialHistoryEntry[];
  /** Internal only — omitted from public API. */
  readonly legacy?: BlogPostLegacyMigration;
}

export interface BlogAuthorWorkspacePost {
  readonly postId: string;
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string;
  readonly content: string;
  readonly categoryId: BlogCategoryId;
  readonly tags: readonly string[];
  readonly coverMedia: BlogCoverMedia | null;
  readonly status: BlogPostStatus;
  readonly originalLanguage: LanguageCode;
  readonly safetyOutcome: LifecycleSafetyOutcome | null;
  readonly review: BlogPostReviewMetadata;
  readonly publishedVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly submittedAt?: string;
  readonly publishedAt?: string;
  readonly archivedAt?: string;
  readonly editorialHistory?: readonly BlogEditorialHistoryEntry[];
}

/** Publishing Workspace Pack 05 — list row without full HTML body. */
export interface BlogAuthorWorkspacePostSummary {
  readonly postId: string;
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string;
  readonly categoryId: BlogCategoryId;
  readonly tags: readonly string[];
  readonly coverMedia: BlogCoverMedia | null;
  readonly status: BlogPostStatus;
  readonly originalLanguage: LanguageCode;
  readonly safetyOutcome: LifecycleSafetyOutcome | null;
  readonly review: BlogPostReviewMetadata;
  readonly publishedVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly submittedAt?: string;
  readonly publishedAt?: string;
  readonly archivedAt?: string;
}

export interface BlogAuthorWorkspacePostListResponse {
  readonly items: readonly BlogAuthorWorkspacePostSummary[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface PublicBlogPostListItem {
  readonly postId: string;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly coverImage: BlogCoverMedia | null;
  readonly author: PublicCommentAuthor;
  readonly publishedAt: string;
  readonly category: BlogCategory;
  readonly tags: readonly string[];
  /** Visible comment count (top-level + replies); batched, not N+1. */
  readonly commentCount: number;
}

/** Post-scoped publication reaction — not an Author quality score. */
export type BlogReactionKind = "helpful" | "not_helpful";

export interface PublicBlogPostDetail {
  readonly postId: string;
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string;
  readonly content: string;
  readonly coverImage: BlogCoverMedia | null;
  readonly author: PublicCommentAuthor;
  readonly publishedAt: string;
  readonly updatedAt: string;
  readonly category: BlogCategory;
  readonly tags: readonly string[];
  readonly originalLanguage: LanguageCode;
  /** Blog Interaction Pack 07 — real Helpful / Not Helpful totals. */
  readonly reactionCounts: {
    readonly helpful: number;
    readonly notHelpful: number;
  };
  /** Viewer reaction when authenticated; omitted/absent for guests. */
  readonly currentUserReaction?: BlogReactionKind | "none";
  /** Visible top-level + reply comments (pending/removed excluded). */
  readonly commentCount: number;
}

/** Blog Interaction Pack 07 — public visibility for Blog comments. */
export type BlogCommentStatus = "visible" | "pending_review" | "removed";

export const BLOG_COMMENT_STATUSES: readonly BlogCommentStatus[] = [
  "visible",
  "pending_review",
  "removed",
] as const;

export type BlogCommentModerationState = "none" | "flagged" | "reviewed";

/** Canonical BlogComment aggregate — separate from Initiative Discussion. */
export interface BlogComment {
  readonly commentId: string;
  readonly postId: string;
  readonly authorParticipantId: string;
  /** Snapshot at create time for public fallback. */
  readonly authorDisplayNameSnapshot: string;
  /** Plain text (safe line breaks only). */
  readonly content: string;
  readonly status: BlogCommentStatus;
  readonly moderationState: BlogCommentModerationState;
  readonly safetyOutcome: LifecycleSafetyOutcome | null;
  /** One-level replies only — parent must be a top-level comment on the same post. */
  readonly parentCommentId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly editedAt?: string;
  readonly deletedAt?: string;
  readonly removedByParticipantId?: string;
}

export interface PublicBlogComment {
  readonly commentId: string;
  readonly author: PublicCommentAuthor;
  readonly content: string;
  /** Empty when soft-deleted but retained for reply structure. */
  readonly removed: boolean;
  readonly createdAt: string;
  readonly editedAt?: string;
  readonly replies: readonly PublicBlogComment[];
}

export interface PublicBlogCommentListResponse {
  readonly comments: readonly PublicBlogComment[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
  readonly hasMore: boolean;
}

export interface BlogReaction {
  readonly reactionId: string;
  readonly postId: string;
  readonly actorParticipantId: string;
  readonly reaction: BlogReactionKind;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BlogReactionSummary {
  readonly helpful: number;
  readonly notHelpful: number;
  readonly currentUserReaction: BlogReactionKind | "none";
}

export interface PublicBlogPostListResponse {
  readonly items: readonly PublicBlogPostListItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/**
 * Author Access Pack 04 — application lifecycle vocabulary.
 * Active (duplicate-blocked) statuses: submitted | under_review | changes_requested.
 */
export type BlogAuthorApplicationStatus =
  | "submitted"
  | "under_review"
  | "changes_requested"
  | "approved"
  | "declined";

export const BLOG_AUTHOR_APPLICATION_STATUSES: readonly BlogAuthorApplicationStatus[] = [
  "submitted",
  "under_review",
  "changes_requested",
  "approved",
  "declined",
] as const;

export const BLOG_AUTHOR_APPLICATION_ACTIVE_STATUSES: readonly BlogAuthorApplicationStatus[] = [
  "submitted",
  "under_review",
  "changes_requested",
] as const;

/** Author Access Pack 04 — Blog Author application aggregate. */
export interface BlogAuthorApplication {
  readonly applicationId: string;
  readonly participantId: string;
  readonly status: BlogAuthorApplicationStatus;
  /** Why the Participant wants to contribute. */
  readonly motivation: string;
  /** Topics the applicant intends to write about. */
  readonly topics: string;
  /** Optional link or short reference to prior writing. */
  readonly previousWritingUrl?: string;
  /** Interest signal only — does not restrict later publication categories. */
  readonly preferredCategoryIds: readonly BlogCategoryId[];
  /** Applicant confirmed Safety + publishing standards. */
  readonly agreedToStandards: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly decidedAt?: string;
  readonly decidedByParticipantId?: string;
  /** Editor/Admin note for changes_requested or declined. */
  readonly reviewNote?: string;
}

/**
 * Capability-aware Workspace Authoring projection for the signed-in Participant.
 * Never accepts a client-supplied participantId — always resolved from JWT identity.
 */
export interface BlogAuthoringAccessState {
  readonly participantId: string;
  readonly capabilities: readonly BlogCapability[];
  readonly application: BlogAuthorApplication | null;
  /**
   * Derived presentation for `/workspace/authoring`.
   * One route; state-dependent UI.
   */
  readonly presentation:
    | "eligible_to_apply"
    | "application_submitted"
    | "application_under_review"
    | "application_changes_requested"
    | "application_declined"
    | "author"
    | "trusted_author"
    | "editor"
    | "administrator";
  readonly canApply: boolean;
  readonly canResubmit: boolean;
  /** Publishing Workspace Pack 05 — Authors and above. */
  readonly publishingWorkspaceHref: "/workspace/publishing" | null;
  readonly navLabel: "Become an Author" | "Publishing";
  /** Editorial Review Pack 06 — Editors/Administrators only. */
  readonly editorialReviewHref: "/workspace/editorial" | null;
}

/** Editorial Review Pack 06 — queue row with Author identity. */
export interface BlogEditorialQueueItem {
  readonly postId: string;
  readonly title: string;
  readonly slug: string;
  readonly excerpt: string;
  readonly categoryId: BlogCategoryId;
  readonly tags: readonly string[];
  readonly coverMedia: BlogCoverMedia | null;
  readonly status: BlogPostStatus;
  readonly safetyOutcome: LifecycleSafetyOutcome | null;
  readonly review: BlogPostReviewMetadata;
  readonly publishedVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly submittedAt?: string;
  readonly authorParticipantId: string;
  readonly authorDisplayName: string;
}

export interface BlogEditorialQueueResponse {
  readonly items: readonly BlogEditorialQueueItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/** Editorial review detail — workspace post + Author identity + history. */
export interface BlogEditorialReviewDetail extends BlogAuthorWorkspacePost {
  readonly authorParticipantId: string;
  readonly authorDisplayName: string;
}

export interface BlogCapabilityGrant {
  readonly participantId: string;
  readonly capabilities: readonly BlogCapability[];
  readonly updatedAt: string;
  readonly grantedByParticipantId?: string;
}
