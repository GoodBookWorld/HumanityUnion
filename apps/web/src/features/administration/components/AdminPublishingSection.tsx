"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type {
  AdminAuthorDirectoryItem,
  AdminAuthorDirectoryStatusFilter,
  AdminPendingAuthorApplicationItem,
  AdminPendingPublicationReviewItem,
  AdminPublicationDirectoryItem,
  AdminPublicationDirectoryStatusFilter,
  AuthUserPublic,
} from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { formatAuthFormError, isForbiddenError } from "../../../lib/api-client";
import { AuthorApplicationReviewModal } from "../../blog/components/AuthorApplicationReviewModal";
import {
  blockAdminPublishingAuthor,
  blockAdminPublishingPublication,
  listAdminPendingAuthorApplications,
  listAdminPendingPublicationReviews,
  listAdminPublishingAuthors,
  listAdminPublishingPublications,
  reconcileAdminPendingAuthorApplications,
  reconcileAdminPendingPublicationReviews,
  recoveryResetAdminAuthorApplication,
  setAdminAuthorTrustedPublishing,
  unblockAdminPublishingAuthor,
  unblockAdminPublishingPublication,
} from "../admin-publishing-api";
import { AdminBlogCategoriesPanel } from "./AdminBlogCategoriesPanel";
import { AdminPanelNavigation } from "./AdminPanelNavigation";

import "./admin-panel.css";
import "./admin-publishing.css";

interface AdminPublishingSectionProps {
  user: AuthUserPublic;
}

type PublishingTab = "pending" | "pending-review" | "authors" | "publications" | "categories";

function formatCompactDate(value?: string): string {
  if (!value) {
    return "—";
  }
  try {
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function publicationStatusLabel(row: AdminPublicationDirectoryItem): string {
  if (row.administrativelyBlocked) {
    return "Blocked";
  }
  return row.status.replaceAll("_", " ");
}

export function AdminPublishingSection({ user: _user }: AdminPublishingSectionProps) {
  const [tab, setTab] = useState<PublishingTab>("pending");
  const [pendingApps, setPendingApps] = useState<readonly AdminPendingAuthorApplicationItem[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingReviews, setPendingReviews] = useState<
    readonly AdminPendingPublicationReviewItem[]
  >([]);
  const [pendingReviewTotal, setPendingReviewTotal] = useState(0);
  const [authors, setAuthors] = useState<readonly AdminAuthorDirectoryItem[]>([]);
  const [authorTotal, setAuthorTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [authorStatus, setAuthorStatus] = useState<AdminAuthorDirectoryStatusFilter>("all");
  const [authorQuery, setAuthorQuery] = useState("");
  const [publications, setPublications] = useState<readonly AdminPublicationDirectoryItem[]>([]);
  const [publicationTotal, setPublicationTotal] = useState(0);
  const [publicationStatus, setPublicationStatus] =
    useState<AdminPublicationDirectoryStatusFilter>("all");
  const [publicationQuery, setPublicationQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reviewApplicationId, setReviewApplicationId] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminPendingAuthorApplications({ limit: 50, offset: 0 });
      setPendingApps(result.applications);
      setPendingTotal(result.total);
      setDenied(false);
    } catch (err: unknown) {
      if (isForbiddenError(err)) {
        setDenied(true);
      }
      setError(formatAuthFormError(err));
      setPendingApps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPendingReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminPendingPublicationReviews({ limit: 50, offset: 0 });
      setPendingReviews(result.publications);
      setPendingReviewTotal(result.total);
      setDenied(false);
    } catch (err: unknown) {
      if (isForbiddenError(err)) {
        setDenied(true);
      }
      setError(formatAuthFormError(err));
      setPendingReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAuthors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminPublishingAuthors({
        status: authorStatus,
        q: authorQuery.trim() || undefined,
        limit: 50,
        offset: 0,
      });
      setAuthors(result.authors);
      setAuthorTotal(result.total);
      setActiveCount(result.activeCount);
      setBlockedCount(result.blockedCount);
      setDenied(false);
    } catch (err: unknown) {
      if (isForbiddenError(err)) {
        setDenied(true);
      }
      setError(formatAuthFormError(err));
      setAuthors([]);
    } finally {
      setLoading(false);
    }
  }, [authorQuery, authorStatus]);

  const loadPublications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminPublishingPublications({
        status: publicationStatus,
        q: publicationQuery.trim() || undefined,
        limit: 50,
        offset: 0,
      });
      setPublications(result.publications);
      setPublicationTotal(result.total);
      setDenied(false);
    } catch (err: unknown) {
      if (isForbiddenError(err)) {
        setDenied(true);
      }
      setError(formatAuthFormError(err));
      setPublications([]);
    } finally {
      setLoading(false);
    }
  }, [publicationQuery, publicationStatus]);

  useEffect(() => {
    if (tab === "pending") {
      void loadPending();
    } else if (tab === "pending-review") {
      void loadPendingReviews();
    } else if (tab === "authors") {
      void loadAuthors();
    } else if (tab === "publications") {
      void loadPublications();
    }
  }, [tab, loadPending, loadPendingReviews, loadAuthors, loadPublications]);

  async function handleReconcile() {
    setActionBusyId("reconcile");
    setActionMessage(null);
    try {
      const result = await reconcileAdminPendingAuthorApplications();
      setActionMessage(
        `Reconciled: ${result.notifiedApplicationCount} application(s), ${result.notificationsCreated} notification(s) created (${result.skippedAlreadyNotified} already present).`,
      );
      await loadPending();
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleReconcilePublicationReviews() {
    setActionBusyId("reconcile-reviews");
    setActionMessage(null);
    try {
      const result = await reconcileAdminPendingPublicationReviews();
      setActionMessage(
        `Reconciled publication reviews: ${result.notifiedPublicationCount} publication(s), ${result.notificationsCreated} notification(s) created (${result.skippedAlreadyNotified} already present).`,
      );
      await loadPendingReviews();
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleRecoveryReset(applicationId: string) {
    setActionBusyId(applicationId);
    setActionMessage(null);
    try {
      await recoveryResetAdminAuthorApplication(applicationId);
      setActionMessage("Invalid application marked for Participant resubmit (not deleted).");
      await loadPending();
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleAuthorBlock(participantId: string, currentlyBlocked: boolean) {
    setActionBusyId(participantId);
    setActionMessage(null);
    try {
      if (currentlyBlocked) {
        await unblockAdminPublishingAuthor(participantId);
        setActionMessage("Author unblocked. Publishing tools restored.");
      } else {
        await blockAdminPublishingAuthor(participantId);
        setActionMessage("Author blocked. Participant account remains active.");
      }
      await loadAuthors();
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleTrustedPublishingToggle(
    participantId: string,
    nextEnabled: boolean,
  ) {
    setActionBusyId(`trusted-${participantId}`);
    setActionMessage(null);
    setError(null);
    try {
      await setAdminAuthorTrustedPublishing(participantId, nextEnabled);
      setActionMessage(
        nextEnabled
          ? "Trusted Publishing enabled. Future submissions may publish without manual review."
          : "Trusted Publishing disabled. Future submissions require editorial review.",
      );
      await loadAuthors();
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setActionBusyId(null);
    }
  }

  async function handlePublicationBlock(postId: string, currentlyBlocked: boolean) {
    setActionBusyId(postId);
    setActionMessage(null);
    try {
      if (currentlyBlocked) {
        await unblockAdminPublishingPublication(postId);
        setActionMessage("Publication unblocked. Visibility follows publication status.");
      } else {
        await blockAdminPublishingPublication(postId);
        setActionMessage("Publication blocked from public surfaces. Record retained.");
      }
      await loadPublications();
    } catch (err: unknown) {
      setError(formatAuthFormError(err));
    } finally {
      setActionBusyId(null);
    }
  }

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />

      <ProfileSection title="Publishing">
        <p className="hu-body admin-publishing__lede">
          Review pending Author applications and publications, manage accepted Authors, and
          Publication visibility. Author block and Publication block are independent. Notifications
          alert Admins; these queues remain the canonical review authority.
        </p>
        <div className="admin-publishing__tabs" role="tablist" aria-label="Publishing areas">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "pending"}
            className={
              tab === "pending"
                ? "hu-tab-control hu-tab-control--selected admin-publishing__tab"
                : "hu-tab-control admin-publishing__tab"
            }
            onClick={() => setTab("pending")}
          >
            Pending applications
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "pending-review"}
            className={
              tab === "pending-review"
                ? "hu-tab-control hu-tab-control--selected admin-publishing__tab"
                : "hu-tab-control admin-publishing__tab"
            }
            onClick={() => setTab("pending-review")}
          >
            Pending Review
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "authors"}
            className={
              tab === "authors"
                ? "hu-tab-control hu-tab-control--selected admin-publishing__tab"
                : "hu-tab-control admin-publishing__tab"
            }
            onClick={() => setTab("authors")}
          >
            Authors
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "publications"}
            className={
              tab === "publications"
                ? "hu-tab-control hu-tab-control--selected admin-publishing__tab"
                : "hu-tab-control admin-publishing__tab"
            }
            onClick={() => setTab("publications")}
          >
            Publications
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "categories"}
            className={
              tab === "categories"
                ? "hu-tab-control hu-tab-control--selected admin-publishing__tab"
                : "hu-tab-control admin-publishing__tab"
            }
            onClick={() => setTab("categories")}
          >
            Categories
          </button>
        </div>
        <ul className="admin-panel__links">
          <li>
            <Link className="admin-panel__link" href="/workspace/editorial">
              Open Editorial Review
            </Link>
          </li>
          <li>
            <Link className="admin-panel__link" href="/blog">
              Open public Blog
            </Link>
          </li>
        </ul>
      </ProfileSection>

      {denied ? (
        <StatusBanner title="Access denied" message="Administrator access is required." />
      ) : null}
      {error ? <StatusBanner title="Publishing admin unavailable" message={error} /> : null}
      {actionMessage ? <StatusBanner title="Action completed" message={actionMessage} /> : null}

      {tab === "pending" ? (
        <ProfileSection title="Pending Author Applications">
          <p className="hu-caption">
            Total pending: {pendingTotal}. Applications remain reviewable here even if a review
            notification was never delivered.
          </p>
          <div className="admin-publishing__toolbar">
            <Button
              type="button"
              variant="secondary"
              disabled={actionBusyId === "reconcile"}
              onClick={() => void handleReconcile()}
            >
              {actionBusyId === "reconcile" ? "Reconciling…" : "Reconcile legacy notifications"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void loadPending()}>
              Refresh
            </Button>
          </div>
          {loading ? <p className="hu-body">Loading pending applications…</p> : null}
          {!loading && pendingApps.length === 0 ? (
            <p className="hu-body">No pending Author applications.</p>
          ) : null}
          {!loading && pendingApps.length > 0 ? (
            <div className="admin-publishing-table-wrap">
              <table className="admin-publishing-table">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Review notification</th>
                    <th>Preview</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApps.map((row) => (
                    <tr key={row.applicationId}>
                      <td>
                        <strong>{row.displayName}</strong>
                        <div className="hu-caption">{row.email}</div>
                      </td>
                      <td>{row.status.replaceAll("_", " ")}</td>
                      <td>{formatCompactDate(row.submittedAt)}</td>
                      <td>
                        {row.hasAdminReviewNotification ? "Delivered" : "Missing"}
                        {row.structurallyInvalid ? (
                          <div className="hu-caption">Structurally invalid</div>
                        ) : null}
                      </td>
                      <td>
                        <span className="hu-caption">{row.motivationPreview || "—"}</span>
                      </td>
                      <td>
                        <div className="admin-publishing-table__actions">
                          <Button
                            type="button"
                            variant="primary"
                            onClick={() => setReviewApplicationId(row.applicationId)}
                          >
                            Review
                          </Button>
                          {row.structurallyInvalid ? (
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={actionBusyId === row.applicationId}
                              onClick={() => void handleRecoveryReset(row.applicationId)}
                            >
                              Mark for resubmit
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </ProfileSection>
      ) : null}

      {tab === "pending-review" ? (
        <ProfileSection title="Pending Review">
          <p className="hu-caption">
            Total awaiting review: {pendingReviewTotal}. Publications remain reviewable here even if
            a review notification was never delivered.
          </p>
          <div className="admin-publishing__toolbar">
            <Button
              type="button"
              variant="secondary"
              disabled={actionBusyId === "reconcile-reviews"}
              onClick={() => void handleReconcilePublicationReviews()}
            >
              {actionBusyId === "reconcile-reviews"
                ? "Reconciling…"
                : "Reconcile review notifications"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void loadPendingReviews()}>
              Refresh
            </Button>
          </div>
          {loading ? <p className="hu-body">Loading pending reviews…</p> : null}
          {!loading && pendingReviews.length === 0 ? (
            <p className="hu-body">No publications awaiting review.</p>
          ) : null}
          {!loading && pendingReviews.length > 0 ? (
            <div className="admin-publishing-table-wrap">
              <table className="admin-publishing-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Category</th>
                    <th>Submitted</th>
                    <th>Publication date</th>
                    <th>Review notification</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingReviews.map((row) => (
                    <tr key={row.postId}>
                      <td>
                        <strong>{row.title}</strong>
                        {row.administrativelyBlocked ? (
                          <div className="hu-caption">Blocked</div>
                        ) : null}
                      </td>
                      <td>{row.authorDisplayName}</td>
                      <td>{row.categoryName}</td>
                      <td>{formatCompactDate(row.submittedAt)}</td>
                      <td>{formatCompactDate(row.publishedAt)}</td>
                      <td>{row.hasAdminReviewNotification ? "Delivered" : "Missing"}</td>
                      <td>
                        <div className="admin-publishing-table__actions">
                          <Link className="admin-panel__link" href={row.editorialHref}>
                            Review publication
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </ProfileSection>
      ) : null}

      {tab === "authors" ? (
        <ProfileSection title="Authors">
          <dl className="admin-publishing__stats">
            <div>
              <dt>Listed</dt>
              <dd>{authorTotal}</dd>
            </div>
            <div>
              <dt>Active</dt>
              <dd>{activeCount}</dd>
            </div>
            <div>
              <dt>Blocked</dt>
              <dd>{blockedCount}</dd>
            </div>
          </dl>
          <div className="admin-publishing__toolbar">
            <label className="admin-publishing__filter">
              <span>Status</span>
              <select
                value={authorStatus}
                onChange={(event) =>
                  setAuthorStatus(event.target.value as AdminAuthorDirectoryStatusFilter)
                }
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>
            <label className="admin-publishing__search">
              <span className="visually-hidden">Search authors</span>
              <input
                type="search"
                placeholder="Search name, email, profile"
                value={authorQuery}
                onChange={(event) => setAuthorQuery(event.target.value)}
              />
            </label>
            <Button type="button" variant="secondary" onClick={() => void loadAuthors()}>
              Refresh
            </Button>
          </div>
          {loading ? <p className="hu-body">Loading authors…</p> : null}
          {!loading && authors.length === 0 ? (
            <p className="hu-body">No accepted Authors match this filter.</p>
          ) : null}
          {!loading && authors.length > 0 ? (
            <div className="admin-publishing-table-wrap">
              <table className="admin-publishing-table">
                <thead>
                  <tr>
                    <th>Author</th>
                    <th>Status</th>
                    <th>Trusted publishing</th>
                    <th>Publications</th>
                    <th>Joined/Accepted</th>
                    <th>Last publication</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {authors.map((row) => (
                    <tr key={row.participantId}>
                      <td>
                        <div className="admin-publishing-table__identity">
                          {row.avatarUrl ? (
                            <img
                              src={row.avatarUrl}
                              alt=""
                              width={32}
                              height={32}
                              className="admin-publishing-table__avatar"
                            />
                          ) : (
                            <span className="admin-publishing-table__avatar admin-publishing-table__avatar--empty" />
                          )}
                          <div>
                            <strong>{row.displayName}</strong>
                            {row.uniqueName ? (
                              <div className="hu-caption">@{row.uniqueName}</div>
                            ) : null}
                            <div className="hu-caption">{row.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={
                            row.status === "blocked"
                              ? "admin-publishing-table__status admin-publishing-table__status--blocked"
                              : "admin-publishing-table__status admin-publishing-table__status--active"
                          }
                        >
                          {row.status === "blocked" ? "Blocked" : "Active"}
                        </span>
                      </td>
                      <td>
                        <label className="admin-publishing-table__trusted">
                          <input
                            type="checkbox"
                            checked={row.publishWithoutManualReview === true}
                            disabled={
                              actionBusyId === `trusted-${row.participantId}` ||
                              actionBusyId === row.participantId
                            }
                            aria-label={`Publish without manual review for ${row.displayName}`}
                            onChange={(event) =>
                              void handleTrustedPublishingToggle(
                                row.participantId,
                                event.target.checked,
                              )
                            }
                          />
                          <span>Publish without manual review</span>
                        </label>
                      </td>
                      <td>{row.publicationCount}</td>
                      <td>{formatCompactDate(row.acceptedAt)}</td>
                      <td>{formatCompactDate(row.lastPublishedAt)}</td>
                      <td>
                        <div className="admin-publishing-table__actions">
                          <Link className="admin-panel__link" href={row.profileHref}>
                            View profile
                          </Link>
                          <Link
                            className="admin-panel__link"
                            href={`/admin/publishing?tab=publications&q=${encodeURIComponent(row.displayName)}`}
                            onClick={() => {
                              setTab("publications");
                              setPublicationQuery(row.displayName);
                              setPublicationStatus("all");
                            }}
                          >
                            View publications
                          </Link>
                          <Button
                            type="button"
                            variant={row.status === "blocked" ? "primary" : "danger"}
                            disabled={actionBusyId === row.participantId}
                            onClick={() =>
                              void handleAuthorBlock(row.participantId, row.status === "blocked")
                            }
                          >
                            {actionBusyId === row.participantId
                              ? "Working…"
                              : row.status === "blocked"
                                ? "Unblock"
                                : "Block"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </ProfileSection>
      ) : (
        <ProfileSection title="Publications">
          <p className="hu-caption">Total matching: {publicationTotal}</p>
          <div className="admin-publishing__toolbar">
            <label className="admin-publishing__filter">
              <span>Status</span>
              <select
                value={publicationStatus}
                onChange={(event) =>
                  setPublicationStatus(event.target.value as AdminPublicationDirectoryStatusFilter)
                }
              >
                <option value="all">All</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="published">Published</option>
                <option value="blocked">Blocked</option>
                <option value="submitted_for_review">Submitted for review</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <label className="admin-publishing__search">
              <span className="visually-hidden">Search publications</span>
              <input
                type="search"
                placeholder="Search title, author, category"
                value={publicationQuery}
                onChange={(event) => setPublicationQuery(event.target.value)}
              />
            </label>
            <Button type="button" variant="secondary" onClick={() => void loadPublications()}>
              Refresh
            </Button>
          </div>
          {loading ? <p className="hu-body">Loading publications…</p> : null}
          {!loading && publications.length === 0 ? (
            <p className="hu-body">No publications match this filter.</p>
          ) : null}
          {!loading && publications.length > 0 ? (
            <div className="admin-publishing-table-wrap">
              <table className="admin-publishing-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Category</th>
                    <th>Publication date</th>
                    <th>Status</th>
                    <th>Visibility</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {publications.map((row) => (
                    <tr key={row.postId}>
                      <td>
                        <strong>{row.title}</strong>
                      </td>
                      <td>{row.authorDisplayName}</td>
                      <td>{row.categoryName}</td>
                      <td>{formatCompactDate(row.publishedAt)}</td>
                      <td>{row.status.replaceAll("_", " ")}</td>
                      <td>{publicationStatusLabel(row)}</td>
                      <td>{formatCompactDate(row.updatedAt)}</td>
                      <td>
                        <div className="admin-publishing-table__actions">
                          {row.publicHref ? (
                            <Link className="admin-panel__link" href={row.publicHref}>
                              View
                            </Link>
                          ) : (
                            <Link className="admin-panel__link" href={row.editorialHref}>
                              View
                            </Link>
                          )}
                          <Link className="admin-panel__link" href={row.editorialHref}>
                            Edit/Correct
                          </Link>
                          <Button
                            type="button"
                            variant={row.administrativelyBlocked ? "primary" : "danger"}
                            disabled={actionBusyId === row.postId}
                            onClick={() =>
                              void handlePublicationBlock(row.postId, row.administrativelyBlocked)
                            }
                          >
                            {actionBusyId === row.postId
                              ? "Working…"
                              : row.administrativelyBlocked
                                ? "Unblock"
                                : "Block"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </ProfileSection>
      )}

      {tab === "categories" && !denied ? (
        <ProfileSection title="Publication Categories">
          <AdminBlogCategoriesPanel />
        </ProfileSection>
      ) : null}

      {reviewApplicationId ? (
        <AuthorApplicationReviewModal
          applicationId={reviewApplicationId}
          isOpen={Boolean(reviewApplicationId)}
          onClose={() => setReviewApplicationId(null)}
          onDecided={() => {
            setReviewApplicationId(null);
            void loadPending();
            setActionMessage("Author application decision recorded.");
          }}
        />
      ) : null}
    </div>
  );
}
