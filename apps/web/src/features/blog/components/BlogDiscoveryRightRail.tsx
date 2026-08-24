"use client";

import type { PublicBlogCategoryCount, PublicBlogPostListItem } from "@hu/types";

import { BlogCategoryChart } from "./BlogCategoryChart";
import { BlogLatestMiniCards } from "./BlogLatestMiniCards";
import { BlogViewsWidget } from "./BlogViewsWidget";

interface BlogDiscoveryRightRailProps {
  blogIndexViews: number;
  categoryCounts: readonly PublicBlogCategoryCount[];
  latestPublications: readonly PublicBlogPostListItem[];
  activeCategorySlug?: string;
  q?: string;
}

/**
 * Pack 14D/15C — right discovery widgets (Views → Chart → Latest 4).
 * Search is a separate row spanning center+right (Pack 15C).
 */
export function BlogDiscoveryRightRail({
  blogIndexViews,
  categoryCounts,
  latestPublications,
  activeCategorySlug = "all",
  q = "",
}: BlogDiscoveryRightRailProps) {
  return (
    <aside className="blog-layout__right" aria-label="Blog discovery" tabIndex={0}>
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
