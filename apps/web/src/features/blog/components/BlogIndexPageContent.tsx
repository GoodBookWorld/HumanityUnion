"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type {
  BlogCategory,
  PublicBlogCategoryCount,
  PublicBlogPostListItem,
} from "@hu/types";

import { isApiUnavailableError } from "../../../lib/api-client";
import {
  BLOG_PAGE_SIZE,
  fetchPublicBlogCategories,
  fetchPublicBlogPosts,
} from "../api";
import {
  parseBlogPageParam,
  resolveCategoryIdFromSlug,
} from "../blog-url";
import { BlogDiscoveryLeftRail } from "./BlogDiscoveryLeftRail";
import { BlogDiscoveryRightRail } from "./BlogDiscoveryRightRail";
import { BlogPagination } from "./BlogPagination";
import { BlogPostCard } from "./BlogPostCard";

import "../blog.css";

export function BlogIndexPageContent() {
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const categorySlug = searchParams.get("category") ?? "all";
  const page = parseBlogPageParam(searchParams.get("page"));

  const [categories, setCategories] = useState<readonly BlogCategory[]>([]);
  const [items, setItems] = useState<PublicBlogPostListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<readonly PublicBlogCategoryCount[]>([]);
  const [latestPublications, setLatestPublications] = useState<readonly PublicBlogPostListItem[]>(
    [],
  );
  const [blogIndexViews, setBlogIndexViews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchPublicBlogCategories()
      .then((list) => {
        if (!cancelled) {
          setCategories(list);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCategories([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const categoryId = useMemo(
    () => resolveCategoryIdFromSlug(categories, categorySlug),
    [categories, categorySlug],
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void fetchPublicBlogPosts({
      q: q || undefined,
      categoryId,
      page,
      pageSize: BLOG_PAGE_SIZE,
      includeDiscovery: true,
      signal: controller.signal,
    })
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }

        setItems([...response.items]);
        setTotal(response.total);
        setTotalPages(
          response.totalPages ??
            (response.total === 0 ? 0 : Math.max(1, Math.ceil(response.total / BLOG_PAGE_SIZE))),
        );
        setCategoryCounts(response.categoryCounts ?? []);
        setLatestPublications(response.latestPublications ?? []);
        setBlogIndexViews(response.blogIndexViews ?? 0);
        setLoading(false);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setItems([]);
        setTotal(0);
        setTotalPages(0);
        setCategoryCounts([]);
        setLatestPublications([]);
        setBlogIndexViews(0);
        setLoading(false);
        setError(
          isApiUnavailableError(fetchError)
            ? "The Blog is temporarily unavailable. Please try again shortly."
            : fetchError instanceof Error
              ? fetchError.message
              : "Unable to load Blog publications.",
        );
      });

    return () => {
      controller.abort();
    };
  }, [q, categoryId, page, categories.length]);

  const filtersActive = Boolean(q.trim()) || (categorySlug !== "all" && Boolean(categorySlug));

  return (
    <main className="blog-page hu-page-container blog-page--pack14d">
      <header className="blog-page__header">
        <h1 className="hu-heading-1">Blog</h1>
        <p className="hu-body blog-page__subtitle">
          Ideas, reflections and perspectives from Humanity Union authors.
        </p>
      </header>

      <div className="blog-layout">
        <BlogDiscoveryLeftRail
          categories={categories}
          activeCategorySlug={categorySlug}
          q={q}
        />

        <section className="blog-layout__center" aria-labelledby="blog-feed-heading" tabIndex={0}>
          <h2 id="blog-feed-heading" className="hu-heading-2">
            Publications
          </h2>

          {error ? (
            <p className="blog-page__status" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? <p className="blog-page__status">Loading publications…</p> : null}

          {!loading && !error && items.length === 0 ? (
            <div className="blog-empty">
              <p className="hu-body">
                {filtersActive ? "No publications match this search." : "No publications found."}
              </p>
              {filtersActive ? (
                <Link href="/blog" className="hu-button hu-button--secondary hu-button--sm">
                  Clear filters
                </Link>
              ) : null}
            </div>
          ) : null}

          {!loading && !error && items.length > 0 ? (
            <>
              <div className="blog-post-feed">
                {items.map((post) => (
                  <BlogPostCard key={post.postId} post={post} />
                ))}
              </div>
              <BlogPagination
                page={page}
                totalPages={Math.max(totalPages, 1)}
                totalItems={total}
                pageSize={BLOG_PAGE_SIZE}
                q={q}
                categorySlug={categorySlug}
              />
            </>
          ) : null}
        </section>

        <BlogDiscoveryRightRail
          blogIndexViews={blogIndexViews}
          categoryCounts={categoryCounts}
          latestPublications={latestPublications}
          activeCategorySlug={categorySlug}
          q={q}
          searchInputId="blog-index-search"
        />
      </div>
    </main>
  );
}
