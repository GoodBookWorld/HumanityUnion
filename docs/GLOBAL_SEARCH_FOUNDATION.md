# Global Search Foundation

Humanity Union Global Search helps participants discover **public civic records** across the Capability 02 lifecycle. It uses the existing `CivicSearchMetadata` contract from the Capability 02 Integration Layer and does not introduce AI search, semantic search, popularity ranking, or member search.

## Search principles

1. Search finds civic records, not people.
2. No popularity, social, or reputation ranking.
3. No AI ranking or hidden personalization.
4. Every result is explainable via `matchedFields` and `explanation`.
5. Only public-safe metadata is indexed and returned.
6. Private drafts never appear in the index.

## Public-safe metadata

The search index is built by enumerating public records from existing stores and calling `buildSearchMetadata(entityType, entityId)` from the Capability 02 Integration Layer. This avoids duplicated business logic and keeps search aligned with public projections.

Indexed entity types:

- Initiatives (published/projected)
- Collaborative analyses (published)
- Improvement proposals (submitted or decided)
- Initiative revisions (published)
- Decision sessions (published/closed)
- Collective decisions (opened/closed/cancelled)
- Civic Action Packages (issued)
- Official responses (published)
- Civic accountability records
- Implementation commitments (published)
- Implementation tracking (active/completed)
- Public impact (published/verified)
- Public civic archive records (published)

## Ranking v1

Deterministic ranking when a query (`q`) is present:

1. Exact title match
2. Title contains query
3. Summary contains query
4. Location or activity area match
5. Status or entity type match
6. Tie-breaker: `updatedAt` (newest first)

When no query is provided, results are filtered by facet parameters and sorted by `updatedAt` newest.

No popularity, vote weighting, author reputation, or personalization is applied.

## Exclusions

The index explicitly excludes:

- Draft initiatives and draft pipeline records
- Private member profiles
- Votes and vote history
- Auth users and sessions
- Private metadata (emails, provider metadata, raw sources)

The API response is scanned for private field keys before returning.

## API

```
GET /api/v1/public/search
```

Public, unauthenticated. Query parameters:

- `q` — search text
- `entityType` — filter by civic entity type
- `country`, `region`, `community`, `activityArea`, `status`
- `fromDate`, `toDate` — filter by `updatedAt`
- `limit`, `offset` — pagination

Response includes `results`, `total`, `facets`, and the normalized `query`.

## Facets

Facet counts are computed from the **full filtered result set** (before pagination) for:

- Entity types
- Countries
- Regions
- Communities
- Activity areas
- Statuses

## Web integration

- `/search` — public search page with filters, result cards, pagination, empty/loading/error states
- Primary header navigation includes **Search**
- Workspace Home quick actions include **Search civic records**

## Performance (Version 1)

Version 1 scans public metadata in memory and rebuilds a cached index on first request. This is acceptable for development and verification.

## Future search engine path

Production search may later adopt:

- MongoDB text indexes
- Meilisearch
- Elasticsearch / OpenSearch
- Vector / semantic search (with strict constitutional guardrails)

Those engines must continue to index `CivicSearchMetadata` only and must not introduce popularity or member search without explicit constitutional review.

Semantic search is **deferred** — the current foundation prepares metadata and API shape without implementing embeddings or LLM retrieval.

## Verification

```bash
npm run verify:global-search
```

Runs three consecutive passes covering index building, draft exclusion, matching, filters, facets, pagination, privacy, web integration, and absence of AI/popularity code.
