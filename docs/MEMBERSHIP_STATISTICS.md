# Membership Statistics (TASK-093)

Membership statistics improve civic transparency by showing how confirmed Participants and Humanity Union Members compose platform participation. **Membership never changes vote weight.**

## Core principle

One participant = one vote. Member and Participant votes have identical weight. Statistics are informational only.

Shared transparency note (single source in `@hu/types`):

`MEMBERSHIP_VOTE_WEIGHT_TRANSPARENCY_NOTE`

## Aggregation model

| Field                | Definition                                                       |
| -------------------- | ---------------------------------------------------------------- |
| `members`            | `memberships.status = active_member`                             |
| `participants`       | Verified, non-disabled auth users without `active_member` status |
| `totalParticipation` | `members + participants`                                         |
| `updatedAt`          | ISO timestamp of aggregation                                     |

Mongo uses indexed counts on `memberships.status` and `auth_users.emailVerificationStatus` — no full collection scans on each request.

## API

**Endpoint:** `GET /api/v1/statistics/membership`

**Response:**

```json
{
  "success": true,
  "data": {
    "totalParticipation": 879,
    "members": 645,
    "participants": 234,
    "updatedAt": "2026-06-27T12:00:00.000Z"
  }
}
```

Read-only. Cached in-process for 60 seconds (`membership-statistics.cache.ts`).

## Reusable components

| Component                                | Purpose                                          |
| ---------------------------------------- | ------------------------------------------------ |
| `MembershipParticipationStatisticsPanel` | Numeric summary cards + shared transparency note |
| `MembershipPlatformStatisticsSection`    | Client wrapper fetching live platform statistics |
| `MembershipVotingExplanation`            | Renders shared note only                         |

No percentages by default. Screen-reader friendly `<dl>` structure with headings.

## UI integrations

- **Home** — `HumanityUnionInNumbers` adds live **Humanity Union Members** card
- **Membership page** — platform participation section with last updated
- **Workspace** — Membership dashboard section
- **Collective Decision workspace** — informational transparency panel (no vote logic changes)
- **Public collective decision pages** — same panel
- **Nomination result placeholder** — same panel

Per-decision Member/Participant voter breakdown is deferred until vote records store cohort at cast time.

## Public visibility policy

Public profiles may show Member badge, number, and label when `membershipPubliclyVisible = true`. Aggregate statistics do not expose individual accounts.

## Voting transparency

Collective Decision vote calculation, eligibility, weight, ranking, thresholds, and winner determination are **unchanged**. Only an informational statistics panel is added.

## Future analytics (deferred)

Architecture types only (`MembershipStatisticsFutureDimensions`):

- Members by country / region
- Monthly memberships
- Growth rate
- Inactive members

Charts belong to TASK-096 Membership Analytics Dashboard.

## Search (architecture only)

Future filters: `members_only`, `participants_only` (`MembershipStatisticsSearchFilter`). Not implemented in TASK-093.

## Verification

```bash
npm run verify:membership-statistics
```

## Related docs

- [MEMBERSHIP_ARCHITECTURE.md](./MEMBERSHIP_ARCHITECTURE.md)
- [PLATFORM_STATISTICS_FOUNDATION.md](./PLATFORM_STATISTICS_FOUNDATION.md)
- [STRIPE_MEMBERSHIP_CONTRIBUTION.md](./STRIPE_MEMBERSHIP_CONTRIBUTION.md)

## Deferred

- **TASK-094** — Official Member Badge Ordering
- **TASK-095** — Support Platform / Contributions
- **TASK-096** — Membership Analytics Dashboard
