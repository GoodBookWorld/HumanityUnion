# Public Initiative Experience

The public single-initiative route `/initiatives/public/[initiativeId]` is the permanent home of a published initiative and its public lifecycle activity.

## Hero

- Full-width hero with **40% illustration / 60% identity** on desktop.
- Uses uploaded initiative image with fallback `/images/initiatives/initiative-default.webp` via `InitiativeImage`.
- Hero shows title, concise summary, Activity Area, geography, status, current lifecycle stage, first published and last updated dates.
- Hero does **not** repeat the complete Overview body.

## Layout

| Breakpoint | Structure                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| Desktop    | Hero + three columns: Lifecycle nav (≈20%) · Center tabs/content (≈56%) · Support / Revision / Latest (≈24%)              |
| Tablet     | Hero + lifecycle sidebar + center; right sidebar moves below main grid                                                    |
| Mobile     | Hero stacked; lifecycle horizontal scroll; center full width; sidebar stacks below (Support + Revision remain accessible) |

Maximum width follows `--hu-workspace-max-width`.

## Center tabs

1. **Overview** — complete initiative content from public projection fields (no empty cards).
2. **Related Civic Records** — petitions, CAP packages, accountability, and other records not duplicated in lifecycle navigation.
3. **Discussion** — public read; comment entry requires login. Backend comments are deferred; empty state is shown honestly.

Lifecycle stage content opens in the center when selected from the left navigation. Overview opens by default.

## Lifecycle navigation

Ordered stages (only where supported):

Initiative → Collaborative Analysis → Improvement Proposals → Revision → Petition → Decision Session → Collective Decision → Implementation Commitments → Implementation Tracking → Official Responses → Public Impact → Civic Archive

Each stage exposes state text labels: Completed, Current stage, Upcoming, Not applicable.

Hash examples: `#initiative`, `#collaborative-analysis`, `#revision`, `#collective-decision`, `#public-impact`.

Invalid hashes fall back to Overview.

## Support statistics

- Like / Dislike with separate **Participants**, **Members**, and **Visitors** counts.
- Membership does not change signal weight.
- Transparency note: `INITIATIVE_SUPPORT_TRANSPARENCY_NOTE`.
- Bookmarks (authenticated) and deduplicated view counts.
- Visitor cookie key: `hu_initiative_visitor` (session-scoped, not secure persistence).

## Revision History

- Compact sidebar widget (~20rem max height, scrollable).
- Newest first; current and original versions marked.
- Selecting a revision activates the Revision lifecycle panel in the center.

## Latest Initiatives

- 3–5 compact cards prioritized by Activity Area, then country/region, then recency.
- Excludes the current initiative.

## Public API

`GET /api/v1/public/initiatives/:initiativeId/experience`

Composed public-safe projection:

- initiative + hero summary
- lifecycle summary and stage content
- support aggregates
- revision history
- related civic records
- latest initiatives
- discussion summary (empty until comments backend exists)

Support routes under `/api/v1/public/initiatives/:initiativeId/support/*`.

## Placeholder assets

| Use                       | Asset                                                                         |
| ------------------------- | ----------------------------------------------------------------------------- |
| Initiative image fallback | `/images/initiatives/initiative-default.webp`                                 |
| Visitor icon              | `/illustrations/test-account.svg`                                             |
| Like / Dislike / Members  | `/icons/workspace/like.svg`, `dislike.svg`, `members.svg`, `member-check.svg` |

## Deferred backend work

- Persistent initiative discussion / comments API
- Durable support statistics storage (currently in-memory module store)
- Secure anonymous visitor signal persistence
