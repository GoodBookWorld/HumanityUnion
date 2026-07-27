# Member Preferences

Member Preferences are private Participant settings stored per authenticated Member. They influence workspace defaults, notification matching, and initiative relevance, but they are not verified residence, Participation Area declarations, or public profile geography unless a separate visibility setting explicitly allows exposure.

Route: `/preferences`

## Geography preferences

Geography preferences appear in the **Participation** section in this order:

1. **Preferred Countries** — searchable multi-select of canonical ISO country codes (`preferredCountryIds`)
2. **Preferred Regions** — regions added from selected countries (`preferredRegions`)
3. **Preferred Cities / Communities** — searchable multi-select constrained by selected regions (`preferredCityCommunityIds`)

### Dependency rules

- **Regions** are scoped to selected countries when countries are selected. Adding a region also adds its country to `preferredCountryIds` when missing.
- **Cities / Communities** load only for selected regions via the shared geography service (`fetchCommunitiesByRegion`). The UI does not render the worldwide city list.
- When no regions are selected, the Cities / Communities control is disabled with guidance: _Select at least one preferred region to choose Cities / Communities._
- When a selected region has no community data, the control explains: _No Cities / Communities are available for this region._

### Cleanup behavior

When a preferred country or region is removed, incompatible regions and cities are removed automatically. The form shows:

> Some cities were removed because their country or region is no longer selected.

Invalid hidden selections are never retained.

### Persistence identifiers

| Field                       | Type       | Example                      |
| --------------------------- | ---------- | ---------------------------- |
| `preferredCountryIds`       | `string[]` | `["CA", "UA"]`               |
| `preferredRegions`          | `string[]` | `["CA::CA-BC", "UA::UA-30"]` |
| `preferredCityCommunityIds` | `string[]` | `["CA::CA-BC::16735"]`       |

Region identifiers use `{countryCode}::{regionCode}`. City/community identifiers use `{countryCode}::{regionCode}::{communityCode}`. Display labels are resolved from the shared Geography dataset at read time.

Legacy records without the new fields normalize to empty arrays on load. Legacy region codes without a country prefix are upgraded only when the country can be inferred unambiguously from selected countries.

### Save behavior

All geography fields save through the existing **Save Preferences** button at the end of the form. There is no separate save action for cities.

### Recommendation and notification matching

Geography preferences act as an optional precision layer for initiative interest notifications:

1. selected City / Community
2. selected Region
3. selected Country
4. activity-area / scope / topic preferences

City preference improves local relevance. Broader region, country, activity-area, and scope matches still notify Participants unless they disable interest-match notifications or the category is disabled. City preferences do not suppress broader matching.

Implementation: `apps/api/src/modules/preferences/preferences-geography-match.ts` and `apps/api/src/modules/notifications/initiative-interest-match.service.ts`.

### Privacy

Preferred Cities / Communities remain private preference data. They are not:

- public Profile geography
- current residence
- verified location
- Participation Area
- legal identity data

Public participation projection exposes `preferredParticipationRegions` only when `participationVisibility` is `public`, and never exposes `preferredCityCommunityIds`.

## Related verification

```bash
npm run verify:preferences-city-communities
npm run verify:member-preferences-initiative-ux
```
