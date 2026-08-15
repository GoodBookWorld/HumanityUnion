"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card } from "../../../design-system/components/Card";
import type { KnowledgeArticlePublic, KnowledgeCenterListing } from "@hu/types";

import { fetchKnowledgeArticle, fetchKnowledgeListing } from "../api";
import { KnowledgeShell } from "./KnowledgeShell";

import "../knowledge-center.css";

interface KnowledgeArticlePageContentProps {
  slug: string;
}

export function KnowledgeArticlePageContent({ slug }: KnowledgeArticlePageContentProps) {
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
          setError(fetchError instanceof Error ? fetchError.message : "Article unavailable.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <KnowledgeShell listing={listing}>
      {error ? <p role="alert">{error}</p> : null}
      {!error && !article ? <p role="status">Loading article…</p> : null}
      {article ? (
        <article className="knowledge-article">
          <header className="knowledge-article__header">
            <h1>{article.title}</h1>
            <p className="knowledge-article__purpose">{article.purpose}</p>
          </header>

          <Card>
            <h2>Purpose</h2>
            <p>{article.purpose}</p>
          </Card>

          <section className="knowledge-article__diagram" aria-label="Diagram">
            <div dangerouslySetInnerHTML={{ __html: article.diagramSvg }} />
          </section>

          <Card>
            <h2>Overview</h2>
            <p>{article.overview}</p>
          </Card>

          {article.explanation.map((section) => (
            <Card key={section.id} className="knowledge-article__section">
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </Card>
          ))}

          <Card>
            <h2>Key concepts</h2>
            <ul>
              {article.keyConcepts.map((concept) => (
                <li key={concept}>{concept}</li>
              ))}
            </ul>
          </Card>

          <div className="knowledge-warning-block">
            <p>
              Knowledge articles explain processes neutrally. They do not advocate positions or
              predict outcomes.
            </p>
          </div>

          <div className="knowledge-article__related">
            {article.relatedConcepts.length > 0 ? (
              <Card>
                <h2>Related concepts</h2>
                <ul>
                  {article.relatedConcepts.map((item) => (
                    <li key={item.slug}>
                      <Link href={item.href}>{item.title}</Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {article.relatedGuides.length > 0 ? (
              <Card>
                <h2>Related guides</h2>
                <ul>
                  {article.relatedGuides.map((item) => (
                    <li key={item.slug}>
                      <Link href={item.href}>{item.title}</Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {article.relatedWorkspaceSection ? (
              <Card>
                <h2>Related workspace section</h2>
                <p>{article.relatedWorkspaceSection}</p>
              </Card>
            ) : null}

            {article.relatedPublicPages.length > 0 ? (
              <Card>
                <h2>Related public pages</h2>
                <ul>
                  {article.relatedPublicPages.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href}>{item.title}</Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>

          <Card className="knowledge-article__meta-grid">
            <p>Last updated: {new Date(article.updatedAt).toLocaleDateString()}</p>
            <p>Version: {article.version}</p>
            <p>Estimated reading time: {article.readingTimeMinutes} min</p>
          </Card>

          <nav className="knowledge-article__pager" aria-label="Article pagination">
            {article.previousSlug ? (
              <Link href={`/knowledge/${article.previousSlug}`}>← Previous article</Link>
            ) : (
              <span />
            )}
            {article.nextSlug ? (
              <Link href={`/knowledge/${article.nextSlug}`}>Next article →</Link>
            ) : null}
          </nav>
        </article>
      ) : null}
    </KnowledgeShell>
  );
}
