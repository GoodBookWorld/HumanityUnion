"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";

import type {
  BlogCategory,
  PublicBlogCategoryCount,
  PublicBlogPostListItem,
  PublicBlogPostListResponse,
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
import { BlogDiscoverySearch } from "./BlogDiscoverySearch";
import { BlogPagination } from "./BlogPagination";
import { BlogPostCard } from "./BlogPostCard";
import { BlogSubscriptionForm } from "./BlogSubscriptionForm";

import "../blog.css";

/** Server-fetched public data for the unfiltered first page (`/blog`). */
export interface BlogIndexInitialData {
  readonly categories: readonly BlogCategory[];
  readonly listing: PublicBlogPostListResponse;
}

function resolveTotalPages(response: PublicBlogPostListResponse): number {
  return (
    response.totalPages ??
    (response.total === 0 ? 0 : Math.max(1, Math.ceil(response.total / BLOG_PAGE_SIZE)))
  );
}

export function BlogIndexPageContent({
  initialData = null,
}: {
  initialData?: BlogIndexInitialData | null;
}) {
  const t = useTranslations("blogPublic");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const categorySlug = searchParams.get("category") ?? "all";
  const page = parseBlogPageParam(searchParams.get("page"));

  // Server data applies only when the browser URL is the same unfiltered first page.
  const seed = initialData && q === "" && categorySlug === "all" && page === 1 ? initialData : null;
  const seededOnMount = useRef(seed !== null);
  const skipSeededPostsFetch = useRef(seed !== null);

  const [categories, setCategories] = useState<readonly BlogCategory[]>(seed?.categories ?? []);
  const [items, setItems] = useState<PublicBlogPostListItem[]>(seed ? [...seed.listing.items] : []);
  const [total, setTotal] = useState(seed?.listing.total ?? 0);
  const [totalPages, setTotalPages] = useState(seed ? resolveTotalPages(seed.listing) : 0);
  const [categoryCounts, setCategoryCounts] = useState<readonly PublicBlogCategoryCount[]>(
    seed?.listing.categoryCounts ?? [],
  );
  const [latestPublications, setLatestPublications] = useState<readonly PublicBlogPostListItem[]>(
    seed?.listing.latestPublications ?? [],
  );
  const [blogIndexViews, setBlogIndexViews] = useState(seed?.listing.blogIndexViews ?? 0);
  const [loading, setLoading] = useState(seed === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (seededOnMount.current) {
      return;
    }
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
    if (skipSeededPostsFetch.current) {
      skipSeededPostsFetch.current = false;
      return;
    }
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
        setTotalPages(resolveTotalPages(response));
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
          isApiUnavailableError(fetchError) ? t("unavailable") : t("loadError"),
        );
      });

    return () => {
      controller.abort();
    };
  }, [q, categoryId, page, categories.length, t]);

  const filtersActive = Boolean(q.trim()) || (categorySlug !== "all" && Boolean(categorySlug));

  return (
    <main className="blog-page hu-page-container blog-page--pack15c">
      <header className="blog-page__header">
        <div className="blog-page__header-copy">
          <h1 className="hu-heading-1">{t("pageTitle")}</h1>
          <p className="hu-body blog-page__subtitle">{t("pageSubtitle", siteName)}</p>
        </div>
        <BlogSubscriptionForm />
      </header>

      <div className="blog-layout">
        <BlogDiscoverySearch
          activeCategorySlug={categorySlug}
          q={q}
          searchInputId="blog-index-search"
        />

        <BlogDiscoveryLeftRail
          categories={categories}
          activeCategorySlug={categorySlug}
          q={q}
          categoryCounts={categoryCounts}
        />

        <section className="blog-layout__center" aria-labelledby="blog-feed-heading" tabIndex={0}>
          <h2 id="blog-feed-heading" className="hu-heading-2">
            {t("publicationsHeading")}
          </h2>

          {error ? (
            <p className="blog-page__status" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? <p className="blog-page__status">{t("loadingPublications")}</p> : null}

          {!loading && !error && items.length === 0 ? (
            <div className="blog-empty">
              <p className="hu-body">{filtersActive ? t("emptyFiltered") : t("empty")}</p>
              {filtersActive ? (
                <Link href="/blog" className="hu-button hu-button--secondary hu-button--sm">
                  {t("clearFilters")}
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
        />
      </div>
    </main>
  );
}
