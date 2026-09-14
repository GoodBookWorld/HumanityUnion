"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { buildBlogIndexHref } from "../blog-url";

interface BlogPaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  q: string;
  categorySlug: string;
}

/** Pack 14D — bounded page window with ellipsis (never hundreds of links). */
export function buildVisiblePagesWithEllipsis(
  page: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 1) {
    return totalPages === 1 ? [1] : [];
  }
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, page]);
  for (let candidate = page - 1; candidate <= page + 1; candidate += 1) {
    if (candidate >= 1 && candidate <= totalPages) {
      pages.add(candidate);
    }
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  let previous = 0;
  for (const value of sorted) {
    if (previous > 0 && value - previous > 1) {
      result.push("ellipsis");
    }
    result.push(value);
    previous = value;
  }
  return result;
}

export function BlogPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  q,
  categorySlug,
}: BlogPaginationProps) {
  const t = useTranslations("blogPublic.pagination");

  if (totalItems === 0) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  if (totalPages <= 1) {
    return (
      <p className="blog-pagination__info">
        {t(totalItems === 1 ? "showingCount" : "showingCountPlural", { count: totalItems })}
      </p>
    );
  }

  const visiblePages = buildVisiblePagesWithEllipsis(page, totalPages);

  return (
    <nav className="blog-pagination" aria-label={t("ariaLabel")}>
      <p className="blog-pagination__info">
        {t("showingRange", { start, end, total: totalItems })}
      </p>
      <div className="blog-pagination__controls">
        {page > 1 ? (
          <Link
            href={buildBlogIndexHref({ q, categorySlug, page: page - 1 })}
            className="hu-button hu-button--secondary hu-button--sm"
            rel="prev"
            aria-label={t("previousAria")}
          >
            {t("previous")}
          </Link>
        ) : (
          <span className="hu-button hu-button--secondary hu-button--sm" aria-disabled="true">
            {t("previous")}
          </span>
        )}
        {visiblePages.map((entry, index) =>
          entry === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="blog-pagination__ellipsis"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <Link
              key={entry}
              href={buildBlogIndexHref({ q, categorySlug, page: entry })}
              className={
                entry === page
                  ? "blog-pagination__page blog-pagination__page--current"
                  : "blog-pagination__page"
              }
              aria-label={t("pageAria", { page: entry })}
              aria-current={entry === page ? "page" : undefined}
            >
              {entry}
            </Link>
          ),
        )}
        {page < totalPages ? (
          <Link
            href={buildBlogIndexHref({ q, categorySlug, page: page + 1 })}
            className="hu-button hu-button--secondary hu-button--sm"
            rel="next"
            aria-label={t("nextAria")}
          >
            {t("next")}
          </Link>
        ) : (
          <span className="hu-button hu-button--secondary hu-button--sm" aria-disabled="true">
            {t("next")}
          </span>
        )}
      </div>
    </nav>
  );
}
