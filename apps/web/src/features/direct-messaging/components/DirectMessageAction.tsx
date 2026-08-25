"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import type { PublicMemberProfileMessagingAvailability } from "@hu/types";

import { HuFeedbackMessage } from "../../../design-system";
import { getPublicMemberProfileByPublicName } from "../../member-profile/member-profile-api";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import { useOpenDirectConversation } from "../use-open-direct-conversation";

import "./direct-message-action.css";

const MESSAGE_ICON = "/icons/workspace/message.svg";

interface DirectMessageActionProps {
  publicName: string;
  /** Accessible label suffix (Communication UX Pack 03.2 Part 6 — `Message {Participant Name}`). */
  displayName?: string;
}

function buildMemberProfileReturnPath(publicName: string): string {
  return `/member/${encodeURIComponent(publicName)}`;
}

function buildGuestMessageLoginHref(publicName: string): string {
  const returnTo = buildMemberProfileReturnPath(publicName);
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

/**
 * Part 7 — the public profile page (`page.tsx`) is a Next.js Server
 * Component, so its server-rendered fetch of `messagingAvailability` never
 * carries the viewer's access token. This client island re-resolves
 * availability once an authenticated session is confirmed.
 *
 * Pack 19C.4F — unauthenticated visitors still see the Message CTA; click
 * uses the established `/login?returnTo=` pattern back to
 * `/member/{publicName}`. Guest visibility is not messaging authorization —
 * after login, `messagingAvailability` remains server-authoritative.
 *
 * Authenticated self-view / blocked policy → no CTA (`hidden` /
 * `unavailable`). Eligible authenticated viewers → `openConversation`.
 */
export function DirectMessageAction({ publicName, displayName }: DirectMessageActionProps) {
  const authStatus = useClientAuthStatus();
  const [availability, setAvailability] =
    useState<PublicMemberProfileMessagingAvailability>("hidden");
  const { isOpening, errorMessage, openConversation } = useOpenDirectConversation();

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setAvailability("hidden");
      return;
    }

    let cancelled = false;

    getPublicMemberProfileByPublicName(publicName)
      .then((profile) => {
        if (!cancelled) {
          setAvailability(profile.messagingAvailability);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailability("hidden");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, publicName]);

  const accessibleLabel = displayName ? `Message ${displayName}` : "Message";

  if (authStatus === "pending") {
    return null;
  }

  if (authStatus === "unauthenticated") {
    return (
      <div className="direct-message-action">
        <a
          href={buildGuestMessageLoginHref(publicName)}
          className="direct-message-action__button hu-button hu-button--secondary"
          aria-label={accessibleLabel}
        >
          <Image src={MESSAGE_ICON} alt="" width={18} height={18} aria-hidden="true" />
          <span>Message</span>
        </a>
      </div>
    );
  }

  if (availability === "hidden" || availability === "unavailable") {
    return null;
  }

  return (
    <div className="direct-message-action">
      <button
        type="button"
        className="direct-message-action__button hu-button hu-button--secondary"
        onClick={() => openConversation({ publicName })}
        disabled={isOpening}
        aria-label={accessibleLabel}
        aria-live="polite"
        aria-busy={isOpening || undefined}
      >
        <Image src={MESSAGE_ICON} alt="" width={18} height={18} aria-hidden="true" />
        <span>{isOpening ? "Opening…" : "Message"}</span>
      </button>
      {errorMessage ? (
        <HuFeedbackMessage variant="error">{errorMessage}</HuFeedbackMessage>
      ) : null}
    </div>
  );
}
