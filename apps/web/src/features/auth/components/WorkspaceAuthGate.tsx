"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { isBootstrapUiAllowed } from "../bootstrap-ui.config";
import { resolveSafeReturnTo } from "../lib/resolve-safe-return-to";
import { useClientAuthStatus } from "../use-client-auth-status";

interface WorkspaceAuthGateProps {
  children: ReactNode;
}

/**
 * Authenticated-only Workspace gate. Guests are sent to Login with returnTo
 * so PWA launches at `/workspace` (and query intents such as `rrp=apply`)
 * resume into Workspace after sign-in.
 */
function WorkspaceAuthGateInner({ children }: WorkspaceAuthGateProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "/workspace";
  const searchParams = useSearchParams();
  const authStatus = useClientAuthStatus();
  const t = useTranslations("workspace.authGate");

  useEffect(() => {
    if (authStatus === "pending") {
      return;
    }

    if (authStatus === "unauthenticated" && !isBootstrapUiAllowed()) {
      const search = searchParams.toString();
      const destination = search ? `${pathname}?${search}` : pathname;
      const returnTo = resolveSafeReturnTo(destination, "/workspace");
      router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [authStatus, pathname, router, searchParams]);

  if (authStatus === "pending") {
    return (
      <p className="workspace-auth-gate__pending" role="status">
        {t("checkingSession")}
      </p>
    );
  }

  if (authStatus === "unauthenticated" && !isBootstrapUiAllowed()) {
    return (
      <p className="workspace-auth-gate__pending" role="status">
        {t("redirectingToLogin")}
      </p>
    );
  }

  return children;
}

export function WorkspaceAuthGate({ children }: WorkspaceAuthGateProps) {
  return (
    <Suspense fallback={null}>
      <WorkspaceAuthGateInner>{children}</WorkspaceAuthGateInner>
    </Suspense>
  );
}
