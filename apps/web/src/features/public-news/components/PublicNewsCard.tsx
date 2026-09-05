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
import { useLocalizedPublicNewsCard } from "../use-localized-public-news-card";
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

/**
 * Pack 08K.3 — shared public-news-card.
 * Semantic fields render from PublicLocalizedPresentation only.
 */
export function PublicNewsCard({ article }: PublicNewsCardProps) {
  const locale = useLocale();
  const t = useTranslations("publicNews.card");
  const view = useLocalizedPublicNewsCard(article);
  const provider = resolveProviderPresentation(view.sourceName);
  const publishedLabel = formatNewsRelativeTime(view.publishedAt, locale);
  const aiSummaryBullets = useMemo(
    () => buildNewsAiSummaryBullets(view.title, view.summary).slice(0, 3),
    [view.summary, view.title],
  );

  return (
    <article
      className="public-news-card"
      aria-labelledby={`public-news-title-${view.id}`}
      data-hu-surface="public-news-card"
      data-hu-coverage={view.coverage.status}
      data-hu-fallback-nodes={String(view.coverage.canonicalFallbackNodeCount)}
    >
      <div className="public-news-card__header">
        {view.category ? (
          <span className="public-news-card__badge" data-hu-semantic="auto">
            {view.category}
          </span>
        ) : null}
        <div className="public-news-card__provider">
          <MediaLogo
            name={view.sourceName}
            logoUrl={provider.logoUrl}
            logoLabel={provider.logoLabel}
            className="public-news-card__logo-fallback"
            imageClassName="public-news-card__logo"
            width={44}
            height={28}
          />
          <div className="public-news-card__provider-copy">
            <p className="public-news-card__provider-name" data-hu-semantic="protected">
              {view.sourceName}
            </p>
            <p className="public-news-card__published">
              <time dateTime={view.publishedAt}>{publishedLabel}</time>
            </p>
          </div>
        </div>
      </div>

      <div className="public-news-card__media">
        <PublicNewsCardImage title={view.title} imageUrl={view.imageUrl} />
      </div>

      <div className="public-news-card__body">
        <h3
          id={`public-news-title-${view.id}`}
          className="public-news-card__headline"
          data-hu-semantic="auto"
        >
          {view.title}
        </h3>

        <PublicNewsAiSummary bullets={aiSummaryBullets} />

        <div className="public-news-card__actions">
          <a
            href={view.articleUrl}
            className="public-news-card__button public-news-card__button--secondary"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("readOriginalAria", { title: view.title })}
            data-hu-semantic="protected"
          >
            {t("readOriginal")}
          </a>
          <CreateInitiativeLink newsId={view.id} />
        </div>

        <PublicNewsRelatedInitiatives article={article} />
      </div>
    </article>
  );
}
