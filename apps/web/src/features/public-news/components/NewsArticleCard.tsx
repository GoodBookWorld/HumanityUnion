"use client";

import type { PublicNewsArticleItem } from "@hu/types";

import { formatNewsPublishedDate } from "../api";
import { NewsArticleImage } from "./NewsArticleImage";
import { NewsCreateInitiativeButton } from "./NewsCreateInitiativeButton";

interface NewsArticleCardProps {
  article: PublicNewsArticleItem;
}

export function NewsArticleCard({ article }: NewsArticleCardProps) {
  return (
    <article className="hu-card public-news-card" aria-labelledby={`news-title-${article.id}`}>
      <NewsArticleImage
        title={article.title}
        imageUrl={article.imageUrl}
        className="public-news-card__image"
      />
      <div className="public-news-card__body">
        <p className="public-news-card__source">{article.sourceName}</p>
        <h3 id={`news-title-${article.id}`}>{article.title}</h3>
        <p className="public-news-card__meta">
          Published {formatNewsPublishedDate(article.publishedAt)}
        </p>
        <p className="public-news-card__summary">{article.summary}</p>
      </div>
      <div className="public-news-card__actions">
        <a
          href={article.articleUrl}
          className="hu-button hu-button--secondary"
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Read original article: ${article.title} (opens in new tab)`}
        >
          Read Original
        </a>
        <NewsCreateInitiativeButton newsId={article.id} label="Create Initiative" />
      </div>
    </article>
  );
}
