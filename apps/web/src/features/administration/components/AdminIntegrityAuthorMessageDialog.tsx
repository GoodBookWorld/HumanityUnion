"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "../../../design-system/components/Button";
import { StatusBanner } from "../../../design-system/components/StatusBanner";
import { trapTabKey } from "../../../design-system/focus-trap";
import { ApiRequestError } from "../../../lib/api-client";
import {
  listAdminIntegrityMediaAuthorHistory,
  markAdminIntegrityMediaAuthorMessagesRead,
  sendAdminIntegrityMediaAuthorChat,
  sendAdminIntegrityMediaAuthorMessage,
} from "../admin-integrity-media-authors-api";
import {
  INTEGRITY_MEDIA_AUTHOR_BODY_MAX,
  INTEGRITY_MEDIA_AUTHOR_HISTORY_PAGE_SIZE,
  buildIntegrityMediaAuthorChatRequest,
  buildIntegrityMediaAuthorMessageRequest,
  inboundIntegrityMediaAuthorChatIds,
  integrityMediaAuthorComposeBlockedCopy,
  integrityMediaAuthorDeliveryCopy,
  integrityMediaAuthorHistoryDeliveryLabel,
  integrityMediaAuthorHistoryKindLabel,
  integrityMediaAuthorHistorySenderLabel,
  integrityMediaAuthorSafeError,
  integrityMediaAuthorSafeHttpUrl,
  interpretIntegrityMediaAuthorDelivery,
  mergeIntegrityMediaAuthorHistory,
  restoredTranscriptScrollTop,
  validateIntegrityMediaAuthorChatForm,
  validateIntegrityMediaAuthorMessageForm,
  type IntegrityMediaAuthorCollaborationStatus,
  type IntegrityMediaAuthorDeliveryStatus,
  type IntegrityMediaAuthorHistoryMessage,
  type IntegrityMediaAuthorMessageDelivery,
} from "../admin-integrity-media-authors-model";

import "../../../design-system/components/confirm-dialog.css";
import "./admin-integrity-author-message-dialog.css";

interface AdminIntegrityAuthorMessageDialogProps {
  memberId: string;
  participantDisplayName: string;
  canSend: boolean;
  linkState: "linked" | "disabled";
  authorActivationPending: boolean;
  collaborationStatus: IntegrityMediaAuthorCollaborationStatus;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onUnreadCount: (count: number | null) => void;
}

type FieldName = "title" | "body" | "ctaLabel" | "ctaUrl";
type ScrollMode = "latest" | "preserve" | "none";

export function AdminIntegrityAuthorMessageDialog({
  memberId,
  participantDisplayName,
  canSend,
  linkState,
  authorActivationPending,
  collaborationStatus,
  isOpen,
  onClose,
  onRefresh,
  onUnreadCount,
}: AdminIntegrityAuthorMessageDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const submittingRef = useRef(false);
  const scrollModeRef = useRef<ScrollMode>("latest");
  const loadedOlderRef = useRef(false);
  const pendingReadIdsRef = useRef<readonly string[] | null>(null);
  const readGenerationRef = useRef(0);
  const preserveAnchorRef = useRef<{ previousScrollHeight: number; previousScrollTop: number } | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [chatBody, setChatBody] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [chatError, setChatError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<null | "chat" | "notification">(null);
  const [chatResultTitle, setChatResultTitle] = useState<string | null>(null);
  const [chatResultMessage, setChatResultMessage] = useState<string | null>(null);
  const [noticeResultTitle, setNoticeResultTitle] = useState<string | null>(null);
  const [noticeResultMessage, setNoticeResultMessage] = useState<string | null>(null);
  const [messages, setMessages] = useState<IntegrityMediaAuthorHistoryMessage[]>([]);
  const [historyPhase, setHistoryPhase] = useState<"loading" | "ready" | "error">("loading");
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const blockedCopy = integrityMediaAuthorComposeBlockedCopy({
    canSend,
    linkState,
    authorActivationPending,
    collaborationStatus,
  });
  const submitting = pendingAction !== null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      "textarea:not(:disabled), input:not(:disabled), button:not(:disabled)",
    );
    focusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!submittingRef.current) {
          onClose();
        }
        return;
      }
      if (dialogRef.current) {
        trapTabKey(event, dialogRef.current);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      const restore = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (restore && typeof restore.focus === "function") {
        restore.focus();
      }
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    loadedOlderRef.current = false;
    pendingReadIdsRef.current = null;
    scrollModeRef.current = "latest";
    setHistoryPhase("loading");
    setHistoryError(null);
    setMessages([]);
    setNextCursor(null);
    setHasMore(false);

    void (async () => {
      try {
        const page = await listAdminIntegrityMediaAuthorHistory(memberId, {
          limit: INTEGRITY_MEDIA_AUTHOR_HISTORY_PAGE_SIZE,
        });
        if (cancelled) {
          return;
        }
        presentInboundChatPage(page.messages);
        setMessages(page.messages);
        setNextCursor(page.pageInfo.nextCursor);
        setHasMore(page.pageInfo.hasMore);
        setHistoryPhase("ready");
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }
        setHistoryPhase("error");
        setHistoryError(safeHistoryError(error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, memberId]);

  function presentInboundChatPage(pageMessages: readonly IntegrityMediaAuthorHistoryMessage[]) {
    pendingReadIdsRef.current = inboundIntegrityMediaAuthorChatIds(pageMessages);
  }

  useLayoutEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript || historyPhase !== "ready") {
      return;
    }

    if (scrollModeRef.current === "preserve" && preserveAnchorRef.current) {
      transcript.scrollTop = restoredTranscriptScrollTop({
        ...preserveAnchorRef.current,
        nextScrollHeight: transcript.scrollHeight,
      });
      preserveAnchorRef.current = null;
      scrollModeRef.current = "none";
    } else if (scrollModeRef.current === "latest") {
      transcript.scrollTop = transcript.scrollHeight;
      scrollModeRef.current = "none";
    }

    const presentedIds = pendingReadIdsRef.current;
    if (!presentedIds) {
      return;
    }
    pendingReadIdsRef.current = null;
    if (presentedIds.length === 0) {
      return;
    }

    const generation = ++readGenerationRef.current;
    void markAdminIntegrityMediaAuthorMessagesRead(memberId, presentedIds)
      .then((result) => {
        onUnreadCount(generation === readGenerationRef.current ? result.unreadMessageCount : null);
      })
      .catch(() => undefined);
  }, [historyPhase, memberId, messages, onUnreadCount]);

  if (!isOpen) {
    return null;
  }

  async function loadOlder() {
    if (!nextCursor || loadingOlder || submittingRef.current) {
      return;
    }

    const transcript = transcriptRef.current;
    preserveAnchorRef.current = transcript
      ? {
          previousScrollHeight: transcript.scrollHeight,
          previousScrollTop: transcript.scrollTop,
        }
      : null;
    scrollModeRef.current = "preserve";
    setLoadingOlder(true);
    try {
      const page = await listAdminIntegrityMediaAuthorHistory(memberId, {
        limit: INTEGRITY_MEDIA_AUTHOR_HISTORY_PAGE_SIZE,
        cursor: nextCursor,
      });
      loadedOlderRef.current = true;
      presentInboundChatPage(page.messages);
      setMessages((current) => mergeIntegrityMediaAuthorHistory(page.messages, current));
      setNextCursor(page.pageInfo.nextCursor);
      setHasMore(page.pageInfo.hasMore);
    } catch (error: unknown) {
      scrollModeRef.current = "none";
      preserveAnchorRef.current = null;
      setHistoryError(safeHistoryError(error));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function refreshHistory() {
    scrollModeRef.current = "latest";
    const page = await listAdminIntegrityMediaAuthorHistory(memberId, {
      limit: INTEGRITY_MEDIA_AUTHOR_HISTORY_PAGE_SIZE,
    });
    presentInboundChatPage(page.messages);
    if (loadedOlderRef.current) {
      setMessages((current) => mergeIntegrityMediaAuthorHistory(current, page.messages));
    } else {
      setMessages(page.messages);
      setNextCursor(page.pageInfo.nextCursor);
      setHasMore(page.pageInfo.hasMore);
    }
    setHistoryPhase("ready");
  }

  async function handleChatSubmit(event: FormEvent) {
    event.preventDefault();
    if (submittingRef.current || !canSend) {
      return;
    }

    const error = validateIntegrityMediaAuthorChatForm(chatBody);
    if (error) {
      setChatError(error);
      setChatResultTitle(null);
      setChatResultMessage(null);
      return;
    }

    const payload = buildIntegrityMediaAuthorChatRequest(chatBody);
    setChatError(null);
    submittingRef.current = true;
    setPendingAction("chat");
    setChatResultTitle(null);
    setChatResultMessage(null);
    try {
      const data = await sendAdminIntegrityMediaAuthorChat(memberId, payload);
      applyDeliveryResult(data, setChatResultTitle, setChatResultMessage);
      setChatBody("");
      try {
        await refreshHistory();
      } catch (historyLoadError: unknown) {
        setHistoryError(safeHistoryError(historyLoadError));
      }
    } catch (sendError: unknown) {
      setChatResultTitle("Message not sent");
      setChatResultMessage(safeSendError(sendError));
    } finally {
      submittingRef.current = false;
      setPendingAction(null);
      onRefresh();
    }
  }

  async function handleNotificationSubmit(event: FormEvent) {
    event.preventDefault();
    if (submittingRef.current || !canSend) {
      return;
    }

    const errors = validateIntegrityMediaAuthorMessageForm({ title, body, ctaLabel, ctaUrl });
    if (errors) {
      setFieldErrors(errors);
      setNoticeResultTitle(null);
      setNoticeResultMessage(null);
      return;
    }

    const payload = buildIntegrityMediaAuthorMessageRequest({ title, body, ctaLabel, ctaUrl });
    setFieldErrors({});
    submittingRef.current = true;
    setPendingAction("notification");
    setNoticeResultTitle(null);
    setNoticeResultMessage(null);
    try {
      const data = await sendAdminIntegrityMediaAuthorMessage(memberId, payload);
      applyDeliveryResult(data, setNoticeResultTitle, setNoticeResultMessage);
      try {
        await refreshHistory();
      } catch (historyLoadError: unknown) {
        setHistoryError(safeHistoryError(historyLoadError));
      }
    } catch (sendError: unknown) {
      setNoticeResultTitle("Message not sent");
      setNoticeResultMessage(safeSendError(sendError));
    } finally {
      submittingRef.current = false;
      setPendingAction(null);
      onRefresh();
    }
  }

  return (
    <div
      className="hu-confirm-dialog__backdrop"
      role="presentation"
      onClick={() => {
        if (!submitting) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="hu-confirm-dialog admin-integrity-author-message-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-integrity-author-message-dialog__header">
          <h2 id={titleId} className="hu-heading-3">
            Chat
          </h2>
          <p id={descriptionId} className="hu-body">
            Conversation with the Integrity Media author linked to Humanity Union Participant{" "}
            {participantDisplayName}. Delivery status comes from the server.
          </p>
        </header>

        <div
          ref={transcriptRef}
          className="admin-integrity-author-message-dialog__transcript"
          tabIndex={0}
          aria-label={`Messages with ${participantDisplayName}`}
        >
          {hasMore ? (
            <Button type="button" disabled={loadingOlder || submitting} onClick={() => void loadOlder()}>
              {loadingOlder ? "Loading earlier messages…" : "Earlier messages"}
            </Button>
          ) : null}
          {historyPhase === "loading" ? <p className="hu-body">Loading messages…</p> : null}
          {historyPhase === "error" && historyError ? (
            <p className="hu-caption" role="alert">
              {historyError}
            </p>
          ) : null}
          {historyPhase === "ready" && messages.length === 0 ? (
            <p className="hu-body">No messages yet.</p>
          ) : null}
          {messages.map((message) => (
            <AdminIntegrityAuthorHistoryMessage
              key={message.messageId}
              message={message}
              participantDisplayName={participantDisplayName}
            />
          ))}
          {historyError && historyPhase === "ready" ? (
            <p className="hu-caption" role="alert">
              {historyError}
            </p>
          ) : null}
        </div>

        <footer className="admin-integrity-author-message-dialog__footer">
          {blockedCopy ? (
            <p className="hu-caption" role="status">
              {blockedCopy}
            </p>
          ) : null}

          <details className="admin-integrity-author-message-dialog__notification">
            <summary>System notification</summary>
            <form
              className="admin-integrity-author-message-dialog__notification-form"
              onSubmit={(event) => {
                void handleNotificationSubmit(event);
              }}
            >
              <label htmlFor="integrity-author-message-title">
                Title
                <input
                  id="integrity-author-message-title"
                  value={title}
                  maxLength={200}
                  disabled={!canSend || submitting}
                  onChange={(event) => setTitle(event.target.value)}
                  aria-invalid={fieldErrors.title ? true : undefined}
                  aria-describedby={fieldErrors.title ? "integrity-author-message-title-error" : undefined}
                />
              </label>
              {fieldErrors.title ? (
                <p id="integrity-author-message-title-error" className="hu-caption" role="alert">
                  {fieldErrors.title}
                </p>
              ) : null}

              <label htmlFor="integrity-author-message-body">
                Body
                <textarea
                  id="integrity-author-message-body"
                  value={body}
                  rows={4}
                  maxLength={8000}
                  disabled={!canSend || submitting}
                  onChange={(event) => setBody(event.target.value)}
                  aria-invalid={fieldErrors.body ? true : undefined}
                  aria-describedby={fieldErrors.body ? "integrity-author-message-body-error" : undefined}
                />
              </label>
              {fieldErrors.body ? (
                <p id="integrity-author-message-body-error" className="hu-caption" role="alert">
                  {fieldErrors.body}
                </p>
              ) : null}

              <label htmlFor="integrity-author-message-cta-label">
                Link label
                <input
                  id="integrity-author-message-cta-label"
                  value={ctaLabel}
                  maxLength={120}
                  disabled={!canSend || submitting}
                  onChange={(event) => setCtaLabel(event.target.value)}
                  aria-invalid={fieldErrors.ctaLabel ? true : undefined}
                  aria-describedby={
                    fieldErrors.ctaLabel ? "integrity-author-message-cta-label-error" : undefined
                  }
                />
              </label>
              {fieldErrors.ctaLabel ? (
                <p id="integrity-author-message-cta-label-error" className="hu-caption" role="alert">
                  {fieldErrors.ctaLabel}
                </p>
              ) : null}

              <label htmlFor="integrity-author-message-cta-url">
                Link URL
                <input
                  id="integrity-author-message-cta-url"
                  value={ctaUrl}
                  inputMode="url"
                  maxLength={2000}
                  disabled={!canSend || submitting}
                  onChange={(event) => setCtaUrl(event.target.value)}
                  aria-invalid={fieldErrors.ctaUrl ? true : undefined}
                  aria-describedby={fieldErrors.ctaUrl ? "integrity-author-message-cta-url-error" : undefined}
                />
              </label>
              {fieldErrors.ctaUrl ? (
                <p id="integrity-author-message-cta-url-error" className="hu-caption" role="alert">
                  {fieldErrors.ctaUrl}
                </p>
              ) : null}

              {noticeResultTitle && noticeResultMessage ? (
                <StatusBanner title={noticeResultTitle} message={noticeResultMessage} />
              ) : null}
              <AdminIntegrityAuthorSendButton
                submitting={pendingAction === "notification"}
                disabled={!canSend || submitting}
                label="Send notification"
              />
            </form>
          </details>

          <form
            className="admin-integrity-author-message-dialog__composer"
            onSubmit={(event) => {
              void handleChatSubmit(event);
            }}
          >
            <label htmlFor="integrity-author-chat-body">
              Message
              <textarea
                id="integrity-author-chat-body"
                value={chatBody}
                rows={3}
                maxLength={INTEGRITY_MEDIA_AUTHOR_BODY_MAX}
                disabled={!canSend || submitting}
                onChange={(event) => setChatBody(event.target.value)}
                aria-invalid={chatError ? true : undefined}
                aria-describedby={chatError ? "integrity-author-chat-body-error" : undefined}
              />
            </label>
            {chatError ? (
              <p id="integrity-author-chat-body-error" className="hu-caption" role="alert">
                {chatError}
              </p>
            ) : null}
            {chatResultTitle && chatResultMessage ? (
              <StatusBanner title={chatResultTitle} message={chatResultMessage} />
            ) : null}
            <div className="admin-integrity-author-message-dialog__actions">
              <Button type="button" disabled={submitting} onClick={onClose}>
                Close
              </Button>
              <AdminIntegrityAuthorSendButton
                submitting={pendingAction === "chat"}
                disabled={!canSend || submitting}
              />
            </div>
          </form>
        </footer>
      </div>
    </div>
  );
}

export function AdminIntegrityAuthorHistoryMessage({
  message,
  participantDisplayName,
}: {
  message: IntegrityMediaAuthorHistoryMessage;
  participantDisplayName: string;
}) {
  const sender = integrityMediaAuthorHistorySenderLabel({
    direction: message.direction,
    participantDisplayName,
  });
  const kind = integrityMediaAuthorHistoryKindLabel(message.kind);
  const headline = message.title?.trim() ?? "";
  const delivery = message.delivery
    ? integrityMediaAuthorHistoryDeliveryLabel(message.delivery.status)
    : null;
  const ctaUrl = message.cta ? integrityMediaAuthorSafeHttpUrl(message.cta.url) : null;

  return (
    <article
      className={`admin-integrity-author-message-dialog__message admin-integrity-author-message-dialog__message--${message.direction}`}
      data-direction={message.direction}
      data-kind={message.kind}
    >
      <p className="admin-integrity-author-message-dialog__meta">
        <span>{sender}</span>
        <span>{kind}</span>
      </p>
      {headline ? <p className="admin-integrity-author-message-dialog__message-title">{headline}</p> : null}
      <p className="hu-body">{message.body}</p>
      {ctaUrl && message.cta ? (
        <a className="admin-panel__link" href={ctaUrl} rel="noreferrer">
          {message.cta.label}
        </a>
      ) : null}
      <p className="hu-caption">
        <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
        {delivery ? <span> · {delivery}</span> : null}
      </p>
    </article>
  );
}

export function AdminIntegrityAuthorSendButton({
  submitting,
  disabled = false,
  label = "Send",
}: {
  submitting: boolean;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Button type="submit" variant="primary" disabled={submitting || disabled} aria-busy={submitting}>
      {submitting ? "Sending…" : label}
    </Button>
  );
}

export function AdminIntegrityAuthorDeliveryNotice({
  status,
}: {
  status: IntegrityMediaAuthorDeliveryStatus | "unknown";
}) {
  const copy = integrityMediaAuthorDeliveryCopy(status);
  return <StatusBanner title={copy.title} message={copy.message} />;
}

function applyDeliveryResult(
  data: IntegrityMediaAuthorMessageDelivery,
  setTitle: (value: string | null) => void,
  setMessage: (value: string | null) => void,
): void {
  const interpreted = interpretIntegrityMediaAuthorDelivery(data?.status);
  const copy = integrityMediaAuthorDeliveryCopy(interpreted.ok ? interpreted.status : "unknown");
  setTitle(copy.title);
  if (interpreted.ok && interpreted.status === "failed") {
    setMessage(
      integrityMediaAuthorSafeError(data.lastErrorCode ?? undefined, copy.message),
    );
    return;
  }
  setMessage(copy.message);
}

function safeSendError(error: unknown): string {
  return integrityMediaAuthorSafeError(readErrorCode(error), "This message could not be sent.");
}

function safeHistoryError(error: unknown): string {
  return integrityMediaAuthorSafeError(readErrorCode(error), "Messages could not be loaded.");
}

function readErrorCode(error: unknown): string | undefined {
  if (error instanceof ApiRequestError && typeof error.meta?.code === "string") {
    return error.meta.code;
  }
  return undefined;
}

function formatMessageTime(value: string): string {
  try {
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
