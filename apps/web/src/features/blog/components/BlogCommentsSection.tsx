"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import type { PublicBlogComment } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { HelperText } from "../../../design-system/components/HelperText";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import {
  createPublicBlogComment,
  deletePublicBlogComment,
  listPublicBlogComments,
} from "../interaction-api";
import { BlogAuthorInline } from "./BlogAuthorInline";

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function CommentBody({ comment }: { comment: PublicBlogComment }) {
  if (comment.removed) {
    return <p className="hu-caption blog-comments__removed">Comment removed</p>;
  }
  return <p className="hu-body blog-comments__content">{comment.content}</p>;
}

export function BlogCommentsSection({
  slug,
  initialCount,
}: {
  slug: string;
  initialCount: number;
}) {
  const authStatus = useClientAuthStatus();
  const composerId = useId();
  const composerHelpId = useId();
  const [comments, setComments] = useState<readonly PublicBlogComment[]>([]);
  const [total, setTotal] = useState(initialCount);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [postedFlash, setPostedFlash] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [ownedIds, setOwnedIds] = useState<ReadonlySet<string>>(new Set());

  async function reload() {
    const listing = await listPublicBlogComments({ slug, limit: 40, offset: 0 });
    setComments(listing.comments);
    setTotal(listing.total);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listPublicBlogComments({ slug, limit: 40, offset: 0 })
      .then((listing) => {
        if (!cancelled) {
          setComments(listing.comments);
          setTotal(listing.total);
          setLoading(false);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(formatAuthFormError(loadError));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!postedFlash) {
      return;
    }
    const timer = window.setTimeout(() => setPostedFlash(false), 1600);
    return () => window.clearTimeout(timer);
  }, [postedFlash]);

  async function submitTopLevel() {
    setPosting(true);
    setError(null);
    setPendingMessage(null);
    try {
      const result = await createPublicBlogComment({ slug, content });
      setContent("");
      setPostedFlash(true);
      setOwnedIds((current) => new Set([...current, result.commentId]));
      if (result.message) {
        setPendingMessage(result.message);
      }
      await reload();
    } catch (postError: unknown) {
      setError(formatAuthFormError(postError));
    } finally {
      setPosting(false);
    }
  }

  async function submitReply(parentCommentId: string) {
    setPosting(true);
    setError(null);
    setPendingMessage(null);
    try {
      const result = await createPublicBlogComment({
        slug,
        content: replyContent,
        parentCommentId,
      });
      setReplyContent("");
      setReplyToId(null);
      setPostedFlash(true);
      setOwnedIds((current) => new Set([...current, result.commentId]));
      if (result.message) {
        setPendingMessage(result.message);
      }
      await reload();
    } catch (postError: unknown) {
      setError(formatAuthFormError(postError));
    } finally {
      setPosting(false);
    }
  }

  async function removeOwn(commentId: string) {
    setError(null);
    try {
      await deletePublicBlogComment({ slug, commentId });
      await reload();
    } catch (deleteError: unknown) {
      setError(formatAuthFormError(deleteError));
    }
  }

  return (
    <section className="blog-comments" id="comments" aria-labelledby="blog-comments-heading">
      <h2 id="blog-comments-heading" className="hu-heading-2">
        Comments {total > 0 ? `(${total})` : ""}
      </h2>

      {pendingMessage ? (
        <StatusBanner title="This comment is awaiting review." message={pendingMessage} />
      ) : null}
      {error ? <StatusBanner title="Comment action unavailable" message={error} /> : null}
      {postedFlash ? (
        <p className="hu-caption" aria-live="polite">
          Posted
        </p>
      ) : null}

      <div className="blog-comments__composer">
        {authStatus === "unauthenticated" ? (
          <p className="hu-body">
            <Link href="/login">Sign in</Link> to post a comment.
          </p>
        ) : (
          <>
            <label className="hu-label" htmlFor={composerId}>
              Add a comment
            </label>
            <textarea
              id={composerId}
              className="hu-form-control"
              rows={4}
              maxLength={2000}
              value={content}
              disabled={posting || authStatus !== "authenticated"}
              aria-describedby={composerHelpId}
              onChange={(event) => setContent(event.target.value)}
            />
            <HelperText id={composerHelpId}>Plain text only. Replies are one level deep.</HelperText>
            <div className="hu-form-actions">
              <Button
                type="button"
                variant="primary"
                disabled={
                  posting || authStatus !== "authenticated" || content.trim().length === 0
                }
                onClick={() => void submitTopLevel()}
              >
                {posting ? "Posting…" : "Post Comment"}
              </Button>
            </div>
          </>
        )}
      </div>

      {loading ? <p className="hu-body">Loading comments…</p> : null}

      {!loading && comments.length === 0 ? (
        <p className="hu-body">No comments yet.</p>
      ) : null}

      <ol className="blog-comments__list">
        {comments.map((comment) => (
          <li
            key={comment.commentId}
            id={`comment-${comment.commentId}`}
            className="blog-comments__item"
          >
            <article>
              <div className="blog-comments__meta">
                <BlogAuthorInline author={comment.author} />
                <time className="hu-caption" dateTime={comment.createdAt}>
                  {formatDate(comment.createdAt)}
                </time>
                {comment.editedAt ? <span className="hu-caption">Edited</span> : null}
              </div>
              <CommentBody comment={comment} />
              {!comment.removed && authStatus === "authenticated" ? (
                <div className="blog-comments__item-actions hu-form-actions">
                  <Button
                    type="button"
                    variant="tertiary"
                    aria-label={`Reply to comment by ${comment.author.displayName}`}
                    onClick={() => {
                      setReplyToId(comment.commentId);
                      setReplyContent("");
                    }}
                  >
                    Reply
                  </Button>
                  {ownedIds.has(comment.commentId) ? (
                    <Button
                      type="button"
                      variant="tertiary"
                      onClick={() => void removeOwn(comment.commentId)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {replyToId === comment.commentId ? (
                <div className="blog-comments__reply-composer">
                  <label className="hu-label" htmlFor={`reply-${comment.commentId}`}>
                    Reply
                  </label>
                  <textarea
                    id={`reply-${comment.commentId}`}
                    className="hu-form-control"
                    rows={3}
                    maxLength={2000}
                    value={replyContent}
                    disabled={posting}
                    onChange={(event) => setReplyContent(event.target.value)}
                  />
                  <div className="hu-form-actions">
                    <Button
                      type="button"
                      variant="primary"
                      disabled={posting || replyContent.trim().length === 0}
                      onClick={() => void submitReply(comment.commentId)}
                    >
                      {posting ? "Posting…" : "Post Reply"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={posting}
                      onClick={() => setReplyToId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}

              {comment.replies.length > 0 ? (
                <ol className="blog-comments__replies">
                  {comment.replies.map((reply) => (
                    <li
                      key={reply.commentId}
                      id={`comment-${reply.commentId}`}
                      className="blog-comments__reply"
                    >
                      <div className="blog-comments__meta">
                        <BlogAuthorInline author={reply.author} />
                        <time className="hu-caption" dateTime={reply.createdAt}>
                          {formatDate(reply.createdAt)}
                        </time>
                        {reply.editedAt ? <span className="hu-caption">Edited</span> : null}
                      </div>
                      <CommentBody comment={reply} />
                      {!reply.removed &&
                      authStatus === "authenticated" &&
                      ownedIds.has(reply.commentId) ? (
                        <div className="blog-comments__item-actions hu-form-actions">
                          <Button
                            type="button"
                            variant="tertiary"
                            onClick={() => void removeOwn(reply.commentId)}
                          >
                            Remove
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : null}
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
