"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { BRAND_TAGLINE, PRIMARY_NAVIGATION } from "../../features/public-experience/constants";
import { HeaderAuthUtility } from "./HeaderAuthUtility";
import { HumanityHeaderMenuButton, HumanityHeaderMobileMenu } from "./HumanityHeaderMobileMenu";

type PrimaryDestination = (typeof PRIMARY_NAVIGATION)[number]["label"];

function resolveCurrentDestination(pathname: string): PrimaryDestination {
  if (pathname.startsWith("/institutions")) {
    return "Institutions";
  }

  if (pathname.startsWith("/initiatives")) {
    return "Initiatives";
  }

  if (pathname.startsWith("/media")) {
    return "Civic Media";
  }

  if (pathname.startsWith("/knowledge/media")) {
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

  return "Home";
}

interface HumanityHeaderProps {
  currentDestination?: PrimaryDestination;
}

export function HumanityHeader({ currentDestination }: HumanityHeaderProps) {
  const pathname = usePathname();
  const activeDestination = currentDestination ?? resolveCurrentDestination(pathname);
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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMobileMenu();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen, closeMobileMenu]);

  return (
    <header className="humanity-header" data-block="Header">
      <div className="humanity-header__inner">
        <div className="humanity-header__row">
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
              {PRIMARY_NAVIGATION.map((item) => {
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
          <div className="humanity-header__utility humanity-header__utility--desktop">
            <HeaderAuthUtility />
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
