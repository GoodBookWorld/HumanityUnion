"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { PublicBlogPostListItem } from "@hu/types";

import { formatBlogPublishedDate } from "../api";
import { buildBlogIndexHref } from "../blog-url";
import { resolveBlogCategoryDisplayName } from "../resolve-blog-category-display-name";
import { resolveBlogPostPresentation } from "../resolve-blog-post-presentation";
import { resolvePublicContentDisplayLanguage } from "../../language/resolve-public-content-display-language";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";
import { BlogAuthorInline } from "./BlogAuthorInline";
import { BlogCoverImage } from "./BlogCoverImage";

interface BlogPostCardProps {
  post: PublicBlogPostListItem;
  /** Related strip: compact media + presentation-only ~10-word excerpt. */
  layout?: "default" | "related";
}

/** Presentation-only word clamp — never mutates stored/source content. */
function truncateWordsForDisplay(text: string, maxWords: number): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return trimmed;
  }
  const words = trimmed.split(/\s+/);
  if (words.length <= maxWords) {
    return trimmed;
  }
  return `${words.slice(0, maxWords).join(" ")}…`;
}

export function BlogPostCard({ post, layout = "default" }: BlogPostCardProps) {
  const t = useTranslations("blogPublic");
  const locale = useLocale();
  const readingContext = usePublicContentReadingContext();
  const displayLanguage = resolvePublicContentDisplayLanguage(locale);
  const requestGenerationRef = useRef(0);
  const [displayTitle, setDisplayTitle] = useState(post.title);
  const [displayExcerpt, setDisplayExcerpt] = useState(post.excerpt);

  useEffect(() => {
    setDisplayTitle(post.title);
    setDisplayExcerpt(post.excerpt);
  }, [post.postId, post.title, post.excerpt]);

  useEffect(() => {
    if (!readingContext.ready) {
      return;
    }

    const requestGeneration = ++requestGenerationRef.current;
    let cancelled = false;
    void resolveBlogPostPresentation({
      postId: post.postId,
      canonical: {
        title: post.title,
        excerpt: post.excerpt,
        contentHtml: "",
      },
      displayLanguage,
      ready: readingContext.ready,
      translationPreference: readingContext.translationPreference,
      requestGeneration,
    }).then((presentation) => {
      if (cancelled || requestGeneration !== requestGenerationRef.current) {
        return;
      }
      if (
        presentation.presentationMode === "translated" &&
        presentation.activeLanguage !== displayLanguage
      ) {
        return;
      }
      setDisplayTitle(presentation.title);
      setDisplayExcerpt(presentation.excerpt);
    });

    return () => {
      cancelled = true;
    };
  }, [
    post.postId,
    post.title,
    post.excerpt,
    readingContext.ready,
    displayLanguage,
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

  const titleId = `blog-card-title-${post.postId}`;
  const href = `/blog/${encodeURIComponent(post.slug)}`;
  const commentsHref = `${href}#comments`;
  const categoryHref = buildBlogIndexHref({ categorySlug: post.category.slug });
  const titleForDisplay = displayTitle || post.title;
  const excerptSource = displayExcerpt || post.excerpt;
  const excerptForDisplay =
    layout === "related"
      ? truncateWordsForDisplay(excerptSource, 10)
      : excerptSource;
  const isRelated = layout === "related";

  return (
    <article
      className={["hu-card", "blog-post-card", isRelated ? "blog-post-card--related" : null]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={titleId}
    >
      <div className="blog-post-card__body">
        <h2 id={titleId} className="hu-heading-3 blog-post-card__title">
          <Link href={href}>{titleForDisplay}</Link>
        </h2>

        <div className="blog-post-card__meta" aria-label={t("publicationDetailsAria")}>
          <span className="blog-post-card__meta-item">
            <img
              src="/icons/workspace/date.png"
              alt=""
              width={18}
              height={18}
              className="blog-post-card__meta-icon"
              aria-hidden="true"
            />
            <time dateTime={post.publishedAt}>{formatBlogPublishedDate(post.publishedAt, locale)}</time>
          </span>

          <span className="blog-post-card__meta-item blog-post-card__meta-item--author">
            <BlogAuthorInline author={post.author} />
          </span>

          <Link href={commentsHref} className="blog-post-card__meta-item blog-post-card__meta-link">
            <img
              src="/icons/workspace/comments.png"
              alt=""
              width={18}
              height={18}
              className="blog-post-card__meta-icon"
              aria-hidden="true"
            />
            <span>{commentsLabel(post.commentCount)}</span>
          </Link>
        </div>

        <div className="blog-post-card__content">
          <Link href={href} className="blog-post-card__media-link" tabIndex={-1} aria-hidden="true">
            <BlogCoverImage
              title={titleForDisplay}
              imageUrl={post.coverImage?.mediaUrl}
              altText={post.coverImage?.altText}
              className="blog-post-card__image"
            />
          </Link>
          <p className="hu-body-sm blog-post-card__excerpt">{excerptForDisplay}</p>
        </div>

        <p className="blog-post-card__category">
          <Link href={categoryHref} className="blog-post-card__category-link">
            <img
              src="/icons/workspace/opened-folder.png"
              alt=""
              width={18}
              height={18}
              className="blog-post-card__meta-icon"
              aria-hidden="true"
            />
            <span>{resolveBlogCategoryDisplayName(post.category.categoryId, t)}</span>
          </Link>
        </p>

        <p className="blog-post-card__cta">
          <Link href={href} className="hu-button hu-button--secondary hu-button--sm">
            {t("readMore")}
          </Link>
        </p>
      </div>
    </article>
  );
}
