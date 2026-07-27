"use client";

import { useEffect, useState } from "react";

import type { PublicInitiativeDiscussionComment } from "@hu/types";

import { Button, HuFeedbackMessage } from "../../../design-system";
import { getMe } from "../../auth/auth-api";
import { resolveSafeReturnTo } from "../../auth/lib/resolve-safe-return-to";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import {
  fetchInitiativeComments,
  postInitiativeComment,
  updateInitiativeCommentReaction,
} from "../api";

interface PublicDiscussionPanelProps {
  initiativeId: string;
  initialComments?: PublicInitiativeDiscussionComment[];
  commentCount?: number;
  hasMoreComments?: boolean;
  panelId?: string;
  scopeLabel?: string;
}

const DRAFT_STORAGE_PREFIX = "pie-discussion-draft:";

function buildDiscussionReturnTo(initiativeId: string): string {
  return resolveSafeReturnTo(
    `/initiatives/public/${encodeURIComponent(initiativeId)}#discussion`,
    "/",
  );
}

function formatCommentDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function applyReactionChange(
  comment: PublicInitiativeDiscussionComment,
  nextReaction: "like" | "dislike" | "none",
): PublicInitiativeDiscussionComment {
  const previousReaction = comment.currentUserReaction ?? "none";
  let likes = comment.likes;
  let dislikes = comment.dislikes;

  if (previousReaction === "like") {
    likes = Math.max(0, likes - 1);
  }

  if (previousReaction === "dislike") {
    dislikes = Math.max(0, dislikes - 1);
  }

  if (nextReaction === "like") {
    likes += 1;
  }

  if (nextReaction === "dislike") {
    dislikes += 1;
  }

  return {
    ...comment,
    likes,
    dislikes,
    currentUserReaction: nextReaction,
  };
}

function CommentReactionControls({
  initiativeId,
  comment,
  authStatus,
  returnTo,
  onUpdated,
}: {
  initiativeId: string;
  comment: PublicInitiativeDiscussionComment;
  authStatus: ReturnType<typeof useClientAuthStatus>;
  returnTo: string;
  onUpdated: (comment: PublicInitiativeDiscussionComment) => void;
}) {
  const [busy, setBusy] = useState(false);
  const currentReaction = comment.currentUserReaction ?? "none";

  async function handleReaction(nextReaction: "like" | "dislike" | "none"): Promise<void> {
    if (authStatus !== "authenticated") {
      return;
    }

    setBusy(true);

    try {
      await updateInitiativeCommentReaction(initiativeId, comment.commentId, nextReaction);
      onUpdated(applyReactionChange(comment, nextReaction));
    } catch {
      // Keep comment intact if reaction fails.
    } finally {
      setBusy(false);
    }
  }

  if (authStatus === "unauthenticated") {
    const loginHref = `/login?returnTo=${encodeURIComponent(returnTo)}`;
    const registerHref = `/register?returnTo=${encodeURIComponent(returnTo)}`;

    return (
      <div className="pie-discussion__reactions pie-discussion__reactions--guest">
        <a
          className="pie-discussion__reaction pie-discussion__reaction--guest"
          href={loginHref}
          aria-label={`Like this comment. ${comment.likes} likes. Sign in to react.`}
        >
          <img src="/icons/workspace/like.svg" alt="" aria-hidden="true" width={16} height={16} />
          <span aria-hidden="true">{comment.likes}</span>
        </a>
        <a
          className="pie-discussion__reaction pie-discussion__reaction--guest"
          href={loginHref}
          aria-label={`Dislike this comment. ${comment.dislikes} dislikes. Sign in to react.`}
        >
          <img
            src="/icons/workspace/dislike.svg"
            alt=""
            aria-hidden="true"
            width={16}
            height={16}
          />
          <span aria-hidden="true">{comment.dislikes}</span>
        </a>
        <a className="pie-discussion__reaction-link" href={registerHref}>
          Create Account
        </a>
      </div>
    );
  }

  return (
    <div className="pie-discussion__reactions">
      <button
        type="button"
        className={`pie-discussion__reaction${
          currentReaction === "like" ? " pie-discussion__reaction--active" : ""
        }`}
        aria-pressed={currentReaction === "like"}
        aria-label={`Like this comment. ${comment.likes} likes.`}
        disabled={busy || authStatus !== "authenticated"}
        onClick={() => void handleReaction(currentReaction === "like" ? "none" : "like")}
      >
        <img src="/icons/workspace/like.svg" alt="" aria-hidden="true" width={16} height={16} />
        <span aria-hidden="true">{comment.likes}</span>
      </button>
      <button
        type="button"
        className={`pie-discussion__reaction${
          currentReaction === "dislike" ? " pie-discussion__reaction--active" : ""
        }`}
        aria-pressed={currentReaction === "dislike"}
        aria-label={`Dislike this comment. ${comment.dislikes} dislikes.`}
        disabled={busy || authStatus !== "authenticated"}
        onClick={() => void handleReaction(currentReaction === "dislike" ? "none" : "dislike")}
      >
        <img src="/icons/workspace/dislike.svg" alt="" aria-hidden="true" width={16} height={16} />
        <span aria-hidden="true">{comment.dislikes}</span>
      </button>
    </div>
  );
}

export function PublicDiscussionPanel({
  initiativeId,
  initialComments = [],
  commentCount = 0,
  hasMoreComments = false,
  panelId,
  scopeLabel,
}: PublicDiscussionPanelProps) {
  const authStatus = useClientAuthStatus();
  const [comments, setComments] = useState(initialComments);
  const [totalCount, setTotalCount] = useState(commentCount);
  const [hasMore, setHasMore] = useState(hasMoreComments);
  const [draft, setDraft] = useState("");
  const [feedback, setFeedback] = useState<{
    variant: "warning" | "error" | "success";
    message: string;
  } | null>(null);
  const [restrictedMessage, setRestrictedMessage] = useState<string | null>(null);
  const [canComment, setCanComment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const returnTo = buildDiscussionReturnTo(initiativeId);
  const draftStorageKey = `${DRAFT_STORAGE_PREFIX}${initiativeId}`;

  useEffect(() => {
    setComments(initialComments);
    setTotalCount(commentCount);
    setHasMore(hasMoreComments);
  }, [initialComments, commentCount, hasMoreComments]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedDraft = window.sessionStorage.getItem(draftStorageKey);

    if (savedDraft) {
      setDraft(savedDraft);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setCanComment(false);
      setRestrictedMessage(null);
      return;
    }

    let cancelled = false;

    void getMe()
      .then((user) => {
        if (cancelled) {
          return;
        }

        if (user.status !== "active") {
          setCanComment(false);
          setRestrictedMessage("Your account is restricted and cannot post comments.");
          return;
        }

        if (user.emailVerificationStatus !== "verified") {
          setCanComment(false);
          setRestrictedMessage("Confirm your email address before posting comments.");
          return;
        }

        setCanComment(true);
        setRestrictedMessage(null);
      })
      .catch(() => {
        if (!cancelled) {
          setCanComment(false);
          setRestrictedMessage("Unable to verify your account for commenting.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    setFeedback(null);

    try {
      const response = await fetchInitiativeComments(initiativeId, comments.length, 40);
      setComments((current) => [...current, ...response.comments]);
      setTotalCount(response.total);
      setHasMore(response.hasMore);
    } catch {
      setFeedback({
        variant: "warning",
        message: "Unable to load more comments. Please try again.",
      });
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!draft.trim()) {
      setFeedback({ variant: "warning", message: "Enter a comment before submitting." });
      return;
    }

    setSubmitting(true);

    try {
      const created = await postInitiativeComment(initiativeId, draft.trim());
      setComments((current) => [created, ...current]);
      setTotalCount((current) => current + 1);
      setDraft("");
      window.sessionStorage.removeItem(draftStorageKey);
      setFeedback({ variant: "success", message: "Your comment was posted." });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Your comment could not be saved. Please try again.";
      const variant = message.toLowerCase().includes("wait") ? "warning" : "error";
      setFeedback({ variant, message });
    } finally {
      setSubmitting(false);
    }
  };

  const sectionProps = panelId ? { id: panelId } : {};
  const titleId = panelId ? `${panelId}-title` : "pie-discussion-title";

  if (authStatus === "pending") {
    return (
      <section {...sectionProps} className="pie-discussion" aria-labelledby={titleId}>
        <h2 id={titleId} className="pie-discussion__title">
          Discussion
        </h2>
        {scopeLabel ? <p className="pie-discussion__scope">{scopeLabel}</p> : null}
        <p className="pie-empty">Loading discussion access…</p>
      </section>
    );
  }

  return (
    <section {...sectionProps} className="pie-discussion" aria-labelledby={titleId}>
      <h2 id={titleId} className="pie-discussion__title">
        Discussion
      </h2>
      {scopeLabel ? <p className="pie-discussion__scope">{scopeLabel}</p> : null}

      {comments.length > 0 ? (
        <div className="pie-discussion__comments-wrap">
          <ul className="pie-discussion__comments">
            {comments.map((comment) => (
              <li key={comment.commentId}>
                <p className="pie-discussion__author">
                  {comment.author.avatarUrl ? (
                    <img
                      className="pie-discussion__author-avatar"
                      src={comment.author.avatarUrl}
                      alt=""
                      aria-hidden="true"
                      width={24}
                      height={24}
                    />
                  ) : null}
                  <span className="pie-discussion__author-name">{comment.author.displayName}</span>
                  <span className="pie-discussion__date">
                    {formatCommentDate(comment.createdAt)}
                  </span>
                </p>
                <p>{comment.body}</p>
                <CommentReactionControls
                  initiativeId={initiativeId}
                  comment={comment}
                  authStatus={authStatus}
                  returnTo={returnTo}
                  onUpdated={(updated) => {
                    setComments((current) =>
                      current.map((entry) =>
                        entry.commentId === updated.commentId ? updated : entry,
                      ),
                    );
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="pie-empty">
          {totalCount > 0
            ? `${totalCount} comment${totalCount === 1 ? "" : "s"}`
            : "No comments have been added."}
        </p>
      )}

      {hasMore ? (
        <button
          type="button"
          className="hu-button hu-button--secondary pie-discussion__load-more"
          disabled={loadingMore}
          onClick={() => void handleLoadMore()}
        >
          {loadingMore ? "Loading…" : "Load more comments"}
        </button>
      ) : null}

      {authStatus === "unauthenticated" ? (
        <div className="pie-discussion__guest">
          <p>Sign in to join the discussion.</p>
          <div className="pie-discussion__guest-actions">
            <Button href={`/login?returnTo=${encodeURIComponent(returnTo)}`} variant="primary">
              Log In
            </Button>
            <Button href={`/register?returnTo=${encodeURIComponent(returnTo)}`} variant="secondary">
              Create Account
            </Button>
          </div>
        </div>
      ) : null}

      {restrictedMessage ? (
        <HuFeedbackMessage variant="warning" title="Commenting unavailable">
          {restrictedMessage}
        </HuFeedbackMessage>
      ) : null}

      {canComment ? (
        <form className="pie-discussion__form" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor={panelId ? `${panelId}-comment` : "pie-discussion-comment"}>
            Add a comment
          </label>
          <textarea
            id={panelId ? `${panelId}-comment` : "pie-discussion-comment"}
            className="pie-discussion__input"
            rows={4}
            value={draft}
            disabled={submitting}
            onChange={(event) => {
              const value = event.target.value;
              setDraft(value);
              window.sessionStorage.setItem(draftStorageKey, value);
            }}
          />
          <button type="submit" className="hu-button hu-button--primary" disabled={submitting}>
            {submitting ? "Posting…" : "Post comment"}
          </button>
        </form>
      ) : null}

      {feedback ? (
        <HuFeedbackMessage variant={feedback.variant}>{feedback.message}</HuFeedbackMessage>
      ) : null}
    </section>
  );
}
