"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { PublicBlogPostDetail } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import { isApiUnavailableError, isNotFoundError } from "../../../lib/api-client";
import { formatBlogPublishedDate, fetchPublicBlogPostBySlug } from "../api";
import { buildBlogIndexHref } from "../blog-url";
import { resolveBlogCategoryDisplayName } from "../resolve-blog-category-display-name";
import { BlogArticleBody } from "./BlogArticleBody";
import { BlogAuthorCard } from "./BlogAuthorCard";
import { BlogAuthorInline } from "./BlogAuthorInline";
import { BlogCommentsSection } from "./BlogCommentsSection";
import { BlogCoverImage } from "./BlogCoverImage";
import { BlogDiscoveryLeftRail } from "./BlogDiscoveryLeftRail";
import { BlogDiscoveryRightRail } from "./BlogDiscoveryRightRail";
import { BlogDiscoverySearch } from "./BlogDiscoverySearch";
import { BlogReactionControls } from "./BlogReactionControls";
import { BlogRelatedPosts } from "./BlogRelatedPosts";
import { usePublicBlogDiscovery } from "./usePublicBlogDiscovery";

import "../blog.css";

interface BlogArticlePageContentProps {
  slug: string;
  /**
   * Launch Readiness Pack 06 — when provided by the server page (including
   * `null` for not-found), the client skips a duplicate detail fetch.
   */
  initialPost?: PublicBlogPostDetail | null;
  /**
   * Optional SSR CT seed used by the server page for Search/SEO/metadata.
   * Ordinary visible reading ignores this bag — browser-native translation owns
   * reading; post-mount content-translation must not replace the article DOM
   * (Pack 1 principle).
   */
  initialPresentation?: {
    readonly title: string;
    readonly excerpt: string;
    readonly contentHtml: string;
  };
}

/**
 * Ordinary public Blog article reading.
 *
 * Stable Browser Translation — Blog reading:
 * - Visible title/body are the canonical published post only.
 * - Do not asynchronously resolve or apply content-translation into visible
 *   React HTML after mount (that races and overwrites browser-native translation).
 * - Shared blog presentation helpers remain for cards, seeds, Search/SEO outside
 *   this ordinary reading path.
 */
export function BlogArticlePageContent({
  slug,
  initialPost,
  initialPresentation: _initialPresentation,
}: BlogArticlePageContentProps) {
  void _initialPresentation;
  const t = useTranslations("blogPublic");
  const locale = useLocale();
  const discovery = usePublicBlogDiscovery();
  const seeded = initialPost !== undefined;
  const [post, setPost] = useState<PublicBlogPostDetail | null>(() =>
    initialPost && initialPost.slug === slug ? initialPost : null,
  );
  const [error, setError] = useState<"not_found" | "unavailable" | "generic" | null>(() =>
    seeded && initialPost === null ? "not_found" : null,
  );

  useEffect(() => {
    if (seeded) {
      if (initialPost && initialPost.slug === slug) {
        setPost(initialPost);
        setError(null);
        return;
      }

      setPost(null);
      setError("not_found");
      return;
    }

    let cancelled = false;
    setPost(null);
    setError(null);

    void fetchPublicBlogPostBySlug(slug)
      .then((detail) => {
        if (!cancelled) {
          setPost(detail);
        }
      })
      .catch((fetchError: unknown) => {
        if (cancelled) {
          return;
        }

        if (isNotFoundError(fetchError)) {
          setError("not_found");
          return;
        }

        if (isApiUnavailableError(fetchError)) {
          setError("unavailable");
          return;
        }

        setError("generic");
      });

    return () => {
      cancelled = true;
    };
  }, [slug, seeded, initialPost]);

  function commentsLabel(count: number): string {
    if (count <= 0) {
      return t("noComments");
    }
    if (count === 1) {
      return t("oneComment");
    }
    return t("commentsCount", { count });
  }

  if (error === "not_found") {
    return (
      <main className="blog-page blog-article hu-page-container blog-page--pack15c">
        <p className="hu-body" role="alert">
          {t("notFound")}
        </p>
        <Link href="/blog" className="hu-button hu-button--secondary hu-button--sm">
          {t("backToBlog")}
        </Link>
      </main>
    );
  }

  if (error) {
    return (
      <main className="blog-page blog-article hu-page-container blog-page--pack15c">
        <p className="hu-body" role="alert">
          {error === "unavailable" ? t("unavailable") : t("articleLoadError")}
        </p>
        <Link href="/blog" className="hu-button hu-button--secondary hu-button--sm">
          {t("backToBlog")}
        </Link>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="blog-page blog-article hu-page-container blog-page--pack15c">
        <div className="blog-layout">
          <BlogDiscoverySearch searchInputId="blog-article-search" />
          <BlogDiscoveryLeftRail
            categories={discovery.categories}
            categoryCounts={discovery.categoryCounts}
          />
          <section className="blog-layout__center" aria-busy="true" tabIndex={0}>
            <p className="blog-page__status">{t("loadingPublication")}</p>
          </section>
          <BlogDiscoveryRightRail
            blogIndexViews={discovery.blogIndexViews}
            categoryCounts={discovery.categoryCounts}
            latestPublications={discovery.latestPublications}
          />
        </div>
      </main>
    );
  }

  const showUpdated =
    post.updatedAt &&
    post.publishedAt &&
    Date.parse(post.updatedAt) - Date.parse(post.publishedAt) > 60_000;
  const commentsHref = `#comments`;
  const categoryHref = buildBlogIndexHref({ categorySlug: post.category.slug });
  const categoryDisplayName = resolveBlogCategoryDisplayName(
    post.category.categoryId,
    t,
    post.category.name,
  );
  // Stable canonical reading DOM — no post-mount CT title/body replacement.
  const titleForDisplay = post.title;
  const bodyHtml = post.content;

  return (
    <main
      className="blog-page blog-article hu-page-container blog-page--pack15c"
      data-hu-reading-owner="browser-native"
    >
      <div className="blog-layout">
        <BlogDiscoverySearch
          activeCategorySlug={post.category.slug}
          searchInputId="blog-article-search"
        />
        <BlogDiscoveryLeftRail
          categories={discovery.categories}
          activeCategorySlug={post.category.slug}
          categoryCounts={discovery.categoryCounts}
        />

        <article
          className="blog-layout__center blog-article__center"
          aria-labelledby="blog-article-title"
          tabIndex={0}
        >
          <nav className="blog-article__crumb" aria-label={t("breadcrumbAria")}>
            <Link href="/blog">{t("pageTitle")}</Link>
            <span aria-hidden="true"> / </span>
            <Link href={categoryHref}>{categoryDisplayName}</Link>
          </nav>

          <div className="blog-article__meta" aria-label={t("publicationDetailsAria")}>
            <span className="blog-article__meta-item">
              <BlogAuthorInline author={post.author} />
            </span>
            <span className="blog-article__meta-sep" aria-hidden="true">
              ·
            </span>
            <span className="blog-article__meta-item">
              <time className="hu-caption" dateTime={post.publishedAt}>
                {formatBlogPublishedDate(post.publishedAt, locale)}
              </time>
            </span>
            {showUpdated ? (
              <>
                <span className="blog-article__meta-sep" aria-hidden="true">
                  ·
                </span>
                <span className="blog-article__meta-item">
                  <time className="hu-caption" dateTime={post.updatedAt}>
                    {t("updated", { date: formatBlogPublishedDate(post.updatedAt, locale) })}
                  </time>
                </span>
              </>
            ) : null}
            <span className="blog-article__meta-sep" aria-hidden="true">
              ·
            </span>
            <span className="blog-article__meta-item">
              <Link href={commentsHref} className="hu-caption blog-article__comments-meta">
                {commentsLabel(post.commentCount)}
              </Link>
            </span>
          </div>

          {/*
            Canonical Blog source prose is English. Declare that on the reading
            surface so non-English Preferred Reading (<html lang>) does not make
            browser MT skip the English article body.
          */}
          <div
            className="blog-article__canonical-reading"
            lang={DEFAULT_PLATFORM_LANGUAGE}
            data-hu-content-lang={DEFAULT_PLATFORM_LANGUAGE}
          >
            <h1 id="blog-article-title" className="hu-heading-1 blog-article__title">
              {titleForDisplay}
            </h1>

            <div className="blog-article__cover">
              <BlogCoverImage
                title={titleForDisplay}
                imageUrl={post.coverImage?.mediaUrl}
                altText={post.coverImage?.altText}
                className="blog-article__cover-image"
                priority
              />
            </div>

            <BlogArticleBody html={bodyHtml} />
          </div>

          <BlogReactionControls
            slug={post.slug}
            initialHelpful={post.reactionCounts.helpful}
            initialNotHelpful={post.reactionCounts.notHelpful}
            initialCurrent={post.currentUserReaction}
          />

          <BlogCommentsSection slug={post.slug} initialCount={post.commentCount} />

          <BlogAuthorCard author={post.author} />

          <BlogRelatedPosts categoryId={post.category.categoryId} excludePostId={post.postId} />

          <p className="blog-article__back">
            <Link href="/blog" className="hu-button hu-button--secondary hu-button--sm">
              {t("backToBlog")}
            </Link>
          </p>
        </article>

        <BlogDiscoveryRightRail
          blogIndexViews={discovery.blogIndexViews}
          categoryCounts={discovery.categoryCounts}
          latestPublications={discovery.latestPublications}
          activeCategorySlug={post.category.slug}
        />
      </div>
    </main>
  );
}
