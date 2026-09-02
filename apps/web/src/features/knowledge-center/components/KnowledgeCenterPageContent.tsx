"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Card } from "../../../design-system/components/Card";
import type { KnowledgeCenterListing } from "@hu/types";

import { fetchKnowledgeListing } from "../api";
import { KnowledgeSearchPanel } from "./KnowledgeSearchPanel";
import { KnowledgeShell } from "./KnowledgeShell";

import "../knowledge-center.css";

export function KnowledgeCenterPageContent() {
  const t = useTranslations("knowledgePublic");
  const [listing, setListing] = useState<KnowledgeCenterListing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchKnowledgeListing()
      .then(setListing)
      .catch((fetchError: unknown) => {
        setError(fetchError instanceof Error ? fetchError.message : t("unavailable"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once listing fetch
  }, []);

  return (
    <KnowledgeShell listing={listing}>
      {error ? <p role="alert">{error}</p> : null}
      {!error && !listing ? <p role="status">{t("loading")}</p> : null}
      {listing ? (
        <>
          <section className="knowledge-center__intro">
            <h1>{t("pageTitle")}</h1>
            <p>{t("pageIntro")}</p>
          </section>

          <KnowledgeSearchPanel />

          <div className="knowledge-info-block">
            <p>{t("pageSecondary")}</p>
          </div>

          <Card className="knowledge-article-card knowledge-blog-entry">
            <h2>{t("blogTitle")}</h2>
            <p>{t("blogIntro")}</p>
            <p className="knowledge-article-card__meta">{t("blogMeta")}</p>
            <p>
              <Link href="/blog" className="hu-button hu-button--secondary hu-button--sm">
                {t("openBlog")}
              </Link>
            </p>
          </Card>

          <div className="knowledge-category-grid">
            {listing.categories.map((category) => (
              <Card key={category.id} className="knowledge-article-card">
                <h2>{category.title}</h2>
                <p>{category.description}</p>
                <p className="knowledge-article-card__meta">
                  {category.articles.length === 1
                    ? t("articlesCountOne", { count: category.articles.length })
                    : t("articlesCount", { count: category.articles.length })}
                </p>
                <ul>
                  {category.articles.slice(0, 5).map((article) => (
                    <li key={article.slug}>
                      <Link href={`/knowledge/${article.slug}`}>{article.title}</Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </KnowledgeShell>
  );
}
