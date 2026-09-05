"use client";

import type { PublicNewsArticleItem } from "@hu/types";
import { useLocale, useTranslations } from "next-intl";

import { useLocalizedPublicNewsCard } from "../use-localized-public-news-card";
import { formatNewsRelativeTime } from "../public-news-discovery.utils";

interface NewsArticleCardProps {
  article: PublicNewsArticleItem;
}

/**
 * Alternate public-news-card shell — Pack 08K.3 uses shared localized presentation.
 */
export function NewsArticleCard({ article }: NewsArticleCardProps) {
  const locale = useLocale();
  const t = useTranslations("publicNews.card");
  const view = useLocalizedPublicNewsCard(article);
  const publishedLabel = formatNewsRelativeTime(view.publishedAt, locale);

  return (
    <article
      className="hu-card public-news-card"
      aria-labelledby={`news-title-${view.id}`}
      data-hu-surface="public-news-card"
    >
      {view.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={view.imageUrl} alt="" className="public-news-card__image" />
      ) : null}
      <div className="public-news-card__body">
        <p className="public-news-card__source" data-hu-semantic="protected">
          {view.sourceName}
        </p>
        <h3 id={`news-title-${view.id}`} data-hu-semantic="auto">
          {view.title}
        </h3>
        <p className="public-news-card__meta">
          <time dateTime={view.publishedAt}>{publishedLabel}</time>
        </p>
        <p className="public-news-card__summary" data-hu-semantic="auto">
          {view.summary}
        </p>
      </div>
      <div className="public-news-card__actions">
        <a
          href={view.articleUrl}
          className="hu-button hu-button--secondary"
          target="_blank"
          rel="noopener noreferrer"
          data-hu-semantic="protected"
        >
          {t("readOriginal")}
        </a>
      </div>
    </article>
  );
}
