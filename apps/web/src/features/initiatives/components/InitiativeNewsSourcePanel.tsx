"use client";

import type { PublicNewsArticleItem } from "@hu/types";

import { Button } from "../../../design-system";
import { formatNewsPublishedDate } from "../../public-news/api";
import { NewsArticleImage } from "../../public-news/components/NewsArticleImage";

import "../../public-news/public-news.css";

interface InitiativeNewsSourcePanelProps {
  article: PublicNewsArticleItem;
  onRemove: () => void;
}

export function InitiativeNewsSourcePanel({ article, onRemove }: InitiativeNewsSourcePanelProps) {
  return (
    <aside className="public-news-source-panel" aria-labelledby="initiative-news-source-heading">
      <div className="public-news-source-panel__header">
        <div>
          <h3 id="initiative-news-source-heading">Source article</h3>
          <p className="public-news-source-panel__meta">
            External publisher reference. Humanity Union has not independently verified this article.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={onRemove}>
          Remove source
        </Button>
      </div>
      <div className="public-news-source-panel__content">
        <NewsArticleImage
          title={article.title}
          imageUrl={article.imageUrl}
          className="public-news-source-panel__image"
        />
        <div>
          <p className="public-news-source-panel__meta">{article.sourceName}</p>
          <p>
            <strong>{article.title}</strong>
          </p>
          <p className="public-news-source-panel__meta">
            Published {formatNewsPublishedDate(article.publishedAt)}
          </p>
          <p>
            <a href={article.articleUrl} target="_blank" rel="noopener noreferrer">
              View original source
            </a>
          </p>
        </div>
      </div>
    </aside>
  );
}
