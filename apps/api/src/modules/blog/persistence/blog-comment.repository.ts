import type { BlogComment, BlogCommentStatus } from "@hu/types";
import type { Filter } from "mongodb";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { BlogCommentConflictError } from "../blog-interaction.errors.js";

export interface BlogCommentMongoDocument extends BlogComment {
  _id?: string;
}

const memoryComments: BlogComment[] = [];

async function ensureReady(): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }
  await connectMongoClient();
}

function commentsCollection() {
  return getMongoCollection<BlogCommentMongoDocument>(MONGO_COLLECTIONS.blogComments);
}

function fromDoc(doc: BlogCommentMongoDocument): BlogComment {
  const { _id: _ignored, ...comment } = doc;
  return {
    ...comment,
    content: comment.content,
    moderationState: comment.moderationState ?? "none",
    safetyOutcome: comment.safetyOutcome ?? null,
  };
}

export async function insertBlogComment(comment: BlogComment): Promise<BlogComment> {
  await ensureReady();
  if (!isMongoConfigured()) {
    memoryComments.push({ ...comment });
    return { ...comment };
  }
  await commentsCollection().insertOne({ ...comment });
  return { ...comment };
}

export async function replaceBlogComment(comment: BlogComment): Promise<void> {
  await ensureReady();
  if (!isMongoConfigured()) {
    const index = memoryComments.findIndex((entry) => entry.commentId === comment.commentId);
    if (index < 0) {
      throw new BlogCommentConflictError("Comment not found for update.");
    }
    memoryComments[index] = { ...comment };
    return;
  }
  const result = await commentsCollection().replaceOne(
    { commentId: comment.commentId },
    { ...comment },
  );
  if (result.matchedCount === 0) {
    throw new BlogCommentConflictError("Comment not found for update.");
  }
}

export async function findBlogCommentById(commentId: string): Promise<BlogComment | null> {
  await ensureReady();
  if (!isMongoConfigured()) {
    return memoryComments.find((entry) => entry.commentId === commentId) ?? null;
  }
  const doc = await commentsCollection().findOne({ commentId });
  return doc ? fromDoc(doc) : null;
}

function isTopLevel(comment: BlogComment): boolean {
  return !comment.parentCommentId;
}

export async function listPublicTopLevelBlogComments(input: {
  postId: string;
  limit: number;
  offset: number;
}): Promise<{ items: BlogComment[]; total: number }> {
  await ensureReady();

  if (!isMongoConfigured()) {
    const replyParentIds = new Set(
      memoryComments
        .filter(
          (entry) =>
            entry.postId === input.postId &&
            entry.status === "visible" &&
            entry.parentCommentId,
        )
        .map((entry) => entry.parentCommentId!),
    );
    const all = memoryComments
      .filter(
        (entry) =>
          entry.postId === input.postId &&
          isTopLevel(entry) &&
          (entry.status === "visible" ||
            (entry.status === "removed" && replyParentIds.has(entry.commentId))),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return {
      total: all.length,
      items: all.slice(input.offset, input.offset + input.limit).map((entry) => ({ ...entry })),
    };
  }

  const collection = commentsCollection();
  const visibleReplies = await collection
    .find({
      postId: input.postId,
      status: "visible",
      parentCommentId: { $type: "string", $ne: "" },
    })
    .project({ parentCommentId: 1 })
    .toArray();
  const replyParentIds = [
    ...new Set(
      visibleReplies
        .map((doc) => doc.parentCommentId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  const filter = {
    postId: input.postId,
    $and: [
      {
        $or: [
          { parentCommentId: { $exists: false } },
          { parentCommentId: { $eq: null } },
          { parentCommentId: "" },
        ],
      },
      {
        $or: [
          { status: "visible" as BlogCommentStatus },
          {
            status: "removed" as BlogCommentStatus,
            commentId: { $in: replyParentIds.length > 0 ? replyParentIds : ["__none__"] },
          },
        ],
      },
    ],
  } as Filter<BlogCommentMongoDocument>;

  const [total, docs] = await Promise.all([
    collection.countDocuments(filter),
    collection
      .find(filter)
      .sort({ createdAt: 1 })
      .skip(input.offset)
      .limit(input.limit)
      .toArray(),
  ]);
  return { total, items: docs.map(fromDoc) };
}

/** Visible replies for parents; also returns removed parents' visible children for structure. */
export async function listVisibleRepliesForParents(input: {
  postId: string;
  parentCommentIds: readonly string[];
}): Promise<BlogComment[]> {
  if (input.parentCommentIds.length === 0) {
    return [];
  }
  await ensureReady();

  if (!isMongoConfigured()) {
    return memoryComments
      .filter(
        (entry) =>
          entry.postId === input.postId &&
          entry.status === "visible" &&
          entry.parentCommentId &&
          input.parentCommentIds.includes(entry.parentCommentId),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((entry) => ({ ...entry }));
  }

  const docs = await commentsCollection()
    .find({
      postId: input.postId,
      status: "visible",
      parentCommentId: { $in: [...input.parentCommentIds] },
    })
    .sort({ createdAt: 1 })
    .toArray();
  return docs.map(fromDoc);
}

/** Soft-deleted top-level comments that still have visible replies (structure preservation). */
export async function listRemovedTopLevelWithVisibleReplies(input: {
  postId: string;
  parentCommentIdsWithReplies: readonly string[];
}): Promise<BlogComment[]> {
  if (input.parentCommentIdsWithReplies.length === 0) {
    return [];
  }
  await ensureReady();

  if (!isMongoConfigured()) {
    return memoryComments
      .filter(
        (entry) =>
          entry.postId === input.postId &&
          entry.status === "removed" &&
          !entry.parentCommentId &&
          input.parentCommentIdsWithReplies.includes(entry.commentId),
      )
      .map((entry) => ({ ...entry }));
  }

  const docs = await commentsCollection()
    .find({
      postId: input.postId,
      status: "removed",
      commentId: { $in: [...input.parentCommentIdsWithReplies] },
      $or: [
        { parentCommentId: { $exists: false } },
        { parentCommentId: { $eq: null } },
        { parentCommentId: "" },
      ],
    } as Filter<BlogCommentMongoDocument>)
    .toArray();
  return docs.map(fromDoc);
}

export async function listPendingBlogCommentsByPost(postId: string): Promise<BlogComment[]> {
  await ensureReady();
  if (!isMongoConfigured()) {
    return memoryComments
      .filter((entry) => entry.postId === postId && entry.status === "pending_review")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((entry) => ({ ...entry }));
  }
  const docs = await commentsCollection()
    .find({ postId, status: "pending_review" })
    .sort({ createdAt: 1 })
    .limit(100)
    .toArray();
  return docs.map(fromDoc);
}

export async function countVisibleBlogComments(postId: string): Promise<number> {
  await ensureReady();
  if (!isMongoConfigured()) {
    return memoryComments.filter(
      (entry) => entry.postId === postId && entry.status === "visible",
    ).length;
  }
  return commentsCollection().countDocuments({ postId, status: "visible" });
}

export async function countVisibleBlogCommentsByPostIds(
  postIds: readonly string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (postIds.length === 0) {
    return result;
  }
  await ensureReady();

  if (!isMongoConfigured()) {
    for (const postId of postIds) {
      result.set(
        postId,
        memoryComments.filter((entry) => entry.postId === postId && entry.status === "visible")
          .length,
      );
    }
    return result;
  }

  const rows = await commentsCollection()
    .aggregate<{ _id: string; count: number }>([
      { $match: { postId: { $in: [...postIds] }, status: "visible" } },
      { $group: { _id: "$postId", count: { $sum: 1 } } },
    ])
    .toArray();

  for (const postId of postIds) {
    result.set(postId, 0);
  }
  for (const row of rows) {
    result.set(row._id, row.count);
  }
  return result;
}

export async function deleteBlogCommentsByPostIdsForTests(postIds: readonly string[]): Promise<void> {
  if (postIds.length === 0) {
    return;
  }
  for (let index = memoryComments.length - 1; index >= 0; index -= 1) {
    if (postIds.includes(memoryComments[index]!.postId)) {
      memoryComments.splice(index, 1);
    }
  }
  if (!isMongoConfigured()) {
    return;
  }
  await ensureReady();
  await commentsCollection().deleteMany({ postId: { $in: [...postIds] } });
}

export function resetBlogCommentsMemoryForTests(): void {
  memoryComments.length = 0;
}
