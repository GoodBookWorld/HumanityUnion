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

/**
 * Part 7 — the public profile page (`page.tsx`) is a Next.js Server
 * Component, so its server-rendered fetch of `messagingAvailability` never
 * carries the viewer's access token (stored in browser `localStorage`) and
 * always resolves as a guest would ("hidden"). This client island
 * re-resolves the exact same server-computed field once an authenticated
 * session is confirmed, so the button a signed-in viewer sees always matches
 * what the server will actually authorize — the client never makes its own
 * authorization decision (Part 5).
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

  if (availability === "hidden") {
    return null;
  }

  if (availability === "unavailable") {
    return (
      <p className="direct-message-action__unavailable">
        Messaging is not available for this profile.
      </p>
    );
  }

  const accessibleLabel = displayName ? `Message ${displayName}` : "Message";

  return (
    <div className="direct-message-action">
      <button
        type="button"
        className="direct-message-action__button hu-button hu-button--secondary"
        onClick={() => openConversation({ publicName })}
        disabled={isOpening}
        aria-label={accessibleLabel}
        aria-live="polite"
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
