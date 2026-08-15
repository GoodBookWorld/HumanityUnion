"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { KnowledgeCenterListing } from "@hu/types";

import { CIVIC_MEDIA_ROUTE } from "../../civic-media-center/routes";

import "../knowledge-center.css";

interface KnowledgeSidebarProps {
  listing: KnowledgeCenterListing;
  /** Called after a nav link is activated (e.g. close mobile drawer). */
  onNavigate?: () => void;
  /** Hide the redundant title when the drawer already shows "Knowledge Center". */
  variant?: "desktop" | "drawer";
}

export function KnowledgeSidebar({
  listing,
  onNavigate,
  variant = "desktop",
}: KnowledgeSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={
        variant === "drawer"
          ? "knowledge-center__sidebar knowledge-center__sidebar--drawer"
          : "knowledge-center__sidebar knowledge-center__sidebar--desktop"
      }
      aria-label="Knowledge Center navigation"
    >
      {variant === "desktop" ? (
        <div>
          <p className="knowledge-center__sidebar-title">
            <Link href="/knowledge" onClick={onNavigate}>
              Knowledge Center
            </Link>
          </p>
        </div>
      ) : null}
      <nav>
        <ul className="knowledge-center__nav-list">
          <li>
            <p className="knowledge-center__nav-category">Subsections</p>
            <ul className="knowledge-center__nav-items">
              <li>
                <Link
                  href={CIVIC_MEDIA_ROUTE}
                  className="knowledge-center__nav-link"
                  aria-current={pathname === CIVIC_MEDIA_ROUTE ? "page" : undefined}
                  onClick={onNavigate}
                >
                  Civic Media Center
                </Link>
              </li>
            </ul>
          </li>
          {listing.categories.map((category) => (
            <li key={category.id}>
              <p className="knowledge-center__nav-category">{category.title}</p>
              <ul className="knowledge-center__nav-items">
                {category.articles.map((article) => {
                  const href = `/knowledge/${article.slug}`;
                  const isCurrent = pathname === href;

                  return (
                    <li key={article.slug}>
                      <Link
                        href={href}
                        className="knowledge-center__nav-link"
                        aria-current={isCurrent ? "page" : undefined}
                        onClick={onNavigate}
                      >
                        {article.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
