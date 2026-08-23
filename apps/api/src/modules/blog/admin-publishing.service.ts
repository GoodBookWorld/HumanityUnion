/**
 * Pack 13B — Admin Author / Publication directory + soft-block commands.
 */
import type {
  AdminAuthorDirectoryItem,
  AdminAuthorDirectoryResponse,
  AdminAuthorDirectoryStatusFilter,
  AdminPublicationDirectoryItem,
  AdminPublicationDirectoryResponse,
  AdminPublicationDirectoryStatusFilter,
  AdminPublishingBlockCommandResult,
  BlogCapabilityGrant,
  BlogPost,
} from "@hu/types";
import { BLOG_CATEGORIES, isModerationBlocked, resolveEffectiveModerationBlock } from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
  AdministrationValidationError,
} from "../administration/administration.errors.js";
import { record } from "../administration/audit.service.js";
import { findAuthUserById, findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { findMemberById } from "../member/infrastructure/member.repository.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import {
  BlogConflictError,
  BlogNotFoundError,
} from "./blog.errors.js";
import {
  emitBlogAuthorAccessBlockedNotification,
  emitBlogAuthorAccessRestoredNotification,
  emitBlogPublicationBlockedNotification,
  emitBlogPublicationRestoredNotification,
} from "./blog-admin-publishing-notifications.js";
import {
  countBlogPostsByAuthorParticipantId,
  findApprovedAuthorApplicationAcceptedAt,
  findBlogCapabilityGrant,
  findBlogPostById,
  findLatestPublishedAtForAuthor,
  listAdminBlogPublications,
  listBlogAuthorCapabilityGrants,
  replaceBlogPost,
  upsertBlogCapabilityGrant,
} from "./persistence/blog.repository.js";

async function assertAdminActor(userId: string): Promise<{
  userId: string;
  participantId: string;
}> {
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }
  const user = await findAuthUserById(userId);
  if (!user || user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
  return { userId: user.userId, participantId: user.memberId };
}

async function resolveAuthorIdentity(participantId: string): Promise<{
  displayName: string;
  uniqueName?: string;
  email: string;
  avatarUrl?: string;
  profileHref: string;
}> {
  const authUser = await findAuthUserByMemberId(participantId);
  let uniqueName: string | undefined;
  try {
    const member = await findMemberById(participantId);
    uniqueName = member?.uniqueName;
  } catch {
    // Member aggregate optional in some test paths.
  }
  const profile = authUser ? await findMemberProfileByUserId(authUser.userId) : null;
  const displayName =
    profile?.displayName?.trim() ||
    authUser?.displayName?.trim() ||
    authUser?.email ||
    participantId;

  return {
    displayName,
    ...(uniqueName ? { uniqueName } : {}),
    email: authUser?.email ?? "",
    ...(profile?.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
    profileHref: uniqueName
      ? `/participation/${encodeURIComponent(uniqueName)}`
      : `/admin/participants`,
  };
}

async function toAuthorDirectoryItem(
  grant: BlogCapabilityGrant,
): Promise<AdminAuthorDirectoryItem> {
  const identity = await resolveAuthorIdentity(grant.participantId);
  const [publicationCount, lastPublishedAt, acceptedAt] = await Promise.all([
    countBlogPostsByAuthorParticipantId(grant.participantId),
    findLatestPublishedAtForAuthor(grant.participantId),
    findApprovedAuthorApplicationAcceptedAt(grant.participantId),
  ]);

  const blocked = isModerationBlocked(grant);

  return {
    participantId: grant.participantId,
    displayName: identity.displayName,
    ...(identity.uniqueName ? { uniqueName: identity.uniqueName } : {}),
    email: identity.email,
    ...(identity.avatarUrl ? { avatarUrl: identity.avatarUrl } : {}),
    profileHref: identity.profileHref,
    capabilities: grant.capabilities,
    status: blocked ? "blocked" : "active",
    publicationCount,
    acceptedAt: acceptedAt ?? grant.updatedAt,
    ...(lastPublishedAt ? { lastPublishedAt } : {}),
    ...(grant.administrativelyBlockedAt
      ? { administrativelyBlockedAt: grant.administrativelyBlockedAt }
      : {}),
    ...(grant.administrativeBlockReason
      ? { administrativeBlockReason: grant.administrativeBlockReason }
      : {}),
  };
}

export async function listAdminAuthors(input: {
  actorUserId: string;
  status?: AdminAuthorDirectoryStatusFilter;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminAuthorDirectoryResponse> {
  await assertAdminActor(input.actorUserId);

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const status = input.status ?? "all";

  const listed = await listBlogAuthorCapabilityGrants({ status });
  const projected: AdminAuthorDirectoryItem[] = [];
  for (const grant of listed.items) {
    projected.push(await toAuthorDirectoryItem(grant));
  }

  const q = input.q?.trim().toLowerCase();
  const filtered = q
    ? projected.filter(
        (row) =>
          row.displayName.toLowerCase().includes(q) ||
          row.email.toLowerCase().includes(q) ||
          (row.uniqueName?.toLowerCase().includes(q) ?? false) ||
          row.participantId.toLowerCase().includes(q),
      )
    : projected;

  return {
    authors: filtered.slice(offset, offset + limit),
    total: filtered.length,
    activeCount: listed.activeCount,
    blockedCount: listed.blockedCount,
    limit,
    offset,
  };
}

export async function blockAdminAuthor(input: {
  actorUserId: string;
  participantId: string;
  reason?: string;
}): Promise<AdminPublishingBlockCommandResult> {
  const admin = await assertAdminActor(input.actorUserId);
  const grant = await findBlogCapabilityGrant(input.participantId);
  if (
    !grant ||
    !(grant.capabilities.includes("author") || grant.capabilities.includes("trusted_author"))
  ) {
    throw new BlogNotFoundError("Author grant not found.");
  }

  const existing = resolveEffectiveModerationBlock(grant);
  if (existing.isBlocked && existing.authority === "ADMIN") {
    throw new BlogConflictError("Author is already blocked.");
  }

  const reason = input.reason?.trim() || undefined;
  if (reason && reason.length > 500) {
    throw new AdministrationValidationError("Reason must be at most 500 characters.");
  }

  const now = new Date().toISOString();
  const updated: BlogCapabilityGrant = {
    ...grant,
    administrativelyBlocked: true,
    administrativeBlockAuthority: "ADMIN",
    administrativelyBlockedAt: now,
    administrativelyBlockedByParticipantId: admin.participantId,
    ...(reason ? { administrativeBlockReason: reason } : { administrativeBlockReason: undefined }),
    updatedAt: now,
  };
  await upsertBlogCapabilityGrant(updated);

  const audit = await record({
    actorParticipantId: admin.participantId,
    action: "author.block",
    targetType: "blog_capability_grant",
    targetId: grant.participantId,
    reason,
    beforeSummary: existing.isBlocked
      ? `administrativelyBlocked=true;authority=${existing.authority}`
      : "administrativelyBlocked=false",
    afterSummary: "administrativelyBlocked=true;authority=ADMIN",
  });

  await emitBlogAuthorAccessBlockedNotification({
    participantId: grant.participantId,
  });

  return {
    targetId: grant.participantId,
    administrativelyBlocked: true,
    auditId: audit.auditId,
  };
}

export async function unblockAdminAuthor(input: {
  actorUserId: string;
  participantId: string;
  reason?: string;
}): Promise<AdminPublishingBlockCommandResult> {
  const admin = await assertAdminActor(input.actorUserId);
  const grant = await findBlogCapabilityGrant(input.participantId);
  if (
    !grant ||
    !(grant.capabilities.includes("author") || grant.capabilities.includes("trusted_author"))
  ) {
    throw new BlogNotFoundError("Author grant not found.");
  }

  const existing = resolveEffectiveModerationBlock(grant);
  if (!existing.isBlocked) {
    throw new BlogConflictError("Author is not blocked.");
  }

  const now = new Date().toISOString();
  const updated: BlogCapabilityGrant = {
    participantId: grant.participantId,
    capabilities: grant.capabilities,
    updatedAt: now,
    grantedByParticipantId: grant.grantedByParticipantId,
  };
  await upsertBlogCapabilityGrant(updated);

  const audit = await record({
    actorParticipantId: admin.participantId,
    action: "author.unblock",
    targetType: "blog_capability_grant",
    targetId: grant.participantId,
    reason: input.reason?.trim() || undefined,
    beforeSummary: `administrativelyBlocked=true;authority=${existing.authority}`,
    afterSummary: "administrativelyBlocked=false",
  });

  await emitBlogAuthorAccessRestoredNotification({
    participantId: grant.participantId,
  });

  return {
    targetId: grant.participantId,
    administrativelyBlocked: false,
    auditId: audit.auditId,
  };
}

function categoryName(categoryId: BlogPost["categoryId"]): string {
  return BLOG_CATEGORIES.find((category) => category.categoryId === categoryId)?.name ?? categoryId;
}

function toPublicationDirectoryItem(post: BlogPost): AdminPublicationDirectoryItem {
  const blocked = post.administrativelyBlocked === true;
  return {
    postId: post.postId,
    title: post.title,
    slug: post.slug,
    authorParticipantId: post.authorParticipantId,
    authorDisplayName: post.authorDisplayNameSnapshot,
    categoryId: post.categoryId,
    categoryName: categoryName(post.categoryId),
    status: post.status,
    administrativelyBlocked: blocked,
    ...(post.publishedAt ? { publishedAt: post.publishedAt } : {}),
    updatedAt: post.updatedAt,
    createdAt: post.createdAt,
    publicHref:
      post.status === "published" && !blocked
        ? `/blog/${encodeURIComponent(post.slug)}`
        : null,
    editorialHref: `/workspace/editorial/${encodeURIComponent(post.postId)}`,
    publishingHref: `/workspace/publishing/${encodeURIComponent(post.postId)}`,
    ...(post.administrativeBlockReason
      ? { administrativeBlockReason: post.administrativeBlockReason }
      : {}),
  };
}

export async function listAdminPublications(input: {
  actorUserId: string;
  status?: AdminPublicationDirectoryStatusFilter;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminPublicationDirectoryResponse> {
  await assertAdminActor(input.actorUserId);

  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);

  const listed = await listAdminBlogPublications({
    statusFilter: input.status ?? "all",
    q: input.q,
    limit,
    offset,
  });

  return {
    publications: listed.items.map(toPublicationDirectoryItem),
    total: listed.total,
    limit,
    offset,
  };
}

export async function blockAdminPublication(input: {
  actorUserId: string;
  postId: string;
  reason?: string;
}): Promise<AdminPublishingBlockCommandResult> {
  const admin = await assertAdminActor(input.actorUserId);
  const post = await findBlogPostById(input.postId);
  if (!post) {
    throw new BlogNotFoundError("Publication not found.");
  }

  const existing = resolveEffectiveModerationBlock(post);
  if (existing.isBlocked && existing.authority === "ADMIN") {
    throw new BlogConflictError("Publication is already blocked.");
  }

  const reason = input.reason?.trim() || undefined;
  if (reason && reason.length > 500) {
    throw new AdministrationValidationError("Reason must be at most 500 characters.");
  }

  const now = new Date().toISOString();
  const updated: BlogPost = {
    ...post,
    administrativelyBlocked: true,
    administrativeBlockAuthority: "ADMIN",
    administrativelyBlockedAt: now,
    administrativelyBlockedByParticipantId: admin.participantId,
    ...(reason ? { administrativeBlockReason: reason } : { administrativeBlockReason: undefined }),
    updatedAt: now,
  };
  await replaceBlogPost(updated);

  const audit = await record({
    actorParticipantId: admin.participantId,
    action: "publication.block",
    targetType: "blog_post",
    targetId: post.postId,
    reason,
    beforeSummary: existing.isBlocked
      ? `administrativelyBlocked=true;authority=${existing.authority}`
      : "administrativelyBlocked=false",
    afterSummary: "administrativelyBlocked=true;authority=ADMIN",
  });

  await emitBlogPublicationBlockedNotification({
    participantId: post.authorParticipantId,
    postId: post.postId,
    title: post.title,
  });

  return {
    targetId: post.postId,
    administrativelyBlocked: true,
    auditId: audit.auditId,
  };
}

export async function unblockAdminPublication(input: {
  actorUserId: string;
  postId: string;
  reason?: string;
}): Promise<AdminPublishingBlockCommandResult> {
  const admin = await assertAdminActor(input.actorUserId);
  const post = await findBlogPostById(input.postId);
  if (!post) {
    throw new BlogNotFoundError("Publication not found.");
  }

  const existing = resolveEffectiveModerationBlock(post);
  if (!existing.isBlocked) {
    throw new BlogConflictError("Publication is not blocked.");
  }

  const now = new Date().toISOString();
  const {
    administrativelyBlocked: _b,
    administrativeBlockAuthority: _a,
    administrativelyBlockedAt: _at,
    administrativelyBlockedByParticipantId: _by,
    administrativeBlockReason: _r,
    ...cleared
  } = post;

  const updated: BlogPost = {
    ...cleared,
    updatedAt: now,
  };
  await replaceBlogPost(updated);

  const audit = await record({
    actorParticipantId: admin.participantId,
    action: "publication.unblock",
    targetType: "blog_post",
    targetId: post.postId,
    reason: input.reason?.trim() || undefined,
    beforeSummary: `administrativelyBlocked=true;authority=${existing.authority}`,
    afterSummary: "administrativelyBlocked=false",
  });

  await emitBlogPublicationRestoredNotification({
    participantId: post.authorParticipantId,
    postId: post.postId,
    title: post.title,
  });

  return {
    targetId: post.postId,
    administrativelyBlocked: false,
    auditId: audit.auditId,
  };
}

/** Pack 13B — true when Author grant is soft-blocked (publishing mutations denied). */
export async function isBlogAuthorAdministrativelyBlocked(
  participantId: string,
): Promise<boolean> {
  const grant = await findBlogCapabilityGrant(participantId);
  return isModerationBlocked(grant);
}
