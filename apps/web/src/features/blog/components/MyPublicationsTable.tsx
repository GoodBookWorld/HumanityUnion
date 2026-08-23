"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { BlogAuthorWorkspacePostSummary, BlogCategoryId } from "@hu/types";
import { BLOG_CATEGORIES } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  cancelScheduledBlogPublication,
  listOwnBlogPosts,
  publishBlogPost,
} from "../publishing-api";

import "../../administration/components/admin-panel.css";
import "../../administration/components/admin-publishing.css";

function categoryName(categoryId: BlogCategoryId): string {
  return BLOG_CATEGORIES.find((category) => category.categoryId === categoryId)?.name ?? categoryId;
}

function formatCompactDate(value?: string): string {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function lifecycleStatusLabel(post: BlogAuthorWorkspacePostSummary): string {
  if (post.status === "draft" && post.review.reviewStatus === "changes_requested") {
    return "Changes requested";
  }
  if (post.status === "draft" && post.review.reviewStatus === "declined") {
    return "Declined";
  }
  switch (post.status) {
    case "draft":
      return "Draft";
    case "submitted_for_review":
      return "Under review";
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

function visibilityLabel(post: BlogAuthorWorkspacePostSummary): string {
  if (post.administrativelyBlocked) {
    return "Blocked by administrator";
  }
  if (post.status === "published") {
    return "Public";
  }
  if (post.status === "scheduled") {
    return "Scheduled";
  }
  return "Not public";
}

export interface MyPublicationsTableProps {
  mutationsDisabled: boolean;
  canDirectPublish: boolean;
}

export function MyPublicationsTable({
  mutationsDisabled,
  canDirectPublish,
}: MyPublicationsTableProps) {
  const [items, setItems] = useState<BlogAuthorWorkspacePostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listOwnBlogPosts({ limit: 100 });
      setItems([...response.items]);
    } catch (loadError) {
      setError(formatAuthFormError(loadError));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handlePublish(postId: string, releaseScheduledNow = false) {
    setActionBusyId(postId);
    setActionMessage(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await publishBlogPost(
        postId,
        releaseScheduledNow ? { publicationDate: today } : undefined,
      );
      setActionMessage("Publication action completed.");
      await load();
    } catch (actionError) {
      setActionMessage(formatAuthFormError(actionError));
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleCancelSchedule(postId: string) {
    setActionBusyId(postId);
    setActionMessage(null);
    try {
      await cancelScheduledBlogPublication(postId);
      setActionMessage("Schedule cancelled.");
      await load();
    } catch (actionError) {
      setActionMessage(formatAuthFormError(actionError));
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <section className="authoring-page__publications" aria-labelledby="my-publications-title">
      <h2 id="my-publications-title" className="hu-heading-3">
        My Publications
      </h2>
      <p className="hu-body authoring-page__muted">
        Manage your own Blog publications. Publication date is the canonical public date (noon UTC
        for date-only values).
      </p>

      {mutationsDisabled ? (
        <StatusBanner
          title="Publishing actions unavailable"
          message="Your Author access has been blocked. Please contact the administrator."
        />
      ) : null}

      {actionMessage ? <p className="hu-caption">{actionMessage}</p> : null}
      {error ? <StatusBanner title="Unable to load publications" message={error} /> : null}
      {loading ? <p className="hu-body">Loading publications…</p> : null}

      {!loading && !error && items.length === 0 ? (
        <p className="hu-body">You have no publications yet.</p>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="admin-publishing-table-wrap">
          <table className="admin-publishing-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Publication date</th>
                <th>Status</th>
                <th>Visibility</th>
                <th>Last updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((post) => {
                const blocked = post.administrativelyBlocked === true;
                const canMutate = !mutationsDisabled && !blocked;
                const editable =
                  canMutate &&
                  (post.status === "draft" ||
                    post.status === "scheduled" ||
                    (post.status === "published" && canDirectPublish));
                const canPublish =
                  canMutate &&
                  canDirectPublish &&
                  (post.status === "draft" || post.status === "scheduled");
                const canCancelSchedule = canMutate && post.status === "scheduled";
                const viewHref =
                  post.status === "published" && !blocked
                    ? `/blog/${post.slug}`
                    : `/workspace/publishing/${post.postId}/preview`;

                return (
                  <tr key={post.postId}>
                    <td>
                      <strong>{post.title}</strong>
                      {blocked ? (
                        <div className="hu-caption">Blocked by administrator</div>
                      ) : null}
                    </td>
                    <td>{categoryName(post.categoryId)}</td>
                    <td>{formatCompactDate(post.publishedAt)}</td>
                    <td>{lifecycleStatusLabel(post)}</td>
                    <td>{visibilityLabel(post)}</td>
                    <td>{formatCompactDate(post.updatedAt)}</td>
                    <td>
                      <div className="admin-publishing-table__actions">
                        <Link className="admin-panel__link" href={viewHref}>
                          View
                        </Link>
                        {editable ? (
                          <Link
                            className="admin-panel__link"
                            href={`/workspace/publishing/${post.postId}`}
                          >
                            Edit
                          </Link>
                        ) : null}
                        {canPublish ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={actionBusyId === post.postId}
                            onClick={() =>
                              void handlePublish(post.postId, post.status === "scheduled")
                            }
                          >
                            {actionBusyId === post.postId
                              ? "Working…"
                              : post.status === "scheduled"
                                ? "Publish now"
                                : "Publish"}
                          </Button>
                        ) : null}
                        {canCancelSchedule ? (
                          <Button
                            type="button"
                            variant="tertiary"
                            disabled={actionBusyId === post.postId}
                            onClick={() => void handleCancelSchedule(post.postId)}
                          >
                            Cancel schedule
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
