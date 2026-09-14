"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import type { BlogEditorialReviewDetail } from "@hu/types";

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
  resolveEditorialHistoryActionLabel,
  resolveEditorialPublicationStatusLabel,
  resolveEditorialReviewStatusLabel,
  resolveEditorialSafetyOutcomeLabel,
} from "../blog-workspace-i18n";
import {
  approveAndPublishEditorialPost,
  declineEditorialPost,
  fetchEditorialReviewDetail,
  previewEditorialPost,
  publishAfterSafetyReview,
  requestEditorialChanges,
  type BlogPreviewProjection,
} from "../editorial-api";
import { resolveBlogCategoryDisplayName } from "../resolve-blog-category-display-name";
import { BlogArticleBody } from "./BlogArticleBody";
import { BlogAuthorCard } from "./BlogAuthorCard";
import { BlogAuthorInline } from "./BlogAuthorInline";
import { BlogCoverImage } from "./BlogCoverImage";

import "../blog.css";

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

function isFuturePublicationDate(iso?: string): boolean {
  if (!iso) {
    return false;
  }
  const t = Date.parse(iso);
  return Number.isFinite(t) && t > Date.now();
}

export function EditorialReviewPageContent({ postId }: { postId: string }) {
  const t = useTranslations("workspace.editorialPage");
  const tBlog = useTranslations("blogPublic");
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
          setError(t("signIn"));
        } else if (isForbiddenError(loadError)) {
          setError(t("accessRestrictedBody"));
        } else if (isNotFoundError(loadError)) {
          setError(t("notFound"));
        } else {
          setError(formatAuthFormError(loadError));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [postId, t]);

  async function runAction(action: string, runner: () => Promise<unknown>): Promise<void> {
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
    return <StatusBanner title={t("reviewUnavailableTitle")} message={error} />;
  }

  if (!detail || !preview) {
    return <p className="hu-body">{t("loadingReview")}</p>;
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
  const categoryName = resolveBlogCategoryDisplayName(detail.categoryId, tBlog);
  const tags = detail.tags.length > 0 ? detail.tags : preview.tags;
  const publicationDate = detail.publishedAt ?? preview.publishedAt;
  const willScheduleOnApprove =
    isSubmitted && !publicationBlocked && isFuturePublicationDate(publicationDate);
  const safetyDisplay = resolveEditorialSafetyOutcomeLabel(safety, t);
  const previewCategory = resolveBlogCategoryDisplayName(preview.category.categoryId, tBlog);

  return (
    <div className="editorial-review editorial-review--pack15d">
      <aside className="editorial-review__context" aria-label={t("publicationContextAria")}>
        <p className="hu-caption">
          <Link href="/workspace/editorial">{t("backLink")}</Link>
        </p>

        <section aria-labelledby="editorial-author-heading">
          <h2 id="editorial-author-heading" className="hu-heading-3">
            {t("author")}
          </h2>
          <p className="hu-body">{detail.authorDisplayName}</p>
          {authorBlocked ? (
            <p className="hu-caption editorial-review__state-note" role="status">
              {t("authorBlockedNote")}
            </p>
          ) : null}
        </section>

        <section aria-labelledby="editorial-meta-heading">
          <h2 id="editorial-meta-heading" className="hu-heading-3">
            {t("metadataHeading")}
          </h2>
          <dl className="editorial-review__meta-list">
            <div>
              <dt className="hu-caption">{t("category")}</dt>
              <dd className="hu-body">{categoryName}</dd>
            </div>
            <div>
              <dt className="hu-caption">{t("tags")}</dt>
              <dd className="hu-body">{tags.length > 0 ? tags.join(", ") : "—"}</dd>
            </div>
            <div>
              <dt className="hu-caption">{t("publicationDate")}</dt>
              <dd className="hu-body">
                {publicationDate ? formatBlogPublishedDate(publicationDate) : "—"}
              </dd>
            </div>
            <div>
              <dt className="hu-caption">{t("submissionDate")}</dt>
              <dd className="hu-body">{formatDate(detail.submittedAt)}</dd>
            </div>
            <div>
              <dt className="hu-caption">{t("status")}</dt>
              <dd className="hu-body">
                {resolveEditorialPublicationStatusLabel(
                  detail.status,
                  detail.review.reviewStatus,
                  t,
                )}
              </dd>
            </div>
            <div>
              <dt className="hu-caption">{t("review")}</dt>
              <dd className="hu-body">
                {resolveEditorialReviewStatusLabel(detail.review.reviewStatus, t)}
              </dd>
            </div>
            <div>
              <dt className="hu-caption">{t("adminBlock")}</dt>
              <dd className="hu-body">
                {publicationBlocked ? t("blocked") : t("notBlocked")}
              </dd>
            </div>
            <div>
              <dt className="hu-caption">{t("version")}</dt>
              <dd className="hu-body">{detail.publishedVersion}</dd>
            </div>
            <div>
              <dt className="hu-caption">{t("updatedLabel")}</dt>
              <dd className="hu-body">{formatDate(detail.updatedAt)}</dd>
            </div>
          </dl>
          {detail.status === "scheduled" || willScheduleOnApprove ? (
            <p className="hu-caption editorial-review__state-note" role="status">
              {detail.status === "scheduled"
                ? t("scheduledFor", {
                    date: publicationDate ? formatBlogPublishedDate(publicationDate) : "—",
                  })
                : t("futureDateNote")}
            </p>
          ) : null}
        </section>

        <section aria-labelledby="editorial-safety-heading">
          <h2 id="editorial-safety-heading" className="hu-heading-3">
            {t("safetyHeading")}
          </h2>
          <p className="hu-body" aria-live="polite">
            {t("safetyLabel", { outcome: safetyDisplay })}
          </p>
          {publicationBlocked ? (
            <StatusBanner
              title={t("publicationBlockedTitle")}
              message={t("publicationBlockedBody")}
            />
          ) : null}
          {rejected ? (
            <StatusBanner title={t("safetyRejectedTitle")} message={t("safetyRejectedBody")} />
          ) : null}
          {needsSafetyOverride ? (
            <StatusBanner
              title={t("safetyNeedsReviewTitle")}
              message={t("safetyNeedsReviewBody")}
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
            {t("articlePreview")}
          </h2>
          <p className="hu-caption blog-article__category">{previewCategory}</p>
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

      <aside className="editorial-review__tools" aria-label={t("toolsAria")}>
        <div className="editorial-review__panel">
          <h2 className="hu-heading-3">{t("guidanceHeading")}</h2>
          <ul className="editorial-review__checklist hu-body">
            <li>{t("guidanceClarity")}</li>
            <li>{t("guidanceEvidence")}</li>
            <li>{t("guidanceFactOpinion")}</li>
            <li>{t("guidanceFraming")}</li>
            <li>{t("guidanceCategory")}</li>
            <li>{t("guidanceStructure")}</li>
            <li>{t("guidanceSafety")}</li>
          </ul>
          <HelperText>{t("guidanceHelper")}</HelperText>
        </div>

        <div className="editorial-review__panel">
          <label className="hu-label" htmlFor={noteId}>
            {t("editorialNotes")}
          </label>
          <textarea
            id={noteId}
            className="hu-form-control"
            rows={5}
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            disabled={!isSubmitted || busy !== null}
          />
          <HelperText>{t("reviewNoteHelper")}</HelperText>
        </div>

        {error ? <StatusBanner title={t("actionFailedTitle")} message={error} /> : null}

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
                  ? t("scheduling")
                  : t("publishing")
                : willScheduleOnApprove
                  ? t("approveSchedule")
                  : t("approvePublish")}
            </Button>
          ) : null}

          {willScheduleOnApprove && ordinaryPublishOk ? (
            <HelperText>{t("scheduleApproveHelper")}</HelperText>
          ) : null}

          {publicationBlocked ? <HelperText>{t("publicationBlockHelper")}</HelperText> : null}

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
              {busy === "changes" ? t("sending") : t("requestChanges")}
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
              {busy === "changes" ? t("sending") : t("requestChanges")}
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
              {t("publishAfterSafety")}
            </Button>
          ) : null}

          {isSubmitted ? (
            <Button
              type="button"
              variant="danger"
              disabled={busy !== null}
              onClick={() => setDeclineConfirmOpen(true)}
            >
              {t("decline")}
            </Button>
          ) : null}
        </div>

        <div className="editorial-review__panel">
          <h2 className="hu-heading-3">{t("reviewHistory")}</h2>
          {(detail.editorialHistory?.length ?? 0) === 0 ? (
            <p className="hu-caption">{t("historyEmpty")}</p>
          ) : (
            <ol className="editorial-review__history">
              {[...(detail.editorialHistory ?? [])].reverse().map((entry, index) => (
                <li key={`${entry.at}-${entry.action}-${index}`} className="hu-caption">
                  <strong>{resolveEditorialHistoryActionLabel(entry.action, t)}</strong> ·{" "}
                  {formatDate(entry.at)}
                  {entry.safetyOutcome
                    ? t("historySafety", {
                        outcome: resolveEditorialSafetyOutcomeLabel(entry.safetyOutcome, t),
                      })
                    : ""}
                  {entry.reviewNote ? t("noteRecorded") : ""}
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>

      <ConfirmDialog
        isOpen={safetyConfirmOpen}
        title={t("safetyConfirmTitle")}
        description={t("safetyConfirmBody")}
        confirmLabel={busy === "safety" ? t("publishing") : t("publishAfterSafety")}
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
        title={t("declineConfirmTitle")}
        description={t("declineConfirmBody")}
        confirmLabel={busy === "decline" ? t("declining") : t("decline")}
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
