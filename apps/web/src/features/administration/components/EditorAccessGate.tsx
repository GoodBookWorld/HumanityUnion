"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import type { AuthUserPublic } from "@hu/types";

import { StatusBanner } from "../../../design-system/components/StatusBanner";
import {
  formatAuthFormError,
  isAuthenticationRequiredError,
  isForbiddenError,
} from "../../../lib/api-client";
import { getMe } from "../../auth/auth-api";
import { AUTH_STATE_CHANGED_EVENT } from "../../auth/auth-events";
import { EDITOR_GRANT_CHANGED_EVENT } from "../editor-grant-events";
import { isEligibleForEditorPanel } from "../editor-panel-eligibility";

interface EditorAccessGateProps {
  children: (user: AuthUserPublic) => ReactNode;
}

/**
 * Pack 12B — Independent Editor Panel authorization (ACTIVE Editor grant).
 * Pack 12E2 — re-queries `/me` on focus/visibility/auth so mid-session
 * deactivate denies without requiring logout.
 * Nav visibility alone is never sufficient.
 */
export function EditorAccessGate({ children }: EditorAccessGateProps) {
  const [user, setUser] = useState<AuthUserPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback((options?: { quiet?: boolean }) => {
    if (!options?.quiet) {
      setLoading(true);
    }

    void getMe()
      .then((currentUser) => {
        if (!isEligibleForEditorPanel(currentUser)) {
          setDenied(true);
          setError("The Editor Panel is available to active Editors only.");
          setUser(null);
          return;
        }

        setUser(currentUser);
        setError(null);
        setDenied(false);
      })
      .catch((loadError: unknown) => {
        setUser(null);

        if (isAuthenticationRequiredError(loadError)) {
          setError("Sign in to open the Editor Panel.");
          setDenied(false);
        } else if (isForbiddenError(loadError)) {
          setDenied(true);
          setError("The Editor Panel is available to active Editors only.");
        } else {
          setError(formatAuthFormError(loadError));
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();

    function handleQuietRefresh() {
      refresh({ quiet: true });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refresh({ quiet: true });
      }
    }

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, handleQuietRefresh);
    window.addEventListener(EDITOR_GRANT_CHANGED_EVENT, handleQuietRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleQuietRefresh);

    return () => {
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, handleQuietRefresh);
      window.removeEventListener(EDITOR_GRANT_CHANGED_EVENT, handleQuietRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleQuietRefresh);
    };
  }, [refresh]);

  if (loading && !user) {
    return <p className="hu-body">Loading Editor Panel…</p>;
  }

  if (error || !user) {
    return (
      <StatusBanner
        title={denied ? "Access restricted" : "Editor Panel unavailable"}
        message={error ?? "Unable to load the Editor Panel."}
      />
    );
  }

  return <>{children(user)}</>;
}
