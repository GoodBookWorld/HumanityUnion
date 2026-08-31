"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  BRAND_TAGLINE,
  DESKTOP_CAPSULE_NAVIGATION,
  type PrimaryNavLabel,
} from "../../features/public-experience/constants";
import { getFocusableElements, trapTabKey } from "../focus-trap";
import { BrowserWorkspaceHeaderControls } from "./BrowserWorkspaceHeaderControls";
import { HeaderAuthUtility } from "./HeaderAuthUtility";
import { HumanityHeaderMenuButton, HumanityHeaderMobileMenu } from "./HumanityHeaderMobileMenu";
import { LanguageSelector } from "../../features/language/components/LanguageSelector";

type PrimaryDestination = PrimaryNavLabel;

/**
 * Public Initiative lifecycle records that live outside `/initiatives/*`
 * but still belong to the Initiatives navigation destination.
 */
const NESTED_PUBLIC_INITIATIVE_PREFIXES = [
  "/collaborative-analysis/public/",
  "/improvement-proposals/public/",
  "/petitions/public/",
  "/decision-sessions/public/",
  "/collective-decisions/public/",
  "/implementation-commitments/public/",
  "/initiative-implementation-commitments/public/",
  "/implementation-tracking/public/",
  "/implementations/public/",
  "/public-impact/",
  "/civic-archive/",
] as const;

function isNestedPublicInitiativeRoute(pathname: string): boolean {
  if (pathname === "/civic-archive" || pathname === "/civic-archive/") {
    return false;
  }

  return NESTED_PUBLIC_INITIATIVE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Launch Readiness Pack 02 / Pack 04 — only mark a primary nav item current
 * when the pathname actually belongs to that destination. Unmatched routes
 * (Blog, Workspace, Profile, auth, …) must not fall through to "Home".
 * Nested public Initiative lifecycle records mark Initiatives.
 */
export function resolveCurrentDestination(pathname: string): PrimaryDestination | null {
  if (pathname === "/" || pathname === "") {
    return "Home";
  }

  if (pathname.startsWith("/institutions")) {
    return "Institutions";
  }

  if (pathname.startsWith("/initiatives") || isNestedPublicInitiativeRoute(pathname)) {
    return "Initiatives";
  }

  if (pathname.startsWith("/media") || pathname.startsWith("/knowledge/media")) {
    return "Civic Media";
  }

  if (pathname.startsWith("/knowledge")) {
    return "Knowledge";
  }

  if (pathname.startsWith("/membership")) {
    return "Membership";
  }

  if (pathname.startsWith("/search")) {
    return "Search";
  }

  return null;
}

interface HumanityHeaderProps {
  currentDestination?: PrimaryDestination | null;
}

export function HumanityHeader({ currentDestination }: HumanityHeaderProps) {
  const pathname = usePathname();
  const activeDestination =
    currentDestination !== undefined ? currentDestination : resolveCurrentDestination(pathname);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((open) => !open);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const panel = document.getElementById(mobileMenuId);
    const firstFocusable = panel ? getFocusableElements(panel)[0] : null;
    firstFocusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileMenu();
        return;
      }

      if (panel) {
        trapTabKey(event, panel);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen, closeMobileMenu, mobileMenuId]);

  return (
    <header className="humanity-header" data-block="Header">
      <div className="humanity-header__inner">
        <div className="humanity-header__row">
          {/* Pack 10A mobile order: platform burger → brand → avatar (end zone). */}
          <div className="humanity-header__brand">
            <HumanityHeaderMenuButton
              ref={menuButtonRef}
              isOpen={mobileMenuOpen}
              menuId={mobileMenuId}
              onToggle={toggleMobileMenu}
            />
            <Link href="/" className="humanity-header__logo-link" aria-label="Humanity Union home">
              <img
                src="/brand/humanity-union-logo.svg"
                alt=""
                className="humanity-header__logo"
                width={32}
                height={32}
              />
            </Link>
            <div className="humanity-header__brand-text">
              <Link href="/" className="humanity-header__brand-name">
                Humanity Union
              </Link>
              <span className="humanity-header__tagline">{BRAND_TAGLINE}</span>
            </div>
          </div>
          <nav
            className="humanity-header__nav humanity-header__nav--desktop"
            aria-label="Primary navigation"
          >
            <ul className="humanity-header__nav-list">
              {DESKTOP_CAPSULE_NAVIGATION.map((item) => {
                const isCurrent = item.label === activeDestination;

                if (!item.href) {
                  return null;
                }

                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="humanity-header__nav-link"
                      aria-current={isCurrent ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="humanity-header__end">
            <LanguageSelector className="humanity-header__language" />
            <BrowserWorkspaceHeaderControls />
            <div className="humanity-header__utility humanity-header__utility--desktop">
              <HeaderAuthUtility />
            </div>
          </div>
        </div>
      </div>
      <HumanityHeaderMobileMenu
        menuId={mobileMenuId}
        activeDestination={activeDestination}
        isOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
      />
    </header>
  );
}
