import type { ClientSession } from "mongodb";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { deleteBlogCommentsByPostIds } from "../blog/persistence/blog-comment.repository.js";
import { deleteBlogPublicationDeliveriesByPostIds } from "../blog/persistence/blog-publication-delivery.repository.js";
import { deleteBlogReactionsByPostIds } from "../blog/persistence/blog-reaction.repository.js";
import {
  deleteBlogPostsByIds,
  findBlogPostById,
} from "../blog/persistence/blog.repository.js";
import { deleteBlogPostContentTranslations } from "../language/persistence/content-translation.repository.js";
import { getIntegrityMediaAuthorMessageStore } from "../integrity-media-author-messages/integrity-media-author-message.store.js";
import {
  deleteArticleDeliveriesByPublicationIds,
  listArticleDeliveriesForAuthorDeletion,
  type ArticleDeliveryRecord,
} from "./external-author-link.article-ingest.repository.js";
import { deleteProvisionAttemptsForAuthorDeletion } from "./external-author-link.provision.database.js";
import { deleteSsoGrantsForAuthorDeletion } from "./external-author-link.sso.database.js";
import type { AuthorDeletionRemovalCounts } from "./external-author-link.types.js";

export interface AuthorDeletionPostOwner {
  postId: string;
  authorParticipantId: string;
}

export async function listAuthorDeletionDeliveries(
  externalAuthorId: string,
  session?: ClientSession,
): Promise<ArticleDeliveryRecord[]> {
  return listArticleDeliveriesForAuthorDeletion(
    externalAuthorId,
    session ? { session } : undefined,
  );
}

export async function findAuthorDeletionPostOwners(
  postIds: readonly string[],
  session?: ClientSession,
): Promise<AuthorDeletionPostOwner[]> {
  if (postIds.length === 0) {
    return [];
  }
  if (session) {
    const documents = await getMongoCollection<{ postId?: string; authorParticipantId?: string }>(
      MONGO_COLLECTIONS.blogPosts,
    )
      .find(
        { postId: { $in: [...postIds] } },
        { session, projection: { _id: 0, postId: 1, authorParticipantId: 1 } },
      )
      .toArray();
    return documents.flatMap((document) => {
      if (typeof document.postId !== "string" || typeof document.authorParticipantId !== "string") {
        return [];
      }
      return [{ postId: document.postId, authorParticipantId: document.authorParticipantId }];
    });
  }

  const owners: AuthorDeletionPostOwner[] = [];
  for (const postId of postIds) {
    const post = await findBlogPostById(postId);
    if (post) {
      owners.push({ postId: post.postId, authorParticipantId: post.authorParticipantId });
    }
  }
  return owners;
}

/**
 * Deletes proven posts, their exclusive dependents, and author-scoped
 * integration rows. Link audits, disconnect events, and the link itself
 * are removed by the link store in the same transaction.
 */
export async function deleteProvenAuthorDeletionRecords(input: {
  externalAuthorId: string;
  postIds: readonly string[];
  publicationIds: readonly string[];
  session?: ClientSession;
}): Promise<
  Pick<
    AuthorDeletionRemovalCounts,
    | "posts"
    | "comments"
    | "reactions"
    | "translations"
    | "publicationDeliveries"
    | "articleDeliveries"
    | "provisionAttempts"
    | "ssoGrants"
    | "messages"
    | "messageAudits"
  >
> {
  const session = input.session;
  const sessionOptions = session ? { session } : undefined;
  const posts = await deleteBlogPostsByIds(input.postIds, sessionOptions);
  const comments = await deleteBlogCommentsByPostIds(input.postIds, sessionOptions);
  const reactions = await deleteBlogReactionsByPostIds(input.postIds, sessionOptions);
  const translations = await deleteBlogPostContentTranslations(input.postIds, sessionOptions);
  const publicationDeliveries = await deleteBlogPublicationDeliveriesByPostIds(
    input.postIds,
    sessionOptions,
  );
  const articleDeliveries = await deleteArticleDeliveriesByPublicationIds(
    input.publicationIds,
    sessionOptions,
  );
  const provisionAttempts = await deleteProvisionAttemptsForAuthorDeletion(
    input.externalAuthorId,
    session,
  );
  const ssoGrants = await deleteSsoGrantsForAuthorDeletion(input.externalAuthorId, session);
  const messages = await getIntegrityMediaAuthorMessageStore().deleteForAuthor(
    input.externalAuthorId,
    sessionOptions,
  );

  return {
    posts,
    comments,
    reactions,
    translations,
    publicationDeliveries,
    articleDeliveries,
    provisionAttempts,
    ssoGrants,
    messages: messages.messages,
    messageAudits: messages.audits,
  };
}
