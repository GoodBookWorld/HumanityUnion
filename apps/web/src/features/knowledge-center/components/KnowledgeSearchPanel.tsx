"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";

import { useLocalizedBrand } from "../../brand-localization/useLocalizedBrand";
import { searchKnowledgeArticles } from "../api";
import {
  EXPECTED_TRANSLATION_FALLBACK,
  resolveKnowledgeArticleTitle,
  resolveKnowledgeSlugFromSearchHit,
} from "../resolve-knowledge-presentation";

import "../knowledge-center.css";

/**
 * Search result titles resolve via catalog when a slug is known (entityId /
 * publicUrl). Search summaries remain API English —
 * EXPECTED_TRANSLATION_FALLBACK until a dedicated search-index localization path exists.
 */
export function KnowledgeSearchPanel() {
  const t = useTranslations("knowledgePublic");
  const tSearch = useTranslations("knowledgePublic.search");
  const brand = useLocalizedBrand();
  const siteName = { siteName: brand.siteName };
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    Array<{ entityId: string; title: string; summary: string; publicUrl: string }>
  >([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await searchKnowledgeArticles({ q: query, limit: 12 });
      setResults(response.results);
      setSearched(true);
    } catch {
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="knowledge-search">
      <h2>{tSearch("title")}</h2>
      <form className="knowledge-search__form" onSubmit={handleSearch}>
        <input
          className="knowledge-search__input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={tSearch("placeholder")}
          aria-label={tSearch("ariaLabel")}
        />
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? tSearch("searching") : tSearch("submit")}
        </Button>
      </form>
      {searched ? (
        results.length > 0 ? (
          <ul>
            {results.map((result) => {
              const slug = resolveKnowledgeSlugFromSearchHit(result);
              const title = slug
                ? resolveKnowledgeArticleTitle(slug, result.title, t, siteName)
                : result.title;
              const titleSource = slug ? "catalog-or-fallback" : EXPECTED_TRANSLATION_FALLBACK;

              return (
                <li key={result.entityId} data-knowledge-search-title-source={titleSource}>
                  <Link href={result.publicUrl}>{title}</Link>
                  {/* Summary: EXPECTED_TRANSLATION_FALLBACK (API English index) */}
                  <p data-knowledge-search-summary-source={EXPECTED_TRANSLATION_FALLBACK}>
                    {result.summary}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>{tSearch("empty")}</p>
        )
      ) : null}
    </Card>
  );
}
