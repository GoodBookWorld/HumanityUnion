"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";

import { trapTabKey } from "../../../design-system/focus-trap";
import { LanguageSelector } from "../../language/components/LanguageSelector";

const GLOBAL_LINKS = [
  { href: "/", labelKey: "home", iconSrc: "/icons/burger/home.svg" },
  { href: "/institutions", labelKey: "institutions", iconSrc: "/icons/burger/government.png" },
  { href: "/knowledge", labelKey: "knowledge", iconSrc: "/icons/burger/bookshelf.png" },
  { href: "/blog", labelKey: "blog", iconSrc: "/icons/burger/blog.png" },
  { href: "/media", labelKey: "civicMedia", iconSrc: "/icons/burger/press-kit.png" },
  { href: "/support", labelKey: "support", iconSrc: "/icons/burger/support.png" },
  { href: "/search", labelKey: "search", iconSrc: "/icons/burger/search.png" },
] as const;

interface PwaGlobalMenuProps {
  open: boolean;
  onClose: () => void;
}

export function PwaGlobalMenu({ open, onClose }: PwaGlobalMenuProps) {
  const titleId = useId();
  const pathname = usePathname() ?? "/";
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const tNav = useTranslations("navigation");
  const tPwa = useTranslations("pwa");

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (panelRef.current) {
        trapTabKey(event, panelRef.current);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="hu-pwa-global-menu" role="presentation">
      <button
        type="button"
        className="hu-pwa-global-menu__backdrop"
        aria-label={tPwa("closeMenu")}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="hu-pwa-global-menu__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="hu-pwa-global-menu__title">
          {tPwa("menuTitle")}
        </h2>
        <div className="hu-pwa-global-menu__language">
          <LanguageSelector className="hu-language-selector--header" variant="icon" />
        </div>
        <ul className="hu-pwa-global-menu__list">
          {GLOBAL_LINKS.map((link) => {
            const current =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  onClick={onClose}
                >
                  <img
                    className="hu-pwa-global-menu__icon"
                    src={link.iconSrc}
                    alt=""
                    width={24}
                    height={24}
                    aria-hidden="true"
                  />
                  <span>{tNav(link.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
