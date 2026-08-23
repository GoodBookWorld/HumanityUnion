import type { LanguageCode } from "./language.js";
import type { LifecycleSafetyOutcome } from "./lifecycle-safety.js";
import type { PublicCommentAuthor } from "./initiative-comment.js";

/**
 * Blog Implementation Pack 02 — Publishing Domain core contracts.
 *
 * Persisted status vocabulary:
 * - draft
 * - submitted_for_review
 * - scheduled (Pack 13C — future publicationDate; not public until due)
 * - published
 * - archived
 *
 * Pack 01 "Preview" is a presentation/API mode, not a persisted status.
 * Pack 01 "Updated" is expressed via publishedVersion + updatedAt, not a status.
 * Pack 13B Admin soft-block is independent of status (`administrativelyBlocked`).
 */

export type BlogPostStatus =
  | "draft"
  | "submitted_for_review"
  | "scheduled"
  | "published"
  | "archived";

export const BLOG_POST_STATUSES: readonly BlogPostStatus[] = [
  "draft",
  "submitted_for_review",
  "scheduled",
  "published",
  "archived",
] as const;

/** Pack 13C — earliest allowed Author-chosen publication calendar date (inclusive). */
export const BLOG_PUBLICATION_DATE_MIN = "2022-01-01";

/**
 * Pack 13C — date-only publication dates are stored as noon UTC (`YYYY-MM-DDT12:00:00.000Z`)
 * so Author / Admin / public surfaces share the same calendar day without local midnight shifts.
 */

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
  /**
   * Canonical publication timestamp (Pack 13C).
   * Distinct from `createdAt` (platform record creation).
   * Used for public visibility (`published` + publishedAt <= now) and chronological sort.
   * Date-only Author input is stored as noon UTC for the chosen calendar day.
   */
  readonly publishedAt?: string;
  readonly publishedByParticipantId?: string;
  readonly archivedAt?: string;
  readonly archivedByParticipantId?: string;
  /** Editorial Review Pack 06 — append-only review/publish accountability trail. */
  readonly editorialHistory?: readonly BlogEditorialHistoryEntry[];
  /**
   * Pack 13B — Admin soft-block. Independent of `status`.
   * Blocked published posts remain stored but are excluded from public surfaces.
   */
  readonly administrativelyBlocked?: boolean;
  readonly administrativeBlockAuthority?: "ADMIN" | "EDITOR";
  readonly administrativelyBlockedAt?: string;
  readonly administrativelyBlockedByParticipantId?: string;
  readonly administrativeBlockReason?: string;
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
  /** Pack 13B — Admin soft-block (independent of status). */
  readonly administrativelyBlocked?: boolean;
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
  /** Pack 13B — Admin soft-block (independent of status). */
  readonly administrativelyBlocked?: boolean;
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
  /** Pack 14D — 1-based page when requested via page/pageSize. */
  readonly page?: number;
  readonly pageSize?: number;
  readonly totalPages?: number;
  /** Pack 14D — eligible public counts per category (visibility-filtered). */
  readonly categoryCounts?: readonly PublicBlogCategoryCount[];
  /** Pack 14D — latest 4 public publications (not page-filtered). */
  readonly latestPublications?: readonly PublicBlogPostListItem[];
  /**
   * Pack 14D — all-time views of the `/blog` index page only (not article pages).
   * Aggregate count; never includes visitor/session identity.
   */
  readonly blogIndexViews?: number;
}

/** Pack 14D — public category publication counts for discovery chart. */
export interface PublicBlogCategoryCount {
  readonly categoryId: BlogCategoryId;
  readonly name: string;
  readonly slug: string;
  readonly count: number;
}

/** Pack 13D — public Authors rail: authors with at least one visible publication. */
export interface PublicBlogAuthorDirectoryLatestPublication {
  readonly postId: string;
  readonly slug: string;
  readonly title: string;
  readonly publishedAt: string;
}

export interface PublicBlogAuthorDirectoryItem {
  readonly author: PublicCommentAuthor;
  readonly latestPublication: PublicBlogAuthorDirectoryLatestPublication;
}

export interface PublicBlogAuthorDirectoryResponse {
  readonly authors: readonly PublicBlogAuthorDirectoryItem[];
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
    | "administrator"
    /** Pack 13B — Author grant present but administratively blocked. */
    | "author_blocked";
  readonly canApply: boolean;
  readonly canResubmit: boolean;
  /** Publishing Workspace Pack 05 — Authors and above. */
  readonly publishingWorkspaceHref: "/workspace/publishing" | null;
  readonly navLabel: "Become an Author" | "Publishing";
  /** Editorial Review Pack 06 — Editors/Administrators only. */
  readonly editorialReviewHref: "/workspace/editorial" | null;
  /** Pack 13B — true when Author grant is administratively blocked. */
  readonly authorAdministrativelyBlocked?: boolean;
}

/**
 * Pack 13A — Admin Notification Center review modal projection.
 * Applicant Profile identity resolved live; no duplicated auth secrets.
 */
export interface AdminAuthorApplicationReview {
  readonly applicationId: string;
  readonly participantId: string;
  readonly displayName: string;
  readonly uniqueName?: string;
  readonly email: string;
  readonly avatarUrl?: string;
  readonly status: BlogAuthorApplicationStatus;
  readonly motivation: string;
  readonly topics: string;
  readonly previousWritingUrl?: string;
  readonly preferredCategoryIds: readonly BlogCategoryId[];
  readonly agreedToStandards: boolean;
  readonly submittedAt: string;
  readonly updatedAt: string;
  readonly decidedAt?: string;
  readonly reviewNote?: string;
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
  /**
   * Pack 13B — Admin Author soft-block. Independent of Participant auth status.
   * Grant (capabilities) remains; publishing mutations are denied while blocked.
   */
  readonly administrativelyBlocked?: boolean;
  readonly administrativeBlockAuthority?: "ADMIN" | "EDITOR";
  readonly administrativelyBlockedAt?: string;
  readonly administrativelyBlockedByParticipantId?: string;
  readonly administrativeBlockReason?: string;
}

/** Pack 13B — Admin Authors registry filter. */
export type AdminAuthorDirectoryStatusFilter = "active" | "blocked" | "all";

/** Pack 13B — Admin Publications registry filter. */
export type AdminPublicationDirectoryStatusFilter =
  | "all"
  | "draft"
  | "scheduled"
  | "published"
  | "blocked"
  | "submitted_for_review"
  | "archived";

export interface AdminAuthorDirectoryItem {
  readonly participantId: string;
  readonly displayName: string;
  readonly uniqueName?: string;
  readonly email: string;
  readonly avatarUrl?: string;
  readonly profileHref: string;
  readonly capabilities: readonly BlogCapability[];
  readonly status: "active" | "blocked";
  readonly publicationCount: number;
  readonly acceptedAt: string;
  readonly lastPublishedAt?: string;
  readonly administrativelyBlockedAt?: string;
  readonly administrativeBlockReason?: string;
}

export interface AdminAuthorDirectoryResponse {
  readonly authors: readonly AdminAuthorDirectoryItem[];
  readonly total: number;
  readonly activeCount: number;
  readonly blockedCount: number;
  readonly limit: number;
  readonly offset: number;
}

export interface AdminPublicationDirectoryItem {
  readonly postId: string;
  readonly title: string;
  readonly slug: string;
  readonly authorParticipantId: string;
  readonly authorDisplayName: string;
  readonly categoryId: BlogCategoryId;
  readonly categoryName: string;
  readonly status: BlogPostStatus;
  readonly administrativelyBlocked: boolean;
  readonly publishedAt?: string;
  readonly updatedAt: string;
  readonly createdAt: string;
  readonly publicHref: string | null;
  readonly editorialHref: string;
  readonly publishingHref: string;
  readonly administrativeBlockReason?: string;
}

export interface AdminPublicationDirectoryResponse {
  readonly publications: readonly AdminPublicationDirectoryItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface AdminPublishingBlockCommandResult {
  readonly targetId: string;
  readonly administrativelyBlocked: boolean;
  readonly auditId: string;
}

/** Pack 14A — Admin Pending Author Applications queue row. */
export interface AdminPendingAuthorApplicationItem {
  readonly applicationId: string;
  readonly participantId: string;
  readonly displayName: string;
  readonly uniqueName?: string;
  readonly email: string;
  readonly avatarUrl?: string;
  readonly profileHref?: string;
  readonly status: BlogAuthorApplicationStatus;
  readonly submittedAt: string;
  readonly updatedAt: string;
  readonly motivationPreview: string;
  readonly hasAdminReviewNotification: boolean;
  readonly structurallyInvalid: boolean;
}

export interface AdminPendingAuthorApplicationListResponse {
  readonly applications: readonly AdminPendingAuthorApplicationItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface AdminAuthorApplicationReconcileResult {
  readonly scannedCount: number;
  readonly notifiedApplicationCount: number;
  readonly notificationsCreated: number;
  readonly skippedAlreadyNotified: number;
  readonly skippedInvalid: number;
  readonly recoveredApplicationIds: readonly string[];
}

/** Pack 14B — Admin Pending Publication Review queue row (canonical review authority). */
export interface AdminPendingPublicationReviewItem {
  readonly postId: string;
  readonly title: string;
  readonly slug: string;
  readonly authorParticipantId: string;
  readonly authorDisplayName: string;
  readonly categoryId: BlogCategoryId;
  readonly categoryName: string;
  readonly status: BlogPostStatus;
  readonly reviewStatus: BlogReviewStatus;
  readonly submittedAt: string;
  readonly updatedAt: string;
  readonly publishedAt?: string;
  readonly administrativelyBlocked: boolean;
  readonly hasAdminReviewNotification: boolean;
  readonly editorialHref: string;
  readonly publishingHref: string;
}

export interface AdminPendingPublicationReviewListResponse {
  readonly publications: readonly AdminPendingPublicationReviewItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface AdminPublicationReviewReconcileResult {
  readonly scannedCount: number;
  readonly notifiedPublicationCount: number;
  readonly notificationsCreated: number;
  readonly skippedAlreadyNotified: number;
  readonly recoveredPostIds: readonly string[];
}
