"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef } from "react";

import { trapTabKey } from "../../../design-system/focus-trap";

const GLOBAL_LINKS = [
  { href: "/", label: "Home" },
  { href: "/institutions", label: "Institutions" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/blog", label: "Blog" },
  { href: "/media", label: "Civic Media" },
  { href: "/support", label: "Support" },
  { href: "/search", label: "Search" },
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
        aria-label="Close menu"
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
          Menu
        </h2>
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
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
