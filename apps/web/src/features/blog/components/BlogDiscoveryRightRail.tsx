"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { PublicBlogCategoryCount, PublicBlogPostListItem } from "@hu/types";

import { buildBlogIndexHref } from "../blog-url";
import { BlogCategoryChart } from "./BlogCategoryChart";
import { BlogLatestMiniCards } from "./BlogLatestMiniCards";
import { BlogViewsWidget } from "./BlogViewsWidget";

interface BlogDiscoveryRightRailProps {
  blogIndexViews: number;
  categoryCounts: readonly PublicBlogCategoryCount[];
  latestPublications: readonly PublicBlogPostListItem[];
  activeCategorySlug?: string;
  q?: string;
  /** Unique search input id when multiple shells could theoretically mount. */
  searchInputId?: string;
}

/** Pack 14D/14E — shared right discovery rail (Search → Views → Chart → Latest 4). */
export function BlogDiscoveryRightRail({
  blogIndexViews,
  categoryCounts,
  latestPublications,
  activeCategorySlug = "all",
  q = "",
  searchInputId = "blog-search",
}: BlogDiscoveryRightRailProps) {
  const router = useRouter();
  const [draftQuery, setDraftQuery] = useState(q);

  useEffect(() => {
    setDraftQuery(q);
  }, [q]);

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(buildBlogIndexHref({ q: draftQuery, categorySlug: activeCategorySlug, page: 1 }));
  }

  return (
    <aside className="blog-layout__right" aria-label="Blog discovery" tabIndex={0}>
      <form className="blog-filters blog-layout__search" onSubmit={onSearchSubmit} role="search">
        <div className="blog-filters__search">
          <label className="hu-label" htmlFor={searchInputId}>
            Search
          </label>
          <div className="blog-filters__search-row">
            <input
              id={searchInputId}
              name="q"
              type="search"
              className="hu-form-control"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Search publications"
              autoComplete="off"
            />
            <button type="submit" className="hu-button hu-button--primary">
              Search
            </button>
          </div>
        </div>
      </form>

      <div className="blog-layout__views">
        <BlogViewsWidget views={blogIndexViews} />
      </div>
      <div className="blog-layout__chart">
        <BlogCategoryChart
          counts={categoryCounts}
          activeCategorySlug={activeCategorySlug}
          q={q}
        />
      </div>
      <div className="blog-layout__latest4">
        <BlogLatestMiniCards posts={latestPublications} />
      </div>
    </aside>
  );
}
