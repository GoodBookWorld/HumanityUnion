"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { BlogCategory, PublicBlogPostListItem } from "@hu/types";

import { isApiUnavailableError } from "../../../lib/api-client";
import {
  BLOG_PAGE_SIZE,
  fetchPublicBlogCategories,
  fetchPublicBlogPosts,
} from "../api";
import {
  buildBlogIndexHref,
  parseBlogPageParam,
  resolveCategoryIdFromSlug,
} from "../blog-url";
import { BlogPagination } from "./BlogPagination";
import { BlogPostCard } from "./BlogPostCard";

import "../blog.css";

export function BlogIndexPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const categorySlug = searchParams.get("category") ?? "all";
  const page = parseBlogPageParam(searchParams.get("page"));

  const [draftQuery, setDraftQuery] = useState(q);
  const [categories, setCategories] = useState<readonly BlogCategory[]>([]);
  const [items, setItems] = useState<PublicBlogPostListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftQuery(q);
  }, [q]);

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

    const offset = (page - 1) * BLOG_PAGE_SIZE;

    void fetchPublicBlogPosts({
      q: q || undefined,
      categoryId,
      limit: BLOG_PAGE_SIZE,
      offset,
      signal: controller.signal,
    })
      .then((response) => {
        if (controller.signal.aborted) {
          return;
        }

        setItems([...response.items]);
        setTotal(response.total);
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

  const totalPages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));
  const filtersActive = Boolean(q.trim()) || (categorySlug !== "all" && Boolean(categorySlug));

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(buildBlogIndexHref({ q: draftQuery, categorySlug, page: 1 }));
  }

  function onCategoryChange(nextSlug: string) {
    router.push(buildBlogIndexHref({ q, categorySlug: nextSlug, page: 1 }));
  }

  return (
    <main className="blog-page hu-page-container">
      <header className="blog-page__header">
        <h1 className="hu-heading-1">Blog</h1>
        <p className="hu-body blog-page__subtitle">
          Ideas, reflections and perspectives from Humanity Union authors.
        </p>
      </header>

      <form className="blog-filters" onSubmit={onSearchSubmit} role="search">
        <div className="blog-filters__search">
          <label className="hu-label" htmlFor="blog-search">
            Search
          </label>
          <div className="blog-filters__search-row">
            <input
              id="blog-search"
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

        <div className="blog-filters__category">
          <label className="hu-label" htmlFor="blog-category">
            Category
          </label>
          <select
            id="blog-category"
            className="hu-form-control"
            value={categorySlug || "all"}
            onChange={(event) => onCategoryChange(event.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category.categoryId} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </form>

      {error ? (
        <p className="blog-page__status" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <p className="blog-page__status">Loading publications…</p> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="blog-empty">
          <p className="hu-body">No publications found.</p>
          {filtersActive ? (
            <Link href="/blog" className="hu-button hu-button--secondary hu-button--sm">
              Clear filters
            </Link>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <div className="blog-post-grid">
            {items.map((post) => (
              <BlogPostCard key={post.postId} post={post} />
            ))}
          </div>
          <BlogPagination
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={BLOG_PAGE_SIZE}
            q={q}
            categorySlug={categorySlug}
          />
        </>
      ) : null}
    </main>
  );
}
