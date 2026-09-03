"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { PublicBlogPostListItem } from "@hu/types";

import { formatBlogPublishedDate } from "../api";
import { buildBlogIndexHref } from "../blog-url";
import { resolveBlogCategoryDisplayName } from "../resolve-blog-category-display-name";
import { resolveBlogPostPresentation } from "../resolve-blog-post-presentation";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";
import { BlogAuthorInline } from "./BlogAuthorInline";
import { BlogCoverImage } from "./BlogCoverImage";

interface BlogPostCardProps {
  post: PublicBlogPostListItem;
}

export function BlogPostCard({ post }: BlogPostCardProps) {
  const t = useTranslations("blogPublic");
  const locale = useLocale();
  const readingContext = usePublicContentReadingContext();
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

    let cancelled = false;
    void resolveBlogPostPresentation({
      postId: post.postId,
      canonical: {
        title: post.title,
        excerpt: post.excerpt,
        contentHtml: "",
      },
      readingContext,
    }).then((presentation) => {
      if (cancelled) {
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

  const titleId = `blog-card-title-${post.postId}`;
  const href = `/blog/${encodeURIComponent(post.slug)}`;
  const commentsHref = `${href}#comments`;
  const categoryHref = buildBlogIndexHref({ categorySlug: post.category.slug });
  const titleForDisplay = displayTitle || post.title;

  return (
    <article className="hu-card blog-post-card" aria-labelledby={titleId}>
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
          <p className="hu-body-sm blog-post-card__excerpt">{displayExcerpt || post.excerpt}</p>
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
