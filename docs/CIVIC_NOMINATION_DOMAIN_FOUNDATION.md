# Civic Nomination Domain Foundation

**Task:** TASK-072  
**Status:** Domain foundation implemented  
**Briefing:** [INSTITUTION_FORMATION_CIVIC_NOMINATION_BRIEFING.md](./INSTITUTION_FORMATION_CIVIC_NOMINATION_BRIEFING.md)

---

## Purpose

Civic Nomination is the domain layer for Institution Formation — structured nominations for future Humanity Union institutional roles with evidence, declarations, lifecycle management, and privacy-safe public projection.

This module does **not** include nomination form UI, posters, voting, appointment, or election logic (TASK-073–075).

---

## Domain Model

**Aggregate:** `CivicNomination` (`packages/types/src/domain/civic-nomination.ts`)

| Area         | Fields                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Identity     | `nominationId`, `institutionRole`, `nominationType`, `nomineeName`, `nomineeProfileId?`, `nominatedByProfileId`, `nominatedByUserId` |
| Scope        | `countrySlug?`, `regionSlug?`, `communitySlug?`                                                                                      |
| Content      | `expertiseAreas[]`, `experienceSummary`, `confirmedAchievements`, `evidenceLinks[]`, `visionStatement`, `conflictOfInterest`         |
| Declarations | UDHR, constitutional principles, no automatic appointment, accuracy confirmation                                                     |
| Lifecycle    | `status`, `submittedAt?`, `publishedAt?`, `withdrawnAt?`, `archivedAt?`, `nominationVersion`                                         |

**Public projection:** `PublicCivicNominationProjection` (`public-civic-nomination.ts`) — never exposes `nominatedByUserId`, email, or auth internals.

---

## Eligible Institution Roles

| Role                             | Slug                               |
| -------------------------------- | ---------------------------------- |
| Humanity Council                 | `humanity_council`                 |
| Chamber of Intellectual Analysis | `chamber_of_intellectual_analysis` |
| Expert Analysis Team             | `expert_analysis_team`             |
| State Collaboration Department   | `state_collaboration_department`   |

Chamber of State Representatives, HPC, and WPC are **not** nominatable in this module.

---

## Lifecycle

```
draft → submitted → published → archived
  ↓         ↓
withdrawn  withdrawn
```

| Rule              | Enforcement                                            |
| ----------------- | ------------------------------------------------------ |
| Edit              | Nominator only, `draft` only                           |
| Submit / withdraw | Nominator only                                         |
| Publish / archive | Admin or moderator (future institution moderator role) |
| Published         | Immutable                                              |

---

## Privacy Rules

**Not collected:** age, gender, religion, ethnicity, marital status, political affiliation, private address, phone.

**Not exposed publicly:** `nominatedByUserId`, internal user IDs, email, auth/session data.

Validation rejects forbidden personal-trait fields if sent in request bodies.

---

## API Routes

### Authenticated (`/api/v1/civic-nominations`)

| Method | Path                      | Action                       |
| ------ | ------------------------- | ---------------------------- |
| POST   | `/`                       | Create draft                 |
| GET    | `/mine`                   | List nominator's nominations |
| GET    | `/:nominationId`          | Get own nomination           |
| PATCH  | `/:nominationId`          | Update draft                 |
| POST   | `/:nominationId/submit`   | Submit                       |
| POST   | `/:nominationId/withdraw` | Withdraw                     |
| POST   | `/:nominationId/publish`  | Publish (moderator)          |
| POST   | `/:nominationId/archive`  | Archive (moderator)          |

### Public

| Method | Path                                                       | Action                                                     |
| ------ | ---------------------------------------------------------- | ---------------------------------------------------------- |
| GET    | `/api/v1/public/civic-nominations`                         | List published (filters: `institutionRole`, `countrySlug`) |
| GET    | `/api/v1/public/civic-nominations/:nominationId`           | Public projection                                          |
| GET    | `/api/v1/public/institutions/:institutionRole/nominations` | Published by role                                          |

---

## Persistence

- Collection: `civic_nominations`
- Env: `CIVIC_NOMINATION_PERSISTENCE=memory|mongodb`
- Module: `apps/api/src/modules/civic-nomination/`

---

## Integrations

| System              | Behavior                                                          |
| ------------------- | ----------------------------------------------------------------- |
| Global Search       | Entity type `civic_nomination`; published only                    |
| Notifications       | `civic_nomination_submitted`, `_published`, `_withdrawn`          |
| Workspace assistant | `listMyCivicNominations(profileId)` available for future TASK-075 |

---

## Future Work

- **TASK-073** — Nomination form, compact/full poster UI, All Nominations modal
- **TASK-074** — Transparent support voting
- **TASK-075** — Search UI, assistant, Knowledge cross-links

---

## Verification

```bash
npm run verify:civic-nomination
```
