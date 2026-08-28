"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";

import type { AdminNotification } from "@hu/types";

import {
  deleteAdminNotification,
  fetchAdminNotificationCount,
  fetchAdminNotifications,
} from "../admin-notification-api";
import {
  formatAdminNotificationDate,
  resolveAdminNotificationHref,
  resolveAdminNotificationTypeLabel,
} from "../admin-notification-labels";

import "./admin-workspace-header.css";

const ATTENTION_ICON = "/icons/messenger/attention.png";
const CLEAR_ICON = "/icons/workspace/cross.svg";

interface AdminWorkspaceHeaderProps {
  title: string;
  subtitle?: string;
}

/**
 * Pack 22E.2 — Admin Panel header with Notification widget + inline panel.
 * Scoped to Admin layout only via headerBar.
 */
export function AdminWorkspaceHeader({ title, subtitle }: AdminWorkspaceHeaderProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<AdminNotification[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearingId, setClearingId] = useState<string | null>(null);

  const refreshCount = useCallback(async () => {
    try {
      const result = await fetchAdminNotificationCount();
      setCount(typeof result.count === "number" ? result.count : 0);
    } catch {
      // Keep last known count; widget remains usable.
    }
  }, []);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshCount();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [refreshCount]);

  async function loadList() {
    setListLoading(true);
    setListError(null);
    setClearError(null);
    try {
      const result = await fetchAdminNotifications({ limit: 50 });
      setNotifications(result.notifications ?? []);
    } catch (error) {
      setListError(
        error instanceof Error ? error.message : "Unable to load Admin notifications.",
      );
      setNotifications(null);
    } finally {
      setListLoading(false);
    }
  }

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      await loadList();
    }
  }

  async function handleClear(notification: AdminNotification, event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setClearError(null);
    setClearingId(notification.adminNotificationId);
    try {
      await deleteAdminNotification(notification.adminNotificationId);
      setNotifications((current) =>
        (current ?? []).filter((row) => row.adminNotificationId !== notification.adminNotificationId),
      );
      await refreshCount();
    } catch (error) {
      setClearError(
        error instanceof Error ? error.message : "Unable to clear notification.",
      );
    } finally {
      setClearingId(null);
    }
  }

  return (
    <div className="admin-workspace-header">
      <header className="member-workspace__header admin-workspace-header__bar">
        <div className="admin-workspace-header__copy">
          <h1 className="member-workspace__title">{title}</h1>
          {subtitle ? <p className="member-workspace__subtitle">{subtitle}</p> : null}
        </div>

        <button
          type="button"
          className="admin-workspace-header__trigger"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={
            count > 0
              ? `Notification, ${count} unread`
              : "Notification"
          }
          onClick={() => void handleToggle()}
        >
          <img
            src={ATTENTION_ICON}
            alt=""
            width={22}
            height={22}
            className="admin-workspace-header__icon"
            draggable={false}
          />
          <span className="admin-workspace-header__label">Notification</span>
          {count > 0 ? (
            <span className="admin-workspace-header__count" aria-hidden="true">
              {count}
            </span>
          ) : null}
        </button>
      </header>

      {open ? (
        <div
          id={panelId}
          className="admin-workspace-header__panel"
          role="region"
          aria-label="Admin notifications"
        >
          {listLoading ? (
            <p className="admin-workspace-header__status" role="status">
              Loading notifications…
            </p>
          ) : null}

          {listError ? (
            <p className="admin-workspace-header__error" role="alert">
              {listError}
            </p>
          ) : null}

          {clearError ? (
            <p className="admin-workspace-header__error" role="alert">
              {clearError}
            </p>
          ) : null}

          {!listLoading && !listError && notifications && notifications.length === 0 ? (
            <p className="admin-workspace-header__empty" role="status">
              No notifications
            </p>
          ) : null}

          {!listLoading && notifications && notifications.length > 0 ? (
            <ul className="admin-workspace-header__list">
              {notifications.map((notification) => {
                const typeLabel = resolveAdminNotificationTypeLabel(notification);
                const dateLabel = formatAdminNotificationDate(notification.createdAt);
                const href = resolveAdminNotificationHref(notification);
                const content = (
                  <>
                    {dateLabel ? (
                      <time
                        className="admin-workspace-header__row-date"
                        dateTime={notification.createdAt}
                      >
                        {dateLabel}
                      </time>
                    ) : null}
                    <span className="admin-workspace-header__row-title">{typeLabel}</span>
                    {notification.targetLabel ? (
                      <span className="admin-workspace-header__row-target">
                        {notification.targetLabel}
                      </span>
                    ) : null}
                    {notification.actorLabel ? (
                      <span className="admin-workspace-header__row-actor">
                        {notification.actorLabel}
                      </span>
                    ) : null}
                  </>
                );

                return (
                  <li
                    key={notification.adminNotificationId}
                    className="admin-workspace-header__row"
                  >
                    {href ? (
                      <Link href={href} className="admin-workspace-header__row-link">
                        {content}
                      </Link>
                    ) : (
                      <div className="admin-workspace-header__row-body">{content}</div>
                    )}
                    <button
                      type="button"
                      className="admin-workspace-header__clear"
                      aria-label={`Clear ${typeLabel}`}
                      disabled={clearingId === notification.adminNotificationId}
                      onClick={(event) => void handleClear(notification, event)}
                    >
                      <img src={CLEAR_ICON} alt="" width={14} height={14} draggable={false} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
