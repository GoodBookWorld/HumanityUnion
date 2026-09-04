"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { PublicBlogPostListItem } from "@hu/types";

import { formatBlogPublishedDate } from "../api";
import { resolveBlogCategoryDisplayName } from "../resolve-blog-category-display-name";
import { resolveBlogPostPresentation } from "../resolve-blog-post-presentation";
import { resolvePublicContentDisplayLanguage } from "../../language/resolve-public-content-display-language";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";
import { BlogCoverImage } from "./BlogCoverImage";

interface BlogLatestMiniCardsProps {
  posts: readonly PublicBlogPostListItem[];
}

function BlogLatestMiniCard({ post }: { post: PublicBlogPostListItem }) {
  const t = useTranslations("blogPublic");
  const locale = useLocale();
  const readingContext = usePublicContentReadingContext();
  const displayLanguage = resolvePublicContentDisplayLanguage(locale);
  const [displayTitle, setDisplayTitle] = useState(post.title);

  useEffect(() => {
    setDisplayTitle(post.title);
  }, [post.postId, post.title]);

  useEffect(() => {
    if (!readingContext.ready) {
      return;
    }

    let cancelled = false;
    void resolveBlogPostPresentation({
      postId: post.postId,
      canonical: {
        title: post.title,
        excerpt: post.excerpt ?? "",
        contentHtml: "",
      },
      displayLanguage,
      ready: readingContext.ready,
      translationPreference: readingContext.translationPreference,
    }).then((presentation) => {
      if (!cancelled) {
        setDisplayTitle(presentation.title);
      }
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

  const href = `/blog/${encodeURIComponent(post.slug)}`;
  const titleForDisplay = displayTitle || post.title;
  const categoryLabel = resolveBlogCategoryDisplayName(post.category.categoryId, t);

  return (
    <li className="blog-latest-mini__item">
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
          <span className="blog-latest-mini__title">{titleForDisplay}</span>
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
 * Pack 08I.7 / 08I.10 — title via shared Blog presentation resolver; locale-aware dates;
 * category via shared taxonomy presenter.
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
