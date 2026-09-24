"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import type { BlogAuthorWorkspacePostSummary } from "@hu/types";

import { Button } from "../../../design-system/components/Button";
import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError } from "../../../lib/api-client";
import { resolvePublishingListStatusLabel } from "../blog-workspace-i18n";
import {
  archiveBlogPost,
  cancelScheduledBlogPublication,
  listOwnBlogPosts,
  publishBlogPost,
  startPublishedCorrection,
} from "../publishing-api";
import { resolveBlogCategoryDisplayName } from "../resolve-blog-category-display-name";

import "../../administration/components/admin-panel.css";
import "../../administration/components/admin-publishing.css";

function formatCompactDate(value: string | undefined, locale: string): string {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function visibilityLabel(
  post: BlogAuthorWorkspacePostSummary,
  t: ReturnType<typeof useTranslations<"workspace.publishingPage">>,
): string {
  if (post.administrativelyBlocked) {
    return t("blockedByAdmin");
  }
  if (post.status === "published") {
    return t("myPublications.visibility.public");
  }
  if (post.status === "scheduled") {
    return t("myPublications.visibility.scheduled");
  }
  return t("myPublications.visibility.notPublic");
}

export interface MyPublicationsTableProps {
  mutationsDisabled: boolean;
  canDirectPublish: boolean;
}

export function MyPublicationsTable({
  mutationsDisabled,
  canDirectPublish,
}: MyPublicationsTableProps) {
  const t = useTranslations("workspace.publishingPage");
  const tBlog = useTranslations("blogPublic");
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState<BlogAuthorWorkspacePostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlogAuthorWorkspacePostSummary | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<BlogAuthorWorkspacePostSummary | null>(
    null,
  );

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
      setActionMessage(t("myPublications.actionCompleted"));
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
      setActionMessage(t("myPublications.scheduleCancelled"));
      await load();
    } catch (actionError) {
      setActionMessage(formatAuthFormError(actionError));
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }
    setActionBusyId(deleteTarget.postId);
    setActionMessage(null);
    try {
      await archiveBlogPost(deleteTarget.postId);
      setActionMessage(t("myPublications.deletedArchived"));
      setDeleteTarget(null);
      await load();
    } catch (actionError) {
      setActionMessage(formatAuthFormError(actionError));
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleCorrection() {
    if (!correctionTarget) {
      return;
    }
    setActionBusyId(correctionTarget.postId);
    setActionMessage(null);
    try {
      await startPublishedCorrection(correctionTarget.postId);
      setCorrectionTarget(null);
      router.push(`/workspace/publishing/${encodeURIComponent(correctionTarget.postId)}`);
    } catch (actionError) {
      setActionMessage(formatAuthFormError(actionError));
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <section className="authoring-page__publications" aria-labelledby="my-publications-title">
      <h2 id="my-publications-title" className="hu-heading-3">
        {t("myPublications.title")}
      </h2>
      <p className="hu-body authoring-page__muted">{t("myPublications.intro")}</p>

      {mutationsDisabled ? (
        <StatusBanner
          title={t("actionsUnavailableTitle")}
          message={t("actionsUnavailableBody")}
        />
      ) : null}

      {actionMessage ? <p className="hu-caption">{actionMessage}</p> : null}
      {error ? <StatusBanner title={t("loadErrorTitle")} message={error} /> : null}
      {loading ? <p className="hu-body">{t("loading")}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <p className="hu-body">{t("myPublications.empty")}</p>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="admin-publishing-table-wrap">
          <table className="admin-publishing-table">
            <thead>
              <tr>
                <th>{t("myPublications.columns.title")}</th>
                <th>{t("myPublications.columns.category")}</th>
                <th>{t("myPublications.columns.publicationDate")}</th>
                <th>{t("myPublications.columns.status")}</th>
                <th>{t("myPublications.columns.visibility")}</th>
                <th>{t("myPublications.columns.lastUpdated")}</th>
                <th>{t("myPublications.columns.actions")}</th>
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
                const publishedManageable = canMutate && post.status === "published";
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
                        <div className="hu-caption">{t("blockedByAdmin")}</div>
                      ) : null}
                    </td>
                    <td>{resolveBlogCategoryDisplayName(post.categoryId, tBlog)}</td>
                    <td>{formatCompactDate(post.publishedAt, locale)}</td>
                    <td>{resolvePublishingListStatusLabel(post, t)}</td>
                    <td>{visibilityLabel(post, t)}</td>
                    <td>{formatCompactDate(post.updatedAt, locale)}</td>
                    <td>
                      <div className="admin-publishing-table__actions">
                        <Link className="admin-panel__link" href={viewHref}>
                          {t("actions.view")}
                        </Link>
                        {editable && post.status !== "published" ? (
                          <Link
                            className="admin-panel__link"
                            href={`/workspace/publishing/${post.postId}`}
                          >
                            {t("actions.edit")}
                          </Link>
                        ) : null}
                        {publishedManageable && canDirectPublish ? (
                          <Link
                            className="admin-panel__link"
                            href={`/workspace/publishing/${post.postId}`}
                          >
                            {t("actions.editCorrect")}
                          </Link>
                        ) : null}
                        {publishedManageable && !canDirectPublish ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={actionBusyId === post.postId}
                            onClick={() => setCorrectionTarget(post)}
                          >
                            {t("actions.editCorrect")}
                          </Button>
                        ) : null}
                        {publishedManageable ? (
                          <Button
                            type="button"
                            variant="danger"
                            disabled={actionBusyId === post.postId}
                            onClick={() => setDeleteTarget(post)}
                          >
                            {t("actions.delete")}
                          </Button>
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
                              ? t("myPublications.working")
                              : post.status === "scheduled"
                                ? t("myPublications.publishNow")
                                : t("myPublications.publish")}
                          </Button>
                        ) : null}
                        {canCancelSchedule ? (
                          <Button
                            type="button"
                            variant="tertiary"
                            disabled={actionBusyId === post.postId}
                            onClick={() => void handleCancelSchedule(post.postId)}
                          >
                            {t("myPublications.cancelSchedule")}
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

      <ConfirmDialog
        isOpen={Boolean(correctionTarget)}
        title={t("correctionTitle")}
        description={t("correctionBody")}
        confirmLabel={
          actionBusyId === correctionTarget?.postId
            ? t("correctionStarting")
            : t("correctionConfirm")
        }
        destructive={false}
        isConfirming={actionBusyId === correctionTarget?.postId}
        onCancel={() => setCorrectionTarget(null)}
        onConfirm={() => void handleCorrection()}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={t("deleteTitle")}
        description={t("deleteBody")}
        confirmLabel={
          actionBusyId === deleteTarget?.postId ? t("deleting") : t("deleteConfirm")
        }
        destructive
        isConfirming={actionBusyId === deleteTarget?.postId}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </section>
  );
}
