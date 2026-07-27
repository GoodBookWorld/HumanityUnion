# Civic Media Center

TASK-096 / TASK-097 Civic Media Center public presentation.

Route: `/media` (canonical). Legacy `/knowledge/media` permanently redirects to `/media`.

## Canonical media resource fields

Trusted media resources are defined in:

`apps/api/src/modules/civic-media-center/content/trusted-media.ts`

Each record includes:

| Field         | Purpose                                                        |
| ------------- | -------------------------------------------------------------- |
| `id`          | Stable resource identifier                                     |
| `name`        | Display name                                                   |
| `logoLabel`   | Text fallback when no logo asset is configured                 |
| `logoUrl`     | Optional local public asset path (`/images/media/<file>.webp`) |
| `country`     | Geographic scope label                                         |
| `countryCode` | Optional ISO alpha-2 filter for Country Experience carousels   |
| `categoryId`  | Trusted media category                                         |
| `explanation` | Short neutral description                                      |
| `websiteUrl`  | Official source URL                                            |
| `sortOrder`   | Category display order                                         |

Country Experience and Civic Media Center share this dataset. Country pages filter by country relationship; the Civic Media Center groups resources by category.

Trusted global news providers for RSS ingestion and initiative discovery are configured separately in the **Trusted Global Media Registry** — see `docs/MEDIA_REGISTRY.md`.

## Logo assets

Local logo assets live in:

`apps/web/public/images/media/`

Public URL pattern:

`/images/media/<filename>.webp`

The shared `MediaLogo` component renders configured logos with `object-fit: contain` and falls back to `logoLabel` when an asset is missing or fails to load. Media names remain visible as text.

## Category carousels

Trusted media categories render inside a subtle **category frame** (border, light background, internal padding) that visually groups each carousel viewport.

Each category uses horizontal carousels through `PublicHomeCarousel` with the `four-three-one` layout:

| Viewport                | Visible cards |
| ----------------------- | ------------- |
| Large desktop (≥1280px) | 4             |
| Tablet (769–1279px)     | 3             |
| Mobile (≤768px)         | 1             |

Resource cards inside `.civic-media-center__category-block` use equal width and minimum height within the carousel. Cards use a flex column layout with the description area set to `flex-grow: 1` so action links align near the bottom.

Carousels provide previous/next controls, keyboard navigation, and disabled boundary states. Auto-rotation is not used.

## Resource deduplication

Each approved outlet appears once in `TRUSTED_MEDIA_RESOURCES`. Country filtering and category grouping must not duplicate records.

## Related documentation

- Architecture: `docs/CIVIC_MEDIA_CENTER_ARCHITECTURE.md`
- Country local media: `docs/COUNTRY_EXPERIENCE.md`
