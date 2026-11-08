"use client";

import { useCallback, useEffect, useState } from "react";

import type { ClientAuthStatus } from "../auth/use-client-auth-status";
import { getPublicPetition } from "./api";
import type { ViewerSignatureStatus } from "./petition-utils";

interface ViewerPetitionSignature {
  readonly viewerSignature: ViewerSignatureStatus;
  readonly registrationGatewayMessage: string | null;
  readonly setViewerSignature: (status: ViewerSignatureStatus) => void;
  /** Re-reads the server's view of the current session's signature. */
  readonly refresh: () => void;
}

/**
 * HU-LC-05B.1 — the current session's signature state from the public Petition
 * projection (`viewerHasSigned`, resolved server-side from the session). Anonymous
 * viewers are never reported as signed.
 */
export function useViewerPetitionSignature(
  petitionId: string,
  authStatus: ClientAuthStatus,
): ViewerPetitionSignature {
  const [viewerSignature, setViewerSignature] = useState<ViewerSignatureStatus>("unknown");
  const [registrationGatewayMessage, setRegistrationGatewayMessage] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (authStatus === "pending") {
      return;
    }

    let active = true;

    getPublicPetition(petitionId)
      .then((projection) => {
        if (!active) {
          return;
        }
        setRegistrationGatewayMessage(
          projection.participationEntryGuidance.registrationGatewayMessage,
        );
        setViewerSignature(
          authStatus === "authenticated" && projection.viewerHasSigned ? "signed" : "unsigned",
        );
      })
      .catch(() => {
        if (active) {
          setViewerSignature("unavailable");
        }
      });

    return () => {
      active = false;
    };
  }, [petitionId, authStatus, revision]);

  const refresh = useCallback(() => setRevision((current) => current + 1), []);

  return { viewerSignature, registrationGatewayMessage, setViewerSignature, refresh };
}
