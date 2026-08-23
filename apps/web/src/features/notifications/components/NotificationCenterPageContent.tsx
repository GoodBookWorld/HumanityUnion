"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { DirectConversationSummary } from "@hu/types";

import { isAuthenticationRequiredError } from "../../../lib/api-client";
import { HumanityUnionAssistantWidget } from "../../humanity-union-assistant";
import { formatInitiativeDate } from "../../initiatives/initiative-lifecycle-labels";
import { fetchMyDirectConversations } from "../../direct-messaging/api";
import { DIRECT_MESSAGES_CHANGED_EVENT } from "../../direct-messaging/direct-messaging-events";
import { formatDirectConversationActivity } from "../../direct-messaging/direct-messaging-format";

import {
  archiveNotification,
  clearArchivedNotifications,
  deleteNotification,
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  priorityLabel,
  type MemberNotificationView,
} from "../api";
import { dispatchNotificationsChanged, NOTIFICATIONS_CHANGED_EVENT } from "../notification-events";
import {
  completeReminder,
  deleteReminder,
  fetchMyReminders,
  type CommunicationReminderView,
} from "../reminders-api";

import { CommunicationCard } from "./CommunicationCard";
import { CommunicationSummary } from "./CommunicationSummary";
import { NotificationCenterParticipantIdentity } from "./NotificationCenterParticipantIdentity";
import { ConfirmDialog } from "../../../design-system/components/ConfirmDialog";

import "../notifications-page.css";

/**
 * Lifecycle UX Correction Pack 01 Part 1 — Communication event types.
 * Direct Messages and Initiative Collaboration Channel / Group Chat
 * activity are person-to-person communication, never a platform/Initiative
 * Notification (Part 1's routing table). They are excluded from the
 * Notifications section entirely and surfaced in Messages instead — a
 * presentation-only routing decision; the underlying `MemberNotification`
 * row is untouched (still exists, still counted, still powers the header
 * bell exactly as before).
 */
const DIRECT_MESSAGE_EVENT_TYPE = "direct_message_received";
const CHANNEL_EVENT_TYPES = [
  "initiative_collaboration_channel_message_received",
  "initiative_collaboration_channel_system_event",
] as const;

function isCommunicationEventType(eventType: string): boolean {
  return (
    eventType === DIRECT_MESSAGE_EVENT_TYPE ||
    (CHANNEL_EVENT_TYPES as readonly string[]).includes(eventType)
  );
}

function isPlatformNotification(notification: MemberNotificationView): boolean {
  return !isCommunicationEventType(notification.eventType);
}

function isChannelNotification(notification: MemberNotificationView): boolean {
  return (CHANNEL_EVENT_TYPES as readonly string[]).includes(notification.eventType);
}

/** One unread Collaboration Channel/Group Chat notification per Initiative — this is a "conversation" card, not one row per message. */
function dedupeChannelNotificationsByInitiative(
  notifications: MemberNotificationView[],
): MemberNotificationView[] {
  const latestByInitiative = new Map<string, MemberNotificationView>();

  for (const notification of notifications) {
    const existing = latestByInitiative.get(notification.relatedEntityId);

    if (!existing || new Date(notification.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
      latestByInitiative.set(notification.relatedEntityId, notification);
    }
  }

  return [...latestByInitiative.values()];
}

function NotificationRow({
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
    <CommunicationCard
      mode="notification"
      title={notification.title}
      description={notification.message}
      meta={`Recorded ${formatInitiativeDate(notification.createdAt)}`}
      unread={notification.status === "unread"}
      unreadLabel="Unread notification"
      badge={
        <span
          className={`notifications-page__badge notifications-page__badge--${notification.priority}`}
        >
          {priorityLabel(notification.priority)}
        </span>
      }
      actions={
        <>
          {notification.relatedUrl ? (
            <Link
              className="notifications-page__link"
              href={notification.relatedUrl}
              onClick={() => {
                if (notification.status === "unread") {
                  void handleMarkRead();
                }
              }}
            >
              {notification.eventType.startsWith("editor_access_") ||
              notification.eventType.startsWith("editor_permissions_") ||
              notification.eventType.startsWith("editor_editing_area_")
                ? "View Editor Panel"
                : "View related civic record"}
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
          <button
            type="button"
            className="notifications-page__button"
            disabled={busy}
            onClick={() => void handleArchive()}
          >
            Archive
          </button>
        </>
      }
    />
  );
}

function DirectMessageRow({ conversation }: { conversation: DirectConversationSummary }) {
  return (
    <CommunicationCard
      mode="message"
      avatarUrl={conversation.otherParticipant.avatarUrl}
      title={conversation.otherParticipant.displayName}
      description={conversation.lastMessagePreview ?? "No messages yet."}
      meta={formatDirectConversationActivity(conversation.lastMessageAt)}
      unread={conversation.unread}
      unreadLabel={`Unread message from ${conversation.otherParticipant.displayName}`}
      href={`/workspace/messages/${encodeURIComponent(conversation.conversationId)}`}
      ariaLabel={`Open conversation with ${conversation.otherParticipant.displayName}`}
    />
  );
}

/**
 * Part 1/5 — an unread Initiative Collaboration Channel/Group Chat
 * "conversation" card. Opening it deep-links into Workspace Messages
 * (Channel mode), which already marks the Channel — and, via this pack's
 * `markInitiativeCollaborationChannelNotificationsRead` wiring — this same
 * underlying notification as read, so it naturally drops out of this
 * unread-only list on next load without any extra call from here.
 */
function ChannelMessageRow({ notification }: { notification: MemberNotificationView }) {
  return (
    <CommunicationCard
      mode="message"
      title={notification.title}
      description={notification.message}
      meta={formatInitiativeDate(notification.createdAt)}
      unread
      unreadLabel="Unread Initiative Collaboration Channel activity"
      href={notification.relatedUrl}
      ariaLabel={notification.title}
    />
  );
}

function ReminderRow({
  reminder,
  onFollowed,
}: {
  reminder: CommunicationReminderView;
  onFollowed: (reminderId: string) => void;
}) {
  return (
    <CommunicationCard
      mode="reminder"
      title={reminder.title}
      description={reminder.message}
      meta={formatInitiativeDate(reminder.createdAt)}
      href={reminder.relatedUrl}
      ariaLabel={reminder.title}
      onClick={() => {
        void completeReminder(reminder.reminderId).catch(() => {});
        onFollowed(reminder.reminderId);
      }}
    />
  );
}

function ArchiveRow({
  item,
  onDeleted,
}: {
  item:
    | { kind: "notification"; record: MemberNotificationView; timestamp: number }
    | { kind: "reminder"; record: CommunicationReminderView; timestamp: number };
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);

    try {
      if (item.kind === "notification") {
        await deleteNotification(item.record.notificationId);
      } else {
        await deleteReminder(item.record.reminderId);
      }

      onDeleted();
    } finally {
      setBusy(false);
    }
  }

  const record = item.record;
  const timestampLabel =
    item.kind === "notification"
      ? item.record.archivedAt ?? item.record.createdAt
      : item.record.completedAt ?? item.record.createdAt;

  return (
    <CommunicationCard
      mode={item.kind}
      title={record.title}
      description={record.message}
      meta={`Archived ${formatInitiativeDate(timestampLabel)}`}
      actions={
        <button
          type="button"
          className="notifications-page__button"
          disabled={busy}
          onClick={() => void handleDelete()}
        >
          Delete
        </button>
      }
    />
  );
}

type SectionLoadState = "loading" | "unauthenticated" | "ready" | "error";

export function NotificationCenterPageContent() {
  const [authenticated, setAuthenticated] = useState(false);

  const [notificationsState, setNotificationsState] = useState<SectionLoadState>("loading");
  const [notifications, setNotifications] = useState<MemberNotificationView[]>([]);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  const [conversationsState, setConversationsState] = useState<SectionLoadState>("loading");
  const [conversations, setConversations] = useState<DirectConversationSummary[]>([]);
  const [conversationsError, setConversationsError] = useState<string | null>(null);

  const [remindersState, setRemindersState] = useState<SectionLoadState>("loading");
  const [reminders, setReminders] = useState<CommunicationReminderView[]>([]);
  const [clearArchiveOpen, setClearArchiveOpen] = useState(false);
  const [clearingArchive, setClearingArchive] = useState(false);

  const loadNotifications = useCallback(async () => {
    setNotificationsState((current) => (current === "ready" ? current : "loading"));

    try {
      /*
       * Part 3 — the Notification Center no longer exposes an "All"
       * filter; every status is fetched once here and split client-side
       * into "active" (Notifications section) and "archived" (Archive
       * section), exactly like the existing communication-type exclusion
       * below. One fetch, two derived views — never a duplicated query.
       */
      const response = await fetchMyNotifications({ status: "all", limit: 100 });
      setAuthenticated(true);
      setNotifications(response.notifications);
      setNotificationsState("ready");
    } catch (fetchError) {
      if (isAuthenticationRequiredError(fetchError)) {
        setAuthenticated(false);
        setNotificationsState("unauthenticated");
        setNotifications([]);
      } else {
        setNotificationsError(
          fetchError instanceof Error ? fetchError.message : "Notification center request failed.",
        );
        setNotificationsState("error");
      }
    }
  }, []);

  const loadConversations = useCallback(async () => {
    setConversationsState((current) => (current === "ready" ? current : "loading"));

    try {
      const response = await fetchMyDirectConversations();
      setConversations(response.conversations);
      setConversationsState("ready");
    } catch (fetchError) {
      if (isAuthenticationRequiredError(fetchError)) {
        setConversationsState("unauthenticated");
        setConversations([]);
      } else {
        setConversationsError(
          fetchError instanceof Error ? fetchError.message : "Messages preview request failed.",
        );
        setConversationsState("error");
      }
    }
  }, []);

  const loadReminders = useCallback(async () => {
    setRemindersState((current) => (current === "ready" ? current : "loading"));

    try {
      const response = await fetchMyReminders({ status: "all", limit: 100 });
      setReminders(response.reminders);
      setRemindersState("ready");
    } catch {
      setRemindersState("error");
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    void loadConversations();
    void loadReminders();
  }, [loadNotifications, loadConversations, loadReminders]);

  useEffect(() => {
    function handleNotificationsChanged() {
      void loadNotifications();
    }

    function handleMessagesChanged() {
      void loadConversations();
    }

    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged);
    window.addEventListener(DIRECT_MESSAGES_CHANGED_EVENT, handleMessagesChanged);

    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged);
      window.removeEventListener(DIRECT_MESSAGES_CHANGED_EVENT, handleMessagesChanged);
    };
  }, [loadNotifications, loadConversations]);

  const activeNotifications = useMemo(
    () =>
      notifications.filter((notification) => isPlatformNotification(notification) && notification.status !== "archived"),
    [notifications],
  );
  const archivedNotifications = useMemo(
    () => notifications.filter((notification) => isPlatformNotification(notification) && notification.status === "archived"),
    [notifications],
  );
  const unreadChannelConversations = useMemo(
    () =>
      dedupeChannelNotificationsByInitiative(
        notifications.filter((notification) => isChannelNotification(notification) && notification.status === "unread"),
      ),
    [notifications],
  );
  const unreadDirectConversations = useMemo(
    () => conversations.filter((conversation) => conversation.unread),
    [conversations],
  );
  const activeReminders = useMemo(() => reminders.filter((reminder) => reminder.status === "active"), [reminders]);
  const archivedReminders = useMemo(() => reminders.filter((reminder) => reminder.status === "archived"), [reminders]);

  /*
   * Every count below is derived from data already fetched for its own
   * section (no new backend call, no new aggregation service).
   */
  const unreadNotificationsCount = useMemo(
    () => activeNotifications.filter((notification) => notification.status === "unread").length,
    [activeNotifications],
  );
  const unreadMessagesCount = unreadDirectConversations.length + unreadChannelConversations.length;
  const pendingRemindersCount = activeReminders.length;

  type ArchiveEntry =
    | { kind: "notification"; record: MemberNotificationView; timestamp: number }
    | { kind: "reminder"; record: CommunicationReminderView; timestamp: number };

  const archiveItems = useMemo<ArchiveEntry[]>(() => {
    const items: ArchiveEntry[] = [
      ...archivedNotifications.map((record) => ({
        kind: "notification" as const,
        record,
        timestamp: new Date(record.archivedAt ?? record.createdAt).getTime(),
      })),
      ...archivedReminders.map((record) => ({
        kind: "reminder" as const,
        record,
        timestamp: new Date(record.completedAt ?? record.archivedAt ?? record.createdAt).getTime(),
      })),
    ];

    return items.sort((left, right) => right.timestamp - left.timestamp);
  }, [archivedNotifications, archivedReminders]);

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    dispatchNotificationsChanged();
    await loadNotifications();
  }

  function handleReminderFollowed(reminderId: string) {
    const timestamp = new Date().toISOString();
    setReminders((current) =>
      current.map((reminder) =>
        reminder.reminderId === reminderId
          ? { ...reminder, status: "archived", completedAt: timestamp, archivedAt: timestamp }
          : reminder,
      ),
    );
  }

  async function handleClearArchiveConfirm() {
    setClearingArchive(true);
    try {
      await clearArchivedNotifications();
      setClearArchiveOpen(false);
      await loadNotifications();
      dispatchNotificationsChanged();
    } catch {
      // Keep dialog open so the participant can retry or cancel.
    } finally {
      setClearingArchive(false);
    }
  }

  return (
    <main className="notifications-page">
      <header className="notifications-page__header">
        <div className="notifications-page__header-copy">
          <div className="notifications-page__title-row">
            {authenticated ? <NotificationCenterParticipantIdentity /> : null}
            <h1 className="notifications-page__title hu-heading-1">Notification Center</h1>
          </div>
          <p className="notifications-page__summary">
            Your active hub for civic notifications, incoming messages, and personal reminders.
          </p>
        </div>
        <div className="notifications-page__header-assistant">
          <HumanityUnionAssistantWidget surfaceId="notifications" />
        </div>
      </header>

      {!authenticated ? (
        <div className="notifications-page__login-prompt">
          <p>Sign in to view your Notification Center.</p>
          <Link className="notifications-page__link" href="/login">
            Sign in
          </Link>
        </div>
      ) : (
        <>
          <CommunicationSummary
            unreadNotifications={unreadNotificationsCount}
            unreadMessages={unreadMessagesCount}
            pendingReminders={pendingRemindersCount}
          />

          <div className="notifications-page__columns">
            <section
              className="notifications-page__section"
              aria-labelledby="notifications-section-heading"
            >
              <div className="notifications-page__section-header">
                <h2 id="notifications-section-heading" className="notifications-page__section-title">
                  Notifications
                </h2>
                {unreadNotificationsCount > 0 ? (
                  <button
                    type="button"
                    className="notifications-page__button"
                    onClick={() => void handleMarkAllRead()}
                  >
                    Mark all read
                  </button>
                ) : null}
              </div>

              {notificationsState === "loading" ? (
                <p className="notifications-page__empty">Loading notifications…</p>
              ) : null}
              {notificationsState === "error" ? (
                <p className="notifications-page__error">{notificationsError}</p>
              ) : null}
              {notificationsState === "ready" && activeNotifications.length === 0 ? (
                <p className="notifications-page__empty">No active notifications.</p>
              ) : null}
              {notificationsState === "ready" && activeNotifications.length > 0 ? (
                <ul className="notifications-page__list">
                  {activeNotifications.map((notification) => (
                    <NotificationRow
                      key={notification.notificationId}
                      notification={notification}
                      onUpdated={() => void loadNotifications()}
                    />
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="notifications-page__section" aria-labelledby="messages-section-heading">
              <div className="notifications-page__section-header">
                <h2 id="messages-section-heading" className="notifications-page__section-title">
                  Messages
                </h2>
                <Link className="notifications-page__link" href="/workspace/messages">
                  Open Workspace Messages
                </Link>
              </div>

              {conversationsState === "loading" ? (
                <p className="notifications-page__empty">Loading messages…</p>
              ) : null}
              {conversationsState === "error" ? (
                <p className="notifications-page__error">{conversationsError}</p>
              ) : null}
              {conversationsState === "ready" &&
              unreadDirectConversations.length === 0 &&
              unreadChannelConversations.length === 0 ? (
                <p className="notifications-page__empty">No unread messages.</p>
              ) : null}
              {conversationsState === "ready" &&
              (unreadDirectConversations.length > 0 || unreadChannelConversations.length > 0) ? (
                <ul className="notifications-page__list">
                  {unreadDirectConversations.map((conversation) => (
                    <DirectMessageRow key={conversation.conversationId} conversation={conversation} />
                  ))}
                  {unreadChannelConversations.map((notification) => (
                    <ChannelMessageRow key={notification.notificationId} notification={notification} />
                  ))}
                </ul>
              ) : null}
            </section>

            <section className="notifications-page__section" aria-labelledby="reminders-section-heading">
              <div className="notifications-page__section-header">
                <h2 id="reminders-section-heading" className="notifications-page__section-title">
                  Reminders
                </h2>
              </div>

              {remindersState === "loading" ? (
                <p className="notifications-page__empty">Loading reminders…</p>
              ) : null}
              {remindersState === "ready" && activeReminders.length === 0 ? (
                <p className="notifications-page__empty">No reminders yet.</p>
              ) : null}
              {remindersState === "ready" && activeReminders.length > 0 ? (
                <ul className="notifications-page__list">
                  {activeReminders.map((reminder) => (
                    <ReminderRow
                      key={reminder.reminderId}
                      reminder={reminder}
                      onFollowed={handleReminderFollowed}
                    />
                  ))}
                </ul>
              ) : null}
            </section>
          </div>

          {/*
           * Part 3/9 — Archive is a separate area below the three active
           * sections, never a fourth tab sharing their scroll: only
           * completed Notifications and Reminders ever appear here, and
           * Messages are never archived (their history lives in Workspace
           * Messages).
           */}
          <section className="notifications-page__archive" aria-labelledby="archive-section-heading">
            <div className="notifications-page__section-header">
              <h2 id="archive-section-heading" className="notifications-page__section-title">
                Archive
              </h2>
              {archivedNotifications.length > 0 ? (
                <button
                  type="button"
                  className="notifications-page__button"
                  onClick={() => setClearArchiveOpen(true)}
                >
                  Clear archive
                </button>
              ) : null}
            </div>

            {archiveItems.length === 0 ? (
              <p className="notifications-page__empty">Nothing archived yet.</p>
            ) : (
              <ul className="notifications-page__archive-list">
                {archiveItems.map((item) => (
                  <ArchiveRow
                    key={`${item.kind}-${
                      item.kind === "notification" ? item.record.notificationId : item.record.reminderId
                    }`}
                    item={item}
                    onDeleted={() => {
                      void loadNotifications();
                      void loadReminders();
                    }}
                  />
                ))}
              </ul>
            )}
          </section>

          <ConfirmDialog
            isOpen={clearArchiveOpen}
            title="Clear notification archive?"
            description="This will permanently remove all archived notifications. This action cannot be undone."
            cancelLabel="Cancel"
            confirmLabel="Clear archive"
            destructive
            isConfirming={clearingArchive}
            onCancel={() => {
              if (!clearingArchive) {
                setClearArchiveOpen(false);
              }
            }}
            onConfirm={() => void handleClearArchiveConfirm()}
          />
        </>
      )}
    </main>
  );
}
