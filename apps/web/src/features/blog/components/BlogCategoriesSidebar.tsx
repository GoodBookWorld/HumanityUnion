"use client";

import { useId } from "react";
import { useRouter } from "next/navigation";

import type { BlogCategory, PublicBlogCategoryCount } from "@hu/types";

import { buildBlogIndexHref } from "../blog-url";

interface BlogCategoriesSidebarProps {
  categories: readonly BlogCategory[];
  activeCategorySlug: string;
  q: string;
  /** Pack 14D/16E — optional publication counts for option labels. */
  categoryCounts?: readonly PublicBlogCategoryCount[];
}

function countForSlug(
  counts: readonly PublicBlogCategoryCount[] | undefined,
  slug: string,
): number | undefined {
  if (!counts || counts.length === 0) {
    return undefined;
  }
  return counts.find((row) => row.slug === slug)?.count;
}

function formatOptionLabel(name: string, count: number | undefined): string {
  if (count === undefined) {
    return name;
  }
  return `${name} (${count})`;
}

/**
 * Pack 16E — accessible category dropdown (replaces permanently expanded list).
 * Preserves `?category=` deep links via client navigation.
 */
export function BlogCategoriesSidebar({
  categories,
  activeCategorySlug,
  q,
  categoryCounts,
}: BlogCategoriesSidebarProps) {
  const router = useRouter();
  const selectId = useId();
  const headingId = useId();
  const active = activeCategorySlug || "all";
  const knownSlugs = new Set(["all", ...categories.map((category) => category.slug)]);
  const selected = knownSlugs.has(active) ? active : "all";

  const allCount =
    categoryCounts && categoryCounts.length > 0
      ? categoryCounts.reduce((sum, row) => sum + row.count, 0)
      : undefined;

  return (
    <nav className="blog-rail-widget blog-categories" aria-labelledby={headingId}>
      <h2 id={headingId} className="hu-heading-4 blog-rail-widget__title">
        Categories
      </h2>
      <label className="hu-label blog-categories__label" htmlFor={selectId}>
        Category
      </label>
      <select
        id={selectId}
        className="hu-form-control blog-categories__select"
        value={selected}
        aria-describedby={headingId}
        onChange={(event) => {
          const categorySlug = event.target.value || "all";
          router.push(buildBlogIndexHref({ q, categorySlug, page: 1 }));
        }}
      >
        <option value="all">{formatOptionLabel("All Categories", allCount)}</option>
        {categories.map((category) => (
          <option key={category.categoryId} value={category.slug}>
            {formatOptionLabel(category.name, countForSlug(categoryCounts, category.slug))}
          </option>
        ))}
      </select>
      <p className="hu-caption blog-categories__current" aria-live="polite">
        Selected:{" "}
        {selected === "all"
          ? formatOptionLabel("All Categories", allCount)
          : formatOptionLabel(
              categories.find((category) => category.slug === selected)?.name ?? selected,
              countForSlug(categoryCounts, selected),
            )}
      </p>
    </nav>
  );
}
