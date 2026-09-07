"use client";

import type { PublicNewsArticleItem } from "@hu/types";
import {
  isMediaRegistryCategory,
  mediaRegistryCategoryMessageKey,
} from "@hu/types";
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";

import { MediaLogo } from "../../civic-media-center/components/MediaLogo";
import {
  MediaSemanticNode,
  type MediaSemanticOwner,
  type MediaSemanticResult,
} from "../../language/media-plp/media-semantic-contract";
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
  /** Reset 03E — Media PLP path: never generate-on-read. */
  disableOnDemandTranslation?: boolean;
  /** Reset 03E.5 — resolved Media PLP presentation for this article. */
  plpPresentation?: {
    readonly mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
    readonly presentation: unknown;
    readonly reasonCode?: string;
  };
}

function plpEntityResultFromView(view: {
  coverage: { status: string; canonicalFallbackNodeCount: number };
}): MediaSemanticResult {
  if (
    view.coverage.status === "FALLBACK_CANONICAL" ||
    view.coverage.canonicalFallbackNodeCount > 0
  ) {
    return "CANONICAL_FALLBACK";
  }
  return "PUBLISHED_LOCALIZED";
}

function resolveNewsEntityResult(
  plpPresentation: PublicNewsCardProps["plpPresentation"],
  view: {
    coverage: { status: string; canonicalFallbackNodeCount: number };
  },
): MediaSemanticResult {
  if (plpPresentation?.mode === "CANONICAL_FALLBACK") {
    return "CANONICAL_FALLBACK";
  }
  if (plpPresentation?.mode === "PUBLISHED_LOCALIZED") {
    return "PUBLISHED_LOCALIZED";
  }
  return plpEntityResultFromView(view);
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
        <MediaSemanticNode as="span" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
          {t("loading")}
        </MediaSemanticNode>
      </span>
    );
  }

  return (
    <a className="public-news-card__button public-news-card__button--primary" href={href}>
      <MediaSemanticNode as="span" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
        {t("createInitiative")}
      </MediaSemanticNode>
    </a>
  );
}

/**
 * Pack 08K.3 — shared public-news-card.
 * Semantic fields render from PublicLocalizedPresentation only.
 */
export function PublicNewsCard({
  article,
  disableOnDemandTranslation = false,
  plpPresentation,
}: PublicNewsCardProps) {
  const locale = useLocale();
  const t = useTranslations("publicNews.card");
  const tCategories = useTranslations("publicNews.categories");
  const view = useLocalizedPublicNewsCard(article, {
    skipClientTranslation: disableOnDemandTranslation || plpPresentation != null,
    plpPresentation,
  });
  const provider = resolveProviderPresentation(view.sourceName);
  const publishedLabel = formatNewsRelativeTime(view.publishedAt, locale);
  const aiSummaryBullets = useMemo(
    () => buildNewsAiSummaryBullets(view.title, view.summary).slice(0, 3),
    [view.summary, view.title],
  );
  const entityResult = resolveNewsEntityResult(plpPresentation, view);
  const fallbackReason =
    entityResult === "CANONICAL_FALLBACK"
      ? plpPresentation?.reasonCode ?? "NO_PUBLISHED_SNAPSHOT"
      : undefined;

  const categoryKey = view.category.trim();
  let categoryLabel = categoryKey;
  let categoryOwner: MediaSemanticOwner = "PROTECTED_CANONICAL";
  let categoryResult: MediaSemanticResult = "PROTECTED_CANONICAL";
  let categoryMessageKey: string | undefined;
  if (categoryKey && isMediaRegistryCategory(categoryKey)) {
    const messageKey = mediaRegistryCategoryMessageKey(categoryKey);
    categoryLabel = tCategories(messageKey);
    categoryOwner = "UI_DICTIONARY";
    categoryResult = "LOCALIZED_DICTIONARY";
    categoryMessageKey = `publicNews.categories.${messageKey}`;
  }

  return (
    <article
      className="public-news-card"
      aria-labelledby={`public-news-title-${view.id}`}
      data-hu-surface="public-news-card"
      data-hu-coverage={view.coverage.status}
      data-hu-fallback-nodes={String(view.coverage.canonicalFallbackNodeCount)}
    >
      <div className="public-news-card__header">
        {categoryKey ? (
          <MediaSemanticNode
            as="span"
            className="public-news-card__badge"
            owner={categoryOwner}
            result={categoryResult}
            messageKey={categoryMessageKey}
          >
            {categoryLabel}
          </MediaSemanticNode>
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
            <MediaSemanticNode
              as="p"
              className="public-news-card__provider-name"
              owner="PROTECTED_CANONICAL"
              result="PROTECTED_CANONICAL"
            >
              {view.sourceName}
            </MediaSemanticNode>
            <p className="public-news-card__published">
              <MediaSemanticNode
                as="time"
                dateTime={view.publishedAt}
                owner="PROTECTED_CANONICAL"
                result="PROTECTED_CANONICAL"
              >
                {publishedLabel}
              </MediaSemanticNode>
            </p>
          </div>
        </div>
      </div>

      <div className="public-news-card__media">
        <PublicNewsCardImage title={view.title} imageUrl={view.imageUrl} />
      </div>

      <div className="public-news-card__body">
        <MediaSemanticNode
          as="h3"
          id={`public-news-title-${view.id}`}
          className="public-news-card__headline"
          owner="PLP_ENTITY"
          result={entityResult}
          entityType="public_news"
          entityId={view.id}
          semanticPath="title"
          fallbackReason={fallbackReason}
        >
          {view.title}
        </MediaSemanticNode>

        <PublicNewsAiSummary
          bullets={aiSummaryBullets}
          entityResult={entityResult}
          entityId={view.id}
          fallbackReason={fallbackReason}
        />

        <div className="public-news-card__actions">
          <a
            href={view.articleUrl}
            className="public-news-card__button public-news-card__button--secondary"
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("readOriginalAria", { title: view.title })}
          >
            <MediaSemanticNode as="span" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
              {t("readOriginal")}
            </MediaSemanticNode>
          </a>
          <CreateInitiativeLink newsId={view.id} />
        </div>

        <PublicNewsRelatedInitiatives article={article} />
      </div>
    </article>
  );
}
