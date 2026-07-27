"use client";

import { useEffect, useState } from "react";

import { getMe } from "../auth-api";
import { isAuthenticationRequiredError } from "../../../lib/api-client";

import "./workspace-auth-status.css";

export function WorkspaceAuthStatus() {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getMe()
      .then((user) => {
        if (!cancelled) {
          setDisplayName(user.displayName);
          setRequiresLogin(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDisplayName(null);
          setRequiresLogin(isAuthenticationRequiredError(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (requiresLogin) {
    return (
      <div className="workspace-auth-status workspace-auth-status--prompt">
        <p className="workspace-auth-status__label">Sign in required</p>
        <p className="workspace-auth-status__copy">
          <a href="/login">Log in</a> or <a href="/register">create an account</a> to use workspace
          features.
        </p>
      </div>
    );
  }

  if (!displayName) {
    return null;
  }

  return (
    <div className="workspace-auth-status">
      <p className="workspace-auth-status__label">Signed in as</p>
      <p className="workspace-auth-status__name">{displayName}</p>
    </div>
  );
}
