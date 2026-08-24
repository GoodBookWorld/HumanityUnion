"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { BlogAuthorWorkspacePostSummary, BlogCategoryId } from "@hu/types";
import { BLOG_CATEGORIES } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";
import { formatAuthFormError } from "../../../lib/api-client";
import { archiveBlogPost, startPublishedCorrection } from "../publishing-api";
import { BlogCoverImage } from "./BlogCoverImage";

function categoryName(categoryId: BlogCategoryId): string {
  return BLOG_CATEGORIES.find((category) => category.categoryId === categoryId)?.name ?? categoryId;
}

function statusLabel(post: BlogAuthorWorkspacePostSummary): string {
  if (post.status === "draft" && post.review.reviewStatus === "changes_requested") {
    return "Changes Requested";
  }
  if (post.status === "draft" && post.review.reviewStatus === "declined") {
    return "Declined";
  }
  switch (post.status) {
    case "draft":
      return "Draft";
    case "submitted_for_review":
      return "Under Review";
    case "scheduled":
      return "Scheduled";
    case "published":
      return "Published";
    case "archived":
      return "Archived";
    default:
      return post.status;
  }
}

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
          {categoryName(post.categoryId)} · {statusLabel(post)}
        </p>
        {blocked ? <p className="hu-caption">Blocked by administrator</p> : null}
        {mutationsDisabled ? (
          <p className="hu-caption">Author publishing is blocked — Edit/Delete unavailable.</p>
        ) : null}
        {post.review.reviewStatus === "changes_requested" && post.review.reviewNote ? (
          <p className="hu-body">Editor note: {post.review.reviewNote}</p>
        ) : null}
        <p className="hu-caption">Updated {formatDate(post.updatedAt)}</p>
        {post.publishedAt ? (
          <p className="hu-caption">
            {post.status === "scheduled" ? "Scheduled" : "Published"} {formatDate(post.publishedAt)}
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
              Edit
            </Button>
          ) : null}
          {publishedManageable && canDirectPublish ? (
            <Button href={`/workspace/publishing/${post.postId}`} variant="primary">
              Edit / Correct
            </Button>
          ) : null}
          {publishedManageable && !canDirectPublish ? (
            <Button
              type="button"
              variant="primary"
              disabled={busy !== null}
              onClick={() => setCorrectionOpen(true)}
            >
              Edit / Correct
            </Button>
          ) : null}
          {publishedManageable ? (
            <Button
              type="button"
              variant="danger"
              disabled={busy !== null}
              onClick={() => setDeleteOpen(true)}
            >
              Delete
            </Button>
          ) : null}
          {post.status === "draft" ||
          post.status === "submitted_for_review" ||
          post.status === "scheduled" ? (
            <Button href={`/workspace/publishing/${post.postId}/preview`} variant="secondary">
              Preview
            </Button>
          ) : null}
          {post.status === "published" && !blocked ? (
            <Button href={`/blog/${post.slug}`} variant="secondary">
              View Public
            </Button>
          ) : null}
          {post.status === "archived" ? (
            <Button href={`/workspace/publishing/${post.postId}/preview`} variant="secondary">
              View
            </Button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        isOpen={correctionOpen}
        title="Start correction?"
        description="This removes the publication from the public Blog while you edit. Changes must be submitted for review before the article is public again. The same publication identity (post id and slug) is preserved."
        confirmLabel={busy === "correct" ? "Starting…" : "Start correction"}
        destructive={false}
        isConfirming={busy === "correct"}
        onCancel={() => setCorrectionOpen(false)}
        onConfirm={() => void runCorrection()}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        title="Delete this publication?"
        description="The publication is archived and removed from the public Blog. The record is preserved for accountability — this is not a hard delete."
        confirmLabel={busy === "delete" ? "Deleting…" : "Delete"}
        destructive
        isConfirming={busy === "delete"}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void runDelete()}
      />
    </Card>
  );
}
