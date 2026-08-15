"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type {
  DirectConversationDetail,
  DirectConversationParticipantProjection,
  DirectMessageProjection,
} from "@hu/types";

import { HuFeedbackMessage } from "../../../design-system";
import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { ApiRequestError } from "../../../lib/api-client";
import { SharedDocumentsPanel, type SharedDocumentsPanelHandle } from "../../shared-documents/components/SharedDocumentsPanel";
import {
  fetchDirectConversation,
  fetchOlderDirectMessages,
  markDirectConversationRead,
  sendDirectMessage,
} from "../api";
import { dispatchDirectMessagesChanged } from "../direct-messaging-events";
import { dispatchNotificationsChanged } from "../../notifications/notification-events";
import { formatDirectMessageTimestamp } from "../direct-messaging-format";

/**
 * Part 15/mirrors `MAX_DIRECT_MESSAGE_LENGTH` in
 * `apps/api/src/modules/direct-messaging/direct-messaging.validators.ts`.
 * Client-side hint only — the server remains the sole source of truth.
 */
const MAX_MESSAGE_LENGTH = 2000;

/** Part 18 — bounded polling while the conversation is open (no WebSocket/SSE infra exists yet). */
const POLL_INTERVAL_MS = 12_000;

/** Part 16 — how close to the bottom (in px) still counts as "already at the bottom". */
const NEAR_BOTTOM_THRESHOLD_PX = 80;

/**
 * Communication UX Pack 03.8 Part 5 — bounded delay before the single
 * allowed retry of a conversation fetch that 404s immediately after
 * navigating here from an open/create action. This never masks a genuinely
 * missing/unauthorized conversation (Part 5: "unrelated 404 errors must
 * not be hidden") — it only buys one short, fixed window for the very
 * request that just created this conversation to become observable to a
 * different connection/read path before giving up and surfacing the real
 * error exactly as before.
 */
const CONVERSATION_FETCH_RETRY_DELAY_MS = 400;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Communication UX Pack 03.8 Part 5 — fetches the conversation, retrying
 * exactly once (never in a loop) when the very first attempt reports "not
 * found". A same-process create-then-immediately-fetch should already be
 * consistent, but this closes the one legitimate gap Part 5 calls out:
 * "no race between route navigation and transaction completion". Any
 * other failure (access denied, validation, network) is rethrown
 * immediately on the first attempt — only a 404 gets the one bounded retry.
 */
async function fetchDirectConversationWithReconciliationRetry(
  conversationId: string,
): Promise<DirectConversationDetail> {
  try {
    return await fetchDirectConversation(conversationId);
  } catch (error) {
    const isNotFound = error instanceof ApiRequestError && error.status === 404;

    if (!isNotFound) {
      throw error;
    }

    await wait(CONVERSATION_FETCH_RETRY_DELAY_MS);

    return fetchDirectConversation(conversationId);
  }
}

function sharedContextLabel(sharedContext: DirectConversationDetail["sharedContext"]): string | null {
  if (!sharedContext || !sharedContext.isActiveAlly) {
    return null;
  }

  return sharedContext.sharedInitiativeCount === 1
    ? "Active Ally in 1 Initiative"
    : `Active Ally in ${sharedContext.sharedInitiativeCount} Initiatives`;
}

function createClientMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `dm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mergeNewMessages(
  current: DirectMessageProjection[],
  incoming: DirectMessageProjection[],
): DirectMessageProjection[] {
  const knownIds = new Set(current.map((message) => message.messageId));
  const newOnes = incoming.filter((message) => !knownIds.has(message.messageId));

  return newOnes.length === 0 ? current : [...current, ...newOnes];
}

interface ConversationToolbarButtonProps {
  icon: string;
  label: string;
  disabledHint?: string;
  onClick?: () => void;
}

/**
 * Communication UX Pack 03.8 Part 3/6/12 — a single icon-button shape
 * reused for every Messenger header-toolbar and composer-toolbar action.
 * Disabled placeholders (call, video, voice message, and share when no
 * safe share target exists) still expose their real accessible label plus
 * a visible "coming soon" hint, so assistive tech never sees a mystery
 * disabled icon and sighted users never see a button that looks active but
 * performs nothing (Part 3: "no fake working" affordance). The hint is
 * rendered as a small text badge (not opacity alone, Part 12) whenever the
 * button is disabled.
 */
function ConversationToolbarButton({ icon, label, disabledHint, onClick }: ConversationToolbarButtonProps) {
  const isDisabled = !onClick;

  return (
    <span className="direct-messaging__toolbar-item">
      <button
        type="button"
        className="direct-messaging__toolbar-button"
        onClick={onClick}
        disabled={isDisabled}
        aria-label={isDisabled && disabledHint ? `${label} — ${disabledHint}` : label}
        title={isDisabled ? `${label} — ${disabledHint}` : label}
      >
        <Image src={icon} alt="" width={20} height={20} aria-hidden="true" />
      </button>
      {isDisabled && disabledHint ? (
        <span className="direct-messaging__toolbar-hint" aria-hidden="true">
          {disabledHint}
        </span>
      ) : null}
    </span>
  );
}

interface DirectConversationViewProps {
  conversationId: string;
  onConversationChanged?: () => void;
  /**
   * UX Completion Pack 04 Part 6 — lets the Messages workspace visually
   * identify the selected Ally in the Active Allies directory (the sole
   * conversation selector now that the list column is gone) without a
   * second conversation-list fetch: this view already loads the other
   * Participant as part of its own conversation detail fetch.
   */
  onParticipantResolved?: (participant: DirectConversationParticipantProjection) => void;
}

type ViewState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready" };

/**
 * Part 10/11 — the conversation screen. Deliberately plain and calm (no
 * entertainment-messenger affordances): identity header, optional shared
 * Active-Ally context, chronological history, and a single text input.
 */
export function DirectConversationView({
  conversationId,
  onConversationChanged,
  onParticipantResolved,
}: DirectConversationViewProps) {
  const [state, setState] = useState<ViewState>({ phase: "loading" });
  const [detail, setDetail] = useState<DirectConversationDetail | null>(null);
  const [messages, setMessages] = useState<DirectMessageProjection[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  /** Communication UX Pack 03.8 Part 3/6 — the composer's "Attach file" button opens this exact same picker/pipeline, never a second one. */
  const sharedDocumentsPanelRef = useRef<SharedDocumentsPanelHandle | null>(null);

  /**
   * Communication UX Pack 03.8 Part 3/14 — no call feature exists yet
   * (Collaboration Sessions remain the supported meeting system), so this
   * is always `false` and "End call" never renders. The flag exists only
   * so a future real call feature has a single, obvious place to flip it
   * — never to fake an active-looking call state today.
   */
  const isCallActive = false;
  const [shareStatusMessage, setShareStatusMessage] = useState<string | null>(null);

  /**
   * Part 3 — "the safest existing share behavior, or a clearly disabled
   * placeholder if no valid behavior exists". The only safe, already-true
   * thing to share from a Direct Collaboration conversation is the other
   * Participant's own public profile link, and only via the browser's own
   * native Web Share API — never a fabricated "share this conversation"
   * feature. When neither exists, the button renders disabled instead.
   */
  const handleShare = detail?.otherParticipant.profileUrl
    ? () => {
        const profileUrl = detail.otherParticipant.profileUrl!;
        const absoluteUrl =
          typeof window !== "undefined" ? new URL(profileUrl, window.location.origin).toString() : profileUrl;

        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
          navigator.share({ url: absoluteUrl, title: detail.otherParticipant.displayName }).catch(() => {
            // The user cancelling the native share sheet is not an error.
          });
          return;
        }

        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          void navigator.clipboard.writeText(absoluteUrl);
          setShareStatusMessage("Public profile link copied to clipboard.");
          return;
        }

        setShareStatusMessage(absoluteUrl);
      }
    : undefined;

  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Part 16 — "Jump to latest": scroll position is only ever moved
  // automatically on first load, on the viewer's own sent message, or when
  // the viewer is already at (or near) the bottom when a new message
  // arrives. Otherwise a new message while reading older history shows a
  // compact action instead of yanking the scroll position.
  const historyRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const hasScrolledInitiallyRef = useRef(false);
  /** Distinguishes "older history prepended" (Load earlier) from "a new message arrived at the bottom". */
  const previousLatestMessageIdRef = useRef<string | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const scrollHistoryToBottom = useCallback((behavior: ScrollBehavior) => {
    const element = historyRef.current;

    if (!element) {
      return;
    }

    element.scrollTo({ top: element.scrollHeight, behavior });
  }, []);

  function handleHistoryScroll() {
    const element = historyRef.current;

    if (!element) {
      return;
    }

    const nearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_THRESHOLD_PX;
    isNearBottomRef.current = nearBottom;

    if (nearBottom) {
      setShowJumpToLatest(false);
    }
  }

  useLayoutEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const latestMessage = messages[messages.length - 1]!;

    if (!hasScrolledInitiallyRef.current) {
      hasScrolledInitiallyRef.current = true;
      previousLatestMessageIdRef.current = latestMessage.messageId;
      isNearBottomRef.current = true;
      scrollHistoryToBottom("auto");
      return;
    }

    if (previousLatestMessageIdRef.current === latestMessage.messageId) {
      // Only older history was prepended (Load earlier messages) — the
      // bottom of the conversation did not change, so scroll/jump state
      // must not react to it.
      return;
    }

    previousLatestMessageIdRef.current = latestMessage.messageId;

    if (latestMessage.isOwnMessage || isNearBottomRef.current) {
      scrollHistoryToBottom("smooth");
      setShowJumpToLatest(false);
    } else {
      setShowJumpToLatest(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the message list identity should retrigger this.
  }, [messages]);

  const loadConversation = useCallback(async () => {
    setState({ phase: "loading" });

    try {
      const loaded = await fetchDirectConversationWithReconciliationRetry(conversationId);
      setDetail(loaded);
      setMessages(loaded.messages);
      setHasMoreOlder(loaded.hasMoreOlderMessages);
      setState({ phase: "ready" });
      onParticipantResolved?.(loaded.otherParticipant);

      await markDirectConversationRead(conversationId);
      dispatchDirectMessagesChanged();
      // UX Completion Pack 04 Part 7 — the backend mark-read call above also
      // clears the matching `direct_message_received` notifications; this
      // tells the header bell (and Notification Center, if open) to refetch
      // immediately instead of waiting for its own poll/visibility trigger.
      dispatchNotificationsChanged();
      onConversationChanged?.();
    } catch (error) {
      setState({
        phase: "error",
        message:
          error instanceof ApiRequestError
            ? error.message
            : "Unable to load this conversation. Please try again.",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onConversationChanged/onParticipantResolved intentionally not tracked to avoid reload loops.
  }, [conversationId]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  // Part 18 — bounded polling: only while this conversation is open and the
  // tab is visible; always cleared on unmount. No global polling, no claim
  // of real-time delivery.
  useEffect(() => {
    function poll() {
      if (document.visibilityState !== "visible") {
        return;
      }

      fetchDirectConversation(conversationId)
        .then((latest) => {
          setDetail(latest);

          const knownIds = new Set(messagesRef.current.map((message) => message.messageId));
          const newMessages = latest.messages.filter((message) => !knownIds.has(message.messageId));

          if (newMessages.length === 0) {
            return;
          }

          setMessages((current) => mergeNewMessages(current, latest.messages));

          if (newMessages.some((message) => !message.isOwnMessage)) {
            void markDirectConversationRead(conversationId).then(() => {
              dispatchDirectMessagesChanged();
              dispatchNotificationsChanged();
              onConversationChanged?.();
            });
          }
        })
        .catch(() => {
          // Bounded polling is best-effort; a transient failure is silently
          // skipped and retried on the next interval.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onConversationChanged intentionally not tracked to avoid resetting the interval.
  }, [conversationId]);

  async function handleLoadOlder() {
    const oldest = messages[0];

    if (!oldest) {
      return;
    }

    setLoadingOlder(true);

    try {
      const page = await fetchOlderDirectMessages(conversationId, oldest.messageId);
      setMessages((current) => [...page.messages, ...current]);
      setHasMoreOlder(page.hasMoreOlderMessages);
    } catch {
      setSendError("Unable to load earlier messages. Please try again.");
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
      const message = await sendDirectMessage(conversationId, normalized, createClientMessageId());
      setMessages((current) => mergeNewMessages(current, [message]));
      setDraft("");
      setStatusMessage("Message sent.");
      dispatchDirectMessagesChanged();
      onConversationChanged?.();
    } catch (error) {
      setSendError(
        error instanceof ApiRequestError ? error.message : "Unable to send this message. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  if (state.phase === "loading" && !detail) {
    return <p className="direct-messaging__conversation-status" role="status">Loading conversation…</p>;
  }

  if (state.phase === "error" && !detail) {
    return (
      <HuFeedbackMessage variant="error" title="Conversation unavailable">
        {state.message}
      </HuFeedbackMessage>
    );
  }

  if (!detail) {
    return null;
  }

  const sharedLabel = sharedContextLabel(detail.sharedContext);

  return (
    <section className="direct-messaging__conversation" aria-label="Direct Collaboration conversation">
      <header className="direct-messaging__conversation-header">
        <HumanityAvatar avatarUrl={detail.otherParticipant.avatarUrl} size={48} alt="" />
        <div className="direct-messaging__conversation-heading">
          {/* Part 13 — a fixed category label, not a second page heading; the Participant's name below is the real heading for this panel. */}
          <p className="direct-messaging__conversation-kicker">Direct Collaboration</p>
          <h2 className="direct-messaging__conversation-title">{detail.otherParticipant.displayName}</h2>
          {/* Communication UX Pack 03.8 Part 3 — conversation status; falls back to a generic label when there is no shared Active Ally context to report. */}
          <p className="direct-messaging__conversation-status-line">
            {sharedLabel ?? "Direct Collaboration conversation"}
          </p>
        </div>
        {detail.otherParticipant.profileUrl ? (
          <Link
            href={detail.otherParticipant.profileUrl}
            className="hu-button hu-button--secondary direct-messaging__profile-button"
          >
            View public profile
          </Link>
        ) : null}

        {/*
         * Communication UX Pack 03.8 Part 3/12/14 — the Messenger header
         * toolbar. Call and Video are permanent disabled placeholders (no
         * WebRTC/meeting session exists in this pack — Collaboration
         * Sessions remain the supported meeting system). End call only
         * ever renders while `isCallActive` is true, which today is
         * never, so it stays hidden rather than shown-and-disabled. Share
         * is genuinely functional when the other Participant has a public
         * profile to share; otherwise it is a truthful disabled
         * placeholder, never a fake-looking active button.
         */}
        <div className="direct-messaging__toolbar" role="toolbar" aria-label="Conversation actions">
          <ConversationToolbarButton icon="/icons/messenger/call.svg" label="Call" disabledHint="coming soon" />
          <ConversationToolbarButton icon="/icons/messenger/camera.svg" label="Video" disabledHint="coming soon" />
          {isCallActive ? (
            <ConversationToolbarButton
              icon="/icons/messenger/end-call.svg"
              label="End call"
              onClick={() => {
                /* No active call state exists yet; unreachable until a real call feature ships. */
              }}
            />
          ) : null}
          <ConversationToolbarButton
            icon="/icons/messenger/share.svg"
            label="Share"
            disabledHint="coming soon"
            onClick={handleShare}
          />
        </div>
      </header>

      <p className="direct-messaging__visually-hidden" role="status" aria-live="polite">
        {shareStatusMessage ?? ""}
      </p>

      <SharedDocumentsPanel
        ref={sharedDocumentsPanelRef}
        context={{ contextType: "direct_conversation", conversationId }}
      />

      <div
        className="direct-messaging__history"
        role="log"
        aria-label="Message history"
        ref={historyRef}
        onScroll={handleHistoryScroll}
      >
        {hasMoreOlder ? (
          <button
            type="button"
            className="direct-messaging__load-older"
            onClick={() => void handleLoadOlder()}
            disabled={loadingOlder}
          >
            {loadingOlder ? "Loading…" : "Load earlier messages"}
          </button>
        ) : null}

        <ul className="direct-messaging__message-list">
          {messages.map((message) => (
            <li
              key={message.messageId}
              className={`direct-messaging__message${message.isOwnMessage ? " direct-messaging__message--own" : ""}`}
            >
              <p className="direct-messaging__message-text">{message.text}</p>
              <p className="direct-messaging__message-time">{formatDirectMessageTimestamp(message.createdAt)}</p>
            </li>
          ))}
        </ul>

        {messages.length === 0 ? (
          <p className="direct-messaging__conversation-status">
            No messages yet. Start the conversation below.
          </p>
        ) : null}
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          className="direct-messaging__jump-to-latest"
          onClick={() => {
            scrollHistoryToBottom("smooth");
            setShowJumpToLatest(false);
          }}
        >
          New message — Jump to latest
        </button>
      ) : null}

      <p className="direct-messaging__visually-hidden" role="status" aria-live="polite">
        {statusMessage ?? ""}
      </p>

      {/*
       * Communication UX Pack 03.8 Part 6 — the composer toolbar. Attach
       * File opens the exact same Shared Documents upload flow as the
       * panel above (no second attachment system). Voice Message is a
       * permanent disabled placeholder with its own accessible label.
       */}
      <form className="direct-messaging__composer" onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="direct-message-composer-input" className="direct-messaging__composer-label">
          Message {detail.otherParticipant.displayName}
        </label>
        <textarea
          id="direct-message-composer-input"
          className="direct-messaging__composer-input"
          rows={3}
          value={draft}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={sending}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="direct-messaging__composer-actions">
          <div className="direct-messaging__composer-toolbar" role="toolbar" aria-label="Message actions">
            <ConversationToolbarButton
              icon="/icons/messenger/add-file.svg"
              label="Attach a file"
              onClick={() => sharedDocumentsPanelRef.current?.openUploadPicker()}
            />
            <ConversationToolbarButton
              icon="/icons/messenger/microphone.svg"
              label="Voice messages"
              disabledHint="coming soon"
            />
          </div>
          <button type="submit" className="hu-button hu-button--primary" disabled={sending || !draft.trim()}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>

      {sendError ? (
        <HuFeedbackMessage variant="error">{sendError}</HuFeedbackMessage>
      ) : null}
    </section>
  );
}
