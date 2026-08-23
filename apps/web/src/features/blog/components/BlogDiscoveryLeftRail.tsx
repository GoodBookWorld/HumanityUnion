"use client";

import type { BlogCategory } from "@hu/types";

import { BlogAuthorsSidebar } from "./BlogAuthorsSidebar";
import { BlogCategoriesSidebar } from "./BlogCategoriesSidebar";

interface BlogDiscoveryLeftRailProps {
  categories: readonly BlogCategory[];
  activeCategorySlug?: string;
  q?: string;
}

/** Pack 14D/14E — shared left Blog navigation rail (Categories + Authors). */
export function BlogDiscoveryLeftRail({
  categories,
  activeCategorySlug = "all",
  q = "",
}: BlogDiscoveryLeftRailProps) {
  return (
    <aside className="blog-layout__left" aria-label="Blog navigation">
      <div className="blog-layout__categories">
        <BlogCategoriesSidebar
          categories={categories}
          activeCategorySlug={activeCategorySlug}
          q={q}
        />
      </div>
      <div className="blog-layout__authors">
        <BlogAuthorsSidebar />
      </div>
    </aside>
  );
}
