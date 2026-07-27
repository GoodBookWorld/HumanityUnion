# Search

TASK-098D Global Search initiative-grouped pagination.

Route: `/search` (grouped mode by default)

## Pagination model

Search paginates **display-level results**, not flat lifecycle child records.

| Unit                       | Description                                                    |
| -------------------------- | -------------------------------------------------------------- |
| Initiative lifecycle group | One initiative and its complete public lifecycle timeline      |
| Standalone record          | Knowledge, media, nomination, and other non-initiative records |

Query parameter `view`:

- `grouped` — paginate initiative groups and standalone records (used by `/search`)
- `flat` — paginate individual entity records (default for API consumers without an explicit view)

## Pipeline

### Previous (flat pagination)

```
query → match entities → sort → slice(offset, limit) → frontend group page slice
```

Problems: one initiative split across pages; totals counted flat entities; incomplete timelines.

### Current (grouped pagination)

```
query/filters → match entities → resolve initiative IDs
→ build initiative groups + standalone results
→ sort display units → paginate display units
→ hydrate full public lifecycle for initiatives on the page
```

## API contract

`GET /api/v1/public/search?view=grouped`

Response fields:

- `view` — `grouped` or `flat`
- `displayResults` — paginated top-level units (grouped mode)
- `results` — paginated flat records (flat mode)
- `totalDisplayResults` — count of visible top-level units
- `total` — same as `totalDisplayResults` in grouped mode; flat entity count in flat mode
- `initiativeGroupCount` — total matching initiative groups (grouped mode)
- `standaloneResultCount` — total matching standalone records (grouped mode)
- `hasMore` — whether another page exists
- `limit`, `offset`, `facets`

Types: `packages/types/src/domain/global-search.ts`

## Initiative Timeline Group

Each initiative group includes:

- shared initiative header (title, summary, geography, status, image)
- ordered horizontal timeline of lifecycle stages
- all public lifecycle records for that initiative (not truncated by pagination)
- matched stages marked when query or filters hit child records

Non-initiative records remain standalone cards.

### Ordered stage model

Stages are defined in:

- API: `apps/api/src/modules/global-search/global-search.stages.ts`
- UI: `apps/web/src/features/global-search/initiative-timeline-stages.ts`

Current order:

Analysis → Proposal → Initiative → Revision → Decision Session → Collective Decision → Civic Action Package → Official Response → Civic Accountability → Implementation Commitment → Implementation Tracking → Public Impact → Civic Archive

### Filter semantics

When an entity-type filter matches a lifecycle child (for example Collaborative Analysis only):

- return the parent initiative group
- show the complete lifecycle for context
- mark stages that matched the filter or query

### Sorting

Display units sort by:

1. match score (highest matched child score for groups)
2. latest lifecycle activity (`latestActivityAt`)
3. stable id (`initiativeId` or `entityType:entityId`)

## Performance

- Search index is built once and cached in memory
- Grouping builds a single `initiativeId → entries` map per request
- Lifecycle hydration uses batched index lookups (no per-result database queries)
- MongoDB indexes on `initiativeId`, geography, visibility, and timestamps support underlying stores

## Related files

- Service: `apps/api/src/modules/global-search/global-search.service.ts`
- Grouping: `apps/api/src/modules/global-search/global-search.grouping.ts`
- UI: `apps/web/src/features/global-search/components/GlobalSearchPageContent.tsx`
- Group component: `apps/web/src/features/global-search/components/InitiativeTimelineGroup.tsx`

## Verification

```bash
npm run verify:grouped-search-pagination
```
