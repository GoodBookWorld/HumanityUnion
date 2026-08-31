"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useClientAuthStatus } from "../../features/auth/use-client-auth-status";

import { AuthenticatedHeaderTools } from "./AuthenticatedHeaderTools";

const LOGIN_ICON = "/icons/workspace/login.png";

export function HeaderAuthUtility() {
  const authStatus = useClientAuthStatus();
  const tAuth = useTranslations("auth");

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
        {/*
         * Launch Readiness UX Fix Pack 01 — one accessible Log in control with
         * the supplied workspace login icon above the label. Icon is decorative
         * so the accessible name stays the translated Log in label.
         */}
        <Link href="/login" className="humanity-header__login-link">
          <Image
            src={LOGIN_ICON}
            alt=""
            width={22}
            height={22}
            className="humanity-header__login-link-icon"
            aria-hidden="true"
          />
          <span className="humanity-header__login-link-label">{tAuth("logIn")}</span>
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
