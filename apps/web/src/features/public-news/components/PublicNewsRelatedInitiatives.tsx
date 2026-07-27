"use client";

import type { CivicSearchResult, PublicNewsArticleItem } from "@hu/types";
import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchRelatedInitiativesForArticle } from "../public-news-initiative-discovery.utils";

interface PublicNewsRelatedInitiativesProps {
  article: PublicNewsArticleItem;
}

export function PublicNewsRelatedInitiatives({ article }: PublicNewsRelatedInitiativesProps) {
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
    <section className="public-news-card__related" aria-label="Related initiatives">
      <h4 className="public-news-card__section-title">Related Initiatives</h4>
      <ul className="public-news-card__related-list">
        {relatedInitiatives.map((initiative) => (
          <li key={initiative.entityId}>
            <Link href={initiative.publicUrl}>{initiative.title}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
