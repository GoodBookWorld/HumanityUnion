"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import type { KnowledgeCenterListing } from "@hu/types";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";
import { CIVIC_MEDIA_ROUTE } from "../../civic-media-center/routes";
import {
  resolveKnowledgeArticleTitle,
  resolveKnowledgeCategoryPresentation,
} from "../resolve-knowledge-presentation";

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
  const t = useTranslations("knowledgePublic");
  const tNav = useTranslations("knowledgePublic.nav");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };
  const pathname = usePathname();

  return (
    <aside
      className={
        variant === "drawer"
          ? "knowledge-center__sidebar knowledge-center__sidebar--drawer"
          : "knowledge-center__sidebar knowledge-center__sidebar--desktop"
      }
      aria-label={tNav("ariaLabel")}
    >
      {variant === "desktop" ? (
        <div>
          <p className="knowledge-center__sidebar-title">
            <Link href="/knowledge" onClick={onNavigate}>
              {tNav("title")}
            </Link>
          </p>
        </div>
      ) : null}
      <nav>
        <ul className="knowledge-center__nav-list">
          <li>
            <p className="knowledge-center__nav-category">{tNav("subsections")}</p>
            <ul className="knowledge-center__nav-items">
              <li>
                <Link
                  href={CIVIC_MEDIA_ROUTE}
                  className="knowledge-center__nav-link"
                  aria-current={pathname === CIVIC_MEDIA_ROUTE ? "page" : undefined}
                  onClick={onNavigate}
                >
                  {tNav("civicMediaCenter")}
                </Link>
              </li>
            </ul>
          </li>
          {listing.categories.map((category) => {
            const presentation = resolveKnowledgeCategoryPresentation(
              category.id,
              t,
              { title: category.title, description: category.description },
              siteName,
            );

            return (
              <li key={category.id}>
                <p className="knowledge-center__nav-category">{presentation.title}</p>
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
                          {resolveKnowledgeArticleTitle(
                            article.slug,
                            article.title,
                            t,
                            siteName,
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
