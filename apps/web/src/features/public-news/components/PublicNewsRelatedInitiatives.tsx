"use client";

import type { CivicSearchResult, PublicNewsArticleItem } from "@hu/types";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { buildSearchResultPresentation } from "../../language/adapters/search-result-presentation";
import { fetchRelatedInitiativesForArticle } from "../public-news-initiative-discovery.utils";

interface PublicNewsRelatedInitiativesProps {
  article: PublicNewsArticleItem;
}

export function PublicNewsRelatedInitiatives({ article }: PublicNewsRelatedInitiativesProps) {
  const t = useTranslations("publicNews.card");
  const [relatedInitiatives, setRelatedInitiatives] = useState<CivicSearchResult[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetchRelatedInitiativesForArticle(article)
      .then((results) => {
        if (cancelled) {
          return;
        }

        setRelatedInitiatives(results);
      })
      .finally(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [article]);

  if (!loaded || relatedInitiatives.length === 0) {
    return null;
  }

  return (
    <section className="public-news-card__related" aria-label={t("relatedAria")}>
      <h4 className="public-news-card__section-title">{t("relatedTitle")}</h4>
      <ul className="public-news-card__related-list">
        {relatedInitiatives.map((initiative) => {
          // Pack 08K — related rail titles via PublicPresentationNode adapter.
          const presentation = buildSearchResultPresentation({
            entityId: initiative.entityId,
            title: initiative.title,
            summary: initiative.summary,
          });
          return (
            <li key={initiative.entityId}>
              <Link href={initiative.publicUrl}>{presentation.title}</Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
