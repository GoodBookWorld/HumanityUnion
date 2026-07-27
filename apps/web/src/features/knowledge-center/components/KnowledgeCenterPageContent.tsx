"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card } from "../../../design-system/components/Card";
import type { KnowledgeCenterListing } from "@hu/types";

import { fetchKnowledgeListing } from "../api";
import { KnowledgeSearchPanel } from "./KnowledgeSearchPanel";
import { KnowledgeSidebar } from "./KnowledgeSidebar";

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

  if (error) {
    return (
      <main className="knowledge-center">
        <p>{error}</p>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="knowledge-center">
        <p>Loading Knowledge Center...</p>
      </main>
    );
  }

  return (
    <main className="knowledge-center">
      <KnowledgeSidebar listing={listing} />
      <div className="knowledge-center__main">
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
      </div>
    </main>
  );
}
