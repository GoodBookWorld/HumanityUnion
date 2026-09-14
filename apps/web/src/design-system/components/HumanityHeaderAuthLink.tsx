"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { useClientAuthStatus } from "../../features/auth/use-client-auth-status";

/** Legacy utility — prefer HeaderAuthUtility. Pack 07: session-based, not localStorage. */
export function HumanityHeaderAuthLink() {
  const status = useClientAuthStatus();
  const tAuth = useTranslations("auth");
  const tNav = useTranslations("navigation");

  if (status === "pending") {
    return <span className="humanity-header__utility-link" aria-hidden="true" />;
  }

  if (status === "authenticated") {
    return (
      <Link href="/workspace" className="humanity-header__utility-link">
        {tNav("workspace")}
      </Link>
    );
  }

  return (
    <Link href="/login" className="humanity-header__utility-link">
      {tAuth("logIn")}
    </Link>
  );
}

export function hasStoredAuthTokenForHydrationCheck(): boolean {
  return false;
}
