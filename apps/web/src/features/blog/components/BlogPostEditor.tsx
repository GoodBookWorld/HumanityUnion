"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";

import type {
  BlogAuthorWorkspacePost,
  BlogCategory,
  BlogCategoryId,
  BlogCoverMedia,
  BlogPublicationOptimization,
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

function isoToPublicationDateOnly(iso: string | undefined): string {
  if (!iso) {
    return "";
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return match?.[1] ?? "";
}

export interface BlogPostEditorProps {
  mode: "create" | "edit";
  initialPost?: BlogAuthorWorkspacePost | null;
  canDirectPublish: boolean;
  authorDisplayName?: string;
}

function safetyMessage(outcome: LifecycleSafetyOutcome | null | undefined): {
  title: string;
  message: string;
} | null {
  if (!outcome || outcome === "accepted") {
    return null;
  }
  if (outcome === "needs_review") {
    return {
      title: "Safety review required",
      message:
        "This publication needs a human Safety review before it can be published directly. You may still save and submit for editorial review.",
    };
  }
  return {
    title: "Publishing blocked by Safety",
    message:
      "This content cannot be submitted or published in its current form. Please revise the text and try again.",
  };
}

export function BlogPostEditor({
  mode,
  initialPost,
  canDirectPublish,
  authorDisplayName,
}: BlogPostEditorProps) {
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
      return "Save failed";
    }
    if (savePhase.phase === "saving") {
      return "Saving…";
    }
    if (savePhase.phase === "success") {
      return "Saved";
    }
    if (dirty) {
      return "Unsaved changes";
    }
    return "All changes saved";
  }, [dirty, saveFailed, savePhase.phase]);

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
      return "Title must be at least 3 characters.";
    }
    if (!category) {
      return "Category is required.";
    }
    if (parseTags().length > MAX_TAGS) {
      return `Use at most ${MAX_TAGS} tags.`;
    }
    if (publicationDate && publicationDate < BLOG_PUBLICATION_DATE_MIN) {
      return `Publication date must be on or after ${BLOG_PUBLICATION_DATE_MIN}.`;
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

  const safety = safetyMessage(safetyOutcome);
  const showPublish =
    canDirectPublish &&
    !administrativelyBlocked &&
    (status === "draft" || status === "submitted_for_review" || status === "scheduled") &&
    safetyOutcome !== "rejected";

  return (
    <div className="blog-post-editor blog-post-editor--pack15b">
      <p className="hu-caption">
        Author: {authorDisplayName ?? "Your Participant identity"} (attribution is set by the
        platform).
      </p>

      {administrativelyBlocked ? (
        <StatusBanner
          title="Blocked by administrator"
          message="This publication is blocked by an administrator and cannot be edited or made public."
        />
      ) : null}

      {status === "scheduled" ? (
        <StatusBanner
          title="Scheduled"
          message="This publication is scheduled and will become public automatically on the publication date (noon UTC)."
        />
      ) : null}

      {status === "submitted_for_review" ? (
        <StatusBanner
          title="Under editorial review"
          message="This publication is waiting for editorial review. Withdraw is available from the API for Editors; Authors should wait for feedback."
        />
      ) : null}

      {changesRequested ? (
        <StatusBanner
          title="Changes Requested"
          message={
            reviewNote
              ? `An Editor requested changes: ${reviewNote}`
              : "An Editor requested changes. Edit, save, preview, and resubmit this same publication."
          }
        />
      ) : null}

      {declined ? (
        <StatusBanner
          title="Publication declined"
          message={
            reviewNote
              ? `Editorial decision: ${reviewNote}`
              : "This publication was declined. You may revise and resubmit if appropriate."
          }
        />
      ) : null}

      {safety ? <StatusBanner title={safety.title} message={safety.message} /> : null}
      {error ? <StatusBanner title="Could not complete the action" message={error} /> : null}

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
              {resolveSaveButtonLabel(savePhase.phase, "Save Draft")}
            </Button>
          ) : null}

          {postId ? (
            <Button href={`/workspace/publishing/${postId}/preview`} variant="secondary">
              Preview
            </Button>
          ) : null}

          {status === "draft" && !administrativelyBlocked ? (
            <Button
              type="button"
              variant="secondary"
              disabled={busyAction !== null}
              onClick={() => setSubmitOpen(true)}
            >
              Submit for Review
            </Button>
          ) : null}

          {showPublish ? (
            <Button
              type="button"
              variant="primary"
              disabled={busyAction !== null || safetyOutcome === "needs_review"}
              onClick={() => setPublishOpen(true)}
            >
              Publish
            </Button>
          ) : null}

          <Link href="/workspace/publishing" className="hu-button hu-button--tertiary">
            Back to Publishing
          </Link>
        </div>
      </div>

      <div className="blog-post-editor__layout">
        <div className="blog-post-editor__main">
          <label className="hu-label blog-post-editor__title-label" htmlFor={titleId}>
            Title
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
          <HelperText>Required. The Assistant never overwrites your title automatically.</HelperText>

          <p className="hu-caption blog-post-editor__slug">
            URL preview: /blog/{slugPreview}
            {publishedLockedSlug ? " (stable after publication)" : ""}
          </p>

          <p className="hu-label" id={contentLabelId}>
            Article Content
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
              Publication settings
            </h2>
            <button
              type="button"
              className="blog-post-editor__settings-toggle"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              {settingsOpen ? "Hide settings" : "Show settings"}
            </button>
          </div>

          {settingsOpen ? (
            <div className="blog-post-editor__aside-body">
              <section className="blog-post-editor__settings-group" aria-labelledby="blog-settings-status">
                <h3 className="hu-heading-4" id="blog-settings-status">
                  Status &amp; review
                </h3>
                <p className="hu-caption">
                  Lifecycle: {status.replaceAll("_", " ")}
                  {reviewStatus !== "none" ? ` · Review: ${reviewStatus.replaceAll("_", " ")}` : ""}
                </p>
                <p className="hu-caption">
                  Use Save Draft, Submit for Review, or Publish — not generic Public/Private toggles.
                </p>
                <p className="hu-caption">
                  Autosave: manual Save Draft only (no aggressive background autosave).
                </p>
              </section>

              <section
                className="blog-post-editor__settings-group"
                aria-labelledby="blog-settings-publication"
              >
                <h3 className="hu-heading-4" id="blog-settings-publication">
                  Publication
                </h3>
                <label className="hu-label" htmlFor={publicationDateId}>
                  Publication date
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
                  Optional. Past dates back to {BLOG_PUBLICATION_DATE_MIN} are allowed for historical
                  works. Future dates schedule publication (noon UTC on the chosen day). createdAt
                  stays the platform record time.
                </HelperText>

                <label className="hu-label" htmlFor={categoryId}>
                  Category
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
                  <option value="">Select a category</option>
                  {categoryOptions.map((entry) => (
                    <option key={entry.categoryId} value={entry.categoryId}>
                      {entry.name}
                    </option>
                  ))}
                </select>

                <label className="hu-label" htmlFor={tagsId}>
                  Tags
                </label>
                <input
                  id={tagsId}
                  className="hu-form-control"
                  value={tagsInput}
                  disabled={readOnly}
                  placeholder="Optional, comma-separated (max 12)"
                  onChange={(event) => {
                    setTagsInput(event.target.value);
                    markDirty();
                  }}
                />
                <HelperText>Optional. Tags are normalized and limited to 12 by the server.</HelperText>
              </section>

              <section className="blog-post-editor__settings-group" aria-labelledby="blog-settings-media">
                <h3 className="hu-heading-4" id="blog-settings-media">
                  Media
                </h3>
                <fieldset className="blog-post-editor__cover" disabled={readOnly}>
                  <legend className="hu-label">Cover Image</legend>
                  <HelperText>Cover is separate from inline article images.</HelperText>
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
                  Discovery
                </h3>
                <label className="hu-label" htmlFor={excerptId}>
                  Excerpt
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
                <HelperText>This short summary appears on the Blog listing cards.</HelperText>
                <p className="hu-caption">
                  Search and social metadata live in Publication Optimization below the article.
                </p>
              </section>

              <section
                className="blog-post-editor__settings-group"
                aria-labelledby="blog-settings-assistant"
              >
                <h3 className="hu-heading-4" id="blog-settings-assistant">
                  Assistant
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
                        field === "structure" ? "Structure suggestion" : "Clarity suggestion"
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
          <HelperText>
            Standard Authors submit for review; direct Publish is for Trusted Authors when Safety
            allows.
          </HelperText>
        ) : null}

        {canDirectPublish && safetyOutcome === "needs_review" ? (
          <HelperText>
            Safety requires review — direct publication is blocked until an Editor handles the Safety
            review.
          </HelperText>
        ) : null}
      </div>

      <ConfirmDialog
        isOpen={submitOpen}
        title="Submit for editorial review?"
        description="Submit this publication for editorial review? You will not be able to edit it while it is under review."
        confirmLabel="Submit for Review"
        destructive={false}
        isConfirming={busyAction === "submit"}
        onCancel={() => setSubmitOpen(false)}
        onConfirm={() => {
          void handleSubmit();
        }}
      />

      <ConfirmDialog
        isOpen={publishOpen}
        title="Publish this publication?"
        description="This will make the article public on the Blog when Safety and permissions allow."
        confirmLabel="Publish"
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
