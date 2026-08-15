"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card } from "../../../design-system/components/Card";
import type { KnowledgeCenterListing } from "@hu/types";

import { fetchKnowledgeListing } from "../api";
import { KnowledgeSearchPanel } from "./KnowledgeSearchPanel";
import { KnowledgeShell } from "./KnowledgeShell";

import "../knowledge-center.css";

export function KnowledgeCenterPageContent() {
  const [listing, setListing] = useState<KnowledgeCenterListing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchKnowledgeListing()
      .then(setListing)
      .catch((fetchError: unknown) => {
        setError(
          fetchError instanceof Error ? fetchError.message : "Knowledge Center unavailable.",
        );
      });
  }, []);

  return (
    <KnowledgeShell listing={listing}>
      {error ? <p role="alert">{error}</p> : null}
      {!error && !listing ? <p role="status">Loading Knowledge Center…</p> : null}
      {listing ? (
        <>
          <section className="knowledge-center__intro">
            <h1>Knowledge Center</h1>
            <p>
              The official educational and reference library for Humanity Union. Knowledge explains
              civic processes and platform concepts — it never persuades.
            </p>
          </section>

          <KnowledgeSearchPanel />

          <div className="knowledge-info-block">
            <p>
              Every article answers one question. Use diagrams and concise sections before reading
              long text elsewhere.
            </p>
          </div>

          <Card className="knowledge-article-card knowledge-blog-entry">
            <h2>Blog</h2>
            <p>Read publications and reflections from Humanity Union authors.</p>
            <p className="knowledge-article-card__meta">
              Blog is an authored Publishing surface. Knowledge remains the structured educational
              library — the two domains stay separate.
            </p>
            <p>
              <Link href="/blog" className="hu-button hu-button--secondary hu-button--sm">
                Open Blog
              </Link>
            </p>
          </Card>

          <div className="knowledge-category-grid">
            {listing.categories.map((category) => (
              <Card key={category.id} className="knowledge-article-card">
                <h2>{category.title}</h2>
                <p>{category.description}</p>
                <p className="knowledge-article-card__meta">
                  {category.articles.length} article{category.articles.length === 1 ? "" : "s"}
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
