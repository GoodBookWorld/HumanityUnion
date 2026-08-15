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
import { isAdminAccountRole } from "../is-admin-role";

interface AdminAccessGateProps {
  children: (user: AuthUserPublic) => ReactNode;
}

/**
 * Independent admin authorization for /admin/* — uses server-backed getMe().
 * Nav visibility alone is never sufficient.
 */
export function AdminAccessGate({ children }: AdminAccessGateProps) {
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

        if (!isAdminAccountRole(currentUser.role)) {
          setDenied(true);
          setError("The Admin Panel is available to Administrators only.");
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
          setError("Sign in to open the Admin Panel.");
        } else if (isForbiddenError(loadError)) {
          setDenied(true);
          setError("The Admin Panel is available to Administrators only.");
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
    return <p className="hu-body">Loading Admin Panel…</p>;
  }

  if (error || !user) {
    return (
      <StatusBanner
        title={denied ? "Access restricted" : "Admin Panel unavailable"}
        message={error ?? "Unable to load the Admin Panel."}
      />
    );
  }

  return <>{children(user)}</>;
}
