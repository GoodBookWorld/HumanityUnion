"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ADMIN_VIEWS_SECTIONS,
  resolveAdminViewsSectionId,
} from "../admin-panel-sections";

import "./admin-views-navigation.css";

export function AdminViewsNavigation() {
  const pathname = usePathname() ?? "/admin/views";
  const activeId = resolveAdminViewsSectionId(pathname);

  return (
    <nav className="admin-views-navigation" aria-label="Views sections">
      <ul className="admin-views-navigation__list">
        {ADMIN_VIEWS_SECTIONS.map((section) => {
          const active = section.id === activeId;

          return (
            <li key={section.id} className="admin-views-navigation__item">
              <Link
                href={section.href}
                className={`admin-views-navigation__link${active ? " admin-views-navigation__link--active" : ""}`}
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
