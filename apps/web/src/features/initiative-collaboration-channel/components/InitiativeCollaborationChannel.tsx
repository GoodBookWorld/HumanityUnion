"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type {
  InitiativeActiveAllyEntry,
  InitiativeCollaborationChannelMessageView,
  InitiativeCollaborationChannelSummary,
} from "@hu/types";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { ApiRequestError } from "../../../lib/api-client";
import { getInitiativeActiveAlliesTeam } from "../../initiative-active-allies/api";
import { useOpenDirectConversation } from "../../direct-messaging/use-open-direct-conversation";
import { SharedDocumentsPanel } from "../../shared-documents/components/SharedDocumentsPanel";
import {
  getInitiativeCollaborationChannelSummary,
  listInitiativeCollaborationChannelHistory,
  markInitiativeCollaborationChannelRead,
  sendInitiativeCollaborationChannelMessage,
} from "../api";
import { formatCollaborationChannelTimestamp } from "../collaboration-channel-format";
import { resolveCollaborationChannelSystemEventDisplay } from "../../public-initiative-experience/initiative-experience-i18n";

import "./initiative-collaboration-channel.css";

const MAX_MESSAGE_LENGTH = 2000;
/** Bounded polling while the Channel is mounted (Part 13 — a genuinely new, non-duplicated poll; no WebSocket infra exists, Part 14). */
const POLL_INTERVAL_MS = 15_000;
const MESSAGE_ICON = "/icons/workspace/message.svg";

function mergeNewMessages(
  current: InitiativeCollaborationChannelMessageView[],
  incoming: InitiativeCollaborationChannelMessageView[],
): InitiativeCollaborationChannelMessageView[] {
  const knownIds = new Set(current.map((message) => message.messageId));
  const newOnes = incoming.filter((message) => !knownIds.has(message.messageId));

  return newOnes.length === 0 ? current : [...current, ...newOnes];
}

function ChannelMessageRow({ message }: { message: InitiativeCollaborationChannelMessageView }) {
  const t = useTranslations("initiativeExperience");
  const locale = useLocale();

  if (message.type === "system_event") {
    const systemEventText = resolveCollaborationChannelSystemEventDisplay(message, t);
    return (
      <li className="icc-channel__system-event" role="note">
        <span className="icc-channel__system-event-text">{systemEventText}</span>
        <span className="icc-channel__system-event-time">
          {formatCollaborationChannelTimestamp(message.createdAt, locale)}
        </span>
      </li>
    );
  }

  return (
    <li
      className={`icc-channel__message${message.isOwnMessage ? " icc-channel__message--own" : ""}`}
    >
      {!message.isOwnMessage ? (
        <p className="icc-channel__message-sender">
          {message.sender?.displayName ?? t("collaboration.channel.participantFallback")}
        </p>
      ) : null}
      <p className="icc-channel__message-text">{message.text}</p>
      <p className="icc-channel__message-time">
        {formatCollaborationChannelTimestamp(message.createdAt, locale)}
      </p>
    </li>
  );
}

/** Part 8 — participants panel Message button; reuses the exact shared open/create Direct Conversation action (never a duplicate implementation). */
function ChannelParticipantMessageButton({ entry }: { entry: InitiativeActiveAllyEntry }) {
  const t = useTranslations("initiativeExperience");
  const { isOpening, openConversation } = useOpenDirectConversation();

  if (!entry.participantId || !entry.canMessage) {
    return null;
  }

  return (
    <button
      type="button"
      className="icc-channel__participant-message-button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openConversation({ participantId: entry.participantId });
      }}
      disabled={isOpening}
      aria-label={t("collaboration.channel.messageAria", { name: entry.displayName })}
    >
      <Image src={MESSAGE_ICON} alt="" width={14} height={14} aria-hidden="true" />
      {entry.hasUnreadMessages ? (
        <>
          <span className="icc-channel__participant-unread-dot" aria-hidden="true" />
          <span className="icc-channel__visually-hidden">
            {t("collaboration.channel.unreadAria", { name: entry.displayName })}
          </span>
        </>
      ) : null}
    </button>
  );
}

/**
 * Part 8 — Avatar, Name, Role, Message button, Current status. "Current
 * status" is presentation-only here (every entry in this projection is
 * already `active` by definition, Part 13 — no new field or query is
 * introduced); it is kept as a distinct badge from Role so a future
 * presence indicator (Part 4/10, "Online indicator (future)") has a clean
 * slot to extend without a layout change.
 */
function ChannelParticipantRow({ entry }: { entry: InitiativeActiveAllyEntry }) {
  const t = useTranslations("initiativeExperience");
  const roleLabel =
    entry.role === "author"
      ? t("collaboration.channel.roleAuthor")
      : t("collaboration.channel.roleAlly");

  return (
    <li className="icc-channel__participant-row">
      {entry.profileUrl ? (
        <Link href={entry.profileUrl} className="icc-channel__participant-identity">
          <HumanityAvatar avatarUrl={entry.avatarUrl} size={28} alt="" />
          <span className="icc-channel__participant-name">{entry.displayName}</span>
        </Link>
      ) : (
        <span className="icc-channel__participant-identity">
          <HumanityAvatar avatarUrl={entry.avatarUrl} size={28} alt="" />
          <span className="icc-channel__participant-name">{entry.displayName}</span>
        </span>
      )}
      <span className="icc-channel__participant-role">{roleLabel}</span>
      <span className="icc-channel__participant-status">
        <span className="icc-channel__participant-status-dot" aria-hidden="true" />
        {t("collaboration.channel.presenceActive")}
      </span>
      <ChannelParticipantMessageButton entry={entry} />
    </li>
  );
}

interface InitiativeCollaborationChannelProps {
  initiativeId: string;
}

type LoadState = "loading" | "ready" | "error";

/**
 * Communication UX Pack 03.5 — the Initiative Collaboration Channel: the
 * Author's/Active Allies' persistent working-collaboration surface (Part
 * 3), replacing the public sidebar. Header → History → Composer →
 * Participants (Part 4/11 — the same order on every breakpoint, matching
 * the mandated mobile stacking order).
 */
export function InitiativeCollaborationChannel({ initiativeId }: InitiativeCollaborationChannelProps) {
  const t = useTranslations("initiativeExperience");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<InitiativeCollaborationChannelSummary | null>(null);
  const [messages, setMessages] = useState<InitiativeCollaborationChannelMessageView[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [participants, setParticipants] = useState<InitiativeActiveAllyEntry[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const historyRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledInitiallyRef = useRef(false);
  const previousLatestMessageIdRef = useRef<string | null>(null);

  const scrollHistoryToBottom = useCallback((behavior: ScrollBehavior) => {
    historyRef.current?.scrollTo({ top: historyRef.current.scrollHeight, behavior });
  }, []);

  useLayoutEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const latest = messages[messages.length - 1]!;

    if (!hasScrolledInitiallyRef.current) {
      hasScrolledInitiallyRef.current = true;
      previousLatestMessageIdRef.current = latest.messageId;
      scrollHistoryToBottom("auto");
      return;
    }

    if (previousLatestMessageIdRef.current === latest.messageId) {
      return;
    }

    previousLatestMessageIdRef.current = latest.messageId;
    scrollHistoryToBottom("smooth");
  }, [messages, scrollHistoryToBottom]);

  const load = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);

    try {
      const [loadedSummary, history, team] = await Promise.all([
        getInitiativeCollaborationChannelSummary(initiativeId),
        listInitiativeCollaborationChannelHistory(initiativeId),
        getInitiativeActiveAlliesTeam(initiativeId),
      ]);

      setSummary(loadedSummary);
      setMessages(history.messages);
      setHasMoreOlder(history.hasMoreOlderMessages);
      setParticipants([team.author, ...team.allies]);
      setLoadState("ready");

      await markInitiativeCollaborationChannelRead(initiativeId);
      setSummary((current) => (current ? { ...current, unreadCount: 0 } : current));
    } catch (error) {
      setLoadState("error");
      setErrorMessage(
        error instanceof ApiRequestError
          ? error.message
          : t("collaboration.channel.loadFailed"),
      );
    }
  }, [initiativeId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Part 13 — one bounded poll for new messages while this panel is
  // mounted (it is persistent, unlike a Direct Conversation screen the
  // viewer navigates away from). Never introduces a second unread-count
  // aggregation: the summary is re-read from the same endpoint each time.
  useEffect(() => {
    function poll() {
      if (document.visibilityState !== "visible") {
        return;
      }

      listInitiativeCollaborationChannelHistory(initiativeId)
        .then((history) => {
          const knownIds = new Set(messagesRef.current.map((message) => message.messageId));
          const newMessages = history.messages.filter((message) => !knownIds.has(message.messageId));

          if (newMessages.length === 0) {
            return;
          }

          setMessages((current) => mergeNewMessages(current, history.messages));
          setHasMoreOlder(history.hasMoreOlderMessages);

          void markInitiativeCollaborationChannelRead(initiativeId).then(() => {
            setSummary((current) => (current ? { ...current, unreadCount: 0 } : current));
          });
        })
        .catch(() => {
          // Bounded polling is best-effort; a transient failure is silently retried on the next interval.
        });
    }

    const intervalId = window.setInterval(poll, POLL_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        poll();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [initiativeId]);

  async function handleLoadOlder() {
    const oldest = messages[0];

    if (!oldest) {
      return;
    }

    setLoadingOlder(true);

    try {
      const page = await listInitiativeCollaborationChannelHistory(initiativeId, {
        createdAt: oldest.createdAt,
        messageId: oldest.messageId,
      });
      setMessages((current) => [...page.messages, ...current]);
      setHasMoreOlder(page.hasMoreOlderMessages);
    } catch {
      setSendError(t("collaboration.channel.loadEarlierFailed"));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const normalized = draft.trim();

    if (!normalized) {
      return;
    }

    setSending(true);
    setSendError(null);

    try {
      const message = await sendInitiativeCollaborationChannelMessage(initiativeId, normalized);
      setMessages((current) => mergeNewMessages(current, [message]));
      setDraft("");
    } catch (error) {
      setSendError(
        error instanceof ApiRequestError
          ? error.message
          : t("collaboration.channel.sendFailed"),
      );
    } finally {
      setSending(false);
    }
  }

  if (loadState === "loading" && !summary) {
    return (
      <section className="icc-channel" aria-label={t("collaboration.channel.aria")}>
        <p className="icc-channel__status" role="status">
          {t("collaboration.channel.loading")}
        </p>
      </section>
    );
  }

  if (loadState === "error" && !summary) {
    return (
      <section className="icc-channel" aria-label={t("collaboration.channel.aria")}>
        <p className="icc-channel__status icc-channel__status--error" role="alert">
          {errorMessage}
        </p>
      </section>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <section className="icc-channel" aria-labelledby="icc-channel-title">
      <header className="icc-channel__header">
        <h2 id="icc-channel-title" className="icc-channel__title">
          {summary.initiativeTitle || t("collaboration.channel.fallbackTitle")}
        </h2>
        <p className="icc-channel__header-meta">
          <span>
            {t("collaboration.channel.participantsCount", { count: summary.participantCount })}
          </span>
          {summary.unreadCount > 0 ? (
            <span className="icc-channel__unread-badge">
              {t("collaboration.channel.unreadCount", { count: summary.unreadCount })}
            </span>
          ) : null}
        </p>
      </header>

      <SharedDocumentsPanel context={{ contextType: "collaboration_channel", initiativeId }} />

      <div
        className="icc-channel__history"
        role="log"
        aria-label={t("collaboration.channel.historyAria")}
        ref={historyRef}
      >
        {hasMoreOlder ? (
          <button
            type="button"
            className="icc-channel__load-older"
            onClick={() => void handleLoadOlder()}
            disabled={loadingOlder}
          >
            {loadingOlder
              ? t("collaboration.channel.loadingEarlier")
              : t("collaboration.channel.loadEarlier")}
          </button>
        ) : null}

        <ul className="icc-channel__message-list">
          {messages.map((message) => (
            <ChannelMessageRow key={message.messageId} message={message} />
          ))}
        </ul>

        {messages.length === 0 ? (
          <p className="icc-channel__status">
            {t("collaboration.channel.empty")} {t("collaboration.channel.emptyHint")}
          </p>
        ) : null}
      </div>

      <form className="icc-channel__composer" onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="icc-channel-composer-input" className="icc-channel__composer-label">
          {t("collaboration.channel.composerPlaceholder")}
        </label>
        <textarea
          id="icc-channel-composer-input"
          className="icc-channel__composer-input"
          rows={2}
          value={draft}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={sending}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSubmit(event);
            }
          }}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="icc-channel__composer-actions">
          <button type="submit" className="hu-button hu-button--primary" disabled={sending || !draft.trim()}>
            {sending ? t("collaboration.channel.sending") : t("collaboration.channel.send")}
          </button>
        </div>
        {sendError ? (
          <p className="icc-channel__status icc-channel__status--error" role="alert">
            {sendError}
          </p>
        ) : null}
      </form>

      <section
        className="icc-channel__participants"
        aria-label={t("collaboration.channel.participantsAria")}
      >
        <h3 className="icc-channel__participants-title">
          {t("collaboration.channel.participantsTitle")}
        </h3>
        <ul className="icc-channel__participants-list">
          {(participants ?? []).map((entry, index) => (
            <ChannelParticipantRow key={entry.participantId ?? `${entry.displayName}-${index}`} entry={entry} />
          ))}
        </ul>
      </section>
    </section>
  );
}
