# Public Home Experience

Route: `/`

The public Home page (`PublicHomeV2Page`) presents civic discovery sections in a restrained, horizontally compact layout.

## Section sequence

1. Hero
2. Humanity Union in Numbers
3. Core Values
4. What can you do here?
5. How Civic Action Works (pipeline)
6. Latest Civic Initiatives
7. Latest Public Impact
8. Knowledge
9. Civic Media
10. Civic Archive
11. Ecosystem statement
12. Explore civic activity by place (approximate IP navigator + world map)

## Shared horizontal collection

Component: `PublicHomeHorizontalCollection` (`PublicHomeCarousel` alias)

Used by Latest Civic Initiatives, Latest Public Impact, and Knowledge.

Features:

- Previous / Next controls with disabled boundary states
- Horizontal scroll with touch/trackpad support
- Keyboard arrow navigation
- Progress dots and position status text
- Edge fade when additional cards remain off-screen
- No autoplay or infinite looping
- Internal overflow only (`overflow-x: clip` on page root)

### Visible card counts

| Section                  | Desktop | Tablet | Mobile |
| ------------------------ | ------- | ------ | ------ |
| Latest Civic Initiatives | 3       | 2      | 1      |
| Latest Public Impact     | 3       | 2      | 1      |
| Knowledge                | 4       | 3      | 1      |

## Latest Civic Initiatives

- Subtitle copy: `PUBLIC_HOME_LATEST_INITIATIVES.intro` in `constants.ts`
- Up to 18 real public initiatives from `/api/v1/public/projections/world-initiatives`
- UI-only placeholders: maximum 2 (`HOME_INITIATIVE_PLACEHOLDER_MAX`), not clickable, excluded from APIs/statistics
- `View All Initiatives` → `/initiatives`

## Latest Public Impact

- No negative empty-state headline
- Subtitle: documented outcomes copy in `PUBLIC_HOME_LATEST_PUBLIC_IMPACT.intro`
- Real records from public search (`entityType: public_impact`)
- When no records exist: up to 3 presentation-only placeholder cards (`HOME_PUBLIC_IMPACT_PLACEHOLDER_MAX`)
- No `View All Public Impact` button (no public index route)

## Knowledge collection

- Up to 12 validated destinations from `PUBLIC_HOME_KNOWLEDGE_ENTRIES`
- Muted tone sequence: `PUBLIC_HOME_KNOWLEDGE_MUTED_TONES`
- Equal-height cards with title, short description, and action link
- `Explore Knowledge` → `/knowledge`

## Civic Media and Civic Archive resource sections

Decorative backgrounds via pseudo-element layers (content remains fully opaque):

| Section       | Asset                             | Opacity token                               |
| ------------- | --------------------------------- | ------------------------------------------- |
| Civic Media   | `/images/media/all-media.webp`    | `--public-home-resource-image-opacity: 0.1` |
| Civic Archive | `/images/media/all-archives.webp` | `--public-home-resource-image-opacity: 0.1` |

Background illustration hidden on small screens when it would harm readability.

## Approximate IP geographic navigator

Home uses `ApproximateIpGeographicNavigator` (not the editable `GeographicNavigator` defaults).

- Data source: `GET /api/v1/public/ip-geography/approximate` (`Cache-Control: private, no-store`)
- Displays only IP/hosting-header derived geography for the current request
- Always begins with **World**
- Appends Country / Region / City only when returned by the resolver
- Shows secondary label **Approximate location**
- No edit/confirm/save controls
- Raw IP addresses are not exposed or persisted
- Localhost / unavailable lookup → **World** only
- Optional dev fixture: `IP_GEOLOCATION_DEV_FIXTURE=CA::CA-BC::Nelson`

See also: [IP Geolocation Operations](./IP_GEOLOCATION_OPERATIONS.md)

## Responsive behavior

- Collections collapse to fewer visible cards at tablet/mobile breakpoints
- Resource illustrations hidden on mobile
- Opportunity cards share equal resting styles (blue outline on hover/focus only)

## Verification

```bash
npm run verify:home-collections-ip-geography
npm run verify:home-v2
npm run verify:initiative-cards-home-search
```
