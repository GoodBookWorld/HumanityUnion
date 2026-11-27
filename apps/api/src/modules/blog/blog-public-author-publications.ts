import type { PublicAuthorPublicationCard, PublicAuthorPublicationListResponse } from "@hu/types";

import { findAuthUserById } from "../auth/auth-user.repository.js";
import {
  MemberProfileAccessDeniedError,
  MemberProfileNotFoundError,
} from "../member-profile/member-profile.errors.js";
import { toPublicMemberProfile } from "../member-profile/member-profile.projection.js";
import { findMemberProfileByPublicName } from "../member-profile/member-profile.repository.js";
import { displayedBlogCoverMedia } from "./blog-cover-media.js";
import { ensureBlogCategoriesSeeded, getBlogCategoryById } from "./blog-categories.js";
import { BlogValidationError } from "./blog.errors.js";
import { assertNoInternalBlogFields } from "./blog.projection.js";
import { listPublicAuthorPublicationRecords } from "./persistence/blog.repository.js";

export const PUBLIC_AUTHOR_PUBLICATION_DEFAULT_LIMIT = 10;
export const PUBLIC_AUTHOR_PUBLICATION_MAX_LIMIT = 20;
/**
 * Offset pagination stays in place for this release. Callers may request an
 * offset from 0 through 2000. The default page size is 10 and the largest
 * accepted page size is 20. hasMore is false when the next page would start
 * above 2000, so a full final page is not advertised as another request the
 * API would reject.
 */
export const PUBLIC_AUTHOR_PUBLICATION_MAX_OFFSET = 2000;

export function publicAuthorPublicationHasAnotherSupportedPage(input: {
  offset: number;
  returnedCount: number;
  repositoryHasMore: boolean;
}): boolean {
  if (!input.repositoryHasMore || input.returnedCount < 1) {
    return false;
  }
  return input.offset + input.returnedCount <= PUBLIC_AUTHOR_PUBLICATION_MAX_OFFSET;
}

export function parsePublicAuthorPublicationPage(input: {
  limit?: number;
  offset?: number;
}): { limit: number; offset: number } {
  const limit = input.limit === undefined ? PUBLIC_AUTHOR_PUBLICATION_DEFAULT_LIMIT : input.limit;
  const offset = input.offset === undefined ? 0 : input.offset;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > PUBLIC_AUTHOR_PUBLICATION_MAX_LIMIT
  ) {
    throw new BlogValidationError("Publication limit must be an integer from 1 to 20.");
  }
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > PUBLIC_AUTHOR_PUBLICATION_MAX_OFFSET
  ) {
    throw new BlogValidationError("Publication offset must be an integer from 0 to 2000.");
  }
  return { limit, offset };
}

/**
 * Resolves the canonical authorParticipantId for an active public profile.
 * Uses the same visibility gate as the public member profile. The id is
 * not returned to the caller.
 */
export async function resolvePublicAuthorParticipantId(input: {
  publicName: string;
  viewerIsAuthenticated: boolean;
  viewerUserId?: string;
}): Promise<string> {
  const publicName = input.publicName.trim();
  if (!publicName) {
    throw new MemberProfileNotFoundError();
  }

  const profile = await findMemberProfileByPublicName(publicName);
  if (!profile || profile.status === "closed") {
    throw new MemberProfileNotFoundError();
  }

  const visible = toPublicMemberProfile(profile, {
    viewerIsAuthenticated: input.viewerIsAuthenticated,
    viewerIsOwner: Boolean(input.viewerUserId && input.viewerUserId === profile.userId),
  });
  if (!visible) {
    throw new MemberProfileAccessDeniedError();
  }

  const authUser = await findAuthUserById(profile.userId);
  const authorParticipantId = authUser?.memberId?.trim() ?? "";
  if (!authorParticipantId) {
    throw new MemberProfileNotFoundError();
  }
  return authorParticipantId;
}

export async function listPublicAuthorPublicationsByPublicName(input: {
  publicName: string;
  limit?: number;
  offset?: number;
  viewerIsAuthenticated: boolean;
  viewerUserId?: string;
}): Promise<PublicAuthorPublicationListResponse> {
  const page = parsePublicAuthorPublicationPage({
    limit: input.limit,
    offset: input.offset,
  });
  const authorParticipantId = await resolvePublicAuthorParticipantId({
    publicName: input.publicName,
    viewerIsAuthenticated: input.viewerIsAuthenticated,
    viewerUserId: input.viewerUserId,
  });

  await ensureBlogCategoriesSeeded();
  const listed = await listPublicAuthorPublicationRecords({
    authorParticipantId,
    limit: page.limit,
    offset: page.offset,
  });

  const items: PublicAuthorPublicationCard[] = listed.items.map((post) => {
    const category = getBlogCategoryById(post.categoryId);
    return {
      postId: post.postId,
      slug: post.slug,
      title: post.title,
      coverImage: displayedBlogCoverMedia(post),
      ...(category ? { category } : {}),
      publishedAt: post.publishedAt,
    };
  });

  const response: PublicAuthorPublicationListResponse = {
    items,
    limit: page.limit,
    offset: page.offset,
    hasMore: publicAuthorPublicationHasAnotherSupportedPage({
      offset: page.offset,
      returnedCount: items.length,
      repositoryHasMore: listed.hasMore,
    }),
  };
  assertNoInternalBlogFields(response);
  return response;
}
