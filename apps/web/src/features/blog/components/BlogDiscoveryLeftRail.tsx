"use client";

import { useTranslations } from "next-intl";

import type { BlogCategory, PublicBlogCategoryCount } from "@hu/types";

import { BlogAuthorsSidebar } from "./BlogAuthorsSidebar";
import { BlogCategoriesSidebar } from "./BlogCategoriesSidebar";

interface BlogDiscoveryLeftRailProps {
  categories: readonly BlogCategory[];
  activeCategorySlug?: string;
  q?: string;
  categoryCounts?: readonly PublicBlogCategoryCount[];
}

/** Pack 14D/14E/16E — shared left Blog navigation rail (Categories + Authors). */
export function BlogDiscoveryLeftRail({
  categories,
  activeCategorySlug = "all",
  q = "",
  categoryCounts,
}: BlogDiscoveryLeftRailProps) {
  const t = useTranslations("blogPublic.discovery");

  return (
    <aside className="blog-layout__left" aria-label={t("leftAria")}>
      <div className="blog-layout__categories">
        <BlogCategoriesSidebar
          categories={categories}
          activeCategorySlug={activeCategorySlug}
          q={q}
          categoryCounts={categoryCounts}
        />
      </div>
      <div className="blog-layout__authors">
        <BlogAuthorsSidebar />
      </div>
    </aside>
  );
}
