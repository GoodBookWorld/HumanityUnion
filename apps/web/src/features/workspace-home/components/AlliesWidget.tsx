"use client";

import Image from "next/image";
import Link from "next/link";

import { HumanityAvatar } from "../../../design-system/components/HumanityAvatar";
import { useOpenDirectConversation } from "../../direct-messaging/use-open-direct-conversation";

import "./allies-widget.css";

const MESSAGE_ICON = "/icons/workspace/message.svg";

export interface AllyCard {
  participantId: string;
  displayName: string;
  avatarUrl?: string | null;
  /**
   * Profile UX Pack 01 — already-projected public profile URL (or
   * `undefined` when the Ally has no public profile to link to). Sourced
   * from the same privacy-respecting projection used for Discussion
   * comment authors; never hardcode `/member/...` from a raw identifier
   * here (Part 16).
   */
  profileUrl?: string;
  /** Number of the signed-in Participant's own Initiatives this Ally is active on. */
  sharedInitiativeCount?: number;
  /**
   * Communication UX Pack 03.2 Part 4/5 — derived server-side from the
   * durable Direct Messaging read state (never from Notification read
   * status). `undefined`/omitted is treated as "no unread messages".
   */
  hasUnreadMessages?: boolean;
}

/**
 * Communication UX Pack 03.2 Part 3 — the compact Message control on the
 * right side of each Ally card. Uses the shared
 * `useOpenDirectConversation` action (Part 2) via `participantId`, since an
 * Ally is not required to have a public profile (`profileUrl` may be
 * absent). Deliberately never rendered as a disabled/greyed-out button when
 * messaging turns out to be blocked (Part 3: "no fake disabled button") —
 * instead the click is attempted and a blocked attempt (Privacy `nobody`)
 * surfaces as a plain inline error message, exactly like the public-profile
 * Message action does.
 */
function AllyMessageButton({ ally }: { ally: AllyCard }) {
  const { isOpening, errorMessage, openConversation } = useOpenDirectConversation();

  return (
    <div className="allies-widget__message-wrap">
      <button
        type="button"
        className="allies-widget__message-button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          openConversation({ participantId: ally.participantId });
        }}
        disabled={isOpening}
        aria-label={`Message ${ally.displayName}`}
        aria-live="polite"
      >
        <Image src={MESSAGE_ICON} alt="" width={18} height={18} aria-hidden="true" />
        <span className="allies-widget__message-label">{isOpening ? "Opening…" : "Message"}</span>
        {ally.hasUnreadMessages ? (
          <>
            <span className="allies-widget__unread-dot" aria-hidden="true" />
            <span className="allies-widget__visually-hidden">
              Unread messages from {ally.displayName}
            </span>
          </>
        ) : null}
      </button>
      {errorMessage ? <p className="allies-widget__message-error">{errorMessage}</p> : null}
    </div>
  );
}

interface AlliesWidgetProps {
  allies?: AllyCard[];
}

const MAX_ALLIES = 8;

/**
 * Recovery Task 33 — Workspace UX Evolution, Part 11.
 * Profile UX Pack 01 Part 9/10 — wired to the real Workspace Allies data
 * source (`GET /api/v1/workspace/home` -> `allies.items`): active
 * Initiative Ally relationships only, deduplicated by `participantId`. The
 * empty state below only ever renders when there really are none — no
 * fake Allies.
 *
 * Profile UX Pack 02 Part 2 — each entry became avatar + name only, both
 * linking to the public profile as one unit (no buttons, no chat), because
 * Direct Collaboration messaging did not exist yet at that point.
 *
 * Communication UX Pack 03.2 Part 3/4 — Direct Collaboration messaging now
 * exists (Profile UX Pack 03), so a compact Message control (with an
 * unread marker, Part 4) is reintroduced on the right side of each card.
 * The identity link itself is unchanged: it still opens the public profile
 * as one unit, never the conversation.
 */
export function AlliesWidget({ allies = [] }: AlliesWidgetProps) {
  const visibleAllies = allies.slice(0, MAX_ALLIES);

  return (
    <div className="allies-widget">
      {visibleAllies.length === 0 ? (
        <p className="allies-widget__empty">
          Your active Initiative Allies will appear here after collaboration requests are
          accepted.
        </p>
      ) : (
        <ul className="allies-widget__list" aria-label="Allies">
          {visibleAllies.map((ally) => {
            const identityContent = (
              <>
                <HumanityAvatar
                  className="allies-widget__avatar"
                  avatarUrl={ally.avatarUrl}
                  size={36}
                  alt=""
                />
                <span>
                  <p className="allies-widget__name">{ally.displayName}</p>
                  {ally.sharedInitiativeCount && ally.sharedInitiativeCount > 1 ? (
                    <p className="allies-widget__shared-count">
                      {ally.sharedInitiativeCount} shared initiatives
                    </p>
                  ) : null}
                </span>
              </>
            );

            return (
              <li key={ally.participantId} className="allies-widget__card">
                {ally.profileUrl ? (
                  <Link className="allies-widget__identity" href={ally.profileUrl}>
                    {identityContent}
                  </Link>
                ) : (
                  <span className="allies-widget__identity">{identityContent}</span>
                )}
                <AllyMessageButton ally={ally} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
