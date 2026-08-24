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

/** Pack 15D — human-readable lifecycle label (block is separate). */
function publicationStatusLabel(
  status: BlogEditorialReviewDetail["status"],
  reviewStatus: BlogEditorialReviewDetail["review"]["reviewStatus"],
): string {
  if (status === "draft" && reviewStatus === "changes_requested") {
    return "Draft · Changes Requested";
  }
  if (status === "draft" && reviewStatus === "declined") {
    return "Draft · Declined";
  }
  switch (status) {
    case "draft":
      return "Draft";
    case "submitted_for_review":
      return "Pending Review";
    case "scheduled":
      return "Scheduled";
    case "published":
      return "Published";
    case "archived":
      return "Archived";
    default:
      return status;
  }
}

function reviewStatusLabel(
  reviewStatus: BlogEditorialReviewDetail["review"]["reviewStatus"],
): string {
  switch (reviewStatus) {
    case "none":
      return "None";
    case "pending":
      return "Pending";
    case "changes_requested":
      return "Changes Requested";
    case "approved":
      return "Approved";
    case "declined":
      return "Declined";
    default:
      return reviewStatus;
  }
}

function isFuturePublicationDate(iso?: string): boolean {
  if (!iso) {
    return false;
  }
  const t = Date.parse(iso);
  return Number.isFinite(t) && t > Date.now();
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
  const publicationBlocked = detail.administrativelyBlocked === true;
  const authorBlocked = detail.authorAdministrativelyBlocked === true;
  const ordinaryPublishOk =
    isSubmitted && !publicationBlocked && (safety === "accepted" || safety === null);
  const needsSafetyOverride =
    isSubmitted && !publicationBlocked && safety === "needs_review";
  const rejected = safety === "rejected";
  const categoryName =
    BLOG_CATEGORIES.find((category) => category.categoryId === detail.categoryId)?.name ??
    detail.categoryId;
  const tags = detail.tags.length > 0 ? detail.tags : preview.tags;
  /** Canonical calendar date — never substitute review/submission time. */
  const publicationDate = detail.publishedAt ?? preview.publishedAt;
  const willScheduleOnApprove =
    isSubmitted && !publicationBlocked && isFuturePublicationDate(publicationDate);

  return (
    <div className="editorial-review editorial-review--pack15d">
      <aside className="editorial-review__context" aria-label="Publication context">
        <p className="hu-caption">
          <Link href="/workspace/editorial">← Editorial Review</Link>
        </p>

        <section aria-labelledby="editorial-author-heading">
          <h2 id="editorial-author-heading" className="hu-heading-3">
            Author
          </h2>
          <p className="hu-body">{detail.authorDisplayName}</p>
          {authorBlocked ? (
            <p className="hu-caption editorial-review__state-note" role="status">
              Author is administratively blocked. This does not automatically block this
              publication.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="editorial-meta-heading">
          <h2 id="editorial-meta-heading" className="hu-heading-3">
            Publication metadata
          </h2>
          <dl className="editorial-review__meta-list">
            <div>
              <dt className="hu-caption">Category</dt>
              <dd className="hu-body">{categoryName}</dd>
            </div>
            <div>
              <dt className="hu-caption">Tags</dt>
              <dd className="hu-body">{tags.length > 0 ? tags.join(", ") : "—"}</dd>
            </div>
            <div>
              <dt className="hu-caption">Publication date</dt>
              <dd className="hu-body">
                {publicationDate ? formatBlogPublishedDate(publicationDate) : "—"}
              </dd>
            </div>
            <div>
              <dt className="hu-caption">Submission date</dt>
              <dd className="hu-body">{formatDate(detail.submittedAt)}</dd>
            </div>
            <div>
              <dt className="hu-caption">Status</dt>
              <dd className="hu-body">
                {publicationStatusLabel(detail.status, detail.review.reviewStatus)}
              </dd>
            </div>
            <div>
              <dt className="hu-caption">Review</dt>
              <dd className="hu-body">{reviewStatusLabel(detail.review.reviewStatus)}</dd>
            </div>
            <div>
              <dt className="hu-caption">Admin block</dt>
              <dd className="hu-body">
                {publicationBlocked ? "Blocked" : "Not blocked"}
              </dd>
            </div>
            <div>
              <dt className="hu-caption">Version</dt>
              <dd className="hu-body">{detail.publishedVersion}</dd>
            </div>
            <div>
              <dt className="hu-caption">Updated</dt>
              <dd className="hu-body">{formatDate(detail.updatedAt)}</dd>
            </div>
          </dl>
          {detail.status === "scheduled" || willScheduleOnApprove ? (
            <p className="hu-caption editorial-review__state-note" role="status">
              {detail.status === "scheduled"
                ? `Scheduled for ${publicationDate ? formatBlogPublishedDate(publicationDate) : "—"}.`
                : `Future publication date — Approve will Schedule (not publish early).`}
            </p>
          ) : null}
        </section>

        <section aria-labelledby="editorial-safety-heading">
          <h2 id="editorial-safety-heading" className="hu-heading-3">
            Safety status
          </h2>
          <p className="hu-body" aria-live="polite">
            Safety: {safety ?? "not evaluated"}
          </p>
          {publicationBlocked ? (
            <StatusBanner
              title="Publication administratively blocked"
              message="This publication cannot be published while blocked. Block/Unblock remains on Admin Publishing — independent of Author block."
            />
          ) : null}
          {rejected ? (
            <StatusBanner
              title="Safety rejected"
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
      </aside>

      <div className="editorial-review__preview">
        <article
          aria-labelledby="editorial-article-heading"
          className="blog-article editorial-review__article"
        >
          <h2 id="editorial-article-heading" className="hu-heading-2">
            Article Preview
          </h2>
          <p className="hu-caption blog-article__category">{preview.category.name}</p>
          <h3 className="hu-heading-1 blog-article__title">{preview.title}</h3>
          <div className="blog-article__meta">
            <BlogAuthorInline author={preview.author} />
            {publicationDate ? (
              <time className="hu-caption" dateTime={publicationDate}>
                {formatBlogPublishedDate(publicationDate)}
              </time>
            ) : null}
          </div>
          <div className="blog-article__cover">
            <BlogCoverImage
              title={preview.title}
              imageUrl={preview.coverImage?.mediaUrl}
              altText={preview.coverImage?.altText}
              className="blog-article__cover-image"
            />
          </div>
          {preview.excerpt ? <p className="hu-body blog-article__excerpt">{preview.excerpt}</p> : null}
          <BlogArticleBody html={preview.content} />
          <BlogAuthorCard author={preview.author} />
        </article>
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
              {busy === "publish"
                ? willScheduleOnApprove
                  ? "Scheduling…"
                  : "Publishing…"
                : willScheduleOnApprove
                  ? "Approve & Schedule"
                  : "Approve & Publish"}
            </Button>
          ) : null}

          {willScheduleOnApprove && ordinaryPublishOk ? (
            <HelperText>
              Selected publication date is in the future. Approval schedules the post; it will not
              publish early.
            </HelperText>
          ) : null}

          {publicationBlocked ? (
            <HelperText>
              Publication Block/Unblock is managed from Admin Publishing. Author block does not
              cascade here.
            </HelperText>
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
