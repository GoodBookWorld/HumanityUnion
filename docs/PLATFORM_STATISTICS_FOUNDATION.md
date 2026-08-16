# Platform Statistics Foundation

TASK-078 establishes a privacy-safe public statistics surface for the Humanity Union home page.

## Purpose

The **Humanity Union in Numbers** widget presents aggregate civic activity counts. It is a factual civic summary, not social proof, popularity ranking, or marketing analytics.

## Public API

- **Endpoint:** `GET /api/v1/public/platform-statistics`
- **Authentication:** none required
- **Response shape:**

```json
{
  "success": true,
  "data": {
    "users": 0,
    "activeMembers": 0,
    "countries": 0,
    "regions": 0,
    "authors": 0,
    "initiatives": 0,
    "proposals": 0,
    "collectiveDecisions": 0,
    "civicActionPackages": 0,
    "officialResponses": 0,
    "civicArchive": 0
  },
  "meta": {
    "activeMemberWindowDays": 90,
    "generatedAt": "2026-06-27T00:00:00.000Z"
  }
}
```

Only aggregate counts and metadata are returned. No user identifiers, names, emails, vote history, or location lists are exposed.

## Metric Definitions

### Users

Count of active, non-disabled authentication users from the auth user store.

Excluded:

- deleted users
- disabled users (`status === "disabled"`)
- test users when the system marks them as test accounts (not currently modeled separately)

When MongoDB auth persistence is unavailable in local development, the service falls back to counting active member records in the in-memory member store so verification and dev environments still return a real aggregate.

### Active Members

Count of unique actors who performed at least one **qualifying civic action** within the previous **90 days**.

Qualifying actions include timestamps from:

- initiative create/update
- collaborative analysis create/update/publish
- improvement proposal create/update/publish
- collective decision vote cast/update/history change
- implementation commitment create/update/publish
- implementation tracking create/update/activate
- implementation tracking update create
- public impact create/update/publish
- civic nomination create/update/publish
- civic nomination vote cast/update/history change

Excluded from activity:

- login only
- page views
- search
- notification reads

Actors are deduplicated by authenticated `userId` when available (via auth user → member mapping). Otherwise participant IDs are used as a deterministic fallback key.

### Users vs Active Members

| Metric             | Meaning                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| **Users**          | Registered authentication accounts that remain active                                          |
| **Active Members** | Subset of civic participants with recent qualifying civic actions in the rolling 90-day window |

A user may exist without recent civic activity and therefore not count as an active member.

### Countries

Count distinct non-empty country slugs from **active Participation Areas** when any exist.

Fallback: distinct non-empty countries from active member profiles.

Participation Areas are preferred because they represent verified civic geography.

### Regions

Count distinct composite identities of `countrySlug::regionSlug` from active Participation Areas (or member profiles as fallback).

Regions with the same name in different countries are not merged.

### Initiatives

Count initiatives eligible for public projection:

- `lifecyclePhase === "projected"`
- `visibility.policy === "public"`

Drafts and private records are excluded.

### Authors

Count Participants with an explicit blog capability grant containing `author` or
`trusted_author` in `blog_capability_grants`. One grant document per Participant.
Returns `0` when Mongo blog persistence is not configured.

Does not count JWT-only editorial roles without a grant, author applications, or
draft-only writers who lack Author capability.

### Proposals

Count canonical **Initiative Improvement Proposal** records whose status is one of:

- `submitted`
- `accepted`
- `partially_accepted`
- `declined`

Source: `initiative_improvement_proposals` via `countPublicImprovementProposals()`.

Excluded (do not double-count):

- `draft` and `archived` Improvement Proposals
- structured Part D proposal collections / candidates / intelligence groupings
- proposal reactions or revision ID lists as separate proposals
- Activity / legacy Proposal module records

### Collective Decisions

Count initiative collective decision records with public statuses: `opened`, `closed`, or `cancelled`.

### Civic Action Packages

Count civic action packages with `status === "issued"`.

### Official Responses

Count official responses with `publicationStatus === "published"` or `publicationStatus === "archived"`.

### Civic Archive

Count records returned by `listPublishedArchiveRecords()` in the public civic archive store.

## Source Stores

| Metric                | Primary store / function                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| Users                 | `auth-user.repository` → `countActiveAuthUsers()`                                                        |
| Active Members        | Aggregated from initiative, analysis, proposal, vote, commitment, tracking, impact, nomination stores    |
| Countries / Regions   | `participation-area.store` → `listActiveParticipationAreas()`, fallback `member.store` → `listMembers()` |
| Authors               | `blog.repository` → `countParticipantsWithBlogAuthorCapability()`                                        |
| Initiatives           | `initiative.store` + `isInitiativeEligibleForPublicProjection()`                                         |
| Proposals             | `initiative-improvement-proposal.store` → `countPublicImprovementProposals()`                            |
| Collective Decisions  | `initiative-collective-decision.store`                                                                   |
| Civic Action Packages | `civic-action-package.store`                                                                             |
| Official Responses    | `official-response.store`                                                                                |
| Civic Archive         | `public-civic-archive.store`                                                                             |

No duplicate entity storage is introduced.

## Caching

- **Type:** process-local in-memory cache
- **TTL:** 60 seconds (`PLATFORM_STATISTICS_CACHE_TTL_MS`)
- **Scope:** full payload (counts + meta)
- **Safety:** cache is rebuilt on expiry; safe across restarts; no Redis required

Repeated home page renders and API calls within the TTL reuse the cached aggregate instead of rescanning all stores.

## Privacy Boundaries

The endpoint and widget must never expose:

- user IDs, profile IDs, participant IDs
- email addresses or names
- individual user locations
- authentication or session data
- vote history or individual civic activity records
- country/region lists (counts only)

## Frontend

- Component: `apps/web/src/features/platform-statistics/components/HumanityUnionInNumbers.tsx`
- Placement: Home (`/`) directly below Hero and before Core Values
- Behavior: client fetch, skeleton loading, calm error message, no fake fallback values
- Icons: local SVG files under `apps/web/src/assets/icons/workspace/` served from `/icons/workspace/`

## Future Mongo Aggregation Path

Version 1 scans existing in-memory or Mongo-backed stores through repository helpers. For production scale:

1. Add Mongo `$facet` or precomputed nightly aggregation documents in a `platform_statistics_snapshots` collection
2. Maintain the same public response contract
3. Keep the 60-second process cache as a hot layer in front of snapshot reads
4. Move active-member rolling windows to indexed activity event collections with `{ actorId, occurredAt, actionType }`
5. Preserve privacy by storing only aggregate snapshot documents publicly readable

## Verification

Run:

```bash
npm run verify:platform-statistics
```

The script validates endpoint registration, metric definitions, privacy boundaries, cache behavior, icon assets, and home page integration.
