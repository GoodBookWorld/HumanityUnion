"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getStoredAccessToken } from "../../features/auth/auth-token-store";

export function HumanityHeaderAuthLink() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(Boolean(getStoredAccessToken()));
  }, []);

  if (isAuthenticated) {
    return (
      <Link href="/workspace" className="humanity-header__utility-link">
        Workspace
      </Link>
    );
  }

  return (
    <Link href="/login" className="humanity-header__utility-link">
      Log in
    </Link>
  );
}

export function hasStoredAuthTokenForHydrationCheck(): boolean {
  return false;
}
