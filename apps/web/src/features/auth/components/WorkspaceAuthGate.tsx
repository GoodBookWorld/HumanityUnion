"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { isBootstrapUiAllowed } from "../bootstrap-ui.config";
import { useClientAuthStatus } from "../use-client-auth-status";

interface WorkspaceAuthGateProps {
  children: ReactNode;
}

export function WorkspaceAuthGate({ children }: WorkspaceAuthGateProps) {
  const router = useRouter();
  const authStatus = useClientAuthStatus();

  useEffect(() => {
    if (authStatus === "pending") {
      return;
    }

    if (authStatus === "unauthenticated" && !isBootstrapUiAllowed()) {
      router.replace("/login");
    }
  }, [authStatus, router]);

  if (authStatus === "pending") {
    return null;
  }

  if (authStatus === "unauthenticated" && !isBootstrapUiAllowed()) {
    return null;
  }

  return children;
}
