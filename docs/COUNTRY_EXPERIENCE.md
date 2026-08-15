# Country Experience

TASK-095 / TASK-096 / TASK-097 dynamic public Country Experience pages.

## Route contract

Canonical public route:

`/countries/[countryCode]`

Examples:

- `/countries/CA`
- `/countries/UA`
- `/countries/PL`

Rules:

- ISO alpha-2 codes internally (uppercase)
- Lowercase URL input normalizes via redirect (e.g. `/countries/ca` → `/countries/CA`)
- Unknown codes return 404
- Legacy `/country/[countrySlug]` redirects to `/countries/{ISO2}`

## Page structure

Single reusable template: `CountryExperienceDynamicPage`

Sections:

1. Country Hero (flag, name, region, subregion, breadcrumb)
2. Country Statistics (nine aggregate public-safe counts with icons, shared Home grid)
3. Search Civic Activity in This Country (scoped Global Search card form)
4. Recommended Media carousel (trusted media matched by country, up to 12)
5. Latest Trusted News widget (country-filtered public news with global fallback)
6. Country Initiatives grid (max 12 public initiatives)

No world map is embedded on Country pages.

## Country statistics (nine cards)

The Country Statistics section displays exactly nine metrics using the shared `PublicStatisticsGrid` component and `COUNTRY_STATISTIC_CARDS` config. The UI label **Participants** replaces the legacy **Users** label everywhere in public statistics (the underlying API field may remain `users` on Home).

Home and Country pages share card structure, icons, typography, hover behavior, loading skeletons, and unavailable states. The Country page does **not** show **Countries**; it shows **Cities / Communities** immediately after **Regions**.

| Metric                | Definition                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| Participants          | Active registered participants without active Member status, scoped to country                     |
| Members               | Active Members scoped to country                                                                   |
| Regions               | Known administrative regions for the country (Geography dataset or approved public activity scope) |
| Cities / Communities  | Known selectable cities/communities for the country                                                |
| Initiatives           | Public initiatives scoped to country                                                               |
| Collective Decisions  | Public collective decisions scoped to country                                                      |
| Civic Action Packages | Issued civic action packages for initiatives in this country                                       |
| Official Responses    | Published or archived official responses for initiatives in this country                           |
| Civic Archive         | Published public archive records scoped to country                                                 |

### Icon mapping

| Metric                | Asset                                       |
| --------------------- | ------------------------------------------- |
| Participants          | `/icons/workspace/members.svg`              |
| Members               | `/icons/workspace/member-check.svg`         |
| Regions               | `/icons/workspace/regions.svg`              |
| Cities / Communities  | `/icons/workspace/city.svg`                 |
| Initiatives           | `/icons/workspace/initiatives.svg`          |
| Collective Decisions  | `/icons/workspace/collective-decisions.svg` |
| Civic Action Packages | `/icons/workspace/packages.svg`             |
| Official Responses    | `/icons/workspace/responses.svg`            |
| Civic Archive         | `/icons/workspace/archive.svg`              |

Icons are decorative (`aria-hidden="true"`). Metric names remain visible text.

### Loading and unavailable behavior

- Loading: stable skeleton cards (no layout shift)
- API failure: visible unavailable message — values are **not** replaced with zero

## Country search layout

The search section submits through the existing Global Search architecture (`/search?country=CA&...`).

- Country scope is fixed from the route and shown as read-only context
- Primary row: large query input, primary Search button, Clear Filters
- Secondary row: Region, City / Community, Activity Area, Entity Type
- Region options belong to the current country; City / Community depends on Region
- Clear Filters resets optional fields but retains country scope

## Recommended Media

Country media resources are filtered from the canonical Civic Media catalog (`TRUSTED_MEDIA_RESOURCES`) by `countryCode` when configured.

Canada (`/countries/CA`) exposes six approved local sources with local logo assets under `/images/media/canada/`:

- CBC — `/images/media/canada/cbc.webp` — https://www.cbc.ca/
- CTV News — `/images/media/canada/ctv.webp` — https://www.ctvnews.ca/
- Global News — `/images/media/canada/global-news.webp` — https://globalnews.ca/
- The Globe and Mail — `/images/media/canada/globe-mail.webp` — https://www.theglobeandmail.com/

Germany (`/countries/DE`) exposes DW, Tagesschau, and Spiegel.

Ukraine (`/countries/UA`) exposes Suspilne, Ukrinform, European Pravda, and Kyiv Independent.

Each card renders:

- `logoUrl` local asset when configured (`/images/media/*.webp`)
- Neutral text fallback via `logoLabel` when no asset is configured
- Media name, country, explanation, and external source link

The carousel supports up to 10 approved local resources without duplicating sources.

## Data sources

| Section        | Source                                                  |
| -------------- | ------------------------------------------------------- |
| Hero geography | `@hu/geography` (`packages/geography`)                  |
| Statistics     | `GET /api/v1/public/countries/:countryCode/statistics`  |
| Initiatives    | `GET /api/v1/public/countries/:countryCode/initiatives` |
| Civic media    | `GET /api/v1/public/countries/:countryCode/media`       |
| Search submit  | `/search?country=CA&...` (Global Search)                |

## Aggregation privacy

Country statistics expose aggregate counts only:

- Participants and Members are mutually exclusive display categories
- Membership does not change vote weight
- No names, emails, user IDs, addresses, or personal records

## Map-link contract

WDCR interactive map country links should use:

```javascript
window.open("/countries/CA", "_top");
```

See `docs/INTERACTIVE_WORLD_MAP_INTEGRATION.md`.

## Empty states

- Initiatives: “No public initiatives have been published for this country yet.”
- Civic media: “Recommended civic media for this country has not been added yet.”
- Trusted news: falls back to global providers when no country-specific articles are available.

## Latest Trusted News widget

Country pages render `CountryPublicNewsWidget`, a thin wrapper around the shared `PublicNewsSection` / `PublicNewsCard` components used on the Civic Media Center.

Filtering dimensions:

- **Country** — recommended media names plus registry providers scoped to the country
- **Region** — geography region mapped to media registry region tags
- **Language** — English feeds by default (`en`)
- **Topics** — article categories when configured

When no country-specific articles match, the widget falls back to trusted global providers for the same region and language.
