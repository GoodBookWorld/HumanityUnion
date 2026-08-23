"use client";

import type { BlogAuthorWorkspacePostSummary, BlogCategoryId } from "@hu/types";
import { BLOG_CATEGORIES } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";
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
}

export function PublicationListItem({ post, canDirectPublish }: PublicationListItemProps) {
  const editable =
    !post.administrativelyBlocked &&
    (post.status === "draft" ||
      post.status === "scheduled" ||
      (post.status === "published" && canDirectPublish));

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
        {post.administrativelyBlocked ? (
          <p className="hu-caption">Blocked by administrator</p>
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
        <div className="publication-list-item__actions hu-form-actions">
          {editable ? (
            <Button href={`/workspace/publishing/${post.postId}`} variant="primary">
              Edit
            </Button>
          ) : null}
          {post.status === "draft" ||
          post.status === "submitted_for_review" ||
          post.status === "scheduled" ? (
            <Button href={`/workspace/publishing/${post.postId}/preview`} variant="secondary">
              Preview
            </Button>
          ) : null}
          {post.status === "published" && !post.administrativelyBlocked ? (
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
    </Card>
  );
}
