"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import {
  BRAND_TAGLINE,
  DESKTOP_CAPSULE_NAVIGATION,
  type PrimaryNavLabel,
} from "../../features/public-experience/constants";
import { resolvePrimaryNavDisplayLabel } from "../../features/public-experience/primary-nav-i18n";
import { LanguageSelector } from "../../features/language/components/LanguageSelector";
import { getFocusableElements, trapTabKey } from "../focus-trap";
import { BrowserWorkspaceHeaderControls } from "./BrowserWorkspaceHeaderControls";
import { HeaderAuthUtility } from "./HeaderAuthUtility";
import { HumanityHeaderMenuButton, HumanityHeaderMobileMenu } from "./HumanityHeaderMobileMenu";
import { resolveCurrentDestination } from "./resolve-current-destination";

export { resolveCurrentDestination } from "./resolve-current-destination";

type PrimaryDestination = PrimaryNavLabel;

interface HumanityHeaderProps {
  currentDestination?: PrimaryDestination | null;
}

export function HumanityHeader({ currentDestination }: HumanityHeaderProps) {
  const pathname = usePathname();
  const tNav = useTranslations("navigation");
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
                      {resolvePrimaryNavDisplayLabel(item.label, tNav)}
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
