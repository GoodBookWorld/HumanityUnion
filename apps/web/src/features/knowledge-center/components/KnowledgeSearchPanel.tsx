"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "../../../design-system/components/Button";
import { Card } from "../../../design-system/components/Card";

import { searchKnowledgeArticles } from "../api";

import "../knowledge-center.css";

export function KnowledgeSearchPanel() {
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
      <h2>Search Knowledge</h2>
      <form className="knowledge-search__form" onSubmit={handleSearch}>
        <input
          className="knowledge-search__input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search articles..."
          aria-label="Search Knowledge Center"
        />
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </Button>
      </form>
      {searched ? (
        results.length > 0 ? (
          <ul>
            {results.map((result) => (
              <li key={result.entityId}>
                <Link href={result.publicUrl}>{result.title}</Link>
                <p>{result.summary}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No Knowledge articles matched your search.</p>
        )
      ) : null}
    </Card>
  );
}
