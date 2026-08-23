import Link from "next/link";

import type { BlogCategory } from "@hu/types";

import { buildBlogIndexHref } from "../blog-url";

interface BlogCategoriesSidebarProps {
  categories: readonly BlogCategory[];
  activeCategorySlug: string;
  q: string;
}

export function BlogCategoriesSidebar({
  categories,
  activeCategorySlug,
  q,
}: BlogCategoriesSidebarProps) {
  const active = activeCategorySlug || "all";

  return (
    <nav className="blog-rail-widget" aria-labelledby="blog-categories-heading">
      <h2 id="blog-categories-heading" className="hu-heading-4 blog-rail-widget__title">
        Categories
      </h2>
      <ul className="blog-categories-list">
        <li>
          <Link
            href={buildBlogIndexHref({ q, categorySlug: "all", page: 1 })}
            className={`blog-categories-list__link${active === "all" ? " is-active" : ""}`}
            aria-current={active === "all" ? "page" : undefined}
          >
            All Categories
          </Link>
        </li>
        {categories.map((category) => {
          const isActive = active === category.slug;
          return (
            <li key={category.categoryId}>
              <Link
                href={buildBlogIndexHref({ q, categorySlug: category.slug, page: 1 })}
                className={`blog-categories-list__link${isActive ? " is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {category.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
