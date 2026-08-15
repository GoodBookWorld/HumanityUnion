"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import type { BlogEditorialHistoryEntry, BlogEditorialReviewDetail } from "@hu/types";
import { BLOG_CATEGORIES } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";
import { HelperText } from "../../../design-system/components/HelperText";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import {
  formatAuthFormError,
  isAuthenticationRequiredError,
  isForbiddenError,
  isNotFoundError,
} from "../../../lib/api-client";
import { formatBlogPublishedDate } from "../api";
import {
  approveAndPublishEditorialPost,
  declineEditorialPost,
  fetchEditorialReviewDetail,
  previewEditorialPost,
  publishAfterSafetyReview,
  requestEditorialChanges,
  type BlogPreviewProjection,
} from "../editorial-api";
import { BlogArticleBody } from "./BlogArticleBody";
import { BlogAuthorCard } from "./BlogAuthorCard";
import { BlogAuthorInline } from "./BlogAuthorInline";
import { BlogCoverImage } from "./BlogCoverImage";

import "../blog.css";

function historyLabel(action: BlogEditorialHistoryEntry["action"]): string {
  switch (action) {
    case "submitted":
      return "Submitted";
    case "resubmitted":
      return "Resubmitted";
    case "changes_requested":
      return "Changes Requested";
    case "approved_published":
      return "Approved & Published";
    case "published_after_safety_review":
      return "Published After Safety Review";
    case "declined":
      return "Declined";
    case "withdrawn":
      return "Withdrawn";
    case "archived":
      return "Archived";
    default:
      return action;
  }
}

function formatDate(value?: string): string {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function EditorialReviewPageContent({ postId }: { postId: string }) {
  const router = useRouter();
  const noteId = useId();
  const [detail, setDetail] = useState<BlogEditorialReviewDetail | null>(null);
  const [preview, setPreview] = useState<BlogPreviewProjection | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [safetyConfirmOpen, setSafetyConfirmOpen] = useState(false);
  const [declineConfirmOpen, setDeclineConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchEditorialReviewDetail(postId), previewEditorialPost(postId)])
      .then(([reviewDetail, previewProjection]) => {
        if (!cancelled) {
          setDetail(reviewDetail);
          setPreview(previewProjection);
          setReviewNote(reviewDetail.review.reviewNote ?? "");
        }
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        if (isAuthenticationRequiredError(loadError)) {
          setError("Sign in to open Editorial Review.");
        } else if (isForbiddenError(loadError)) {
          setError("Editorial Review is available to Editors and Administrators only.");
        } else if (isNotFoundError(loadError)) {
          setError("Publication not found.");
        } else {
          setError(formatAuthFormError(loadError));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  async function runAction(
    action: string,
    runner: () => Promise<unknown>,
  ): Promise<void> {
    setBusy(action);
    setError(null);
    try {
      await runner();
      router.push("/workspace/editorial");
    } catch (actionError) {
      setError(formatAuthFormError(actionError));
    } finally {
      setBusy(null);
      setSafetyConfirmOpen(false);
      setDeclineConfirmOpen(false);
    }
  }

  if (error && !detail) {
    return <StatusBanner title="Review unavailable" message={error} />;
  }

  if (!detail || !preview) {
    return <p className="hu-body">Loading review…</p>;
  }

  const safety = detail.safetyOutcome;
  const isSubmitted = detail.status === "submitted_for_review";
  const ordinaryPublishOk = isSubmitted && (safety === "accepted" || safety === null);
  const needsSafetyOverride = isSubmitted && safety === "needs_review";
  const rejected = safety === "rejected";
  const categoryName =
    BLOG_CATEGORIES.find((category) => category.categoryId === detail.categoryId)?.name ??
    detail.categoryId;

  return (
    <div className="editorial-review">
      <div className="editorial-review__preview">
        <p className="hu-caption">
          <Link href="/workspace/editorial">← Editorial Review</Link>
        </p>

        <section aria-labelledby="editorial-meta-heading">
          <h2 id="editorial-meta-heading" className="hu-heading-2">
            Publication metadata
          </h2>
          <p className="hu-body">
            {categoryName} · Status: {detail.status} · Version: {detail.publishedVersion}
          </p>
          <p className="hu-caption">Updated {formatDate(detail.updatedAt)}</p>
        </section>

        <section aria-labelledby="editorial-author-heading">
          <h2 id="editorial-author-heading" className="hu-heading-2">
            Author identity
          </h2>
          <p className="hu-body">{detail.authorDisplayName}</p>
        </section>

        <section aria-labelledby="editorial-safety-heading">
          <h2 id="editorial-safety-heading" className="hu-heading-2">
            Safety status
          </h2>
          <p className="hu-body" aria-live="polite">
            Safety: {safety ?? "not evaluated"}
          </p>
          {rejected ? (
            <StatusBanner
              title="Publication blocked"
              message="This publication cannot be published in its current form."
            />
          ) : null}
          {needsSafetyOverride ? (
            <StatusBanner
              title="Safety needs review"
              message="Ordinary Approve & Publish is unavailable. Use Publish After Safety Review only after deliberate human review."
            />
          ) : null}
        </section>

        <section aria-labelledby="editorial-article-heading" className="blog-article">
          <h2 id="editorial-article-heading" className="hu-heading-2">
            Article Preview
          </h2>
          <p className="hu-caption blog-article__category">{preview.category.name}</p>
          <p className="hu-heading-1 blog-article__title">{preview.title}</p>
          <div className="blog-article__meta">
            <BlogAuthorInline author={preview.author} />
            <time className="hu-caption" dateTime={preview.publishedAt}>
              {formatBlogPublishedDate(preview.publishedAt)}
            </time>
          </div>
          <div className="blog-article__cover">
            <BlogCoverImage
              title={preview.title}
              imageUrl={preview.coverImage?.mediaUrl}
              altText={preview.coverImage?.altText}
            />
          </div>
          {preview.excerpt ? <p className="hu-body blog-article__excerpt">{preview.excerpt}</p> : null}
          <BlogArticleBody html={preview.content} />
          {preview.tags.length > 0 ? (
            <p className="hu-caption">Tags: {preview.tags.join(", ")}</p>
          ) : null}
          <BlogAuthorCard author={preview.author} />
        </section>
      </div>

      <aside className="editorial-review__tools" aria-label="Editorial review tools">
        <div className="editorial-review__panel">
          <h2 className="hu-heading-3">Editorial guidance</h2>
          <ul className="editorial-review__checklist hu-body">
            <li>Clarity</li>
            <li>Evidence / sourcing where relevant</li>
            <li>Fact vs opinion distinction</li>
            <li>Constructive framing</li>
            <li>Category fit</li>
            <li>Readable structure</li>
            <li>Safety status</li>
          </ul>
          <HelperText>
            Guidance only — not a score. Final editorial decision belongs to the human Editor.
          </HelperText>
        </div>

        <div className="editorial-review__panel">
          <label className="hu-label" htmlFor={noteId}>
            Editorial notes
          </label>
          <textarea
            id={noteId}
            className="hu-form-control"
            rows={5}
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            disabled={!isSubmitted || busy !== null}
          />
          <HelperText>
            Required for Request Changes, Decline, and Publish After Safety Review. Optional for
            ordinary approval.
          </HelperText>
        </div>

        {error ? <StatusBanner title="Action could not complete" message={error} /> : null}

        <div className="editorial-review__actions">
          {ordinaryPublishOk ? (
            <Button
              type="button"
              variant="primary"
              disabled={busy !== null}
              onClick={() =>
                void runAction("publish", () =>
                  approveAndPublishEditorialPost({
                    postId,
                    expectedUpdatedAt: detail.updatedAt,
                    reviewNote: reviewNote.trim() || undefined,
                  }),
                )
              }
            >
              {busy === "publish" ? "Publishing…" : "Approve & Publish"}
            </Button>
          ) : null}

          {isSubmitted && !rejected ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy !== null}
              onClick={() =>
                void runAction("changes", () =>
                  requestEditorialChanges({
                    postId,
                    reviewNote,
                    expectedUpdatedAt: detail.updatedAt,
                  }),
                )
              }
            >
              {busy === "changes" ? "Sending…" : "Request Changes"}
            </Button>
          ) : null}

          {isSubmitted && rejected ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busy !== null}
              onClick={() =>
                void runAction("changes", () =>
                  requestEditorialChanges({
                    postId,
                    reviewNote,
                    expectedUpdatedAt: detail.updatedAt,
                  }),
                )
              }
            >
              {busy === "changes" ? "Sending…" : "Request Changes"}
            </Button>
          ) : null}

          {needsSafetyOverride ? (
            <Button
              type="button"
              variant="secondary"
              className="editorial-review__safety-action"
              disabled={busy !== null}
              onClick={() => setSafetyConfirmOpen(true)}
            >
              Publish After Safety Review
            </Button>
          ) : null}

          {isSubmitted ? (
            <Button
              type="button"
              variant="danger"
              disabled={busy !== null}
              onClick={() => setDeclineConfirmOpen(true)}
            >
              Decline
            </Button>
          ) : null}
        </div>

        <div className="editorial-review__panel">
          <h2 className="hu-heading-3">Review history</h2>
          {(detail.editorialHistory?.length ?? 0) === 0 ? (
            <p className="hu-caption">No editorial history yet.</p>
          ) : (
            <ol className="editorial-review__history">
              {[...(detail.editorialHistory ?? [])].reverse().map((entry, index) => (
                <li key={`${entry.at}-${entry.action}-${index}`} className="hu-caption">
                  <strong>{historyLabel(entry.action)}</strong> · {formatDate(entry.at)}
                  {entry.safetyOutcome ? ` · Safety: ${entry.safetyOutcome}` : ""}
                  {entry.reviewNote ? ` · Note recorded` : ""}
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>

      <ConfirmDialog
        isOpen={safetyConfirmOpen}
        title="Publish after Safety review?"
        description="You are accepting editorial responsibility to publish while Safety is needs_review. This does not claim the Safety system was wrong. A review note is required."
        confirmLabel={busy === "safety" ? "Publishing…" : "Publish After Safety Review"}
        destructive={false}
        isConfirming={busy === "safety"}
        onCancel={() => setSafetyConfirmOpen(false)}
        onConfirm={() =>
          void runAction("safety", () =>
            publishAfterSafetyReview({
              postId,
              reviewNote,
              expectedUpdatedAt: detail.updatedAt,
            }),
          )
        }
      />

      <ConfirmDialog
        isOpen={declineConfirmOpen}
        title="Decline this publication?"
        description="The post is preserved as a draft with declined review status. A review note is required. Author capability is unchanged."
        confirmLabel={busy === "decline" ? "Declining…" : "Decline"}
        destructive
        isConfirming={busy === "decline"}
        onCancel={() => setDeclineConfirmOpen(false)}
        onConfirm={() =>
          void runAction("decline", () =>
            declineEditorialPost({
              postId,
              reviewNote,
              expectedUpdatedAt: detail.updatedAt,
            }),
          )
        }
      />
    </div>
  );
}
