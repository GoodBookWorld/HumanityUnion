# Trusted Global Media Registry

The Humanity Union Trusted Global Media Registry is the canonical configuration for approved global news providers used by public news ingestion, initiative discovery, and civic media tooling.

## Location

| Artifact | Path |
| -------- | ---- |
| Provider definitions | `packages/media-registry/src/media-registry.ts` |
| Filter helpers | `packages/media-registry/src/media-registry.filters.ts` |
| Runtime config | `packages/media-registry/src/media-registry.config.ts` |
| Shared types | `packages/types/src/domain/media-registry.ts` |
| Public API | `GET /api/v1/public/media/registry` |

## Design principles

- **Single source of truth** — provider metadata is defined once and reused by RSS ingestion, URL validation, logos, and filtering.
- **No parser hardcoding** — the RSS parser only parses XML. Approved sources come from `deriveApprovedNewsSources()`.
- **Local logos only** — every provider references `/images/media/<file>.webp`. External logo URLs are never used.
- **Configurable runtime** — reliability thresholds and default language are controlled by environment variables.

## Provider record

Each registry entry includes:

| Field | Purpose |
| ----- | ------- |
| `id` | Stable provider identifier |
| `name` | Display name (also used as `sourceName` on ingested articles) |
| `country` | Geographic scope label |
| `countryCode` | Optional ISO alpha-2 code |
| `language` | Primary feed language (e.g. `en`) |
| `rssFeeds` | One or more RSS/Atom feed URLs with optional default categories |
| `logoUrl` | Local public asset path |
| `logoLabel` | Text fallback for `MediaLogo` |
| `website` | Official publisher homepage |
| `categories` | Civic topic labels used for discovery filters |
| `priority` | Sort order (lower = higher priority) |
| `reliabilityScore` | Editorial reliability score (0–100) |
| `regionTags` | Regional discovery tags |
| `sourceDomains` | Approved article hostname suffixes for URL validation |
| `aliases` | Optional legacy labels (e.g. `BBC News` → `BBC World`) |

## Global providers (English)

1. BBC World
2. Reuters
3. Associated Press
4. DW
5. France24
6. Euronews
7. Al Jazeera English
8. UN News
9. WHO News
10. NASA News
11. Nature News
12. The Conversation

## Filtering

Registry providers can be filtered by:

- **Provider** — `id` or display name
- **Country** — country label
- **Language** — language code
- **Category** — civic category label
- **Region** — region tag

### API

```http
GET /api/v1/public/media/registry
GET /api/v1/public/media/registry/filters
GET /api/v1/public/media/registry/search?provider=bbc-world&region=global
```

### Programmatic

```typescript
import {
  TRUSTED_GLOBAL_MEDIA_REGISTRY,
  filterMediaRegistryProviders,
  deriveApprovedNewsSources,
} from "@hu/media-registry";
```

## Public news integration

`apps/api/src/modules/public-news/public-news.config.ts` derives `APPROVED_NEWS_SOURCES` from the registry. RSS ingestion iterates `listActiveApprovedNewsSources()`, which respects:

- `MEDIA_REGISTRY_DEFAULT_LANGUAGE` (default: `en`)
- `MEDIA_REGISTRY_MIN_RELIABILITY` (default: `80`)

Providers below the reliability threshold are excluded from RSS fetch but remain in the registry for discovery metadata.

## Logo assets

Local assets live in:

`apps/web/public/images/media/`

Public URL pattern:

`/images/media/<filename>.webp`

Replace placeholder assets for newly added providers (`france24.webp`, `euronews.webp`, `un-news.webp`, `who.webp`, `nasa.webp`, `nature.webp`, `the-conversation.webp`) with brand-approved artwork when available.

## Environment variables

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `MEDIA_REGISTRY_DEFAULT_LANGUAGE` | `en` | Default language for RSS source selection |
| `MEDIA_REGISTRY_MIN_RELIABILITY` | `80` | Minimum reliability score for RSS ingestion |

## Related documentation

- Civic Media Center: `docs/CIVIC_MEDIA_CENTER.md`
- Public news module: `apps/api/src/modules/public-news/`
