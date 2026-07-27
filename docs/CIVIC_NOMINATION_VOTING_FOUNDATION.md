# Civic Nomination Voting Foundation

**Task:** TASK-075  
**Status:** Backend foundation implemented  
**Architecture:** [INSTITUTION_SELECTION_VOTING_ARCHITECTURE.md](./INSTITUTION_SELECTION_VOTING_ARCHITECTURE.md)  
**Nomination domain:** [CIVIC_NOMINATION_DOMAIN_FOUNDATION.md](./CIVIC_NOMINATION_DOMAIN_FOUNDATION.md)

---

## Purpose

Backend foundation for transparent civic nomination support voting: vote cast/update, eligibility by institution scope, unweighted aggregates with verified/unverified splits, Mongo persistence, authenticated APIs, public projections, and notification events.

This module does **not** implement voting UI (TASK-076), appointment, institution confirmation, or selection policy.

---

## Domain Types

**Package:** `packages/types/src/domain/civic-nomination-voting.ts`

| Type                                    | Role                                                       |
| --------------------------------------- | ---------------------------------------------------------- |
| `CivicNominationVote`                   | One active vote per participant per nomination             |
| `CivicNominationVoteHistoryEntry`       | Append-only audit on cast/update                           |
| `CivicNominationVotingSession`          | `not_open` / `open` / `closed` / `cancelled` window        |
| `CivicNominationVotingResult`           | Unweighted aggregate counts + informational `outcomeLabel` |
| `PublicCivicNominationVotingProjection` | Privacy-safe public voting view                            |

**Choices:** `support`, `do_not_support`, `abstain`

**Transparency cohort:** `verified` | `unverified` — derived from active Participation Area; never client-supplied.

---

## Eligibility Engine

| Institution role                 | Scope                           |
| -------------------------------- | ------------------------------- |
| Humanity Council                 | Country (nominee `countrySlug`) |
| State Collaboration Department   | Country                         |
| Chamber of Intellectual Analysis | World                           |
| Expert Analysis Team             | World                           |

Rejected roles: Chamber of State Representatives, HPC, WPC (not nominatable / not votable).

Requirements:

- Nomination status `published`
- Voting session status `open` within `openedAt`–`closesAt`
- Registered active participant with matching Participation Area scope

---

## API Routes

### Authenticated (`/api/v1/civic-nominations`)

| Method | Path                          | Action                                    |
| ------ | ----------------------------- | ----------------------------------------- |
| POST   | `/:nominationId/voting/open`  | Moderator opens voting (body: `closesAt`) |
| POST   | `/:nominationId/voting/close` | Moderator closes voting                   |
| POST   | `/:nominationId/vote`         | Cast vote                                 |
| PATCH  | `/:nominationId/vote`         | Update vote while open                    |
| GET    | `/:nominationId/my-vote`      | Load caller's active vote                 |

### Public (`/api/v1/public/civic-nominations`)

| Method | Path                    | Action                                          |
| ------ | ----------------------- | ----------------------------------------------- |
| GET    | `/:nominationId/voting` | Aggregate voting projection (no voter identity) |

---

## Persistence

**Env:** `CIVIC_NOMINATION_VOTE_PERSISTENCE=memory|mongodb`

**Collections:**

- `civic_nomination_votes`
- `civic_nomination_vote_history`
- `civic_nomination_voting_sessions`

Indexes on `nominationId`, `participantId`, `choice`, `createdAt`, `updatedAt`.

---

## Notifications

| Event                            | Typical recipient          |
| -------------------------------- | -------------------------- |
| `civic_nomination_voting_opened` | Nominator                  |
| `civic_nomination_vote_cast`     | Voting participant (actor) |
| `civic_nomination_voting_closed` | Nominator                  |

---

## Assistant Guidance

`buildCivicNominationVotingAssistantGuidance()` answers eligibility and voting status without recommending candidates.

---

## Verification

```bash
npm run verify:civic-nomination-voting
```

---

## Explicit Exclusions

- Vote UI and charts (TASK-076)
- Appointment / institution formation / workspace
- Candidate ranking and leaderboards
