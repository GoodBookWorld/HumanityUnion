"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { getStoredAccessToken } from "../../auth/auth-token-store";
import { isAuthenticationRequiredError } from "../../../lib/api-client";
import { formatInitiativeDate } from "../../initiatives/initiative-lifecycle-labels";

import {
  archiveNotification,
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  priorityLabel,
  type MemberNotificationView,
  type NotificationFilter,
} from "../api";
import { dispatchNotificationsChanged } from "../notification-events";

import "../notifications-page.css";

const FILTERS: Array<{ id: NotificationFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "archived", label: "Archived" },
];

function NotificationItem({
  notification,
  onUpdated,
}: {
  notification: MemberNotificationView;
  onUpdated: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleMarkRead() {
    setBusy(true);

    try {
      await markNotificationRead(notification.notificationId);
      dispatchNotificationsChanged();
      onUpdated();
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    setBusy(true);

    try {
      await archiveNotification(notification.notificationId);
      onUpdated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={`notifications-page__item ${notification.status === "unread" ? "notifications-page__item--unread" : ""}`}
    >
      <div className="notifications-page__item-header">
        <h2 className="notifications-page__item-title">{notification.title}</h2>
        <span
          className={`notifications-page__badge notifications-page__badge--${notification.priority}`}
        >
          {priorityLabel(notification.priority)}
        </span>
      </div>
      <p className="notifications-page__message">{notification.message}</p>
      <p className="notifications-page__meta">
        Recorded {formatInitiativeDate(notification.createdAt)}
      </p>
      <div className="notifications-page__item-actions">
        {notification.relatedUrl ? (
          <Link className="notifications-page__link" href={notification.relatedUrl}>
            View related civic record
          </Link>
        ) : null}
        {notification.status === "unread" ? (
          <button
            type="button"
            className="notifications-page__button"
            disabled={busy}
            onClick={() => void handleMarkRead()}
          >
            Mark read
          </button>
        ) : null}
        {notification.status !== "archived" ? (
          <button
            type="button"
            className="notifications-page__button"
            disabled={busy}
            onClick={() => void handleArchive()}
          >
            Archive
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function NotificationCenterPageContent() {
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [notifications, setNotifications] = useState<MemberNotificationView[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!getStoredAccessToken()) {
      setAuthenticated(false);
      setLoading(false);
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    setAuthenticated(true);
    setLoading(true);
    setError(null);

    try {
      const response = await fetchMyNotifications({ status: filter, limit: 50 });
      setNotifications(response.notifications);
      setUnreadCount(response.unreadCount);
    } catch (fetchError) {
      if (isAuthenticationRequiredError(fetchError)) {
        setAuthenticated(false);
        setNotifications([]);
        setUnreadCount(0);
      } else {
        setError(
          fetchError instanceof Error ? fetchError.message : "Notification center request failed.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    dispatchNotificationsChanged();
    await loadNotifications();
  }

  return (
    <>
      <main className="notifications-page">
        <header className="notifications-page__header">
          <div>
            <h1 className="notifications-page__title">Notification Center</h1>
            <p className="notifications-page__summary">
              Private civic notifications about your responsibilities and public records.
            </p>
          </div>
          {authenticated && unreadCount > 0 ? (
            <div className="notifications-page__actions">
              <button
                type="button"
                className="notifications-page__button"
                onClick={() => void handleMarkAllRead()}
              >
                Mark all read
              </button>
            </div>
          ) : null}
        </header>

        {!authenticated ? (
          <div className="notifications-page__login-prompt">
            <p>Sign in to view your private civic notifications.</p>
            <Link className="notifications-page__link" href="/login">
              Sign in
            </Link>
          </div>
        ) : (
          <>
            <div
              className="notifications-page__filters"
              role="tablist"
              aria-label="Notification filters"
            >
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  className={`notifications-page__filter ${filter === item.id ? "notifications-page__filter--active" : ""}`}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                  {item.id === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
                </button>
              ))}
            </div>

            {loading ? <p className="notifications-page__empty">Loading notifications…</p> : null}
            {error ? <p className="notifications-page__error">{error}</p> : null}

            {!loading && !error && notifications.length === 0 ? (
              <p className="notifications-page__empty">No notifications in this view.</p>
            ) : null}

            {!loading && !error && notifications.length > 0 ? (
              <ul className="notifications-page__list">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.notificationId}
                    notification={notification}
                    onUpdated={() => void loadNotifications()}
                  />
                ))}
              </ul>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
