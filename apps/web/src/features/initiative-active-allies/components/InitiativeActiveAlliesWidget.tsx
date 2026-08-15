"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { InitiativeActiveAllyEntry } from "@hu/types";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { useOpenDirectConversation } from "../../direct-messaging/use-open-direct-conversation";
import { getInitiativeActiveAlliesTeam } from "../api";

import "./initiative-active-allies-widget.css";

const MESSAGE_ICON = "/icons/workspace/message.svg";

/**
 * Part 11 — reuses the exact shared open/create Direct Conversation
 * action (Communication UX Pack 03.2), never a duplicate implementation.
 * Only rendered at all when `entry.canMessage` is true (Part 12/15) — the
 * backend, not the frontend, decided that; this component never infers
 * eligibility merely from both Participants appearing in the widget.
 */
function ActiveAllyMessageButton({ entry }: { entry: InitiativeActiveAllyEntry }) {
  const { isOpening, errorMessage, openConversation } = useOpenDirectConversation();

  if (!entry.participantId) {
    return null;
  }

  return (
    <div className="iaa-widget__message-wrap">
      <button
        type="button"
        className="iaa-widget__message-button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openConversation({ participantId: entry.participantId });
        }}
        disabled={isOpening}
        aria-label={`Message ${entry.displayName}`}
        aria-live="polite"
      >
        <Image src={MESSAGE_ICON} alt="" width={18} height={18} aria-hidden="true" />
        <span className="iaa-widget__message-label">{isOpening ? "Opening…" : "Message"}</span>
        {entry.hasUnreadMessages ? (
          <>
            <span className="iaa-widget__unread-dot" aria-hidden="true" />
            <span className="iaa-widget__visually-hidden">Unread messages from {entry.displayName}</span>
          </>
        ) : null}
      </button>
      {errorMessage ? <p className="iaa-widget__message-error">{errorMessage}</p> : null}
    </div>
  );
}

/**
 * Communication UX Pack 03.8 Part 6 — simplified to avatar + name + Message
 * only; role, shared Initiatives, and statistics are never rendered here.
 */
function ActiveAllyRow({ entry }: { entry: InitiativeActiveAllyEntry }) {
  const identityContent = (
    <>
      <HumanityAvatar className="iaa-widget__avatar" avatarUrl={entry.avatarUrl} size={36} alt="" />
      <span className="iaa-widget__identity-text">
        <span className="iaa-widget__name">{entry.displayName}</span>
      </span>
    </>
  );

  return (
    <li className="iaa-widget__row">
      {entry.profileUrl ? (
        <Link className="iaa-widget__identity" href={entry.profileUrl}>
          {identityContent}
        </Link>
      ) : (
        <span className="iaa-widget__identity">{identityContent}</span>
      )}
      {entry.canMessage ? <ActiveAllyMessageButton entry={entry} /> : null}
    </li>
  );
}

interface InitiativeActiveAlliesWidgetProps {
  initiativeId: string;
  /**
   * Part 9 — only rendered when the caller confirms the deep-link route
   * behavior is stable for the current page (the Initiative Author viewing
   * their own Initiative). Omitted entirely otherwise; this widget never
   * invents its own destination.
   */
  reviewCollaborationRequestsHref?: string;
}

/**
 * Communication UX Pack 03.3 — the Initiative "Active Allies" widget.
 *
 * Self-fetching by design (Part 23): every lifecycle-stage surface that
 * hosts this widget already has its own primary data fetch (the public
 * Initiative experience, an owner-mode manage panel, etc.), none of which
 * carry per-viewer Direct Messaging eligibility or unread state. Rather
 * than plumb a new field through every one of those existing projections
 * (which would touch far more files, and risk leaking viewer-scoped
 * fields into a page-level public cache — Part 20), this widget performs
 * exactly one dedicated request of its own on mount. It does not poll; it
 * refreshes only on remount (page navigation) or when `initiativeId`
 * changes, consistent with the "existing bounded refresh conventions"
 * option in Part 23.
 */
export function InitiativeActiveAlliesWidget({
  initiativeId,
  reviewCollaborationRequestsHref,
}: InitiativeActiveAlliesWidgetProps) {
  const [team, setTeam] = useState<Awaited<ReturnType<typeof getInitiativeActiveAlliesTeam>> | null>(
    null,
  );
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setTeam(null);
    setLoadFailed(false);

    getInitiativeActiveAlliesTeam(initiativeId)
      .then((result) => {
        if (!cancelled) {
          setTeam(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initiativeId]);

  if (loadFailed || !team) {
    return null;
  }

  const showReviewAction =
    team.viewerRole === "author" && team.allies.length === 0 && reviewCollaborationRequestsHref;

  return (
    <section className="iaa-widget" aria-labelledby="iaa-widget-title">
      <div className="iaa-widget__header">
        <h2 id="iaa-widget-title">Active Allies</h2>
        {team.activeAlliesCount > 0 ? (
          <span className="iaa-widget__count">
            {team.activeAlliesCount} active {team.activeAlliesCount === 1 ? "Ally" : "Allies"}
          </span>
        ) : null}
      </div>

      <ul className="iaa-widget__list" aria-label="Active Allies">
        <ActiveAllyRow entry={team.author} />
        {team.allies.map((entry, index) => (
          <ActiveAllyRow key={entry.participantId ?? `${entry.displayName}-${index}`} entry={entry} />
        ))}
      </ul>

      {team.allies.length === 0 ? (
        <div className="iaa-widget__empty">
          <p>No active Allies yet.</p>
          <p className="iaa-widget__empty-support">
            Participants accepted for collaboration will appear here.
          </p>
          {showReviewAction ? (
            <Link className="iaa-widget__empty-action" href={reviewCollaborationRequestsHref!}>
              Review collaboration requests
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
