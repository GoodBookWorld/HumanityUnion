"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ADMIN_PANEL_SECTIONS,
  resolveAdminPanelSectionId,
} from "../admin-panel-sections";

import "./admin-panel-navigation.css";

export function AdminPanelNavigation() {
  const pathname = usePathname() ?? "/admin";
  const activeId = resolveAdminPanelSectionId(pathname);

  return (
    <nav className="admin-panel-navigation" aria-label="Admin Panel sections">
      <ul className="admin-panel-navigation__list">
        {ADMIN_PANEL_SECTIONS.map((section) => {
          const active = section.id === activeId;

          return (
            <li key={section.id} className="admin-panel-navigation__item">
              <Link
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
