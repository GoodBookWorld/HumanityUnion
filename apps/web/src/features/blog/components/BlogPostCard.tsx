"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import type { PublicBlogPostListItem } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import { useHuPersistedOrdinaryFields } from "../../language/use-hu-persisted-ordinary-fields";
import { formatBlogPublishedDate } from "../api";
import { buildBlogIndexHref } from "../blog-url";
import { resolveBlogCategoryDisplayName } from "../resolve-blog-category-display-name";
import { BlogAuthorInline } from "./BlogAuthorInline";
import { BlogCoverImage } from "./BlogCoverImage";

interface BlogPostCardProps {
  post: PublicBlogPostListItem;
  /** Related strip: compact media + presentation-only ~10-word excerpt. */
  layout?: "default" | "related";
}

/** Presentation-only word clamp — never mutates stored/source content. */
function truncateWordsForDisplay(text: string, maxWords: number): string {
  // Display-only: some excerpts contain literal HTML entities (e.g. `&nbsp;`).
  const cleaned = text
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) {
    return cleaned;
  }
  const words = cleaned.split(/\s+/);
  if (words.length <= maxWords) {
    return cleaned;
  }
  return `${words.slice(0, maxWords).join(" ")}…`;
}

/**
 * Ordinary public Blog card reading.
 * Pack 1 WEB: canonical title/excerpt (browser-native).
 * PWA Pack 01: hu-persisted CURRENT when available.
 */
export function BlogPostCard({ post, layout = "default" }: BlogPostCardProps) {
  const t = useTranslations("blogPublic");
  const locale = useLocale();
  const persisted = useHuPersistedOrdinaryFields({
    sourceKind: "blog_post",
    sourceRecordId: post.postId,
    fallbackFields: {
      title: post.title,
      excerpt: post.excerpt,
      content: "",
    },
    fieldOrder: ["title", "excerpt"],
  });

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
  const titleForDisplay =
    persisted.owner === "hu-persisted" &&
    persisted.presentationMode === "localized" &&
    persisted.fields.title?.trim()
      ? persisted.fields.title
      : post.title;
  const excerptSource =
    persisted.owner === "hu-persisted" &&
    persisted.presentationMode === "localized" &&
    persisted.fields.excerpt?.trim()
      ? persisted.fields.excerpt
      : post.excerpt;
  const excerptForDisplay =
    layout === "related"
      ? truncateWordsForDisplay(excerptSource, 10)
      : excerptSource;
  const isRelated = layout === "related";
  const titleLang =
    persisted.owner === "hu-persisted" && persisted.presentationMode === "localized"
      ? persisted.activeLanguage
      : DEFAULT_PLATFORM_LANGUAGE;

  return (
    <article
      className={["hu-card", "blog-post-card", isRelated ? "blog-post-card--related" : null]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={titleId}
      data-hu-reading-owner={persisted.owner}
    >
      <div className="blog-post-card__body">
        <h2
          id={titleId}
          className="hu-heading-3 blog-post-card__title"
          lang={titleLang}
        >
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
          <p
            className="hu-body-sm blog-post-card__excerpt"
            lang={DEFAULT_PLATFORM_LANGUAGE}
          >
            {excerptForDisplay}
          </p>
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
            <span>
              {resolveBlogCategoryDisplayName(
                post.category.categoryId,
                t,
                post.category.name,
              )}
            </span>
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
