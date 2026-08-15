"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import type { WorkspaceHomeAllyEntry } from "../../workspace-home/workspace-home-api";
import { filterActiveAlliesByName } from "../direct-messaging-format";
import { useOpenDirectConversation } from "../use-open-direct-conversation";

import "./active-allies-panel.css";

const MESSAGE_ICON = "/icons/workspace/message.svg";

/**
 * Communication UX Pack 03.3.1 Part 3/11/12; Communication UX Pack 03.8
 * Part 4 — the compact Message control on each Active Allies row. Reuses
 * the exact same shared `useOpenDirectConversation` action every other
 * Message entry point uses (Public Profile, Initiative Active Allies
 * widget) — never a second open/create implementation. Selecting the
 * whole card performs the identical action (see `ActiveAllyCard` below).
 */
function ActiveAllyMessageButton({
  ally,
  isOpening,
  errorMessage,
  onMessage,
}: {
  ally: WorkspaceHomeAllyEntry;
  isOpening: boolean;
  errorMessage: string | null;
  onMessage: () => void;
}) {
  return (
    <div className="active-allies-panel__message-wrap">
      <button
        type="button"
        className="active-allies-panel__message-button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onMessage();
        }}
        disabled={isOpening}
        aria-label={`Message ${ally.displayName}`}
        aria-live="polite"
      >
        <Image src={MESSAGE_ICON} alt="" width={16} height={16} aria-hidden="true" />
        <span className="active-allies-panel__message-label">
          {isOpening ? "Opening…" : "Message"}
        </span>
        {ally.hasUnreadMessages ? (
          <>
            <span className="active-allies-panel__unread-dot" aria-hidden="true" />
            <span className="active-allies-panel__visually-hidden">
              Unread messages from {ally.displayName}
            </span>
          </>
        ) : null}
      </button>
      {errorMessage ? <p className="active-allies-panel__message-error">{errorMessage}</p> : null}
    </div>
  );
}

/**
 * Communication UX Pack 03.8 Part 4 — a simplified Active Ally card:
 * avatar, display name, and a Message button only (never role, shared
 * Initiatives, or statistics). Selecting anywhere on the card — not only
 * the Message button — opens the same conversation in the Messenger.
 */
function ActiveAllyCard({ ally, isActive }: { ally: WorkspaceHomeAllyEntry; isActive: boolean }) {
  const { isOpening, errorMessage, openConversation } = useOpenDirectConversation();

  const openThisConversation = () => openConversation({ participantId: ally.participantId });

  return (
    <li className={`active-allies-panel__card${isActive ? " active-allies-panel__card--active" : ""}`}>
      <button
        type="button"
        className="active-allies-panel__identity"
        onClick={openThisConversation}
        disabled={isOpening}
        aria-current={isActive ? "true" : undefined}
        aria-label={`Open conversation with ${ally.displayName}`}
      >
        <HumanityAvatar
          className="active-allies-panel__avatar"
          avatarUrl={ally.avatarUrl}
          size={36}
          alt=""
        />
        <span className="active-allies-panel__name">{ally.displayName}</span>
      </button>
      <ActiveAllyMessageButton
        ally={ally}
        isOpening={isOpening}
        errorMessage={errorMessage}
        onMessage={openThisConversation}
      />
    </li>
  );
}

export type ActiveAlliesPanelState = "loading" | "ready" | "error";

interface ActiveAlliesPanelProps {
  state: ActiveAlliesPanelState;
  allies: WorkspaceHomeAllyEntry[];
  alliesCount: number;
  errorMessage?: string | null;
  /**
   * UX Completion Pack 04 Part 6 — the participant whose conversation is
   * currently open in the Messenger, so this directory (the sole
   * conversation selector) can visually identify the selected Ally.
   */
  activeParticipantId?: string;
}

/**
 * Communication UX Pack 03.3.1 Part 3/4 — the Workspace Messages right-rail
 * "Active Allies" panel: the permanent replacement for the Civic Assistant
 * on this one page (Part 2). Purely presentational — `DirectMessagesWorkspace`
 * owns the single load of the shared Workspace Allies aggregation (`GET
 * /api/v1/workspace/home/allies` → `buildAlliesSummary`, Part 4; no
 * duplicate service/projection/query) so the same response can also decide
 * the conversation list's empty-state copy (Part 5) without a second fetch.
 */
export function ActiveAlliesPanel({
  state,
  allies,
  alliesCount,
  errorMessage,
  activeParticipantId,
}: ActiveAlliesPanelProps) {
  const searchInputId = useId();
  const [searchTerm, setSearchTerm] = useState("");

  /** Communication UX Pack 03.8 Part 8 — client-side filter by display name; the full Active Allies list is already loaded, so no request is issued per keystroke. */
  const visibleAllies = useMemo(
    () => filterActiveAlliesByName(allies, searchTerm),
    [allies, searchTerm],
  );

  const body = (() => {
    if (state === "loading") {
      return (
        <p className="active-allies-panel__status" role="status">
          Loading Active Allies…
        </p>
      );
    }

    if (state === "error") {
      return (
        <p className="active-allies-panel__status active-allies-panel__status--error">
          {errorMessage ?? "Unable to load your Active Allies."}
        </p>
      );
    }

    if (allies.length === 0) {
      return (
        <div className="active-allies-panel__empty">
          <p className="active-allies-panel__empty-title">No Active Allies yet.</p>
          <Link href="/workspace/initiatives" className="active-allies-panel__empty-action">
            View Initiatives
          </Link>
        </div>
      );
    }

    if (visibleAllies.length === 0) {
      return (
        <p className="active-allies-panel__status">No Active Allies match &ldquo;{searchTerm.trim()}&rdquo;.</p>
      );
    }

    return (
      <ul className="active-allies-panel__list" aria-label="Active Allies">
        {visibleAllies.map((ally) => (
          <ActiveAllyCard
            key={ally.participantId}
            ally={ally}
            isActive={ally.participantId === activeParticipantId}
          />
        ))}
      </ul>
    );
  })();

  return (
    <aside className="active-allies-panel" aria-label="Active Allies panel">
      <div className="active-allies-panel__sticky">
        <div className="active-allies-panel__panel">
          <header className="active-allies-panel__header">
            <h2 className="active-allies-panel__title">Active Allies</h2>
            {state === "ready" && alliesCount > 0 ? (
              <span className="active-allies-panel__count">
                {alliesCount} active {alliesCount === 1 ? "Ally" : "Allies"}
              </span>
            ) : null}
          </header>

          {state === "ready" && allies.length > 0 ? (
            <div className="active-allies-panel__search">
              <label htmlFor={searchInputId} className="active-allies-panel__visually-hidden">
                Search Active Allies by name
              </label>
              <input
                id={searchInputId}
                type="search"
                className="active-allies-panel__search-input"
                placeholder="Search Allies by name"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          ) : null}

          {body}
        </div>
      </div>
    </aside>
  );
}
