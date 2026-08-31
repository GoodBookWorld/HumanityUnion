"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { forwardRef, useCallback } from "react";

import { useClientAuthStatus } from "../../features/auth/use-client-auth-status";
import { LanguageSelector } from "../../features/language/components/LanguageSelector";
import { PRIMARY_NAVIGATION } from "../../features/public-experience/constants";
import { resolvePrimaryNavDisplayLabel } from "../../features/public-experience/primary-nav-i18n";

const WORKSPACE_ICON = "/icons/workspace/work.svg";
const NOTIFICATIONS_ICON = "/icons/workspace/icons8-notification.svg";

interface HumanityHeaderMobileMenuProps {
  menuId: string;
  activeDestination: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function HumanityHeaderMobileMenu({
  menuId,
  activeDestination,
  isOpen,
  onClose,
}: HumanityHeaderMobileMenuProps) {
  const authStatus = useClientAuthStatus();
  const tNav = useTranslations("navigation");
  const tAuth = useTranslations("auth");
  const tWorkspace = useTranslations("workspace");

  const handleLinkClick = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="humanity-header__mobile-backdrop"
        aria-label="Close navigation menu"
        onClick={onClose}
      />
      <div
        id={menuId}
        className="humanity-header__mobile-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        <nav aria-label="Primary navigation">
          <ul className="humanity-header__mobile-nav-list">
            {PRIMARY_NAVIGATION.map((item) => {
              if (!item.href) {
                return null;
              }

              const isCurrent = item.label === activeDestination;

              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="humanity-header__mobile-nav-link"
                    aria-current={isCurrent ? "page" : undefined}
                    onClick={handleLinkClick}
                  >
                    {resolvePrimaryNavDisplayLabel(item.label, tNav)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <LanguageSelector className="hu-language-selector--mobile" />

        {authStatus !== "pending" ? (
          <div className="humanity-header__mobile-auth">
            {authStatus === "unauthenticated" ? (
              <>
                <Link
                  href="/login"
                  className="humanity-header__mobile-nav-link"
                  onClick={handleLinkClick}
                >
                  {tAuth("logIn")}
                </Link>
                <Link
                  href="/register"
                  className="humanity-header__mobile-nav-link"
                  onClick={handleLinkClick}
                >
                  {tAuth("createAccount")}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/workspace"
                  className="humanity-header__mobile-nav-link"
                  onClick={handleLinkClick}
                >
                  <Image
                    src={WORKSPACE_ICON}
                    alt=""
                    width={18}
                    height={18}
                    className="humanity-header__mobile-nav-icon"
                    aria-hidden="true"
                  />
                  {tNav("workspace")}
                </Link>
                <Link
                  href="/notifications"
                  className="humanity-header__mobile-nav-link"
                  onClick={handleLinkClick}
                >
                  <Image
                    src={NOTIFICATIONS_ICON}
                    alt=""
                    width={18}
                    height={18}
                    className="humanity-header__mobile-nav-icon"
                    aria-hidden="true"
                  />
                  {tWorkspace("notifications")}
                </Link>
                <Link
                  href="/member"
                  className="humanity-header__mobile-nav-link"
                  onClick={handleLinkClick}
                >
                  {tWorkspace("profile")}
                </Link>
              </>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}

export const HumanityHeaderMenuButton = forwardRef<
  HTMLButtonElement,
  {
    isOpen: boolean;
    menuId: string;
    onToggle: () => void;
  }
>(function HumanityHeaderMenuButton({ isOpen, menuId, onToggle }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className="humanity-header__menu-button"
      aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
      aria-expanded={isOpen}
      aria-controls={menuId}
      onClick={onToggle}
    >
      <span className="humanity-header__menu-icon" aria-hidden="true" />
    </button>
  );
});
