# Frontend Manual Customization

This guide covers manually editable public UI assets and data sources.

## Interactive world map

- Component: `apps/web/src/features/world-map/components/InteractiveWorldMap.tsx`
- Styles: `apps/web/src/features/world-map/components/interactive-world-map.css`
- Map assets: `apps/web/public/maps/` (recommended)
- Integration notes: `docs/INTERACTIVE_WORLD_MAP_INTEGRATION.md`

Replace the placeholder frame inside `InteractiveWorldMap.tsx`. Keep the accessible country fallback selector.

## Geography data

Canonical shared package:

`@hu/geography` (`packages/geography`)

- Countries: `packages/geography/src/countries.json`
- Regions: `packages/geography/src/administrative-regions.json`
- Helpers/types: `packages/geography/src/index.ts`
- Attribution: `packages/geography/ATTRIBUTION.md`

Web-only search URL helper / thin compatibility facade:

`apps/web/src/data/geography/` (`helpers.ts`, re-export barrels)

### Country object format

```json
{
  "code": "CA",
  "slug": "ca",
  "label": "Canada"
}
```

### Region object format

```json
{
  "slug": "british-columbia",
  "label": "British Columbia",
  "countrySlug": "ca"
}
```

### Adding a country or region safely

1. Edit the JSON files in `packages/geography/src/`.
2. Keep `slug` stable and lowercase.
3. Use ISO-style country slugs (`ca`, not `canada`).
4. Run:

```bash
npm run format
npm run typecheck
npm run build
```

5. Verify geography consumers:

- Member Participation Area
- Search country filter
- Home geographic navigator / world map fallback

Do not duplicate country arrays in feature components. Import shared geography APIs from `@hu/geography`.

## Home statistics icons

Paths under `apps/web/public/icons/workspace/`:

- `users.svg`
- `members.svg`
- `countries.svg`
- `regions.svg`
- `initiatives.svg`
- `collective-decisions.svg`
- `packages.svg`
- `responses.svg`
- `archive.svg`

Configured in:

`apps/web/src/features/platform-statistics/components/HumanityUnionInNumbers.tsx`

## Core Values icons

Paths under `apps/web/public/icons/workspace/`:

- `responsibility.svg`
- `justice.svg`
- `security.svg`
- `progress.svg`

Displayed at 64 × 64 px in:

`apps/web/src/features/public-home-v2/components/PublicHomeCoreValuesSection.tsx`

## Warnings

- Do not edit generated `.next` files.
- Do not add participant uploads to source-controlled public folders.
- Run `npm run format`, `npm run typecheck`, and `npm run build` after manual edits.
