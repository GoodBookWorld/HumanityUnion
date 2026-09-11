"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { BlogAuthorWorkspacePostSummary } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";
import { formatAuthFormError } from "../../../lib/api-client";
import { resolvePublishingListStatusLabel } from "../blog-workspace-i18n";
import { resolveBlogCategoryDisplayName } from "../resolve-blog-category-display-name";
import { archiveBlogPost, startPublishedCorrection } from "../publishing-api";
import { BlogCoverImage } from "./BlogCoverImage";

function formatDate(value?: string): string {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

export interface PublicationListItemProps {
  post: BlogAuthorWorkspacePostSummary;
  canDirectPublish: boolean;
  /** Pack 13B — Author soft-block disables mutations. */
  mutationsDisabled?: boolean;
  onMutated?: () => void;
}

export function PublicationListItem({
  post,
  canDirectPublish,
  mutationsDisabled = false,
  onMutated,
}: PublicationListItemProps) {
  const t = useTranslations("workspace.publishingPage");
  const tBlog = useTranslations("blogPublic");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);

  const blocked = post.administrativelyBlocked === true;
  const canMutate = !mutationsDisabled && !blocked;
  const editableDraftOrScheduled =
    canMutate && (post.status === "draft" || post.status === "scheduled");
  const publishedManageable = canMutate && post.status === "published";
  const categoryLabel = resolveBlogCategoryDisplayName(post.categoryId, tBlog);
  const statusLabel = resolvePublishingListStatusLabel(post, t);

  async function runDelete() {
    setBusy("delete");
    setActionError(null);
    try {
      await archiveBlogPost(post.postId);
      setDeleteOpen(false);
      onMutated?.();
    } catch (error) {
      setActionError(formatAuthFormError(error));
    } finally {
      setBusy(null);
    }
  }

  async function runCorrection() {
    setBusy("correct");
    setActionError(null);
    try {
      await startPublishedCorrection(post.postId);
      setCorrectionOpen(false);
      router.push(`/workspace/publishing/${encodeURIComponent(post.postId)}`);
    } catch (error) {
      setActionError(formatAuthFormError(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="publication-list-item">
      <div className="publication-list-item__media">
        <BlogCoverImage
          title={post.title}
          imageUrl={post.coverMedia?.mediaUrl}
          altText={post.coverMedia?.altText}
          className="publication-list-item__cover"
        />
      </div>
      <div className="publication-list-item__body">
        <h3 className="hu-heading-3 publication-list-item__title">{post.title}</h3>
        <p className="hu-caption">
          {categoryLabel} · {statusLabel}
        </p>
        {blocked ? <p className="hu-caption">{t("blockedByAdmin")}</p> : null}
        {mutationsDisabled ? <p className="hu-caption">{t("authorBlockedNote")}</p> : null}
        {post.review.reviewStatus === "changes_requested" && post.review.reviewNote ? (
          <p className="hu-body">{t("editorNote", { note: post.review.reviewNote })}</p>
        ) : null}
        <p className="hu-caption">{t("updated", { date: formatDate(post.updatedAt) })}</p>
        {post.publishedAt ? (
          <p className="hu-caption">
            {post.status === "scheduled"
              ? t("scheduledOn", { date: formatDate(post.publishedAt) })
              : t("publishedOn", { date: formatDate(post.publishedAt) })}
          </p>
        ) : null}
        {actionError ? (
          <p className="hu-caption" role="alert">
            {actionError}
          </p>
        ) : null}
        <div className="publication-list-item__actions hu-form-actions">
          {editableDraftOrScheduled ? (
            <Button href={`/workspace/publishing/${post.postId}`} variant="primary">
              {t("actions.edit")}
            </Button>
          ) : null}
          {publishedManageable && canDirectPublish ? (
            <Button href={`/workspace/publishing/${post.postId}`} variant="primary">
              {t("actions.editCorrect")}
            </Button>
          ) : null}
          {publishedManageable && !canDirectPublish ? (
            <Button
              type="button"
              variant="primary"
              disabled={busy !== null}
              onClick={() => setCorrectionOpen(true)}
            >
              {t("actions.editCorrect")}
            </Button>
          ) : null}
          {publishedManageable ? (
            <Button
              type="button"
              variant="danger"
              disabled={busy !== null}
              onClick={() => setDeleteOpen(true)}
            >
              {t("actions.delete")}
            </Button>
          ) : null}
          {post.status === "draft" ||
          post.status === "submitted_for_review" ||
          post.status === "scheduled" ? (
            <Button href={`/workspace/publishing/${post.postId}/preview`} variant="secondary">
              {t("actions.preview")}
            </Button>
          ) : null}
          {post.status === "published" && !blocked ? (
            <Button href={`/blog/${post.slug}`} variant="secondary">
              {t("actions.viewPublic")}
            </Button>
          ) : null}
          {post.status === "archived" ? (
            <Button href={`/workspace/publishing/${post.postId}/preview`} variant="secondary">
              {t("actions.view")}
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        isOpen={correctionOpen}
        title={t("correctionTitle")}
        description={t("correctionBody")}
        confirmLabel={busy === "correct" ? t("correctionStarting") : t("correctionConfirm")}
        destructive={false}
        isConfirming={busy === "correct"}
        onCancel={() => setCorrectionOpen(false)}
        onConfirm={() => void runCorrection()}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        title={t("deleteTitle")}
        description={t("deleteBody")}
        confirmLabel={busy === "delete" ? t("deleting") : t("deleteConfirm")}
        destructive
        isConfirming={busy === "delete"}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void runDelete()}
      />
    </Card>
  );
}
