"use client";

import type { PublicNewsArticleItem } from "@hu/types";
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

import { MediaLogo } from "../../civic-media-center/components/MediaLogo";
import { useClientAuthStatus } from "../../auth/use-client-auth-status";
import {
  buildCreateInitiativeFromNewsHref,
  buildRegisterCreateInitiativeFromNewsHref,
} from "../api";
import { buildNewsAiSummaryBullets } from "../public-news-initiative-discovery.utils";
import { formatNewsRelativeTime, resolveProviderPresentation } from "../public-news-discovery.utils";
import { PublicNewsAiSummary } from "./PublicNewsAiSummary";
import { PublicNewsCardImage } from "./PublicNewsCardImage";
import { PublicNewsRelatedInitiatives } from "./PublicNewsRelatedInitiatives";

interface PublicNewsCardProps {
  article: PublicNewsArticleItem;
}

function CreateInitiativeLink({ newsId }: { newsId: string }) {
  const authStatus = useClientAuthStatus();
  const t = useTranslations("publicNews.card");
  const href =
    authStatus === "authenticated"
      ? buildCreateInitiativeFromNewsHref(newsId)
      : buildRegisterCreateInitiativeFromNewsHref(newsId);

  if (authStatus === "pending") {
    return (
      <span className="public-news-card__button public-news-card__button--primary" aria-hidden="true">
        {t("loading")}
      </span>
    );
  }

  return (
    <a className="public-news-card__button public-news-card__button--primary" href={href}>
      {t("createInitiative")}
    </a>
  );
}

export function PublicNewsCard({ article }: PublicNewsCardProps) {
  const locale = useLocale();
  const t = useTranslations("publicNews.card");
  const provider = resolveProviderPresentation(article.sourceName);
  const publishedLabel = formatNewsRelativeTime(article.publishedAt, locale);
  const aiSummaryBullets = useMemo(
    () => buildNewsAiSummaryBullets(article.title, article.summary).slice(0, 3),
    [article.summary, article.title],
  );

  return (
    <article className="public-news-card" aria-labelledby={`public-news-title-${article.id}`}>
      <div className="public-news-card__header">
        {article.category ? (
          <span className="public-news-card__badge">{article.category}</span>
        ) : null}
        <div className="public-news-card__provider">
          <MediaLogo
            name={article.sourceName}
            logoUrl={provider.logoUrl}
            logoLabel={provider.logoLabel}
            className="public-news-card__logo-fallback"
            imageClassName="public-news-card__logo"
            width={44}
            height={28}
          />
          <div className="public-news-card__provider-copy">
            <p className="public-news-card__provider-name">{article.sourceName}</p>
            <p className="public-news-card__published">
              <time dateTime={article.publishedAt}>{publishedLabel}</time>
            </p>
          </div>
        </div>
      </div>

      <div className="public-news-card__media">
        <PublicNewsCardImage title={article.title} imageUrl={article.imageUrl} />
      </div>

      <div className="public-news-card__body">
        <h3 id={`public-news-title-${article.id}`} className="public-news-card__headline">
          {article.title}
        </h3>

        <PublicNewsAiSummary bullets={aiSummaryBullets} />

        <div className="public-news-card__actions">
          <a
            href={article.articleUrl}
            className="public-news-card__button public-news-card__button--secondary"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("readOriginalAria", { title: article.title })}
          >
            {t("readOriginal")}
          </a>
          <CreateInitiativeLink newsId={article.id} />
        </div>

        <PublicNewsRelatedInitiatives article={article} />
      </div>
    </article>
  );
}
