"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState } from "react";

import type {
  BlogAuthorWorkspacePost,
  BlogCategory,
  BlogCategoryId,
  BlogCoverMedia,
  BlogPostStatus,
  BlogPublicationOptimization,
  BlogReviewStatus,
  LifecycleSafetyOutcome,
} from "@hu/types";
import { BLOG_CATEGORIES, BLOG_PUBLICATION_DATE_MIN } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";
import { HelperText } from "../../../design-system/components/HelperText";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  resolveSaveButtonLabel,
  useSaveButtonPhase,
} from "../../member-profile/use-save-button-phase";
import { fetchPublicBlogCategories } from "../api";
import { resolveBlogCategoryDisplayName } from "../resolve-blog-category-display-name";
import {
  createBlogDraft,
  previewBlogSlugFromTitle,
  publishBlogPost,
  submitBlogPostForReview,
  updateBlogDraft,
} from "../publishing-api";
import { BlogAuthoringAssistantPanel } from "./BlogAuthoringAssistantPanel";
import { BlogCoverField } from "./BlogCoverField";
import { BlogPublicationOptimizationPanel } from "./BlogPublicationOptimizationPanel";
import { BlogRichTextEditor } from "./BlogRichTextEditor";

const MAX_TAGS = 12;

type PublishingTranslator = ReturnType<typeof useTranslations<"workspace.publishingPage">>;

function isoToPublicationDateOnly(iso: string | undefined): string {
  if (!iso) {
    return "";
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return match?.[1] ?? "";
}

function safetyMessage(
  outcome: LifecycleSafetyOutcome | null | undefined,
  t: PublishingTranslator,
): {
  title: string;
  message: string;
} | null {
  if (!outcome || outcome === "accepted") {
    return null;
  }
  if (outcome === "needs_review") {
    return {
      title: t("editor.banners.safetyNeedsReviewTitle"),
      message: t("editor.banners.safetyNeedsReviewBody"),
    };
  }
  return {
    title: t("editor.banners.safetyBlockedTitle"),
    message: t("editor.banners.safetyBlockedBody"),
  };
}

function resolveLifecycleStatusLabel(status: BlogPostStatus, t: PublishingTranslator): string {
  return t(`status.${status}`);
}

function resolveReviewStatusLabel(
  reviewStatus: Exclude<BlogReviewStatus, "none">,
  t: PublishingTranslator,
): string {
  return t(`editor.reviewStatuses.${reviewStatus}`);
}

export interface BlogPostEditorProps {
  mode: "create" | "edit";
  initialPost?: BlogAuthorWorkspacePost | null;
  canDirectPublish: boolean;
  authorDisplayName?: string;
}

export function BlogPostEditor({
  mode,
  initialPost,
  canDirectPublish,
  authorDisplayName,
}: BlogPostEditorProps) {
  const t = useTranslations("workspace.publishingPage");
  const tBlog = useTranslations("blogPublic");
  const router = useRouter();
  const titleId = useId();
  const categoryId = useId();
  const excerptId = useId();
  const contentLabelId = useId();
  const tagsId = useId();
  const publicationDateId = useId();
  const settingsToggleId = useId();
  const savePhase = useSaveButtonPhase();

  const [postId, setPostId] = useState(initialPost?.postId ?? null);
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [category, setCategory] = useState<BlogCategoryId | "">(
    initialPost?.categoryId ?? "",
  );
  const [categoryOptions, setCategoryOptions] = useState<readonly BlogCategory[]>(BLOG_CATEGORIES);
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt ?? "");
  const [content, setContent] = useState(initialPost?.content ?? "");
  const [tagsInput, setTagsInput] = useState((initialPost?.tags ?? []).join(", "));
  const [coverMedia, setCoverMedia] = useState<BlogCoverMedia | null>(
    initialPost?.coverMedia ?? null,
  );
  const [publicationDate, setPublicationDate] = useState(
    isoToPublicationDateOnly(initialPost?.publishedAt),
  );
  const [optimization, setOptimization] = useState<BlogPublicationOptimization>(
    () => initialPost?.optimization ?? {},
  );
  const [status, setStatus] = useState(initialPost?.status ?? "draft");
  const [reviewStatus, setReviewStatus] = useState(
    initialPost?.review.reviewStatus ?? "none",
  );
  const [reviewNote, setReviewNote] = useState(initialPost?.review.reviewNote ?? "");
  const [slug, setSlug] = useState(initialPost?.slug ?? "");
  const [safetyOutcome, setSafetyOutcome] = useState(initialPost?.safetyOutcome ?? null);
  const [administrativelyBlocked] = useState(initialPost?.administrativelyBlocked === true);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<"submit" | "publish" | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(true);

  const readOnly =
    status === "submitted_for_review" || status === "archived" || administrativelyBlocked;
  const changesRequested = status === "draft" && reviewStatus === "changes_requested";
  const declined = status === "draft" && reviewStatus === "declined";
  const publishedLockedSlug = status === "published" || status === "archived";

  const slugPreview = useMemo(() => {
    if (publishedLockedSlug && slug) {
      return slug;
    }
    return slug || previewBlogSlugFromTitle(title);
  }, [publishedLockedSlug, slug, title]);

  useEffect(() => {
    let cancelled = false;
    void fetchPublicBlogCategories()
      .then((list) => {
        if (!cancelled && list.length > 0) {
          setCategoryOptions(list);
        }
      })
      .catch(() => {
        /* keep seed fallback */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveStatusLabel = useMemo(() => {
    if (saveFailed) {
      return t("editor.saveStatus.failed");
    }
    if (savePhase.phase === "saving") {
      return t("editor.saveStatus.saving");
    }
    if (savePhase.phase === "success") {
      return t("editor.saveStatus.saved");
    }
    if (dirty) {
      return t("editor.saveStatus.unsaved");
    }
    return t("editor.saveStatus.allSaved");
  }, [dirty, saveFailed, savePhase.phase, t]);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function markDirty() {
    setDirty(true);
    setSaveFailed(false);
  }

  function parseTags(): string[] {
    return tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, MAX_TAGS);
  }

  function validateLocal(): string | null {
    if (title.trim().length < 3) {
      return t("editor.validation.titleMin", { min: 3 });
    }
    if (!category) {
      return t("editor.validation.categoryRequired");
    }
    if (parseTags().length > MAX_TAGS) {
      return t("editor.validation.tagsMax", { max: MAX_TAGS });
    }
    if (publicationDate && publicationDate < BLOG_PUBLICATION_DATE_MIN) {
      return t("editor.validation.publicationDateMin", { min: BLOG_PUBLICATION_DATE_MIN });
    }
    return null;
  }

  async function persistDraft(): Promise<BlogAuthorWorkspacePost> {
    const localError = validateLocal();
    if (localError) {
      throw new Error(localError);
    }

    const payload = {
      title: title.trim(),
      categoryId: category as BlogCategoryId,
      excerpt: excerpt.trim(),
      content,
      tags: parseTags(),
      coverMedia,
      optimization,
      ...(publicationDate ? { publicationDate } : {}),
    };

    if (postId) {
      return updateBlogDraft(postId, payload);
    }
    return createBlogDraft(payload);
  }

  async function handleSaveDraft() {
    setError(null);
    setSaveFailed(false);
    try {
      const saved = await savePhase.runSave(persistDraft);
      setPostId(saved.postId);
      setSlug(saved.slug);
      setStatus(saved.status);
      setReviewStatus(saved.review.reviewStatus);
      setReviewNote(saved.review.reviewNote ?? "");
      setSafetyOutcome(saved.safetyOutcome);
      setCoverMedia(saved.coverMedia ?? null);
      setPublicationDate(isoToPublicationDateOnly(saved.publishedAt));
      setOptimization(saved.optimization ?? {});
      setDirty(false);
      if (mode === "create" && !initialPost) {
        router.replace(`/workspace/publishing/${saved.postId}`);
      }
    } catch (saveError) {
      setSaveFailed(true);
      setError(formatAuthFormError(saveError));
    }
  }

  async function handleSubmit() {
    setBusyAction("submit");
    setError(null);
    try {
      let id = postId;
      if (dirty || !id) {
        const saved = await persistDraft();
        id = saved.postId;
        setPostId(id);
        setSlug(saved.slug);
        setSafetyOutcome(saved.safetyOutcome);
        setDirty(false);
      }
      const submitted = await submitBlogPostForReview(id!);
      setStatus(submitted.status);
      setReviewStatus(submitted.review.reviewStatus);
      setReviewNote(submitted.review.reviewNote ?? "");
      setSafetyOutcome(submitted.safetyOutcome);
      setSubmitOpen(false);
      router.push("/workspace/publishing");
    } catch (submitError) {
      setError(formatAuthFormError(submitError));
      setSubmitOpen(false);
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePublish() {
    setBusyAction("publish");
    setError(null);
    try {
      let id = postId;
      if (dirty || !id) {
        const saved = await persistDraft();
        id = saved.postId;
        setPostId(id);
        setSlug(saved.slug);
        setSafetyOutcome(saved.safetyOutcome);
        setDirty(false);
      }
      const published = await publishBlogPost(
        id!,
        publicationDate ? { publicationDate } : undefined,
      );
      setStatus(published.status);
      setSlug(published.slug);
      setSafetyOutcome(published.safetyOutcome);
      setPublicationDate(isoToPublicationDateOnly(published.publishedAt));
      setPublishOpen(false);
      if (published.status === "scheduled") {
        router.push("/workspace/publishing");
      } else {
        router.push(`/blog/${published.slug}`);
      }
    } catch (publishError) {
      setError(formatAuthFormError(publishError));
      setPublishOpen(false);
    } finally {
      setBusyAction(null);
    }
  }

  const safety = safetyMessage(safetyOutcome, t);
  const showPublish =
    canDirectPublish &&
    !administrativelyBlocked &&
    (status === "draft" || status === "submitted_for_review" || status === "scheduled") &&
    safetyOutcome !== "rejected";

  return (
    <div className="blog-post-editor blog-post-editor--pack15b">
      <p className="hu-caption">
        {t("editor.attribution", {
          name: authorDisplayName ?? t("editor.attributionFallback"),
        })}
      </p>

      {administrativelyBlocked ? (
        <StatusBanner
          title={t("editor.banners.blockedTitle")}
          message={t("editor.banners.blockedBody")}
        />
      ) : null}

      {status === "scheduled" ? (
        <StatusBanner
          title={t("editor.banners.scheduledTitle")}
          message={t("editor.banners.scheduledBody")}
        />
      ) : null}

      {status === "submitted_for_review" ? (
        <StatusBanner
          title={t("editor.banners.underReviewTitle")}
          message={t("editor.banners.underReviewBody")}
        />
      ) : null}

      {changesRequested ? (
        <StatusBanner
          title={t("editor.banners.changesRequestedTitle")}
          message={
            reviewNote
              ? t("editor.banners.changesRequestedWithNote", { note: reviewNote })
              : t("editor.banners.changesRequestedBody")
          }
        />
      ) : null}

      {declined ? (
        <StatusBanner
          title={t("editor.banners.declinedTitle")}
          message={
            reviewNote
              ? t("editor.banners.declinedWithNote", { note: reviewNote })
              : t("editor.banners.declinedBody")
          }
        />
      ) : null}

      {safety ? <StatusBanner title={safety.title} message={safety.message} /> : null}
      {error ? (
        <StatusBanner title={t("editor.banners.actionFailed")} message={error} />
      ) : null}

      <div className="blog-post-editor__chrome">
        <p className="blog-post-editor__save-status" aria-live="polite">
          {saveStatusLabel}
        </p>
        <div className="blog-post-editor__actions blog-post-editor__actions--top hu-form-actions">
          {!readOnly ? (
            <Button
              type="button"
              variant="primary"
              disabled={savePhase.isBusy}
              ariaLive="polite"
              onClick={() => {
                void handleSaveDraft();
              }}
            >
              {resolveSaveButtonLabel(savePhase.phase, t("editor.chrome.saveDraft"))}
            </Button>
          ) : null}

          {postId ? (
            <Button href={`/workspace/publishing/${postId}/preview`} variant="secondary">
              {t("editor.chrome.preview")}
            </Button>
          ) : null}

          {status === "draft" && !administrativelyBlocked ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busyAction !== null}
              onClick={() => setSubmitOpen(true)}
            >
              {t("editor.chrome.submitForReview")}
            </Button>
          ) : null}

          {showPublish ? (
            <Button
              type="button"
              variant="primary"
              disabled={busyAction !== null || safetyOutcome === "needs_review"}
              onClick={() => setPublishOpen(true)}
            >
              {t("editor.chrome.publish")}
            </Button>
          ) : null}

          <Link href="/workspace/publishing" className="hu-button hu-button--tertiary">
            {t("editor.chrome.backToPublishing")}
          </Link>
        </div>
      </div>

      <div className="blog-post-editor__layout">
        <div className="blog-post-editor__main">
          <label className="hu-label blog-post-editor__title-label" htmlFor={titleId}>
            {t("editor.labels.title")}
          </label>
          <input
            id={titleId}
            className="hu-form-control blog-post-editor__title-input"
            value={title}
            disabled={readOnly}
            required
            maxLength={160}
            onChange={(event) => {
              setTitle(event.target.value);
              markDirty();
            }}
          />
          <HelperText>{t("editor.helpers.title")}</HelperText>

          <p className="hu-caption blog-post-editor__slug">
            {t("editor.helpers.urlPreview", { slug: slugPreview })}
            {publishedLockedSlug ? t("editor.helpers.urlPreviewStable") : ""}
          </p>

          <p className="hu-label" id={contentLabelId}>
            {t("editor.labels.articleContent")}
          </p>
          <BlogRichTextEditor
            value={content}
            disabled={readOnly}
            labelledBy={contentLabelId}
            onChange={(html) => {
              setContent(html);
              markDirty();
            }}
          />

          <BlogPublicationOptimizationPanel
            title={title}
            excerpt={excerpt}
            slug={slugPreview}
            coverMedia={coverMedia}
            value={optimization}
            disabled={readOnly}
            onChange={(next) => {
              setOptimization(next);
              markDirty();
            }}
          />
        </div>

        <aside className="blog-post-editor__aside" aria-labelledby={settingsToggleId}>
          <div className="blog-post-editor__aside-header">
            <h2 className="hu-heading-3" id={settingsToggleId}>
              {t("editor.labels.publicationSettings")}
            </h2>
            <button
              type="button"
              className="blog-post-editor__settings-toggle"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              {settingsOpen ? t("editor.chrome.hideSettings") : t("editor.chrome.showSettings")}
            </button>
          </div>

          {settingsOpen ? (
            <div className="blog-post-editor__aside-body">
              <section className="blog-post-editor__settings-group" aria-labelledby="blog-settings-status">
                <h3 className="hu-heading-4" id="blog-settings-status">
                  {t("editor.labels.statusAndReview")}
                </h3>
                <p className="hu-caption">
                  {t("editor.lifecycle.lifecycleLabel", {
                    status: resolveLifecycleStatusLabel(status, t),
                  })}
                  {reviewStatus !== "none"
                    ? t("editor.lifecycle.reviewLabel", {
                        status: resolveReviewStatusLabel(reviewStatus, t),
                      })
                    : ""}
                </p>
                <p className="hu-caption">{t("editor.helpers.lifecycleGuidance")}</p>
                <p className="hu-caption">{t("editor.helpers.autosave")}</p>
              </section>

              <section
                className="blog-post-editor__settings-group"
                aria-labelledby="blog-settings-publication"
              >
                <h3 className="hu-heading-4" id="blog-settings-publication">
                  {t("editor.labels.publication")}
                </h3>
                <label className="hu-label" htmlFor={publicationDateId}>
                  {t("editor.labels.publicationDate")}
                </label>
                <input
                  id={publicationDateId}
                  className="hu-form-control"
                  type="date"
                  min={BLOG_PUBLICATION_DATE_MIN}
                  value={publicationDate}
                  disabled={readOnly}
                  onChange={(event) => {
                    setPublicationDate(event.target.value);
                    markDirty();
                  }}
                />
                <HelperText>
                  {t("editor.helpers.publicationDate", { min: BLOG_PUBLICATION_DATE_MIN })}
                </HelperText>

                <label className="hu-label" htmlFor={categoryId}>
                  {t("category")}
                </label>
                <select
                  id={categoryId}
                  className="hu-form-control"
                  value={category}
                  disabled={readOnly}
                  required
                  onChange={(event) => {
                    setCategory(event.target.value as BlogCategoryId | "");
                    markDirty();
                  }}
                >
                  <option value="">{t("selectCategory")}</option>
                  {categoryOptions.map((entry) => (
                    <option key={entry.categoryId} value={entry.categoryId}>
                      {resolveBlogCategoryDisplayName(entry.categoryId, tBlog)}
                    </option>
                  ))}
                </select>

                <label className="hu-label" htmlFor={tagsId}>
                  {t("editor.labels.tags")}
                </label>
                <input
                  id={tagsId}
                  className="hu-form-control"
                  value={tagsInput}
                  disabled={readOnly}
                  placeholder={t("editor.helpers.tagsPlaceholder", { max: MAX_TAGS })}
                  onChange={(event) => {
                    setTagsInput(event.target.value);
                    markDirty();
                  }}
                />
                <HelperText>{t("editor.helpers.tags", { max: MAX_TAGS })}</HelperText>
              </section>

              <section className="blog-post-editor__settings-group" aria-labelledby="blog-settings-media">
                <h3 className="hu-heading-4" id="blog-settings-media">
                  {t("editor.labels.media")}
                </h3>
                <fieldset className="blog-post-editor__cover" disabled={readOnly}>
                  <legend className="hu-label">{t("editor.labels.coverImage")}</legend>
                  <HelperText>{t("editor.helpers.coverSeparate")}</HelperText>
                  <BlogCoverField
                    coverMedia={coverMedia}
                    title={title}
                    disabled={readOnly}
                    onChange={(next) => {
                      setCoverMedia(next);
                      markDirty();
                    }}
                  />
                </fieldset>
              </section>

              <section
                className="blog-post-editor__settings-group"
                aria-labelledby="blog-settings-discovery"
              >
                <h3 className="hu-heading-4" id="blog-settings-discovery">
                  {t("editor.labels.discovery")}
                </h3>
                <label className="hu-label" htmlFor={excerptId}>
                  {t("editor.labels.excerpt")}
                </label>
                <textarea
                  id={excerptId}
                  className="hu-form-control"
                  rows={4}
                  maxLength={500}
                  value={excerpt}
                  disabled={readOnly}
                  onChange={(event) => {
                    setExcerpt(event.target.value);
                    markDirty();
                  }}
                />
                <HelperText>{t("editor.helpers.excerptListing")}</HelperText>
                <p className="hu-caption">{t("editor.helpers.discoverySeoPointer")}</p>
              </section>

              <section
                className="blog-post-editor__settings-group"
                aria-labelledby="blog-settings-assistant"
              >
                <h3
                  className="hu-heading-4 blog-post-editor__assistant-heading"
                  id="blog-settings-assistant"
                >
                  <img
                    src="/icons/workspace/intel.webp"
                    alt=""
                    className="blog-post-editor__assistant-icon"
                    width={22}
                    height={22}
                    aria-hidden="true"
                  />
                  {t("editor.labels.assistant")}
                </h3>
                <BlogAuthoringAssistantPanel
                  postId={postId}
                  title={title}
                  excerpt={excerpt}
                  content={content}
                  optimization={optimization}
                  disabled={readOnly}
                  onApplyField={({ field, text, mode }) => {
                    const next = text.trim();
                    if (!next) {
                      return;
                    }
                    if (field === "title") {
                      setTitle(next.slice(0, 160));
                    } else if (field === "content") {
                      const html = next.includes("<")
                        ? next
                        : `<p>${next
                            .replace(/&/g, "&amp;")
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;")
                            .replace(/\n\n/g, "</p><p>")
                            .replace(/\n/g, "<br />")}</p>`;
                      setContent(html);
                    } else if (field === "excerpt") {
                      setExcerpt(next.slice(0, 500));
                    } else if (field === "keywords") {
                      setTagsInput(next);
                    } else if (field === "seoTitle") {
                      setOptimization((prev) => ({ ...prev, seoTitle: next.slice(0, 70) }));
                    } else if (field === "seoDescription") {
                      setOptimization((prev) => ({ ...prev, seoDescription: next.slice(0, 320) }));
                    } else if (field === "socialTitle") {
                      setOptimization((prev) => ({ ...prev, socialTitle: next.slice(0, 70) }));
                    } else if (field === "socialDescription") {
                      setOptimization((prev) => ({
                        ...prev,
                        socialDescription: next.slice(0, 320),
                      }));
                    } else if (field === "structure" || field === "clarity") {
                      const safe = next
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;");
                      const block = `<blockquote><p><strong>${
                        field === "structure"
                          ? t("editor.helpers.structureSuggestion")
                          : t("editor.helpers.claritySuggestion")
                      }</strong></p><p>${safe.replace(/\n/g, "<br />")}</p></blockquote>`;
                      setContent(mode === "replace" ? block : `${block}${content}`);
                    }
                    markDirty();
                  }}
                />
              </section>
            </div>
          ) : null}
        </aside>
      </div>

      <div className="blog-post-editor__actions hu-form-actions">
        {!canDirectPublish && status === "draft" ? (
          <HelperText>{t("editor.helpers.standardAuthorPublish")}</HelperText>
        ) : null}

        {canDirectPublish && safetyOutcome === "needs_review" ? (
          <HelperText>{t("editor.helpers.safetyNeedsReview")}</HelperText>
        ) : null}
      </div>

      <ConfirmDialog
        isOpen={submitOpen}
        title={t("editor.dialogs.submitTitle")}
        description={t("editor.dialogs.submitBody")}
        confirmLabel={t("editor.dialogs.submitConfirm")}
        destructive={false}
        isConfirming={busyAction === "submit"}
        onCancel={() => setSubmitOpen(false)}
        onConfirm={() => {
          void handleSubmit();
        }}
      />

      <ConfirmDialog
        isOpen={publishOpen}
        title={t("editor.dialogs.publishTitle")}
        description={t("editor.dialogs.publishBody")}
        confirmLabel={t("editor.dialogs.publishConfirm")}
        destructive={false}
        isConfirming={busyAction === "publish"}
        onCancel={() => setPublishOpen(false)}
        onConfirm={() => {
          void handlePublish();
        }}
      />
    </div>
  );
}
