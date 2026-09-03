"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import type { PublicBlogPostDetail } from "@hu/types";

import { isApiUnavailableError, isNotFoundError } from "../../../lib/api-client";
import { formatBlogPublishedDate, fetchPublicBlogPostBySlug } from "../api";
import { buildBlogIndexHref } from "../blog-url";
import { resolveBlogPostPresentation } from "../resolve-blog-post-presentation";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";
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
}

/**
 * Pack 08I.5 — Blog title + sanitized HTML body resolve through content_translations.
 * Canonical post.content is never overwritten; missing/stale → English/original HTML.
 */
export function BlogArticlePageContent({ slug, initialPost }: BlogArticlePageContentProps) {
  const t = useTranslations("blogPublic");
  const discovery = usePublicBlogDiscovery();
  const readingContext = usePublicContentReadingContext();
  const seeded = initialPost !== undefined;
  const [post, setPost] = useState<PublicBlogPostDetail | null>(() =>
    initialPost && initialPost.slug === slug ? initialPost : null,
  );
  const [error, setError] = useState<"not_found" | "unavailable" | "generic" | null>(() =>
    seeded && initialPost === null ? "not_found" : null,
  );
  const [displayTitle, setDisplayTitle] = useState(() =>
    initialPost && initialPost.slug === slug ? initialPost.title : "",
  );
  const [displayContentHtml, setDisplayContentHtml] = useState(() =>
    initialPost && initialPost.slug === slug ? initialPost.content : "",
  );

  useEffect(() => {
    if (seeded) {
      if (initialPost && initialPost.slug === slug) {
        setPost(initialPost);
        setDisplayTitle(initialPost.title);
        setDisplayContentHtml(initialPost.content);
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
          setDisplayTitle(detail.title);
          setDisplayContentHtml(detail.content);
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

  useEffect(() => {
    if (!post || !readingContext.ready) {
      return;
    }

    let cancelled = false;

    void resolveBlogPostPresentation({
      postId: post.postId,
      canonical: {
        title: post.title,
        excerpt: post.excerpt,
        contentHtml: post.content,
      },
      readingContext,
    }).then((presentation) => {
      if (cancelled) {
        return;
      }
      setDisplayTitle(presentation.title);
      setDisplayContentHtml(presentation.contentHtml);
    });

    return () => {
      cancelled = true;
    };
  }, [
    post,
    readingContext.ready,
    readingContext.readingLanguage,
    readingContext.translationPreference,
  ]);

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
  const titleForDisplay = displayTitle || post.title;
  const bodyHtml = displayContentHtml || post.content;

  return (
    <main className="blog-page blog-article hu-page-container blog-page--pack15c">
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
            <Link href={categoryHref}>{post.category.name}</Link>
          </nav>

          <p className="hu-caption blog-article__category">
            <Link href={categoryHref}>{post.category.name}</Link>
          </p>
          <h1 id="blog-article-title" className="hu-heading-1 blog-article__title">
            {titleForDisplay}
          </h1>

          <div className="blog-article__meta" aria-label={t("publicationDetailsAria")}>
            <BlogAuthorInline author={post.author} />
            <time className="hu-caption" dateTime={post.publishedAt}>
              {formatBlogPublishedDate(post.publishedAt)}
            </time>
            {showUpdated ? (
              <time className="hu-caption" dateTime={post.updatedAt}>
                {t("updated", { date: formatBlogPublishedDate(post.updatedAt) })}
              </time>
            ) : null}
            <Link href={commentsHref} className="hu-caption blog-article__comments-meta">
              {commentsLabel(post.commentCount)}
            </Link>
          </div>

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
