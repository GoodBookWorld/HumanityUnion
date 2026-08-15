"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiRequestError } from "../../lib/api-client";

import { openOrCreateDirectConversation, type DirectConversationTarget } from "./api";

export interface OpenDirectConversationState {
  isOpening: boolean;
  errorMessage: string | null;
  openConversation: (target: DirectConversationTarget) => void;
  clearError: () => void;
}

/**
 * Communication UX Pack 03.2 Part 2 — the single shared "open or create
 * Direct Conversation with Participant" frontend action. Every Message
 * entry point (public profile, Workspace Ally card, future Initiative
 * Active Allies widget) uses this same hook instead of duplicating the
 * open/navigate/loading/error logic:
 *
 * 1. calls the existing open/create conversation endpoint with whichever
 *    Participant identity the caller has (`publicName` or `participantId`);
 * 2. the server reuses the existing deterministic pair conversation and
 *    resolves the real `conversationId` — the frontend never constructs one;
 * 3. navigates directly to `/workspace/messages/{conversationId}`;
 * 4. exposes a loading state while the request is in flight;
 * 5. ignores repeated clicks while already opening (no duplicate requests);
 * 6. surfaces a clear error message when opening fails (e.g. blocked by
 *    the target's messaging Privacy policy).
 */
export function useOpenDirectConversation(): OpenDirectConversationState {
  const router = useRouter();
  const [isOpening, setIsOpening] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const openingRef = useRef(false);

  const openConversation = useCallback(
    (target: DirectConversationTarget) => {
      if (openingRef.current) {
        return;
      }

      openingRef.current = true;
      setIsOpening(true);
      setErrorMessage(null);

      void openOrCreateDirectConversation(target)
        .then((conversation) => {
          router.push(`/workspace/messages/${encodeURIComponent(conversation.conversationId)}`);
        })
        .catch((error: unknown) => {
          setErrorMessage(
            error instanceof ApiRequestError ? error.message : "Unable to open this conversation.",
          );
        })
        .finally(() => {
          openingRef.current = false;
          setIsOpening(false);
        });
    },
    [router],
  );

  const clearError = useCallback(() => setErrorMessage(null), []);

  return { isOpening, errorMessage, openConversation, clearError };
}
