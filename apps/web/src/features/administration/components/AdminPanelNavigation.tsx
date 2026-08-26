"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  ADMIN_PANEL_SECTIONS,
  resolveAdminPanelSectionId,
} from "../admin-panel-sections";
import { scrollAdminPanelNavItemIntoView } from "../admin-panel-navigation-scroll";

import "./admin-panel-navigation.css";

export {
  computeAdminPanelNavCenteredScrollLeft,
  scrollAdminPanelNavItemIntoView,
} from "../admin-panel-navigation-scroll";

export function AdminPanelNavigation() {
  const pathname = usePathname() ?? "/admin";
  const activeId = resolveAdminPanelSectionId(pathname);
  const listRef = useRef<HTMLUListElement>(null);
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    scrollAdminPanelNavItemIntoView(listRef.current, activeLinkRef.current);
  }, [activeId]);

  return (
    <nav className="admin-panel-navigation" aria-label="Admin Panel sections">
      <ul ref={listRef} className="admin-panel-navigation__list">
        {ADMIN_PANEL_SECTIONS.map((section) => {
          const active = section.id === activeId;

          return (
            <li key={section.id} className="admin-panel-navigation__item">
              <Link
                ref={active ? activeLinkRef : undefined}
                href={section.href}
                className={`admin-panel-navigation__link${active ? " admin-panel-navigation__link--active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
