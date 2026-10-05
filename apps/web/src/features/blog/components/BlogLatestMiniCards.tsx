"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import type { PublicBlogPostListItem } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import { useHuPersistedOrdinaryFields } from "../../language/use-hu-persisted-ordinary-fields";
import { formatBlogPublishedDate } from "../api";
import { resolveBlogCategoryDisplayName } from "../resolve-blog-category-display-name";
import { BlogCoverImage } from "./BlogCoverImage";

interface BlogLatestMiniCardsProps {
  posts: readonly PublicBlogPostListItem[];
}

function BlogLatestMiniCard({ post }: { post: PublicBlogPostListItem }) {
  const t = useTranslations("blogPublic");
  const locale = useLocale();
  const href = `/blog/${encodeURIComponent(post.slug)}`;
  const persisted = useHuPersistedOrdinaryFields({
    sourceKind: "blog_post",
    sourceRecordId: post.postId,
    fallbackFields: {
      title: post.title,
      excerpt: "",
      content: "",
    },
    fieldOrder: ["title"],
  });
  const titleForDisplay =
    persisted.owner === "hu-persisted" &&
    persisted.presentationMode === "localized" &&
    persisted.fields.title?.trim()
      ? persisted.fields.title
      : post.title;
  const titleLang =
    persisted.owner === "hu-persisted" && persisted.presentationMode === "localized"
      ? persisted.activeLanguage
      : DEFAULT_PLATFORM_LANGUAGE;
  const categoryLabel = resolveBlogCategoryDisplayName(
    post.category.categoryId,
    t,
    post.category.name,
  );

  return (
    <li className="blog-latest-mini__item" data-hu-reading-owner={persisted.owner}>
      <Link href={href} className="blog-latest-mini__link">
        <span className="blog-latest-mini__thumb-frame" aria-hidden="true">
          <BlogCoverImage
            title={titleForDisplay}
            imageUrl={post.coverImage?.mediaUrl}
            altText={post.coverImage?.altText}
            allowTitleAsAltFallback={false}
            className="blog-latest-mini__thumb"
          />
        </span>
        <span className="blog-latest-mini__body">
          <span className="blog-latest-mini__title" lang={titleLang}>
            {titleForDisplay}
          </span>
          <span className="blog-latest-mini__category">{categoryLabel}</span>
          <time className="blog-latest-mini__date" dateTime={post.publishedAt}>
            {formatBlogPublishedDate(post.publishedAt, locale)}
          </time>
          <span className="blog-latest-mini__author">{post.author.displayName}</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Pack 14D — Latest 4 mini-cards for the right discovery rail.
 * STEP 15D.14.B.2 — same blog_post hu-persisted ordinary-reading boundary as cards.
 */
export function BlogLatestMiniCards({ posts }: BlogLatestMiniCardsProps) {
  const t = useTranslations("blogPublic.discovery.latest");

  return (
    <section className="blog-rail-widget blog-latest-mini" aria-labelledby="blog-latest-mini-heading">
      <h2 id="blog-latest-mini-heading" className="hu-heading-3 blog-rail-widget__title">
        {t("heading")}
      </h2>
      {posts.length === 0 ? (
        <p className="hu-caption">{t("empty")}</p>
      ) : (
        <ul className="blog-latest-mini__list">
          {posts.map((post) => (
            <BlogLatestMiniCard key={post.postId} post={post} />
          ))}
        </ul>
      )}
    </section>
  );
}
