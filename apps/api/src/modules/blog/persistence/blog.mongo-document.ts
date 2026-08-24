import type {
  BlogAuthorApplication,
  BlogCapabilityGrant,
  BlogCoverMedia,
  BlogEditorialHistoryEntry,
  BlogPost,
  BlogPostLegacyMigration,
  BlogPostReviewMetadata,
  ModerationBlockAuthority,
} from "@hu/types";

export interface BlogPostMongoDocument {
  postId: string;
  authorParticipantId: string;
  authorDisplayNameSnapshot: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  categoryId: BlogPost["categoryId"];
  tags: string[];
  coverMedia: BlogCoverMedia | null;
  status: BlogPost["status"];
  originalLanguage: string;
  safetyOutcome: BlogPost["safetyOutcome"];
  review: BlogPostReviewMetadata;
  publishedVersion: number;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  submittedByParticipantId?: string;
  publishedAt?: string;
  publishedByParticipantId?: string;
  archivedAt?: string;
  archivedByParticipantId?: string;
  editorialHistory?: BlogEditorialHistoryEntry[];
  administrativelyBlocked?: boolean;
  administrativeBlockAuthority?: ModerationBlockAuthority;
  administrativelyBlockedAt?: string;
  administrativelyBlockedByParticipantId?: string;
  administrativeBlockReason?: string;
  legacy?: BlogPostLegacyMigration;
  /** Pack 16C */
  optimization?: BlogPost["optimization"];
}

export interface BlogCapabilityGrantMongoDocument {
  participantId: string;
  capabilities: string[];
  updatedAt: string;
  grantedByParticipantId?: string;
  administrativelyBlocked?: boolean;
  administrativeBlockAuthority?: ModerationBlockAuthority;
  administrativelyBlockedAt?: string;
  administrativelyBlockedByParticipantId?: string;
  administrativeBlockReason?: string;
  /** Pack 16G — Trusted Publishing; omit/false = OFF. */
  publishWithoutManualReview?: boolean;
}

export interface BlogAuthorApplicationMongoDocument {
  applicationId: string;
  participantId: string;
  status: BlogAuthorApplication["status"];
  motivation: string;
  topics: string;
  previousWritingUrl?: string;
  preferredCategoryIds: BlogAuthorApplication["preferredCategoryIds"][number][];
  agreedToStandards: boolean;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string;
  decidedByParticipantId?: string;
  reviewNote?: string;
  /** Pack 02 seam field — migrated into motivation when reading legacy docs. */
  note?: string;
}

function pickModerationBlockFields(source: {
  administrativelyBlocked?: boolean;
  administrativeBlockAuthority?: ModerationBlockAuthority;
  administrativelyBlockedAt?: string;
  administrativelyBlockedByParticipantId?: string;
  administrativeBlockReason?: string;
}): {
  administrativelyBlocked?: boolean;
  administrativeBlockAuthority?: ModerationBlockAuthority;
  administrativelyBlockedAt?: string;
  administrativelyBlockedByParticipantId?: string;
  administrativeBlockReason?: string;
} {
  if (source.administrativelyBlocked !== true) {
    return {};
  }
  return {
    administrativelyBlocked: true,
    ...(source.administrativeBlockAuthority
      ? { administrativeBlockAuthority: source.administrativeBlockAuthority }
      : {}),
    ...(source.administrativelyBlockedAt
      ? { administrativelyBlockedAt: source.administrativelyBlockedAt }
      : {}),
    ...(source.administrativelyBlockedByParticipantId
      ? {
          administrativelyBlockedByParticipantId:
            source.administrativelyBlockedByParticipantId,
        }
      : {}),
    ...(source.administrativeBlockReason
      ? { administrativeBlockReason: source.administrativeBlockReason }
      : {}),
  };
}

export function toBlogPostMongoDocument(post: BlogPost): BlogPostMongoDocument {
  return {
    postId: post.postId,
    authorParticipantId: post.authorParticipantId,
    authorDisplayNameSnapshot: post.authorDisplayNameSnapshot,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    categoryId: post.categoryId,
    tags: [...post.tags],
    coverMedia: post.coverMedia ? { ...post.coverMedia } : null,
    status: post.status,
    originalLanguage: post.originalLanguage,
    safetyOutcome: post.safetyOutcome,
    review: { ...post.review },
    publishedVersion: post.publishedVersion,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    submittedAt: post.submittedAt,
    submittedByParticipantId: post.submittedByParticipantId,
    publishedAt: post.publishedAt,
    publishedByParticipantId: post.publishedByParticipantId,
    archivedAt: post.archivedAt,
    archivedByParticipantId: post.archivedByParticipantId,
    editorialHistory: post.editorialHistory
      ? post.editorialHistory.map((entry) => ({ ...entry }))
      : undefined,
    ...pickModerationBlockFields(post),
    legacy: post.legacy ? { ...post.legacy } : undefined,
    ...(post.optimization ? { optimization: structuredCloneOptimization(post.optimization) } : {}),
  };
}

function structuredCloneOptimization(
  optimization: NonNullable<BlogPost["optimization"]>,
): NonNullable<BlogPost["optimization"]> {
  return {
    ...(optimization.seoTitle ? { seoTitle: optimization.seoTitle } : {}),
    ...(optimization.seoDescription ? { seoDescription: optimization.seoDescription } : {}),
    ...(optimization.socialTitle ? { socialTitle: optimization.socialTitle } : {}),
    ...(optimization.socialDescription
      ? { socialDescription: optimization.socialDescription }
      : {}),
    ...(optimization.socialImage !== undefined
      ? {
          socialImage: optimization.socialImage ? { ...optimization.socialImage } : null,
        }
      : {}),
    ...(optimization.distribution
      ? {
          distribution: {
            huSocialShare: optimization.distribution.huSocialShare,
            authorExternalAccounts: optimization.distribution.authorExternalAccounts.map(
              (account) => ({ ...account }),
            ),
          },
        }
      : {}),
  };
}

export function fromBlogPostMongoDocument(doc: BlogPostMongoDocument): BlogPost {
  return {
    postId: doc.postId,
    authorParticipantId: doc.authorParticipantId,
    authorDisplayNameSnapshot: doc.authorDisplayNameSnapshot,
    title: doc.title,
    slug: doc.slug,
    excerpt: doc.excerpt,
    content: doc.content,
    categoryId: doc.categoryId,
    tags: [...(doc.tags ?? [])],
    coverMedia: doc.coverMedia ? { ...doc.coverMedia } : null,
    status: doc.status,
    originalLanguage: doc.originalLanguage,
    safetyOutcome: doc.safetyOutcome ?? null,
    review: {
      reviewStatus: doc.review?.reviewStatus ?? "none",
      reviewedByParticipantId: doc.review?.reviewedByParticipantId,
      reviewedAt: doc.review?.reviewedAt,
      reviewNote: doc.review?.reviewNote,
    },
    publishedVersion: doc.publishedVersion ?? 0,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    submittedAt: doc.submittedAt,
    submittedByParticipantId: doc.submittedByParticipantId,
    publishedAt: doc.publishedAt,
    publishedByParticipantId: doc.publishedByParticipantId,
    archivedAt: doc.archivedAt,
    archivedByParticipantId: doc.archivedByParticipantId,
    editorialHistory: doc.editorialHistory?.map((entry) => ({ ...entry })),
    ...pickModerationBlockFields(doc),
    legacy: doc.legacy ? { ...doc.legacy } : undefined,
    ...(doc.optimization ? { optimization: structuredCloneOptimization(doc.optimization) } : {}),
  };
}

export function toBlogCapabilityGrantMongoDocument(
  grant: BlogCapabilityGrant,
): BlogCapabilityGrantMongoDocument {
  return {
    participantId: grant.participantId,
    capabilities: [...grant.capabilities],
    updatedAt: grant.updatedAt,
    grantedByParticipantId: grant.grantedByParticipantId,
    ...pickModerationBlockFields(grant),
    ...(grant.publishWithoutManualReview === true
      ? { publishWithoutManualReview: true }
      : {}),
  };
}

export function fromBlogCapabilityGrantMongoDocument(
  doc: BlogCapabilityGrantMongoDocument,
): BlogCapabilityGrant {
  return {
    participantId: doc.participantId,
    capabilities: [...(doc.capabilities ?? [])] as BlogCapabilityGrant["capabilities"],
    updatedAt: doc.updatedAt,
    grantedByParticipantId: doc.grantedByParticipantId,
    ...pickModerationBlockFields(doc),
    ...(doc.publishWithoutManualReview === true
      ? { publishWithoutManualReview: true }
      : {}),
  };
}

export function toBlogAuthorApplicationMongoDocument(
  application: BlogAuthorApplication,
): BlogAuthorApplicationMongoDocument {
  return {
    applicationId: application.applicationId,
    participantId: application.participantId,
    status: application.status,
    motivation: application.motivation,
    topics: application.topics,
    previousWritingUrl: application.previousWritingUrl,
    preferredCategoryIds: [...application.preferredCategoryIds],
    agreedToStandards: application.agreedToStandards,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
    decidedAt: application.decidedAt,
    decidedByParticipantId: application.decidedByParticipantId,
    reviewNote: application.reviewNote,
  };
}

export function fromBlogAuthorApplicationMongoDocument(
  doc: BlogAuthorApplicationMongoDocument,
): BlogAuthorApplication {
  const legacyNote = typeof doc.note === "string" ? doc.note.trim() : "";
  const motivation =
    typeof doc.motivation === "string" && doc.motivation.trim().length > 0
      ? doc.motivation
      : legacyNote;

  // Pack 02 used status "pending"; Pack 04 maps it to "submitted".
  const rawStatus = doc.status as BlogAuthorApplication["status"] | "pending";
  const status: BlogAuthorApplication["status"] =
    rawStatus === "pending" ? "submitted" : doc.status;

  return {
    applicationId: doc.applicationId,
    participantId: doc.participantId,
    status,
    motivation,
    topics: typeof doc.topics === "string" ? doc.topics : "",
    previousWritingUrl: doc.previousWritingUrl,
    preferredCategoryIds: Array.isArray(doc.preferredCategoryIds)
      ? [...doc.preferredCategoryIds]
      : [],
    agreedToStandards: doc.agreedToStandards === true,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    decidedAt: doc.decidedAt,
    decidedByParticipantId: doc.decidedByParticipantId,
    reviewNote: doc.reviewNote,
  };
}
