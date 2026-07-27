"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { KnowledgeCenterListing } from "@hu/types";

import { CIVIC_MEDIA_ROUTE } from "../../civic-media-center/routes";

import "../knowledge-center.css";

interface KnowledgeSidebarProps {
  listing: KnowledgeCenterListing;
}

export function KnowledgeSidebar({ listing }: KnowledgeSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="knowledge-center__sidebar" aria-label="Knowledge Center navigation">
      <div>
        <p className="knowledge-center__sidebar-title">
          <Link href="/knowledge">Knowledge Center</Link>
        </p>
      </div>
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
