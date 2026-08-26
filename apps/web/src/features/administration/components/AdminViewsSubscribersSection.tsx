"use client";

import { useEffect, useId, useState } from "react";

import type {
  AdminBlogSubscriberDirectoryItem,
  AdminBlogSubscriberImportMode,
  AdminBlogSubscriberStatusFilter,
  AuthUserPublic,
} from "@hu/types";

import { ProfileSection } from "../../../components/member/ProfileSection";
import { Button } from "../../../design-system/components/Button";
import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";
import { formatAuthFormError } from "../../../lib/api-client";
import {
  addAdminBlogSubscriber,
  fetchAdminBlogSubscriptionSettings,
  listAdminBlogSubscribers,
  queueAdminBlogSubscriberMessage,
  removeAdminBlogSubscriber,
  updateAdminBlogSubscriptionSettings,
} from "../admin-publishing-api";
import {
  BLOG_ADMIN_MESSAGE_BODY_MAX_LENGTH,
  BLOG_ADMIN_MESSAGE_MAX_RECIPIENTS,
  BLOG_ADMIN_MESSAGE_SUBJECT_MAX_LENGTH,
} from "../blog-subscription-admin-message-limits";
import {
  blogSubscriptionStatusClassName,
  formatBlogSubscriptionStatusLabel,
  formatBlogSubscriptionTypeLabel,
} from "../blog-subscription-labels";
import { AdminPanelNavigation } from "./AdminPanelNavigation";
import { AdminViewsNavigation } from "./AdminViewsNavigation";

import "./admin-panel.css";
import "./admin-publishing.css";

const PAGE_SIZE = 25;

interface AdminViewsSubscribersSectionProps {
  user: AuthUserPublic;
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
    }).format(new Date(value));
  } catch {
    return value;
  }
}

/**
 * Pack 21B — Welcome Message settings.
 * Pack 21C — Subscribers directory table, search, selection, remove.
 * Pack 21E — selected-subscriber message composer (queues durable send).
 * Pack 21G — Admin manual subscriber add (historical import / confirmation).
 */
export function AdminViewsSubscribersSection({ user: _user }: AdminViewsSubscribersSectionProps) {
  const welcomeId = useId();
  const searchId = useId();
  const statusFilterId = useId();
  const selectAllId = useId();
  const composeSubjectId = useId();
  const composeMessageId = useId();
  const composeCtaLabelId = useId();
  const composeCtaUrlId = useId();
  const addNameId = useId();
  const addEmailId = useId();
  const addImportModeId = useId();
  const addRestoreId = useId();

  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsLoadError, setSettingsLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminBlogSubscriberStatusFilter>("all");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<readonly AdminBlogSubscriberDirectoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [subscribedCount, setSubscribedCount] = useState(0);
  const [notConfirmedCount, setNotConfirmedCount] = useState(0);
  const [unsubscribedCount, setUnsubscribedCount] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [removeTarget, setRemoveTarget] = useState<AdminBlogSubscriberDirectoryItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addImportMode, setAddImportMode] =
    useState<AdminBlogSubscriberImportMode>("confirmed_existing");
  const [addRestoreUnsubscribed, setAddRestoreUnsubscribed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  const [composeSubject, setComposeSubject] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [composeCtaLabel, setComposeCtaLabel] = useState("");
  const [composeCtaUrl, setComposeCtaUrl] = useState("");
  const [composeQueuing, setComposeQueuing] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composeSuccess, setComposeSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchAdminBlogSubscriptionSettings()
      .then((response) => {
        if (cancelled) {
          return;
        }
        setWelcomeMessage(response.welcomeMessage);
        setIsDefault(response.isDefault);
        setSettingsLoadError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setSettingsLoadError(formatAuthFormError(err));
      })
      .finally(() => {
        if (!cancelled) {
          setSettingsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    setListError(null);

    void listAdminBlogSubscribers({
      q: appliedSearch || undefined,
      status: statusFilter,
      limit: PAGE_SIZE,
      offset,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setRows(response.subscribers);
        setTotal(response.total);
        setSubscribedCount(response.subscribedCount);
        setNotConfirmedCount(response.notConfirmedCount);
        setUnsubscribedCount(response.unsubscribedCount);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setListError(formatAuthFormError(err));
        setRows([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) {
          setListLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appliedSearch, statusFilter, offset]);

  async function handleSaveSettings() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);
    try {
      const saved = await updateAdminBlogSubscriptionSettings({
        welcomeMessage,
      });
      setWelcomeMessage(saved.welcomeMessage);
      setIsDefault(saved.isDefault);
      setSaveMessage("Welcome Message saved.");
    } catch (err: unknown) {
      setSaveError(formatAuthFormError(err));
    } finally {
      setSaving(false);
    }
  }

  function applySearch() {
    setOffset(0);
    setAppliedSearch(searchInput.trim());
  }

  async function refreshSubscriberList(nextOffset = offset) {
    const response = await listAdminBlogSubscribers({
      q: appliedSearch || undefined,
      status: statusFilter,
      limit: PAGE_SIZE,
      offset: nextOffset,
    });
    setRows(response.subscribers);
    setTotal(response.total);
    setSubscribedCount(response.subscribedCount);
    setNotConfirmedCount(response.notConfirmedCount);
    setUnsubscribedCount(response.unsubscribedCount);
    setListError(null);
  }

  async function handleAddSubscriber() {
    setAdding(true);
    setAddError(null);
    setAddSuccess(null);
    setActionMessage(null);
    try {
      const result = await addAdminBlogSubscriber({
        email: addEmail,
        importMode: addImportMode,
        ...(addName.trim() ? { displayName: addName.trim() } : {}),
        ...(addRestoreUnsubscribed ? { restoreUnsubscribed: true } : {}),
      });
      setAddSuccess(result.message);
      setAddEmail("");
      setAddName("");
      setAddRestoreUnsubscribed(false);
      setOffset(0);
      await refreshSubscriberList(0);
    } catch (err: unknown) {
      setAddError(formatAuthFormError(err));
    } finally {
      setAdding(false);
    }
  }

  const pageIds = rows.map((row) => row.subscriberId);
  const selectedOnPageCount = pageIds.filter((id) => selectedIds.has(id)).length;
  const allPageSelected = pageIds.length > 0 && selectedOnPageCount === pageIds.length;
  const somePageSelected = selectedOnPageCount > 0 && !allPageSelected;

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const id of pageIds) {
          next.delete(id);
        }
      } else {
        for (const id of pageIds) {
          next.add(id);
        }
      }
      return next;
    });
  }

  function toggleRow(subscriberId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(subscriberId)) {
        next.delete(subscriberId);
      } else {
        next.add(subscriberId);
      }
      return next;
    });
  }

  async function confirmRemove() {
    if (!removeTarget) {
      return;
    }
    setRemoving(true);
    setActionMessage(null);
    try {
      await removeAdminBlogSubscriber(removeTarget.subscriberId);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(removeTarget.subscriberId);
        return next;
      });
      setActionMessage("Subscriber removed from Blog subscription emails.");
      setRemoveTarget(null);
      await refreshSubscriberList(offset);
    } catch (err: unknown) {
      setActionMessage(formatAuthFormError(err));
      setRemoveTarget(null);
    } finally {
      setRemoving(false);
    }
  }

  async function handleQueueMessage() {
    setComposeError(null);
    setComposeSuccess(null);
    if (selectedIds.size < 1) {
      setComposeError("Select at least one subscriber.");
      return;
    }
    if (selectedIds.size > BLOG_ADMIN_MESSAGE_MAX_RECIPIENTS) {
      setComposeError(
        `At most ${BLOG_ADMIN_MESSAGE_MAX_RECIPIENTS} subscribers can be selected per send.`,
      );
      return;
    }
    setComposeQueuing(true);
    try {
      const result = await queueAdminBlogSubscriberMessage({
        subject: composeSubject,
        message: composeMessage,
        subscriberIds: [...selectedIds],
        ...(composeCtaLabel.trim() && composeCtaUrl.trim()
          ? { ctaLabel: composeCtaLabel.trim(), ctaUrl: composeCtaUrl.trim() }
          : {}),
      });
      setComposeSuccess(result.message);
      setSelectedIds(new Set());
      setComposeSubject("");
      setComposeMessage("");
      setComposeCtaLabel("");
      setComposeCtaUrl("");
    } catch (err: unknown) {
      setComposeError(formatAuthFormError(err));
    } finally {
      setComposeQueuing(false);
    }
  }

  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + rows.length, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;
  const totalCount = subscribedCount + notConfirmedCount + unsubscribedCount;

  return (
    <div className="admin-panel">
      <AdminPanelNavigation />
      <AdminViewsNavigation />

      <ProfileSection title="Subscribers">
        <p className="hu-body">
          Blog publication subscribers are managed separately from Participants and Members.
          <strong> Subscriber is not Participant</strong>, and{" "}
          <strong>Subscriber is not Member</strong>.
        </p>

        <dl className="admin-publishing__stats" aria-label="Subscriber counts">
          <div>
            <dt>Total</dt>
            <dd>{totalCount}</dd>
          </div>
          <div>
            <dt>Subscribed</dt>
            <dd>{subscribedCount}</dd>
          </div>
          <div>
            <dt>Not confirmed</dt>
            <dd>{notConfirmedCount}</dd>
          </div>
          <div>
            <dt>Unsubscribed</dt>
            <dd>{unsubscribedCount}</dd>
          </div>
        </dl>

        <div className="admin-panel__form admin-publishing__add-subscriber">
          <h3 className="hu-heading-4">Add Subscriber</h3>
          <p className="hu-caption admin-panel__note">
            Manually import a historical Blog subscriber. Does not create a Participant account.
            Confirmed imports do not send confirmation or Welcome email. Needs confirmation sends
            the normal confirmation email; Welcome follows only after the subscriber confirms.
          </p>
          <label className="hu-label" htmlFor={addNameId}>
            Name
          </label>
          <input
            id={addNameId}
            className="hu-form-control"
            type="text"
            value={addName}
            maxLength={120}
            disabled={adding}
            autoComplete="off"
            onChange={(event) => {
              setAddName(event.target.value);
              setAddError(null);
              setAddSuccess(null);
            }}
          />
          <label className="hu-label" htmlFor={addEmailId}>
            Email
          </label>
          <input
            id={addEmailId}
            className="hu-form-control"
            type="email"
            value={addEmail}
            required
            disabled={adding}
            autoComplete="off"
            onChange={(event) => {
              setAddEmail(event.target.value);
              setAddError(null);
              setAddSuccess(null);
            }}
          />
          <label className="hu-label" htmlFor={addImportModeId}>
            Subscription status
          </label>
          <select
            id={addImportModeId}
            className="hu-form-control"
            value={addImportMode}
            disabled={adding}
            onChange={(event) => {
              setAddImportMode(event.target.value as AdminBlogSubscriberImportMode);
              setAddError(null);
              setAddSuccess(null);
            }}
          >
            <option value="confirmed_existing">Confirmed existing subscriber</option>
            <option value="needs_confirmation">Needs confirmation</option>
          </select>
          <label className="admin-publishing__checkbox" htmlFor={addRestoreId}>
            <input
              id={addRestoreId}
              type="checkbox"
              checked={addRestoreUnsubscribed}
              disabled={adding}
              onChange={(event) => setAddRestoreUnsubscribed(event.target.checked)}
            />
            <span>Restore if currently unsubscribed</span>
          </label>
          <div className="admin-panel__links">
            <Button
              type="button"
              variant="primary"
              disabled={adding || addEmail.trim().length < 5}
              onClick={() => {
                void handleAddSubscriber();
              }}
            >
              {adding ? "Adding…" : "Add Subscriber"}
            </Button>
          </div>
          {addSuccess ? (
            <p className="hu-caption" role="status">
              {addSuccess}
            </p>
          ) : null}
          {addError ? (
            <p className="hu-body" role="alert">
              {addError}
            </p>
          ) : null}
        </div>

        <div className="admin-publishing__toolbar">
          <label className="admin-publishing__search" htmlFor={searchId}>
            <span className="visually-hidden">Search subscribers</span>
            <input
              id={searchId}
              className="hu-form-control"
              type="search"
              placeholder="Search subscribers…"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applySearch();
                }
              }}
            />
          </label>
          <Button type="button" variant="secondary" onClick={() => applySearch()}>
            Search
          </Button>
          <label className="admin-publishing__filter" htmlFor={statusFilterId}>
            <span className="hu-caption">Status</span>
            <select
              id={statusFilterId}
              className="hu-form-control"
              value={statusFilter}
              onChange={(event) => {
                setOffset(0);
                setStatusFilter(event.target.value as AdminBlogSubscriberStatusFilter);
              }}
            >
              <option value="all">All</option>
              <option value="subscribed">Subscribed</option>
              <option value="not_confirmed">Not confirmed</option>
              <option value="unsubscribed">Unsubscribed</option>
            </select>
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setOffset(offset);
              setAppliedSearch(appliedSearch);
              setListLoading(true);
              void listAdminBlogSubscribers({
                q: appliedSearch || undefined,
                status: statusFilter,
                limit: PAGE_SIZE,
                offset,
              })
                .then((response) => {
                  setRows(response.subscribers);
                  setTotal(response.total);
                  setSubscribedCount(response.subscribedCount);
                  setNotConfirmedCount(response.notConfirmedCount);
                  setUnsubscribedCount(response.unsubscribedCount);
                  setListError(null);
                })
                .catch((err: unknown) => setListError(formatAuthFormError(err)))
                .finally(() => setListLoading(false));
            }}
          >
            Refresh
          </Button>
        </div>

        {selectedIds.size > 0 ? (
          <p className="hu-caption admin-panel__note" role="status">
            {selectedIds.size} selected
          </p>
        ) : null}

        {listLoading ? <p className="hu-caption">Loading subscribers…</p> : null}
        {listError ? (
          <p className="hu-body" role="alert">
            {listError}
          </p>
        ) : null}
        {actionMessage ? (
          <p className="hu-caption" role="status">
            {actionMessage}
          </p>
        ) : null}

        {!listLoading && !listError && rows.length === 0 ? (
          <p className="hu-body">No subscribers match this filter.</p>
        ) : null}

        {!listLoading && rows.length > 0 ? (
          <div className="admin-publishing-table-wrap">
            <table className="admin-publishing-table">
              <thead>
                <tr>
                  <th scope="col">
                    <input
                      id={selectAllId}
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = somePageSelected;
                        }
                      }}
                      onChange={() => toggleSelectAll()}
                      aria-label="Select all subscribers on this page"
                    />
                  </th>
                  <th scope="col">Name</th>
                  <th scope="col">Subscription type</th>
                  <th scope="col">Email subscription</th>
                  <th scope="col">Date subscribed</th>
                  <th scope="col">Country</th>
                  <th scope="col">Emails sent</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const nameLabel = row.displayName?.trim() || row.email;
                  return (
                    <tr key={row.subscriberId}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.subscriberId)}
                          onChange={() => toggleRow(row.subscriberId)}
                          aria-label={`Select ${nameLabel}`}
                        />
                      </td>
                      <td>
                        <div className="admin-publishing-table__identity">
                          <div>
                            {row.displayName ? (
                              <>
                                <strong>{row.displayName}</strong>
                                <div className="hu-caption">{row.email}</div>
                              </>
                            ) : (
                              <strong>{row.email}</strong>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{formatBlogSubscriptionTypeLabel(row.subscriptionType)}</td>
                      <td>
                        <span className={blogSubscriptionStatusClassName(row.status)}>
                          {formatBlogSubscriptionStatusLabel(row.status)}
                        </span>
                      </td>
                      <td>
                        {row.status === "subscribed"
                          ? formatCompactDate(row.subscribedAt)
                          : "—"}
                      </td>
                      <td>{row.countryCode?.trim() || "—"}</td>
                      <td>{row.emailsSent}</td>
                      <td>
                        <div className="admin-publishing-table__actions">
                          <Button
                            type="button"
                            variant="danger"
                            disabled={removing}
                            onClick={() => setRemoveTarget(row)}
                          >
                            Remove Subscriber
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {!listLoading && total > 0 ? (
          <div className="admin-publishing__toolbar">
            <p className="hu-caption">
              Showing {pageStart}–{pageEnd} of {total}
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={!canPrev}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!canNext}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </ProfileSection>

      <ProfileSection title="Send message to selected subscribers">
        <div className="admin-panel__form">
          <p className="hu-caption admin-panel__note" role="status">
            {selectedIds.size === 0
              ? "Select subscribers in the table to enable sending."
              : `${selectedIds.size} selected`}
            {selectedIds.size > BLOG_ADMIN_MESSAGE_MAX_RECIPIENTS
              ? ` (maximum ${BLOG_ADMIN_MESSAGE_MAX_RECIPIENTS} per send)`
              : null}
          </p>
          <label className="hu-label" htmlFor={composeSubjectId}>
            Subject
          </label>
          <input
            id={composeSubjectId}
            className="hu-form-control"
            type="text"
            value={composeSubject}
            maxLength={BLOG_ADMIN_MESSAGE_SUBJECT_MAX_LENGTH}
            disabled={composeQueuing || selectedIds.size < 1}
            onChange={(event) => {
              setComposeSubject(event.target.value);
              setComposeError(null);
              setComposeSuccess(null);
            }}
          />
          <label className="hu-label" htmlFor={composeMessageId}>
            Message
          </label>
          <textarea
            id={composeMessageId}
            className="hu-form-control"
            rows={5}
            value={composeMessage}
            maxLength={BLOG_ADMIN_MESSAGE_BODY_MAX_LENGTH}
            disabled={composeQueuing || selectedIds.size < 1}
            onChange={(event) => {
              setComposeMessage(event.target.value);
              setComposeError(null);
              setComposeSuccess(null);
            }}
          />
          <label className="hu-label" htmlFor={composeCtaLabelId}>
            CTA label (optional)
          </label>
          <input
            id={composeCtaLabelId}
            className="hu-form-control"
            type="text"
            value={composeCtaLabel}
            maxLength={60}
            disabled={composeQueuing || selectedIds.size < 1}
            onChange={(event) => setComposeCtaLabel(event.target.value)}
          />
          <label className="hu-label" htmlFor={composeCtaUrlId}>
            CTA URL (optional)
          </label>
          <input
            id={composeCtaUrlId}
            className="hu-form-control"
            type="text"
            value={composeCtaUrl}
            disabled={composeQueuing || selectedIds.size < 1}
            placeholder="https://… or /blog"
            onChange={(event) => setComposeCtaUrl(event.target.value)}
          />
          <div className="admin-panel__links">
            <Button
              type="button"
              variant="primary"
              disabled={
                composeQueuing ||
                selectedIds.size < 1 ||
                selectedIds.size > BLOG_ADMIN_MESSAGE_MAX_RECIPIENTS ||
                composeSubject.trim().length < 1 ||
                composeMessage.trim().length < 1
              }
              onClick={() => {
                void handleQueueMessage();
              }}
            >
              {composeQueuing ? "Queuing…" : "Send to selected"}
            </Button>
          </div>
          {composeSuccess ? (
            <p className="hu-caption" role="status">
              {composeSuccess}
            </p>
          ) : null}
          {composeError ? (
            <p className="hu-body" role="alert">
              {composeError}
            </p>
          ) : null}
        </div>
      </ProfileSection>

      <ProfileSection title="Settings">
        <div className="admin-panel__form">
          <h3 className="hu-heading-4">Welcome Message</h3>
          <p className="hu-caption admin-panel__note">
            Plain text shown in the Welcome email after confirmation.
            {isDefault ? " Currently showing the platform default." : null}
          </p>

          {settingsLoading ? <p className="hu-caption">Loading settings…</p> : null}
          {settingsLoadError ? (
            <p className="hu-body" role="alert">
              {settingsLoadError}
            </p>
          ) : null}

          {!settingsLoading && !settingsLoadError ? (
            <>
              <label className="hu-label" htmlFor={welcomeId}>
                Welcome Message
              </label>
              <textarea
                id={welcomeId}
                className="hu-form-control"
                rows={6}
                value={welcomeMessage}
                maxLength={2000}
                disabled={saving}
                onChange={(event) => {
                  setWelcomeMessage(event.target.value);
                  setSaveMessage(null);
                  setSaveError(null);
                }}
              />
              <div className="admin-panel__links">
                <Button
                  type="button"
                  variant="primary"
                  disabled={saving || welcomeMessage.trim().length < 1}
                  onClick={() => {
                    void handleSaveSettings();
                  }}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
              {saveMessage ? (
                <p className="hu-caption" role="status">
                  {saveMessage}
                </p>
              ) : null}
              {saveError ? (
                <p className="hu-body" role="alert">
                  {saveError}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      </ProfileSection>

      <ConfirmDialog
        isOpen={removeTarget !== null}
        title="Remove subscriber?"
        description="This subscriber will no longer receive Blog subscription emails."
        confirmLabel="Remove Subscriber"
        cancelLabel="Cancel"
        destructive
        isConfirming={removing}
        onCancel={() => {
          if (!removing) {
            setRemoveTarget(null);
          }
        }}
        onConfirm={() => {
          void confirmRemove();
        }}
      />
    </div>
  );
}
