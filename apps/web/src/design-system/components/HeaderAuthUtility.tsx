"use client";

import Link from "next/link";

import { useClientAuthStatus } from "../../features/auth/use-client-auth-status";

import { AuthenticatedHeaderTools } from "./AuthenticatedHeaderTools";

export function HeaderAuthUtility() {
  const authStatus = useClientAuthStatus();

  if (authStatus === "pending") {
    return (
      <div
        className="humanity-header__utility humanity-header__utility--pending"
        aria-hidden="true"
      />
    );
  }

  if (authStatus === "unauthenticated") {
    return (
      <div className="humanity-header__utility">
        <Link href="/login" className="humanity-header__utility-link">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="humanity-header__utility">
      <AuthenticatedHeaderTools />
    </div>
  );
}
