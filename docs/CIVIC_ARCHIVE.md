# Civic Archive

TASK-098E initiative lifecycle archive records · TASK-107 centered results experience · TASK-107C idle initial state and horizontal search results.

Route: `/civic-archive` · Detail: `/civic-archive/[initiativeId]`

## Lifecycle archive model

Each public archive result is one **CivicArchiveLifecycleRecord** — a documented historical outcome for a single initiative.

- One archived initiative appears once in the index
- Nested lifecycle stages (analysis, proposals, revisions, decisions, implementation, official responses, public impact) are grouped under the initiative
- Child records never appear as separate top-level archive cards
- Counts and filters operate on archived initiatives (`archivedInitiativeCount`)

### Archive eligibility policy

An initiative enters the public Civic Archive only when governance requirements are satisfied and a **published** `PublicCivicArchiveRecord` exists:

- Verified public impact
- Completed implementation tracking
- Closed collective decision
- Projected initiative lifecycle phase
- Implementation author prepares draft; initiative steward publishes

Draft records, cancelled initiatives, and age alone do not create archive entries.

### Outcome labels

Outcome status is derived honestly from lifecycle evidence:

- `completed` — completed tracking and verified impact
- `partially_implemented` — active or incomplete implementation evidence
- `concluded_without_implementation` — archived without full implementation completion
- `cancelled` / `superseded` — reserved for explicit governance outcomes

---

## Page structure (TASK-107 / TASK-107C)

The Civic Archive index uses the shared public content container:

```
.civic-archive-page
  .civic-archive-page__header
  .civic-archive-page__filters
  .civic-archive-page__results
```

- Horizontally centered via `max-width: var(--hu-content-max-width)` and `margin: 0 auto`
- Filter and results panels share the same full container width
- Results always render inside `#civic-archive-results`

### Initial state (TASK-107C)

On direct navigation to `/civic-archive` with no submitted search:

- No archive API request runs
- No country is preselected
- No result count or cards render
- The results panel shows instructional copy only (`idle` state)

Archive queries run only after explicit Search submission or when the URL contains valid search parameters.

## Geographic filters

The archive index uses compact dependent single-select controls:

- Country — searchable select over the approved country list
- Region — searchable select disabled until Country is selected
- City / Community — searchable select disabled until Country is selected; constrained by Region when selected, otherwise all communities for the country

Filters use the shared Geography dataset through `GeographySearchSelect`. Checkbox multi-select geography lists are not used.

### Dependency rules

- Region is disabled until Country is selected
- City / Community is disabled until Country is selected
- Changing Country clears incompatible Region and City / Community values
- Changing Region clears incompatible City / Community values
- Clear Filters resets all filters, clears submitted search state, and returns the page to `idle` without fetching records

## Form layout

- Row 1: Search input, Search button (primary), Clear Filters
- Row 2: Country, Region, City / Community
- Row 3: Activity area, Archive year, Outcome status

Search requires at least one meaningful criterion. Empty submissions show amber feedback and do not call the API.

Search navigates to `#civic-archive-results` and focuses the results heading with header offset via `scroll-margin-top`.

## URL and query behavior

Filter selections serialize into GET query parameters as single values (legacy comma-separated URLs still parse the first value):

```
/civic-archive?q=environment&countryCode=CA&regionId=CA-BC&cityCommunityId=16735&activityArea=Environment&archiveYear=2026&outcomeStatus=completed#civic-archive-results
```

Browser Back/Forward navigation preserves selections through standard GET form navigation and resyncs the filter form from `searchParams`.

A URL with no parameters remains in the idle instructional state.

## API filtering

`GET /api/v1/public/civic-archive` accepts the canonical query parameters:

| Parameter          | Purpose                                                                             |
| ------------------ | ----------------------------------------------------------------------------------- |
| `q`                | Substring match across title, summary, community, region, country, activity area    |
| `countryCode`      | ISO country code                                                                    |
| `regionId`         | Region code (resolved with country when provided)                                   |
| `cityCommunityId`  | Geography community code, civic community label, or known initiative community slug |
| `activityArea`     | Exact activity area                                                                 |
| `archiveYear`      | Archive year from `archivedAt`                                                      |
| `outcomeStatus`    | Derived lifecycle outcome enum                                                      |
| `limit` / `offset` | Pagination when supported by route                                                  |

Legacy aliases (`search`, `country`, `region`, `community`, `implementationYear`) remain supported at the API boundary.

Community filters resolve geography codes (for example `16735`) to civic archive community labels through the shared participation-area geography loader and known initiative community aliases.

## Results panel states

| State     | Behavior                                                                             |
| --------- | ------------------------------------------------------------------------------------ |
| `idle`    | Instructional copy only; no API request, no result count, no cards                   |
| `loading` | Horizontal skeleton row inside the results panel                                     |
| `success` | One horizontal row of `PublicArchiveInitiativeMiniCard` entries with scroll controls |
| `empty`   | Approved no-match message with Clear Filters and Adjust Search                       |
| `error`   | “The Civic Archive is temporarily unavailable.” with Try Again — no zero aggregates  |

The results header shows a simple result count only after a submitted search completes.

## Archive card route

Cards link to the canonical archived initiative experience:

`/civic-archive/[initiativeId]`

Component: `PublicArchiveInitiativeMiniCard`

Fallback image: `/images/initiatives/initiative-default.webp`

## Archive results layout

| Viewport | Visible cards |
| -------- | ------------- |
| Desktop  | 3             |
| Tablet   | 2             |
| Mobile   | 1             |

Additional matches remain in the same horizontal row and are accessed through horizontal scrolling, Previous/Next controls, keyboard navigation, and a compact progress indicator. Results do not wrap into additional rows.

## Verification and fixture isolation

- Development cleanup: `npm run dev:cleanup-civic-archive-fixtures`
- Development audit: `npm run dev:audit-civic-archive -- --country=CA`
- Development projection sync: `npm run dev:rebuild-civic-archive-projections`
- Idle + horizontal results gate: `npm run verify:civic-archive-idle-horizontal-results`
- Real data source gate: `npm run verify:civic-archive-real-data-source`
- Runtime search gate: `npm run verify:civic-archive-runtime-search`
- Results experience gate: `npm run verify:civic-archive-results-experience`

When `MONGODB_URI` is configured for development, civic archive persistence defaults to MongoDB (`humanity_union_dev`) instead of the local `.runtime/public-civic-archive.json` file. Verification fixtures are excluded from public queries by `isPublicVerificationFixtureRecord` (verification flag, verification task, and TASK-107 title patterns).

Verification fixtures are created only in isolated verification databases and are excluded from public archive queries unless explicitly opted in for the active verification run.

## Related files

- Page: `apps/web/src/app/civic-archive/page.tsx`
- Search experience: `apps/web/src/features/public-civic-archive/components/CivicArchiveSearchExperience.tsx`
- Filters UI: `apps/web/src/features/public-civic-archive/components/CivicArchiveFiltersForm.tsx`
- Results panel: `apps/web/src/features/public-civic-archive/components/CivicArchiveResultsPanel.tsx`
- Horizontal results: `apps/web/src/features/public-civic-archive/components/CivicArchiveHorizontalResults.tsx`
- Archive mini card: `apps/web/src/features/public-civic-archive/components/PublicArchiveInitiativeMiniCard.tsx`
- API filters: `apps/api/src/modules/public-civic-archive/public-civic-archive-lifecycle.filters.ts`
- Projection: `apps/api/src/modules/public-civic-archive/public-civic-archive-lifecycle.projection.ts`
