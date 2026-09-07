# RESET 05 — Migration Inventory (from RESET 04)

Status: **NOT MIGRATED**. Universal PLP core exists; domains below still use legacy CT and/or canonical English.

## Explicit sentinel — `country-initiative-rail-card__meta`

| Item | Value |
|------|--------|
| CSS / surface | `.country-initiative-rail-card__meta` |
| Render | `CountryInitiativeRailCard.tsx` — `{activityAreaLabel} · {initiative.geographyLabel}` |
| Also | `CountryElectionRailCard.tsx` — `{initiative.geographyLabel}` |
| Canonical source | Initiative world/country card projection (`activityArea`, `geographyLabel` via `toWorldInitiativeCardProjection` / `formatPublicGeography`) |
| Current localization | `activityAreaLabel` via next-intl `initiativeExperience`; `geographyLabel` often English projection |
| Future ownership | Initiative/Lifecycle PLP adapter — likely `MACHINE_CONTENT` or controlled geography terminology for area; geography may be `PROTECTED_CANONICAL` / GEOGRAPHY authority |
| Adapter owner | **Initiative/Lifecycle** (not Media) |
| Acceptance | RESET 05 incomplete while this participant-facing meta remains unowned/unlocalized on non-English locales |
| Do not | Locally hardcode Ukrainian strings in RESET 04/05 UI patches |

## Domain inventory

| Domain / surface | Legacy dependency | RESET 05 adapter |
|------------------|-------------------|------------------|
| Initiative lifecycle public pages | CT / presentation hooks | `initiative_lifecycle` |
| Country Initiative rail cards | CT + i18n fragments; PLP `DOMAIN_NOT_YET_MIGRATED` | `initiative_lifecycle` |
| Country election rails | same | `initiative_lifecycle` |
| Blog / Knowledge / Publications | CT warm + resolve | `blog_knowledge` |
| Public Discussions | CT / canonical | `discussion` |
| Public participant / profile dynamic content | CT / canonical | `participant_public` |
| Other civic semantic content | audit during RESET 05 | TBD adapters |

## Media (reference — already migrated)

Media PLP adapter is the reference implementation. Do not re-materialize as part of RESET 05 unless inventory/version drift requires it.

## Notes

- Universal core must not gain Initiative/Media-specific branches.
- Consumer identity authority applies to any bounded collection surface (News lesson).
