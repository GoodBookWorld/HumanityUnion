"use client";

import { useEffect, useState, type ReactNode } from "react";

import type { AuthUserPublic } from "@hu/types";

import { StatusBanner } from "../../../design-system/components/StatusBanner";
import {
  formatAuthFormError,
  isAuthenticationRequiredError,
  isForbiddenError,
} from "../../../lib/api-client";
import { getMe } from "../../auth/auth-api";
import { isEligibleForEditorPanel } from "../editor-panel-eligibility";

interface EditorAccessGateProps {
  children: (user: AuthUserPublic) => ReactNode;
}

/**
 * Pack 12B — Independent Editor Panel authorization (ACTIVE Editor grant).
 * Nav visibility alone is never sufficient.
 */
export function EditorAccessGate({ children }: EditorAccessGateProps) {
  const [user, setUser] = useState<AuthUserPublic | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void getMe()
      .then((currentUser) => {
        if (cancelled) {
          return;
        }

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
        if (cancelled) {
          return;
        }

        setUser(null);

        if (isAuthenticationRequiredError(loadError)) {
          setError("Sign in to open the Editor Panel.");
        } else if (isForbiddenError(loadError)) {
          setDenied(true);
          setError("The Editor Panel is available to active Editors only.");
        } else {
          setError(formatAuthFormError(loadError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
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
