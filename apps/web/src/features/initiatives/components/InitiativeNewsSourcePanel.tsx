"use client";

import type { PublicNewsArticleItem } from "@hu/types";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system";
import { formatNewsPublishedDate } from "../../public-news/api";
import { NewsArticleImage } from "../../public-news/components/NewsArticleImage";

import "../../public-news/public-news.css";

interface InitiativeNewsSourcePanelProps {
  article: PublicNewsArticleItem;
  onRemove: () => void;
}

export function InitiativeNewsSourcePanel({ article, onRemove }: InitiativeNewsSourcePanelProps) {
  const tCommon = useTranslations("initiativeExperience.common");
  const tManage = useTranslations("initiativeExperience.manage");

  return (
    <aside className="public-news-source-panel" aria-labelledby="initiative-news-source-heading">
      <div className="public-news-source-panel__header">
        <div>
          <h3 id="initiative-news-source-heading">{tCommon("sourceArticle")}</h3>
          <p className="public-news-source-panel__meta">{tManage("newsSource.disclaimer")}</p>
        </div>
        <Button type="button" variant="secondary" onClick={onRemove}>
          {tManage("newsSource.remove")}
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
            {tCommon("publishedPrefix", { date: formatNewsPublishedDate(article.publishedAt) })}
          </p>
          <p>
            <a href={article.articleUrl} target="_blank" rel="noopener noreferrer">
              {tCommon("viewOriginalSource")}
            </a>
          </p>
        </div>
      </div>
    </aside>
  );
}
