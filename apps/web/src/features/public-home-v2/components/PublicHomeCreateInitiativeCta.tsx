"use client";

import { Button } from "../../../design-system";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";

const WORKSPACE_CREATE_HREF = "/workspace/initiatives#create";
const REGISTER_CREATE_HREF = "/register?returnTo=%2Fworkspace%2Finitiatives%23create";

export function PublicHomeCreateInitiativeCta({ label }: { label: string }) {
  const authStatus = useClientAuthStatus();

  if (authStatus === "pending") {
    return (
      <Button variant="primary" disabled>
        Loading…
      </Button>
    );
  }

  const href = authStatus === "authenticated" ? WORKSPACE_CREATE_HREF : REGISTER_CREATE_HREF;

  return (
    <Button href={href} variant="primary">
      {label}
    </Button>
  );
}
