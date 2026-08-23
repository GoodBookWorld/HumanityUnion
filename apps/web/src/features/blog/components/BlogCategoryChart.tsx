import Link from "next/link";

import type { PublicBlogCategoryCount } from "@hu/types";

import { buildBlogIndexHref } from "../blog-url";

interface BlogCategoryChartProps {
  counts: readonly PublicBlogCategoryCount[];
  activeCategorySlug: string;
  q: string;
}

/** Pack 14D — vertically stacked category chart with accessible text counts. */
export function BlogCategoryChart({ counts, activeCategorySlug, q }: BlogCategoryChartProps) {
  const visible = counts.filter((row) => row.count > 0);
  const max = Math.max(0, ...visible.map((row) => row.count));

  return (
    <section className="blog-rail-widget blog-category-chart" aria-labelledby="blog-category-chart-heading">
      <h2 id="blog-category-chart-heading" className="hu-heading-3 blog-rail-widget__title">
        Publications by Category
      </h2>
      {visible.length === 0 ? (
        <p className="hu-caption">No published publications yet.</p>
      ) : (
        <ul className="blog-category-chart__list">
          {visible.map((row) => {
            const widthPercent = max > 0 ? Math.max(6, Math.round((row.count / max) * 100)) : 0;
            const href = buildBlogIndexHref({
              categorySlug: row.slug,
              q,
              page: 1,
            });
            const isActive = activeCategorySlug === row.slug;
            return (
              <li key={row.categoryId} className="blog-category-chart__item">
                <Link
                  href={href}
                  className={
                    isActive
                      ? "blog-category-chart__link is-active"
                      : "blog-category-chart__link"
                  }
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="blog-category-chart__label">
                    <span className="blog-category-chart__name">{row.name}</span>
                    <span className="blog-category-chart__count">
                      {row.count} {row.count === 1 ? "publication" : "publications"}
                    </span>
                  </span>
                  <span
                    className="blog-category-chart__bar"
                    style={{ width: `${widthPercent}%` }}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
