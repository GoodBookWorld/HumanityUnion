"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import type { PublicBlogComment } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { HelperText } from "../../../design-system/components/HelperText";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import { useContextualActionReveal } from "../../auth/components/ContextualActionFeedback";
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

function CommentBody({
  comment,
  removedLabel,
}: {
  comment: PublicBlogComment;
  removedLabel: string;
}) {
  if (comment.removed) {
    return <p className="hu-caption blog-comments__removed">{removedLabel}</p>;
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
  const t = useTranslations("blogPublic.comments");
  const authStatus = useClientAuthStatus();
  const composerId = useId();
  const composerHelpId = useId();
  const [comments, setComments] = useState<readonly PublicBlogComment[]>([]);
  const [total, setTotal] = useState(initialCount);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<{ commentId: string; text: string } | null>(null);
  const [noticeCommentId, setNoticeCommentId] = useState<string | null>(null);
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
          // API_OPAQUE — surface formatted API/auth error copy as-is.
          setLoadError(formatAuthFormError(loadError));
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
    if (posting) {
      return;
    }
    setPosting(true);
    setComposerError(null);
    setNoticeCommentId(null);
    setPendingMessage(null);
    try {
      const result = await createPublicBlogComment({ slug, content });
      setContent("");
      setPostedFlash(true);
      setOwnedIds((current) => new Set([...current, result.commentId]));
      if (result.message) {
        // API_OPAQUE — pending-review copy comes from the API response.
        setPendingMessage(result.message);
      }
      await reload();
    } catch (postError: unknown) {
      // API_OPAQUE — surface formatted API/auth error copy as-is.
      setComposerError(formatAuthFormError(postError));
    } finally {
      setPosting(false);
    }
  }

  async function submitReply(parentCommentId: string) {
    if (posting) {
      return;
    }
    setPosting(true);
    setReplyError(null);
    setPendingMessage(null);
    try {
      const result = await createPublicBlogComment({
        slug,
        content: replyContent,
        parentCommentId,
      });
      setReplyContent("");
      setNoticeCommentId(parentCommentId);
      setReplyToId(null);
      setPostedFlash(true);
      setOwnedIds((current) => new Set([...current, result.commentId]));
      if (result.message) {
        // API_OPAQUE — pending-review copy comes from the API response.
        setPendingMessage(result.message);
      }
      await reload();
    } catch (postError: unknown) {
      // API_OPAQUE — surface formatted API/auth error copy as-is.
      setReplyError(formatAuthFormError(postError));
    } finally {
      setPosting(false);
    }
  }

  async function removeOwn(commentId: string) {
    setDeleteError(null);
    try {
      await deletePublicBlogComment({ slug, commentId });
      await reload();
    } catch (deleteError: unknown) {
      // API_OPAQUE — surface formatted API/auth error copy as-is.
      setDeleteError({ commentId, text: formatAuthFormError(deleteError) });
    }
  }

  return (
    <section className="blog-comments" id="comments" aria-labelledby="blog-comments-heading">
      <h2 id="blog-comments-heading" className="hu-heading-2">
        {total > 0 ? t("headingWithCount", { count: total }) : t("heading")}
      </h2>

      {loadError ? (
        <StatusBanner title={t("actionUnavailableTitle")} message={loadError} />
      ) : null}

      <div className="blog-comments__composer">
        {authStatus === "unauthenticated" ? (
          <p className="hu-body">
            {t.rich("signInPrompt", {
              link: (chunks) => <Link href="/login">{chunks}</Link>,
            })}
          </p>
        ) : (
          <>
            <label className="hu-label" htmlFor={composerId}>
              {t("composerLabel")}
            </label>
            <textarea
              id={composerId}
              className="hu-form-control"
              rows={4}
              maxLength={2000}
              value={content}
              disabled={posting || authStatus !== "authenticated"}
              aria-describedby={composerHelpId}
              placeholder={t("composerPlaceholder")}
              onChange={(event) => setContent(event.target.value)}
            />
            <HelperText id={composerHelpId}>{t("composerHelp")}</HelperText>
            <div className="hu-form-actions">
              <Button
                type="button"
                variant="primary"
                disabled={
                  posting || authStatus !== "authenticated" || content.trim().length === 0
                }
                onClick={() => void submitTopLevel()}
              >
                {posting ? t("posting") : t("postComment")}
              </Button>
            </div>
            {composerError || (noticeCommentId === null && (pendingMessage || postedFlash)) ? (
              <CommentActionNotice
                noticeKey={[composerError, pendingMessage, postedFlash].join(":")}
              >
                {composerError ? (
                  <StatusBanner title={t("actionUnavailableTitle")} message={composerError} />
                ) : null}
                {pendingMessage ? (
                  <StatusBanner title={t("awaitingReviewTitle")} message={pendingMessage} />
                ) : null}
                {postedFlash ? (
                  <p className="hu-caption" aria-live="polite">
                    {t("posted")}
                  </p>
                ) : null}
              </CommentActionNotice>
            ) : null}
          </>
        )}
      </div>

      {loading ? <p className="hu-body">{t("loading")}</p> : null}

      {!loading && comments.length === 0 ? (
        <p className="hu-body">{t("empty")}</p>
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
                {comment.editedAt ? <span className="hu-caption">{t("edited")}</span> : null}
              </div>
              <CommentBody comment={comment} removedLabel={t("removed")} />
              {!comment.removed && authStatus === "authenticated" ? (
                <div className="blog-comments__item-actions hu-form-actions">
                  <Button
                    type="button"
                    variant="tertiary"
                    aria-label={t("replyAria", { name: comment.author.displayName })}
                    onClick={() => {
                      setReplyToId(comment.commentId);
                      setReplyContent("");
                    }}
                  >
                    {t("reply")}
                  </Button>
                  {ownedIds.has(comment.commentId) ? (
                    <Button
                      type="button"
                      variant="tertiary"
                      onClick={() => void removeOwn(comment.commentId)}
                    >
                      {t("remove")}
                    </Button>
                  ) : null}
                </div>
              ) : null}
              {deleteError?.commentId === comment.commentId ? (
                <CommentActionNotice noticeKey={`delete:${comment.commentId}:${deleteError.text}`}>
                  <StatusBanner title={t("actionUnavailableTitle")} message={deleteError.text} />
                </CommentActionNotice>
              ) : null}
              {noticeCommentId === comment.commentId && (pendingMessage || postedFlash) ? (
                <CommentActionNotice
                  noticeKey={`notice:${comment.commentId}:${pendingMessage ?? ""}:${postedFlash}`}
                >
                  {pendingMessage ? (
                    <StatusBanner title={t("awaitingReviewTitle")} message={pendingMessage} />
                  ) : null}
                  {postedFlash ? (
                    <p className="hu-caption" aria-live="polite">
                      {t("posted")}
                    </p>
                  ) : null}
                </CommentActionNotice>
              ) : null}

              {replyToId === comment.commentId ? (
                <div className="blog-comments__reply-composer">
                  <label className="hu-label" htmlFor={`reply-${comment.commentId}`}>
                    {t("reply")}
                  </label>
                  <textarea
                    id={`reply-${comment.commentId}`}
                    className="hu-form-control"
                    rows={3}
                    maxLength={2000}
                    value={replyContent}
                    disabled={posting}
                    placeholder={t("replyPlaceholder")}
                    onChange={(event) => setReplyContent(event.target.value)}
                  />
                  <div className="hu-form-actions">
                    <Button
                      type="button"
                      variant="primary"
                      disabled={posting || replyContent.trim().length === 0}
                      onClick={() => void submitReply(comment.commentId)}
                    >
                      {posting ? t("posting") : t("postReply")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={posting}
                      onClick={() => setReplyToId(null)}
                    >
                      {t("cancel")}
                    </Button>
                  </div>
                  {replyError ? (
                    <CommentActionNotice noticeKey={`reply:${comment.commentId}:${replyError}`}>
                      <StatusBanner title={t("actionUnavailableTitle")} message={replyError} />
                    </CommentActionNotice>
                  ) : null}
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
                        {reply.editedAt ? <span className="hu-caption">{t("edited")}</span> : null}
                      </div>
                      <CommentBody comment={reply} removedLabel={t("removed")} />
                      {!reply.removed &&
                      authStatus === "authenticated" &&
                      ownedIds.has(reply.commentId) ? (
                        <div className="blog-comments__item-actions hu-form-actions">
                          <Button
                            type="button"
                            variant="tertiary"
                            onClick={() => void removeOwn(reply.commentId)}
                          >
                            {t("remove")}
                          </Button>
                        </div>
                      ) : null}
                      {deleteError?.commentId === reply.commentId ? (
                        <CommentActionNotice noticeKey={`delete:${reply.commentId}:${deleteError.text}`}>
                          <StatusBanner title={t("actionUnavailableTitle")} message={deleteError.text} />
                        </CommentActionNotice>
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

function CommentActionNotice({
  noticeKey,
  children,
}: {
  noticeKey: string;
  children: ReactNode;
}) {
  const ref = useContextualActionReveal(noticeKey);
  return (
    <div ref={ref} className="contextual-action-feedback">
      {children}
    </div>
  );
}
