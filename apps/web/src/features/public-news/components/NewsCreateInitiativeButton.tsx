"use client";

import { Button } from "../../../design-system";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import {
  buildCreateInitiativeFromNewsHref,
  buildRegisterCreateInitiativeFromNewsHref,
} from "../api";

interface NewsCreateInitiativeButtonProps {
  newsId: string;
  label: string;
}

export function NewsCreateInitiativeButton({ newsId, label }: NewsCreateInitiativeButtonProps) {
  const authStatus = useClientAuthStatus();

  if (authStatus === "pending") {
    return (
      <Button variant="primary" disabled>
        Loading…
      </Button>
    );
  }

  const href =
    authStatus === "authenticated"
      ? buildCreateInitiativeFromNewsHref(newsId)
      : buildRegisterCreateInitiativeFromNewsHref(newsId);

  return (
    <Button href={href} variant="primary">
      {label}
    </Button>
  );
}
