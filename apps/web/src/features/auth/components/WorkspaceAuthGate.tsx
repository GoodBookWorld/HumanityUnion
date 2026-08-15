"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { isBootstrapUiAllowed } from "../bootstrap-ui.config";
import { useClientAuthStatus } from "../use-client-auth-status";

interface WorkspaceAuthGateProps {
  children: ReactNode;
}

/**
 * Authenticated-only Workspace gate. Guests are sent to Login with returnTo
 * so PWA launches at `/workspace` resume into Workspace after sign-in.
 */
export function WorkspaceAuthGate({ children }: WorkspaceAuthGateProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "/workspace";
  const authStatus = useClientAuthStatus();

  useEffect(() => {
    if (authStatus === "pending") {
      return;
    }

    if (authStatus === "unauthenticated" && !isBootstrapUiAllowed()) {
      const returnTo = pathname.startsWith("/") ? pathname : "/workspace";
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [authStatus, pathname, router]);

  if (authStatus === "pending") {
    return (
      <p className="workspace-auth-gate__pending" role="status">
        Checking your session…
      </p>
    );
  }

  if (authStatus === "unauthenticated" && !isBootstrapUiAllowed()) {
    return (
      <p className="workspace-auth-gate__pending" role="status">
        Redirecting to Log in…
      </p>
    );
  }

  return children;
}
