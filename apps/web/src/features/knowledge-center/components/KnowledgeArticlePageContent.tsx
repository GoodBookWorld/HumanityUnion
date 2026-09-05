"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Card } from "../../../design-system/components/Card";
import type { KnowledgeArticlePublic, KnowledgeCenterListing } from "@hu/types";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";
import {
  buildKnowledgeArticlePresentation,
} from "../../language/adapters/knowledge-article-presentation";
import { fetchKnowledgeArticle, fetchKnowledgeListing } from "../api";
import {
  resolveKnowledgeArticleField,
  resolveKnowledgeArticleTitle,
  resolveKnowledgeExplanationSection,
  resolveKnowledgeKeyConcepts,
} from "../resolve-knowledge-presentation";
import { KnowledgeShell } from "./KnowledgeShell";

import "../knowledge-center.css";

interface KnowledgeArticlePageContentProps {
  slug: string;
}

export function KnowledgeArticlePageContent({ slug }: KnowledgeArticlePageContentProps) {
  const t = useTranslations("knowledgePublic");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };
  const [listing, setListing] = useState<KnowledgeCenterListing | null>(null);
  const [article, setArticle] = useState<KnowledgeArticlePublic | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setArticle(null);
    setError(null);

    void Promise.all([fetchKnowledgeListing(), fetchKnowledgeArticle(slug)])
      .then(([listingData, articleData]) => {
        if (!cancelled) {
          setListing(listingData);
          setArticle(articleData);
          setError(null);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(
            fetchError instanceof Error ? fetchError.message : t("article.unavailable"),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug, t]);

  const purpose = article
    ? resolveKnowledgeArticleField(slug, "purpose", article.purpose, t, siteName)
    : null;
  const overview = article
    ? resolveKnowledgeArticleField(slug, "overview", article.overview, t, siteName)
    : null;
  const keyConcepts = article
    ? resolveKnowledgeKeyConcepts(slug, article.keyConcepts, t, siteName)
    : null;
  // Pack 08K — semantic article fields via PublicPresentationNode adapter.
  // Catalog resolution still supplies preferred strings; adapter owns the boundary shape.
  const articlePresentation = article
    ? buildKnowledgeArticlePresentation({
        slug,
        title: resolveKnowledgeArticleTitle(slug, article.title, t, siteName),
        purpose: purpose?.value,
        overview: overview?.value,
        keyConcepts: keyConcepts?.concepts,
        explanation: article.explanation,
      })
    : null;

  return (
    <KnowledgeShell listing={listing}>
      {error ? <p role="alert">{error}</p> : null}
      {!error && !article ? <p role="status">{t("article.loading")}</p> : null}
      {article && purpose && overview && keyConcepts && articlePresentation ? (
        <article className="knowledge-article">
          <header className="knowledge-article__header">
            <h1>{articlePresentation.title}</h1>
            <p className="knowledge-article__purpose" data-source={purpose.source}>
              {articlePresentation.purpose || purpose.value}
            </p>
          </header>

          <Card>
            <h2>{t("article.purpose")}</h2>
            <p data-source={purpose.source}>{purpose.value}</p>
          </Card>

          <section className="knowledge-article__diagram" aria-label={t("article.diagramAria")}>
            <div dangerouslySetInnerHTML={{ __html: article.diagramSvg }} />
          </section>

          <Card>
            <h2>{t("article.overview")}</h2>
            <p data-source={overview.source}>{overview.value}</p>
          </Card>

          {article.explanation.map((section) => {
            const localized = resolveKnowledgeExplanationSection(slug, section, t, siteName);
            return (
              <Card
                key={section.id}
                className="knowledge-article__section"
                data-source={localized.source}
              >
                <h2>{localized.heading}</h2>
                <p>{localized.body}</p>
              </Card>
            );
          })}

          <Card data-source={keyConcepts.source}>
            <h2>{t("article.keyConcepts")}</h2>
            <ul>
              {keyConcepts.concepts.map((concept) => (
                <li key={concept}>{concept}</li>
              ))}
            </ul>
          </Card>

          <div className="knowledge-warning-block">
            <p>{t("article.warning")}</p>
          </div>

          <div className="knowledge-article__related">
            {article.relatedConcepts.length > 0 ? (
              <Card>
                <h2>{t("article.relatedConcepts")}</h2>
                <ul>
                  {article.relatedConcepts.map((item) => (
                    <li key={item.slug}>
                      <Link href={item.href}>
                        {resolveKnowledgeArticleTitle(item.slug, item.title, t, siteName)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {article.relatedGuides.length > 0 ? (
              <Card>
                <h2>{t("article.relatedGuides")}</h2>
                <ul>
                  {article.relatedGuides.map((item) => (
                    <li key={item.slug}>
                      <Link href={item.href}>
                        {resolveKnowledgeArticleTitle(item.slug, item.title, t, siteName)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {article.relatedWorkspaceSection ? (
              <Card>
                <h2>{t("article.relatedWorkspace")}</h2>
                <p>{article.relatedWorkspaceSection}</p>
              </Card>
            ) : null}

            {article.relatedPublicPages.length > 0 ? (
              <Card>
                <h2>{t("article.relatedPublicPages")}</h2>
                <ul>
                  {article.relatedPublicPages.map((item) => {
                    const relatedPresentation = buildKnowledgeArticlePresentation({
                      slug: item.href,
                      title: item.title,
                    });
                    return (
                      <li key={item.href}>
                        <Link href={item.href}>{relatedPresentation.title}</Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ) : null}
          </div>

          <Card className="knowledge-article__meta-grid">
            <p>
              {t("article.lastUpdated", {
                date: new Date(article.updatedAt).toLocaleDateString(),
              })}
            </p>
            <p>{t("article.version", { version: article.version })}</p>
            <p>{t("article.readingTime", { minutes: article.readingTimeMinutes })}</p>
          </Card>

          <nav className="knowledge-article__pager" aria-label={t("article.pagerAria")}>
            {article.previousSlug ? (
              <Link href={`/knowledge/${article.previousSlug}`}>{t("article.previous")}</Link>
            ) : (
              <span />
            )}
            {article.nextSlug ? (
              <Link href={`/knowledge/${article.nextSlug}`}>{t("article.next")}</Link>
            ) : null}
          </nav>
        </article>
      ) : null}
    </KnowledgeShell>
  );
}
