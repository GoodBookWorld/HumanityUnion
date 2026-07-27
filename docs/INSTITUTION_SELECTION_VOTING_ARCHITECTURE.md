# Institution Selection / Voting Architecture

**Task:** TASK-074  
**Status:** Architecture briefing only — no code, UI, API, domain model changes, vote storage, or selection logic  
**Builds on:** [INSTITUTION_FORMATION_CIVIC_NOMINATION_BRIEFING.md](./INSTITUTION_FORMATION_CIVIC_NOMINATION_BRIEFING.md) (TASK-071), [CIVIC_NOMINATION_DOMAIN_FOUNDATION.md](./CIVIC_NOMINATION_DOMAIN_FOUNDATION.md) (TASK-072), Civic Nomination Form & Poster UI (TASK-073)  
**Last updated:** 2026-07-08

---

## 1. Executive Summary

This document defines the constitutional architecture for **Civic Nomination voting** and its relationship to **future institution selection**. It prepares implementation tasks TASK-075 through TASK-078 without beginning engineering work.

Nomination voting expresses **public civic support** for a published nominee. It is a transparent public signal that may inform future institution formation, review, and governance processes. It does **not** automatically appoint, hire, authorize, command, represent states, or create legal office.

TASK-073 implemented nomination form and poster UI with **voting and result placeholders only**. This briefing specifies what those placeholders will become: scope rules, lifecycle, vote and result models, display requirements, privacy boundaries, consent reservations, and legal safeguards.

---

## 2. Core Constitutional Principle

> **Nomination voting expresses public civic support. It does not create authority.**

| Voting does                                                     | Voting does not                  |
| --------------------------------------------------------------- | -------------------------------- |
| Record unweighted participant choices on a published nomination | Automatically appoint a person   |
| Produce aggregate transparency metrics                          | Create legal authority           |
| Inform future public review and institution formation           | Create employment                |
| Support governance deliberation with public signal              | Create office                    |
| Remain publicly auditable at aggregate level                    | Override charter selection rules |

Final selection — if any — requires separate governance rules, role eligibility policy, legal review, and an explicit confirmation mechanism (TASK-078).

---

## 3. Relationship to Collective Decision Voting

Civic Nomination voting reuses the same **constitutional voting principles** established for Collective Decision voting:

| Principle                 | Specification                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| One participant, one vote | One registered **active** participant = one **active** vote per nomination while voting is open   |
| Choices                   | `support`, `do_not_support`, `abstain`                                                            |
| Vote update               | Participant may change vote while voting is **open**                                              |
| Weighting                 | **None** — unweighted counts only                                                                 |
| Verification overlay      | Verified and unverified cohorts shown **separately**; verification does **not** change vote value |
| AI outcome                | **None** — no AI-generated recommendation or outcome                                              |
| Reputation                | **None** — no reputation weighting                                                                |
| Geo/IP eligibility        | **None** — no IP, VPN, or geolocation-based vote eligibility                                      |

### Key difference in purpose

| Dimension            | Collective Decision voting                         | Nomination voting                                              |
| -------------------- | -------------------------------------------------- | -------------------------------------------------------------- |
| **Subject**          | Initiative outcome / decision record               | Person nominated for future institutional role                 |
| **Question**         | Does the community support this civic outcome?     | Does the community support this nominee for this role context? |
| **Pipeline**         | Capability 02 civic lifecycle                      | Institution Formation pathway                                  |
| **Authority effect** | Records collective civic position on an initiative | Records public support signal only — no appointment            |

Implementation should reuse shared eligibility and transparency patterns where practical, but **must not** merge nomination votes into initiative decision vote stores.

---

## 4. Nomination Voting Scope Rules

Scope determines **who may cast a vote** on a given published nomination. Scope is derived from the nominee’s **institution role** and **declared civic scope** (especially `countrySlug`).

### 4.1 Humanity Council

| Attribute       | Rule                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| **Scope**       | Country                                                                                                 |
| **Reason**      | Each future council nominee represents a national civic constituency                                    |
| **Eligibility** | Registered active participants whose Participation Area **country** matches the nominee’s `countrySlug` |
| **Requirement** | Nomination must include country (already required at submission)                                        |

### 4.2 Chamber of Intellectual Analysis

| Attribute       | Rule                                                  |
| --------------- | ----------------------------------------------------- |
| **Scope**       | World                                                 |
| **Reason**      | Global expert role addressing common human challenges |
| **Eligibility** | Any registered active participant                     |

### 4.3 Expert Analysis Team

| Attribute              | Rule                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| **Scope (v1 default)** | World                                                                  |
| **Future option**      | Domain-specific review panels (e.g. expertise-area cohorts) — deferred |
| **Eligibility (v1)**   | Any registered active participant                                      |

### 4.4 State Collaboration Department

| Attribute              | Rule                                                                        |
| ---------------------- | --------------------------------------------------------------------------- |
| **Scope (v1 default)** | Country                                                                     |
| **Reason**             | Coordination role linked to state institutions and government communication |
| **Eligibility**        | Registered active participants in the nominee’s `countrySlug`               |
| **Requirement**        | Nomination must include country (already required at submission)            |

### 4.5 Chamber of State Representatives

| Attribute                    | Rule                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| **Public nomination voting** | **No**                                                                                        |
| **Reason**                   | Representatives are appointed by participating governments — not open civic nomination voting |

### 4.6 Humanity Protection Command Center (HPC) / World Protection Corps (WPC)

| Attribute                  | Rule                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| **Nomination voting (v1)** | **No**                                                                                           |
| **Reason**                 | Requires separate legal and security governance briefing before any nomination or voting surface |

### Scope summary

| Institution role                                              | Nomination (TASK-072/073) | Voting scope (this document)   |
| ------------------------------------------------------------- | ------------------------- | ------------------------------ |
| Humanity Council                                              | Yes                       | Country                        |
| Chamber of Intellectual Analysis                              | Yes                       | World                          |
| Expert Analysis Team                                          | Yes                       | World (domain panels deferred) |
| State Collaboration Department                                | Yes                       | Country                        |
| Chamber of State Representatives                              | No                        | No voting                      |
| HPC / WPC                                                     | No                        | No voting                      |
| Secretariat / Regional Offices / Community Self-Defense Units | Deferred                  | Deferred                       |

---

## 5. Voting Lifecycle

Voting lifecycle is **separate from** nomination lifecycle (`draft → submitted → published → withdrawn/archived`). A published nomination may have an associated voting session.

### 5.1 States

```
not_open → open → closed
              ↘ cancelled
```

| State       | Meaning                                                           |
| ----------- | ----------------------------------------------------------------- |
| `not_open`  | Nomination is published; voting has not started                   |
| `open`      | Eligible participants may cast or update votes                    |
| `closed`    | Voting window ended; aggregates frozen; results remain public     |
| `cancelled` | Voting aborted by governance/moderation; results marked cancelled |

### 5.2 Rules

1. Voting may open **only** for `published` nominations.
2. Voting **cannot** open for `withdrawn` or `archived` nominations.
3. Voting session records `openedAt` and `closesAt` (or equivalent scheduled close).
4. Votes are **frozen** after `closed` or `cancelled`.
5. Aggregate results remain **public** after close (subject to privacy rules below).
6. Reopening voting requires a **new nomination version** or an explicit **governance process** — not silent retroactive edits to closed results.

### 5.3 Suggested future entity (implementation deferred)

`CivicNominationVotingSession` (name tentative):

- `votingSessionId`
- `nominationId`
- `status` (`not_open` | `open` | `closed` | `cancelled`)
- `openedAt`, `closesAt`, `closedAt?`, `cancelledAt?`
- `openedBy` (moderator/governance actor — internal only)
- `scopePolicy` (derived from role + country)
- `nominationVersion` (bind session to nomination version at open)

---

## 6. Vote Model (Future)

### 6.1 CivicNominationVote

One **active** vote record per `(nominationId, participantId)` while voting is open.

| Field                | Type         | Notes                                                                      |
| -------------------- | ------------ | -------------------------------------------------------------------------- |
| `voteId`             | string       | Primary key                                                                |
| `nominationId`       | string       | FK to published nomination                                                 |
| `participantId`      | string       | Internal — **never public**                                                |
| `profileId`          | string       | Internal — **never public**                                                |
| `choice`             | enum         | `support` \| `do_not_support` \| `abstain`                                 |
| `transparencyCohort` | enum         | `verified` \| `unverified` — snapshot at cast/update; display overlay only |
| `castAt`             | ISO datetime | First cast timestamp                                                       |
| `updatedAt`          | ISO datetime | Last change while open                                                     |
| `version`            | number       | Optimistic concurrency / audit                                             |

### 6.2 CivicNominationVoteHistoryEntry

Append-only history when a participant changes vote while voting is open.

| Field                | Type         | Notes                    |
| -------------------- | ------------ | ------------------------ |
| `historyId`          | string       | Primary key              |
| `voteId`             | string       | FK                       |
| `nominationId`       | string       | Denormalized for query   |
| `participantId`      | string       | Internal                 |
| `previousChoice`     | enum \| null | Null on first cast       |
| `newChoice`          | enum         |                          |
| `changedAt`          | ISO datetime |                          |
| `transparencyCohort` | enum         | Cohort at time of change |

Vote history is **not** publicly exposed per voter. It exists for audit, moderation, and integrity review only.

### 6.3 Cast and update rules

- Participant must be **registered**, **active**, and **scope-eligible**.
- Participant may **update** choice while session status is `open`.
- Updates append history; aggregates recompute from current active votes.
- No vote casting after `closed` or `cancelled`.

---

## 7. Result Model (Future)

### 7.1 CivicNominationVotingResult

Public projection of aggregates — computed from active votes at close (and live while open).

| Field                         | Description                                                             |
| ----------------------------- | ----------------------------------------------------------------------- |
| `totalVotes`                  | Count of participants with an active vote                               |
| `supportVotes`                | Count where `choice = support`                                          |
| `doNotSupportVotes`           | Count where `choice = do_not_support`                                   |
| `abstainVotes`                | Count where `choice = abstain`                                          |
| `verifiedVotes`               | Total votes from verified cohort                                        |
| `unverifiedVotes`             | Total votes from unverified cohort                                      |
| `verifiedSupportVotes`        | Verified + support                                                      |
| `verifiedDoNotSupportVotes`   | Verified + do not support                                               |
| `verifiedAbstainVotes`        | Verified + abstain                                                      |
| `unverifiedSupportVotes`      | Unverified + support                                                    |
| `unverifiedDoNotSupportVotes` | Unverified + do not support                                             |
| `unverifiedAbstainVotes`      | Unverified + abstain                                                    |
| `participationConfidence`     | Informational metric (e.g. low participation notice) — **not** a weight |
| `outcomeLabel`                | Informational label only — see below                                    |

### 7.2 Outcome labels (informational only)

| Label           | Suggested meaning (policy finalized in TASK-078)         |
| --------------- | -------------------------------------------------------- |
| `supported`     | Support votes exceed do-not-support by defined threshold |
| `not_supported` | Do-not-support exceeds support by defined threshold      |
| `inconclusive`  | No clear margin, low participation, or high abstain      |
| `cancelled`     | Session cancelled                                        |

> **Critical:** `outcomeLabel` is a **descriptive summary** for public transparency. It does **not** appoint the nominee, trigger hiring, or confer authority.

Thresholds and tie-break rules belong in **Institution Selection Policy** (TASK-078), not in vote storage.

---

## 8. Compact Poster Voting Display

Compact posters appear in **All Nominations** modal/grid (TASK-073). When voting is implemented (TASK-076):

### Required fields (unchanged from TASK-073)

| Field          | Display                          |
| -------------- | -------------------------------- |
| Name           | Nominee display name             |
| Role           | Institution role label           |
| Country        | Country label or “Not specified” |
| Expertise tags | Expertise area labels            |

### Votes section

| Metric                       | Display                                                         |
| ---------------------------- | --------------------------------------------------------------- |
| Total support votes          | Aggregate count when voting has occurred; otherwise status text |
| Verified participant votes   | Verified cohort total (or split by choice on full poster only)  |
| Unverified participant votes | Unverified cohort total                                         |

**Compact poster shows support total prominently** per TASK-071 briefing; verified/unverified lines reflect transparency overlay.

Link: **View Full Poster →**

### Sorting and discovery (mandatory)

Default listing order **must not** rank by vote count.

Approved default sorts:

- **Newest first** (by `publishedAt` / `updatedAt`)
- **Role grouping**
- **Country grouping**

**Prohibited:** leaderboards, trending nominees, popularity badges, “top supported” default sorts.

---

## 9. Full Poster Voting Display

Full poster route: `/institutions/nominations/[nominationId]` (TASK-073).

### 9.1 Voting widget (TASK-076 replaces placeholder)

| Element             | Behavior                                                                   |
| ------------------- | -------------------------------------------------------------------------- |
| Choices             | Support, Do not support, Abstain                                           |
| Cast                | Submit one active vote when session is `open` and participant is eligible  |
| Update              | Change vote while `open`                                                   |
| My vote             | Show participant’s current choice when authenticated and eligible          |
| Disabled state      | When `not_open`, `closed`, or `cancelled`; explain status                  |
| Eligibility message | If out of scope, explain country/world rule without exposing others’ votes |

Component boundary (already reserved in TASK-073): `NominationVotingWidgetPlaceholder` → live widget.

### 9.2 Result widget (TASK-076 replaces placeholder)

| Element                            | Display                                         |
| ---------------------------------- | ----------------------------------------------- |
| Total votes                        | Yes                                             |
| Support / do not support / abstain | Yes — unweighted                                |
| Verified / unverified splits       | Yes — by choice where space allows              |
| Transparency note                  | Required                                        |
| Voting window                      | `openedAt` – `closesAt` when applicable         |
| Status                             | `not_open` \| `open` \| `closed` \| `cancelled` |

Component boundary: `NominationResultWidgetPlaceholder` → live widget.

### 9.3 Required legal note (full poster)

> This nomination vote expresses civic support and public evaluation. It does not create legal appointment, employment, office, or institutional authority.

### 9.4 Required transparency note (voting and result widgets)

> Verified and unverified votes are shown separately for transparency. They do not change vote weight.

---

## 10. Selection / Appointment Architecture

### 10.1 What voting results may inform (future)

- Public review and civic archive records
- Institution formation deliberation
- Council selection shortlists
- Expert candidate review panels
- Governance audit and transparency reporting

### 10.2 What voting results may not do (ever, without separate process)

- Appoint
- Hire
- Authorize command
- Represent states
- Create office or legal authority

### 10.3 Future selection gate

Any transition from **nomination + vote signal** to **institutional role** requires:

1. **Governance rules** — charter-approved selection procedure per role
2. **Role eligibility policy** — qualifications, conflicts, residency, consent
3. **Legal review** — especially for HPC/WPC and state-adjacent roles
4. **Final confirmation mechanism** — explicit human governance action, not vote threshold alone

Documented in TASK-078 — Institution Selection Policy Briefing.

---

## 11. Candidate / Nominee Consent (Reserved)

Because nominators may name **another person**, the architecture reserves a future **consent state** without implementing it in TASK-074–076.

### Suggested consent states

| State               | Meaning                                               |
| ------------------- | ----------------------------------------------------- |
| `nominee_unclaimed` | Nominee has not linked platform profile to nomination |
| `nominee_claimed`   | Nominee affirmed or corrected record                  |
| `nominee_declined`  | Nominee declined association                          |

### Rules (architecture)

- A nomination may be **published** based on public professional evidence even if the nominee has not claimed a profile.
- Future platform flows should allow nominee to **claim**, **confirm**, **correct**, or **decline**.
- Decline does not erase public record automatically — governance/moderation policy defines archival (TASK-077).

Implementation: **TASK-077 — Nominee Consent & Claiming Architecture**.

---

## 12. Anti-Abuse / Safety (Future)

Not implemented in TASK-074–076. Architecture anticipates:

| Control                     | Purpose                            |
| --------------------------- | ---------------------------------- |
| Report nomination           | Community flag for review          |
| Archive abusive nomination  | Moderator action                   |
| Moderation review queue     | Human review                       |
| Duplicate nominee detection | Same person, same role, same scope |
| Impersonation warning       | Nominee name vs profile mismatch   |
| Evidence quality flags      | Low-quality or misleading links    |

Vote manipulation concerns (sock puppets, brigading) lean on **existing participant verification** and moderation — not vote weighting or geo-blocking.

---

## 13. Privacy Rules

### Never expose publicly

- `participantId`, internal `profileId`, `userId`
- Email, authentication data, session tokens
- Individual voter choices
- Per-voter vote history
- IP, VPN, geolocation, or device fingerprints

### Public may expose

- Aggregate vote counts and cohort splits
- Current nomination poster content (existing public projection)
- Voting session status and window
- Informational `outcomeLabel` (not individual ballots)

### Authenticated participant may see (future)

- **Own** current vote on a nomination
- **Own** eligibility explanation (in scope / out of scope)

---

## 14. Notifications (Future)

Suggested event types:

| Event                            | When                                  |
| -------------------------------- | ------------------------------------- |
| `civic_nomination_voting_opened` | Session transitions to `open`         |
| `civic_nomination_vote_cast`     | Participant casts or updates own vote |
| `civic_nomination_voting_closed` | Session transitions to `closed`       |

### Recommended delivery policy

- **Do not** notify all participants on every vote cast globally.
- **Do** notify nominator when voting opens and closes.
- Vote-cast notifications: only when personally relevant (e.g. own vote confirmation) or when user preference enabled later.

Align with existing notification infrastructure from TASK-072 (`civic_nomination_submitted`, `_published`, `_withdrawn`).

---

## 15. Assistant Integration (Future)

The workspace civic assistant may:

- Explain how nomination voting works
- Explain why verified/unverified splits are shown
- Explain why voting does not appoint
- State whether the current participant is eligible to vote (scope check)
- Describe current voting session status

The assistant may **not**:

- Recommend a candidate based on popularity or vote totals
- Tell the user whom to vote for
- Generate campaign or propaganda content
- Decide or announce an official outcome

---

## 16. Explicit Exclusions (TASK-074)

This task does **not** include:

- Vote storage or APIs
- UI changes beyond existing TASK-073 placeholders
- Domain model changes to `CivicNomination`
- Selection or appointment logic
- HPC/WPC voting
- Chamber of State Representatives voting
- Reputation, ranking, or weighted scoring
- AI outcome generation

---

## 17. Future Implementation Plan

| Task         | Title                                   | Scope                                                                                                                                            |
| ------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **TASK-075** | Civic Nomination Voting Foundation      | Vote domain types; eligibility engine; cast/update; unweighted aggregates; Mongo persistence; public result projection; voting session lifecycle |
| **TASK-076** | Civic Nomination Voting UI              | Replace full-poster voting/result placeholders; compact poster counts; my-vote display; eligibility messaging                                    |
| **TASK-077** | Nominee Consent & Claiming Architecture | `nominee_unclaimed` / `claimed` / `declined`; claim and correction flows; consent notices                                                        |
| **TASK-078** | Institution Selection Policy Briefing   | Role-specific final selection rules; legal caution; governance confirmation; outcome threshold policy                                            |

Recommended implementation order: **075 → 076 → 077 → 078**. Selection policy (078) should inform outcome label thresholds before any automated “supported/not_supported” labeling goes live.

---

## 18. Acceptance Checklist (TASK-074)

| Criterion                             | Status |
| ------------------------------------- | ------ |
| Document created                      | ✓      |
| No code changes                       | ✓      |
| No APIs                               | ✓      |
| No UI changes                         | ✓      |
| No vote storage                       | ✓      |
| No selection logic                    | ✓      |
| Voting principles defined             | ✓      |
| Scope rules defined                   | ✓      |
| Lifecycle defined                     | ✓      |
| Vote model defined                    | ✓      |
| Result model defined                  | ✓      |
| Compact poster voting display defined | ✓      |
| Full poster voting display defined    | ✓      |
| Legal caution defined                 | ✓      |
| Consent model reserved                | ✓      |
| Privacy rules defined                 | ✓      |
| Future implementation plan defined    | ✓      |

---

## 19. Related Documents

- [INSTITUTION_FORMATION_CIVIC_NOMINATION_BRIEFING.md](./INSTITUTION_FORMATION_CIVIC_NOMINATION_BRIEFING.md) — nomination workflow, poster fields, initial voting principles
- [CIVIC_NOMINATION_DOMAIN_FOUNDATION.md](./CIVIC_NOMINATION_DOMAIN_FOUNDATION.md) — nomination aggregate, lifecycle, public projection (TASK-072)
- [INSTITUTIONS_PAGE_BRIEFING.md](./INSTITUTIONS_PAGE_BRIEFING.md) — institutions experience context (TASK-069)
