# Interactive World Map Integration

## Component boundary

Primary replaceable component:

`apps/web/src/features/world-map/components/InteractiveWorldMap.tsx`

Styles:

`apps/web/src/features/world-map/components/interactive-world-map.css`

Home section wrapper:

`apps/web/src/features/public-home-v2/components/PublicHomeGeographicNavigationSection.tsx`

## Map asset path

Version 1 embeds the existing WDCR interactive map through an isolated iframe:

- Map entry: `apps/web/public/wdcr-js-map/index.html`
- Public URL: `/wdcr-js-map/index.html`
- Frame class: `.interactive-world-map-boundary__frame`
- Iframe class: `.interactive-world-map-boundary__iframe`

The iframe keeps map CSS and scripts isolated from the React app shell.

## Canonical Country page URL (TASK-095)

Primary platform action for country selection:

`/countries/{ISO2}`

Examples:

- `/countries/CA`
- `/countries/UA`
- `/countries/PL`

Requirements:

- ISO alpha-2 country code (uppercase internally; lowercase URLs redirect)
- Use `_top` when navigating from the iframe so the full app shell loads

Example map link:

```javascript
window.open("/countries/CA", "_top");
```

Do not rewrite the WDCR map in React. Update `map-config.js` manually when adding country links using this contract.

## Embedded map behavior

1. Home renders one map section inside the existing geographic navigation block.
2. The iframe loads `/wdcr-js-map/index.html`.
3. Accessible fallback controls navigate to `/countries/{ISO2}`.

## Search URL contract

| Scope     | URL pattern                                                                   |
| --------- | ----------------------------------------------------------------------------- |
| Country   | `/search?country=<countryCode>` or ISO label such as `CA` / `Canada`          |
| Region    | `/search?country=<countryCode>&region=<regionSlug>` or code such as `CA-BC`   |
| Community | `/search?country=<countryCode>&region=<regionSlug>&community=<communitySlug>` |

Country pages also link to Search for deeper filtering within a country.

## Geographic navigator

Breadcrumb-style navigator:

`apps/web/src/features/global-experience/components/GeographicNavigator.tsx`

Levels:

- World → `/initiatives`
- Country → `/countries/{ISO2}`
- Region / Community → Search URLs above
