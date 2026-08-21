"use client";

import { useEffect } from "react";

/** Cross-surface refresh after Overview Select/Recall (Overview, sidebar, CD, election). */
export const PUBLIC_CHOICE_ELECTION_REFRESH_EVENT = "hu:public-choice-election-refresh";

export function notifyPublicChoiceElectionRefresh(initiativeId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent(PUBLIC_CHOICE_ELECTION_REFRESH_EVENT, {
      detail: { initiativeId },
    }),
  );
}

export function usePublicChoiceElectionRefresh(
  initiativeId: string,
  reload: () => void | Promise<void>,
): void {
  useEffect(() => {
    function onRefresh(event: Event): void {
      const detail = (event as CustomEvent<{ initiativeId?: string }>).detail;
      if (detail?.initiativeId === initiativeId) {
        void reload();
      }
    }

    window.addEventListener(PUBLIC_CHOICE_ELECTION_REFRESH_EVENT, onRefresh);
    return () => {
      window.removeEventListener(PUBLIC_CHOICE_ELECTION_REFRESH_EVENT, onRefresh);
    };
  }, [initiativeId, reload]);
}
