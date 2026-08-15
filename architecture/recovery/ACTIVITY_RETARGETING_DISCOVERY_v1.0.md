# Activity Retargeting Discovery v1.0

**Authority:** This document is governed by `architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md` ("the ADR") and `architecture/recovery/INITIATIVE_ARCHITECTURE_RECOVERY_ROADMAP_v1.0.md` ("the roadmap"), specifically Phase 4 ("Reuse Activity as participation-trace infrastructure"). Where this document and the ADR/roadmap conflict, the ADR/roadmap control and the conflict is called out explicitly below rather than silently resolved.

**Status:** Discovery only — planning artifact. No production code, route, event, schema, or migration was introduced by this document or by the Recovery Task (Task 20) that produced it. `activity` remains unchanged; `initiativeId` was not added to it; no `MemberActionRecorded` event was created.

**Produced by:** Architecture Recovery Task 20, building on Task 19's executable Activity boundary contract (`apps/api/test/unit/activity/activity-impact-archive-boundary.test.ts`) and the canonical Initiative ancestry chain recovered in Tasks 04–18.

---

## 1. Existing State

`apps/api/src/modules/activity` is a minimal, standalone, member-owned "civic participation trace" record:

- **Aggregate type:** `ACTIVITY_AGGREGATE_TYPE = "Activity"`, its own aggregate root, own `activityId` (server-generated `randomUUID()`), own Mongo collection `activities` (unique index on `activityId`, secondary indexes on `creatorMemberId`, `status`, `createdAt`, `visibility`, `activityType`, `aggregateVersion`).
- **Fields:** `activityId, creatorMemberId, title, description, activityType ("civic_participation" only), visibility (public/allies/working_group/private), status ("open" only), aggregateVersion, createdAt, updatedAt`. No `initiativeId`, no `impactId`, no `archiveId`, no source-artifact reference of any kind.
- **Lifecycle:** create-only. `ACTIVITY_STATUSES = ["open"]` — one status, no transition function exists anywhere in the module. No update, no close, no delete-by-id, no listing endpoint. Deletion helpers exist only as test-cleanup-by-prefix utilities (`deleteActivitiesByActivityIdPrefix`, `deleteActivitiesByCreatorMemberIdPrefix`), not production behavior.
- **Routes:** `POST /api/v1/activities` (JWT + verified-email required; 201/400/403/500) and `GET /api/v1/activities/:activityId` (JWT required; 200/401/403/404/500, creator-only — any other Member gets 403).
- **Idempotency/duplicate protection:** none beyond the random UUID. Two structurally identical creation requests produce two distinct records (confirmed by this task's new characterization tests).
- **Events:** exactly one, `ActivityCreated`, persisted transactionally with the record via `runMongoTransaction` + `enqueueDomainEvent` (outbox pattern). The event payload is narrower than the record — `activityId, creatorMemberId, title, activityType, visibility, status, createdAt` (no `description`, confirmed by this task's tests). Two catalogue names, `ActivityRevised` and `ActivityClosed`, are reserved in `CATALOGUE_EVENTS` but have zero producers anywhere in the codebase — dead, unimplemented vocabulary.
- **Production callers:** only the `workspace` module consumes `ActivityCreated` (`activity-created.workspace-handler.ts`), incrementing `WorkspaceParticipationSummary.activeActivityCount` by 1 per event. `completedActivityCount` and `awaitingMemberActionCount` are never incremented by anything — permanently `0`. No canonical `initiative-*` module imports from `activity` in either direction.
- **Frontend callers:** zero. No file under `apps/web/src` references `/api/v1/activities` or the Activity module's types. This matches the reconciliation report's classification of Activity as "Dead/unreachable from UI."
- **Fixtures/seed data:** none found; the only records ever created are through the route/service in tests.
- **Tests:** `test/unit/activity/{activity-persistence,create-activity-aggregate}.test.ts` (pre-existing), `test/integration/activity-create.test.ts` (Mongo-backed route/event/authorization coverage), `test/unit/workspace/activity-created-workspace-handler.test.ts`, plus this task's two new files.

## 2. Member-Action Inventory

| Action | Owning module | `participantId`/`memberId` | `initiativeId` | Own aggregate ID | Lifecycle | Canonical? | Append-only? | Emits event? | Public? |
|---|---|---|---|---|---|---|---|---|---|
| Comment on Initiative | `initiative-comments` | yes | yes, direct, mandatory | yes | active/edited/removed | Yes | No (editable) | No | Yes |
| Comment reaction | `initiative-comment-reactions` | yes | yes, direct, mandatory | yes | — | Yes | Yes (toggle) | No | Yes |
| Collaborative discussion / contribution / evidence | `initiative-collaborative-analysis` | yes | yes, direct, mandatory | yes | draft/published stages | Yes | Mostly | No | Yes (published) |
| Improvement proposal | `initiative-improvement-proposal` | yes | yes, direct, mandatory | yes | draft→submitted→… | Yes | No | No | Yes |
| Petition signing | `petition` | yes | yes (via Petition→Decision) | yes | signed/tally | Yes | Yes | No | Yes |
| Decision-session participation | `decision-session` | yes (steward) | yes, direct, mandatory (Task 08) | yes | draft/open/closed | Yes | No | No | Yes |
| Collective decision / vote | `initiative-collective-decision`, `initiative-decision-vote` | yes | yes, direct/transitive, mandatory (Tasks 09/12) | yes | draft/open/closed; vote cast/changed | Yes | Vote history append-only | No | Yes (aggregates) |
| Support signal (bookmark/view/registered/visitor support) | `initiative-support` | yes (or visitor key) | yes, direct, mandatory | no separate ID (keyed by initiativeId+actor) | — | Yes (own concept) | Mostly | No | No (internal signal) |
| Implementation commitment | `initiative-implementation-commitment` | yes | yes, transitive, mandatory (Task 15) | yes | draft→active→… | Yes | No | No | Yes (published) |
| Implementation tracking / updates | `initiative-implementation-tracking` | yes | yes, transitive, mandatory (Task 16) | yes | active→completed | Yes | Updates append-only | No | Yes (published) |
| Public impact creation | `initiative-public-impact` | yes | yes, transitive, mandatory (Task 17) | yes | draft→published→verified | Yes | No | No | Yes (published) |
| Civic archive publication | `public-civic-archive` | yes | yes, transitive, mandatory (Task 18) | yes | draft→published(+correction) | Yes | Corrections append | No | Yes (published) |
| Platform membership (joining Humanity Union) | `membership` | yes (`userId`) | **none — no `initiativeId` field exists** | yes | not_started→…→active_member | Yes | No | No | No (profile-level) |
| Member badge contribution (merchandise) | `member-badge-contribution` | yes | none | yes | requested→confirmed→shipped→delivered | Yes | No | No | No |
| Notifications | `notifications` | yes (recipient) | resolved transitively per-module (per ADR: "already correctly resolves `initiativeId` transitively") | yes | delivered/read | Derived (secondary) | Yes | No (consumer, not producer) | No |
| Global search index entries | `global-search` | n/a | per-entity, from `CivicEntityType` | n/a | rebuilt from source | Projection | Yes | No | Yes |
| Workspace projection | `workspace` | yes | none today (fed only by legacy Activity/Discussion/Proposal/Decision events) | yes (`workspace:<memberId>`) | materialized/pending | Projection | Yes (event-sourced) | No (consumer) | No (private) |
| Activity (existing) | `activity` | yes | **none** | yes | open only | Currently canonical for itself, but dead product-wise | No | Yes (`ActivityCreated` only) | No |
| Social Activity Score / Fair points | — | — | — | — | — | **Does not exist in code** | — | — | — |
| Collective Participation Journey | — | — | — | — | — | **Does not exist as a record** — only narrative UI copy referencing the canonical pipeline stages (`PetitionStatus.tsx`, `InitiativeContextSection.tsx` ×2) | — | — | — |

**Key finding:** every genuinely canonical, product-live Member action is already Initiative-scoped (directly or transitively) through its own canonical `initiative-*`/`petition`/`decision-session` module. `Activity` would **duplicate**, not merely index, any of these if it tried to become their source of truth — but it duplicates none of them today because it captures none of their content; it is a wholly separate, empty-of-real-content record type.

## 3. Initiative Relationship Classification (Part 4)

**Initiative-mandatory actions:** comment, comment reaction, collaborative analysis/contribution/evidence, improvement proposal, petition signature, decision-session participation, collective decision, vote, support signal, implementation commitment, implementation tracking update, public impact creation, civic archive publication. Initiative is resolved either directly (own `initiativeId` field) or transitively (validated ancestry chain, Tasks 15–18).

**Initiative-optional actions:** none were found where Initiative is sometimes present and sometimes absent on the *same* record type. Every Initiative-scoped module examined treats `initiativeId` as unconditionally mandatory.

**Non-Initiative actions:** platform membership/joining (`membership` — no `initiativeId` field at all), member badge contribution (merchandise purchase/shipping), account/email verification, authentication/session events (`MemberRegistered`, `MemberAuthenticated`, `SessionEnded`, `MemberVerified`, `MemberProfileUpdated`), and the existing `Activity` record itself (structurally incapable of referencing an Initiative today).

This directly means: **not every Member action is or should be Initiative-scoped.** The roadmap's Phase 4 event contract (`mandatory initiativeId` on every "Member-action event," per P4.1) is correct **only for the subset of actions that originate from `initiative-*` mutation points** — it must not be read as "every Member action anywhere on the platform requires an `initiativeId`." This is elaborated in §5 below.

## 4. Roadmap and ADR Meaning (Part 5)

Exact quotes:

- ADR §8 (line 104): *"Activity MAY support audit history, participation history, Workspace feeds, notifications, and Social Activity Score calculations, each of which reads from Initiative-scoped events rather than substituting for them."*
- ADR §12 (line 189): *"The Activity pipeline's infrastructure — the transactional outbox pattern, the domain-event envelope..., the idempotent handler-registry dispatch, and its associated automated test suite — is genuinely reusable and SHOULD be retargeted to serve the redefined Activity role: emitting a `MemberActionRecorded`-class event (or equivalent) whenever a Member performs a meaningful action within an Initiative's lifecycle..., with `initiativeId` as a mandatory field on every such event."*
- Roadmap Phase 4 (P4.1–P4.3): defines a 3-step plan — (1) define the Member-action event contract additively in `packages/types`; (2) **emit** it from each `initiative-*` service's existing mutation points, reusing (not modifying) Activity's outbox writer; (3) **retarget** Activity's own creation entry point to be *driven by* the new events instead of standalone client-initiated creation, explicitly noting *"existing Activity documents remain valid history"* (no migration).

Findings:

1. **`MemberActionRecorded` is explicitly illustrative, not a locked contract** — the ADR itself says "-class event (or equivalent)." This session's strict safety rule against creating it is consistent with the ADR's own phrasing.
2. **No event schema is defined anywhere in code** — `packages/types` has no `MemberAction`/`ParticipationRecord` type today.
3. **Activity is explicitly chosen as Phase 4's persistence owner** — P4.3 says Activity's own creation entry point is retargeted, not that a new module replaces it. This is a real, load-bearing roadmap decision, not just informal wording.
4. **No rename is indicated** — the roadmap never proposes renaming `activity`.
5. **No migration of legacy records is required or proposed** — P4.3 explicitly preserves "existing Activity documents... as valid history," implying coexistence (versioned/optional-field evolution), not a backfill or rewrite.
6. **Phase 4 does *not* actually assume every Member action platform-wide is Initiative-scoped** — P4.2's own example list ("join, contribute, submit evidence, support proposal, sign petition, participate in decision, accept commitment, record impact") is scoped to `initiative-*` service mutation points specifically, not to `membership`, `member-badge-contribution`, or auth/security actions. Read narrowly and consistently with ADR §8, the "mandatory `initiativeId`" applies to this one event *type* (Initiative-scoped Member actions), not to a platform-wide "every action needs an Initiative" rule. **However, the roadmap text does not say this explicitly** — a reader taking P4.1's "mandatory `initiativeId` on every such event" completely literally and unscoped could reasonably conclude the roadmap wants ALL Member actions funneled through one Initiative-mandatory event type, which is incompatible with `membership`/badge-contribution/auth actions ever being recorded that way. **This is a reportable ambiguity, not silently resolved here.**
7. **A second, narrower ambiguity:** P4.2 lists "join" as an example `initiative-*` mutation point, but no current `initiative-*` module implements an explicit "join this Initiative" action distinct from `initiative-support`'s bookmark/view/support signals. It is unclear whether the roadmap's "join" means joining the *platform* (`membership` — confirmed non-Initiative-scoped) or becoming an Initiative *participant* (a concept that does not have its own dedicated write-side module today). **This gap should be resolved by the roadmap's own authors/maintainers before Phase 4 implementation, not inferred here.**
8. **Phase 4 documentation is internally consistent otherwise** and does not contradict the recovered Initiative model — it predates only the *proof* of that model (Tasks 04–19), not its substance.

**Social Activity Score / Fair points / Collective Participation Journey:** all three are documentation/UI-copy-only concepts. No calculation, storage, or scoring code exists anywhere in `apps/api` or `apps/web`. "Collective Participation Journey" appears three times in frontend copy purely as narrative framing of the existing canonical pipeline stages (Petition, Implementation Commitment, Implementation) — it is not a record, table, or projection.

## 5. Event Architecture (Part 8) — Coverage Matrix

| Producer module | Event(s) | Member ID | Initiative ID | Source artifact ID | Replay-safe |
|---|---|---|---|---|---|
| `member` | `MemberRegistered` | yes | n/a | n/a | Yes (`(consumerId, eventId)` claim, see below) |
| `activity` (legacy, dead) | `ActivityCreated` | yes | **no** | n/a | Yes |
| `discussion` (legacy, dead) | `DiscussionCreated` | yes | no | n/a | Yes |
| `proposal` (legacy, dead) | `ProposalCreated`, `ProposalSubmitted` | yes | no | n/a | Yes |
| `decision` (legacy, dead) | `DecisionOpened`, `DecisionApproved`, `DecisionRejected`, `DecisionReturnedForRevision` | yes | no | n/a | Yes |
| **every `initiative-*` module** (comments, collaborative-analysis, improvement-proposal, decision-vote, collective-decision, support, implementation-commitment, implementation-tracking, public-impact) | **none** | — | — | — | — |
| `public-civic-archive` | none | — | — | — | — |
| `petition`, `decision-session` | none | — | — | — | — |

**Critical gap:** `enqueueDomainEvent` (the only production call site of the outbox writer) is invoked from exactly five modules: `activity`, `discussion`, `proposal`, `decision`, and `member`. **Zero canonical `initiative-*` modules, `petition`, `decision-session`, or `public-civic-archive` emit any domain event.** The entire outbox/event/idempotent-dispatch infrastructure that the ADR calls "genuinely reusable" is, today, wired exclusively to the legacy, dead Activity pipeline plus member registration. `workspace`'s handler registry (`registerWorkspaceProjectionHandlers`) confirms this independently — it only registers handlers for `MemberRegistered`, `ActivityCreated`, `DiscussionCreated`, `ProposalCreated`, `ProposalSubmitted`, `DecisionOpened`.

**Consequence for this task's design space:** "Candidate D — pure projection from existing events" (Part 3) and "Strategy A/B/C event-based ancestry resolution" (Part 9) are **not implementable today without first adding event emission to every canonical `initiative-*` module** — a change explicitly forbidden by this task's safety rules ("Do not create new production events"). Any Member Action design that depends on canonical events existing has an unmet prerequisite that must be satisfied by a *separate*, prior recovery task (see §9 "Prerequisites").

**Idempotent consumption pattern (already proven, reusable as-is):** `apps/api/src/infrastructure/outbox/processed-events.repository.ts` implements dedup via a unique `(consumerId, eventId)` claim record with `processing`/`completed`/`failed` states and stale-claim reclaim (5-minute staleness window). This is the correct, already-battle-tested idempotency key pattern for any future Member Action consumer — no new idempotency mechanism needs to be invented.

## 6. Candidate Domain Concepts (Part 3) — Assessment

- **Candidate A (generic Activity aggregate, as-is):** stale-prone by construction — nothing keeps it consistent with the canonical action it nominally represents, because it captures no reference to that action at all. Not recommended as a permanent end state.
- **Candidate B (Member Action ledger entry):** the right *shape* (`memberId, initiativeId?, actionType, sourceArtifactType, sourceArtifactId, occurredAt`) for a derived, append-only, rebuildable, source-event-identity-preserving record — but requires canonical events to exist first (see §5 gap).
- **Candidate C (Initiative participation record, `initiativeId` mandatory):** correct for the Initiative-scoped subset of actions (§3 table), but would incorrectly exclude legitimate non-Initiative Member actions (membership, badge contribution) if treated as the *only* Member-action concept.
- **Candidate D (pure rebuildable projection, no write-side aggregate):** architecturally the cleanest long-term answer for "participation timeline" / "Collective Participation Journey" display purposes — but cannot be built today because the source events it would rebuild from do not exist yet (§5).
- **Candidate E (Social Activity Score input ledger):** no current requirement to build this now — no scoring logic exists in production, and ADR §8 explicitly frames scoring as a future *reader* of "Initiative-scoped events," not a co-equal write path. Should remain a distinct, later concept, not conflated with the participation ledger itself (Part 15's stated principle applies: distinct responsibilities, not a shared record type).
- **Candidate F (audit log):** already served by existing per-module domain errors/logging and the `civic_compatibility_reviews`/`civic_accountability` machinery; not this task's concern and must not be conflated with a public-facing participation journey.

**Conclusion: more than one concept is genuinely needed, and they must not be collapsed into one record type:**
1. A **Member Action ledger** (Candidate B/C hybrid: `initiativeId` mandatory *when* the action is Initiative-scoped, optional/absent otherwise) — future write-side, event-consumer-created, append-only, deduplicated by source event ID.
2. A **participation timeline/journey projection** (Candidate D) — rebuildable read model over the ledger (or, until canonical events exist, over direct reads of canonical aggregates), used for "Collective Participation Journey" UI and Workspace feeds.
3. A **future, separate Social Activity Score ledger** (Candidate E) — out of scope for now, explicitly not to be built by extending the Member Action ledger's row shape.

## 7. Canonical Source of Truth (Part 7)

Required rule, confirmed as a hard constraint by this discovery: **a Member Action record must never become the authoritative record of the underlying action.** Concretely:

```text
Vote aggregate (initiative-decision-vote)     = authoritative
Comment (initiative-comments)                 = authoritative
Implementation Commitment/Tracking            = authoritative
Public Impact / Public Civic Archive          = authoritative
Member Action ledger entry (future)           = secondary, derived, rebuildable, disposable
```

Member Action entries must be: rebuildable (from source events, once they exist) or disposable, eventually consistent, outbox-driven (event-consumer-created — see Part 12 below), and deduplicated by source event ID via the existing `(consumerId, eventId)` claim pattern. They must never be transactionally co-written with the canonical action itself in a way that makes the ledger a second point of write-side truth for that action — this would recreate exactly the dual-authority problem this task is designed to prevent.

## 8. Reuse Feasibility of Existing Activity (Part 6)

| Dimension | Assessment |
|---|---|
| Field compatibility | High — new fields (`initiativeId?`, `sourceArtifactType?`, `sourceArtifactId?`) can be added as optional without breaking `ActivityRecord` consumers, since none exist outside the module and its one workspace consumer. |
| ID compatibility | High — `activityId` stays the aggregate ID; no conflict with any canonical ID space. |
| Collection compatibility | High — dedicated `activities` collection, no shared writers. |
| Lifecycle compatibility | Medium — currently one static status; a ledger entry doesn't need more, but must decide whether "open" still means anything for a derived record. |
| Immutability | Currently mutable-by-schema (has `updatedAt`) but never actually updated — compatible with becoming append-only in practice. |
| Source reference support | **None today** — must be added (additively, optional) to support a real Member Action ledger; this is the main gap. |
| Initiative identity support | **None today** — must be added (additively, optional, present only for Initiative-scoped source actions) per §3's classification. |
| Idempotency support | **None today** (confirmed by this task's new tests) — must be added using the existing `(consumerId, eventId)` claim pattern, not invented fresh. |
| Event identity support | Partial — `ActivityCreated`'s `eventId` is derived from `activityId`, not from any source event; a ledger entry would need to preserve/reference the *source* event's ID separately. |
| Ordering support | `createdAt` exists; sufficient for chronological ordering. |
| Correction support | None today; not required if the ledger is treated as disposable/rebuildable. |
| Authorization model | Creator-private, route-enforced; would need revisiting if entries become event-consumer-created rather than user-submitted (see Part 12). |
| Privacy/query model | Currently owner-only fetch-by-id, no listing; a participation timeline needs listing by member and possibly by Initiative — not present today. |
| Projection rebuildability | Not currently rebuildable from anything (it *is* the source); becoming a projection target changes this role fundamentally. |
| Scoring suitability | Not evaluated for production use; no scoring exists. |

**Reuse Model selected for reporting purposes: B — Versioned/coexisting schema.** The roadmap's own P4.3 ("existing Activity documents remain valid history... no data migration") is functionally Reuse Model B: legacy standalone-created documents (no `initiativeId`, no source reference) and future event-derived documents (optional `initiativeId`, `sourceArtifactType`, `sourceArtifactId`) coexist in the same collection, distinguished only by which optional fields are populated — no discriminator field is strictly required if the new fields are always optional and consistently present/absent by era, but a lightweight `schemaVersion` or `sourceEventId` presence check is a cheap, safe way to distinguish them if needed later. This does **not** contradict Model A ("extend in place") — B is really "A, done carefully, with an explicit compatibility note," not a separate mechanism.

## 9. Migration Option Matrix (Part 18)

| Option | Domain clarity | Initiative ancestry | Compatibility | Migration risk | Idempotency | Replay | Scoring readiness | Privacy | Query perf | Effort | Ops complexity |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1. Keep Activity unchanged | Low (stays empty/unused) | N/A | Perfect | None | N/A | N/A | Poor | N/A | N/A | None | None |
| 2. Extend Activity into Member Action (Model A/B) | Medium — reuses a name with historical baggage | Optional, correct per §3 | High (additive only) | Low | Must add | Must add | Fair | Needs new visibility rules | Needs new indexes (by initiativeId, memberId) | Medium | Low |
| 3. New Member Action module, Activity retained as legacy | High — clean separation | Optional, correct | High (Activity untouched) | Low | Must add | Must add | Fair | Clean slate | Clean slate | Medium-High | Medium (two modules to maintain) |
| 4. Pure event-derived projection, no new write-side aggregate | Highest | Correct by construction | High | Low | N/A (derived) | Depends entirely on event coverage | Good, if events exist | Clean | Depends on projection design | **Blocked — canonical events don't exist yet (§5)** | High until §5's gap is closed |
| 5. Hybrid: durable normalized ledger + consumer projections | High | Correct, explicit per-row | High | Low-Medium | Native (source event ID) | Native | **Best** — durable ledger is the natural score input | Filterable per consumer | Best (ledger indexed once, projections tailored) | High | Medium-High |

**Recommended option: 5 — Hybrid ledger + projections**, with Option 2/3's decision (whether the ledger literally lives inside the `activities` collection or a new collection) deliberately left open pending an ADR/roadmap clarification (see §10), because the roadmap's own P4.3 text points at Option 2/3-as-B while sound architectural practice (Part 7's "never dual-authority" rule, this task's own Candidate D analysis) points toward eventually treating "journey" *views* as pure projections (Option 4/5) once canonical events exist. Option 5 is compatible with either choice at the persistence layer and does not foreclose it.

## 10. Compatibility and Prerequisites

**Legacy persistence compatibility (Part 14):**

| Option | Legacy reads | Legacy writes | New records | Migration required | API compatibility | Risk |
|---|---|---|---|---|---|---|
| Add optional fields to `ActivityRecord`/Mongo doc | Unaffected (confirmed: `fromActivityMongoDocument` ignores unknown extra fields today — see this task's new test) | Unaffected | Fully supported | **No** | Preserved if DTO mapping stays additive-only | Low |

**No production changes were necessary or made in this task.** No narrow defect (per Part 19's criteria — doc/code contradiction, false-ancestry test claim, wrong vocabulary import, or dead code resolving Activity as a civic artifact) was found. `CATALOGUE_EVENTS.activityRevised`/`activityClosed` are unused/reserved, not incorrect.

**Prerequisites before any Phase 4 implementation can begin:**
1. Resolve the ambiguity in §4 finding 6/7 (scope of "mandatory `initiativeId`"; meaning of "join") — a roadmap/ADR clarification, not a code change.
2. Add domain-event emission to the canonical `initiative-*` modules (a large, separate recovery task — currently **zero** of them emit events; this is the single largest blocker to any event-derived Member Action or "Candidate D" projection design).
3. Decide, via ADR or roadmap addendum, whether the Member Action ledger's persistence home is the existing `activities` collection (Option 2/3-B) or a new collection (Option 3) — both are compatible with this discovery's recommendation but have not been decided here, per this task's explicit prohibition on implementing Phase 4 based on roadmap wording alone.
4. Design (in a future task) the authorization model change implied by Part 12: today Activity is exclusively user-submitted; a Member Action ledger populated by domain-service/event-consumer writes needs a different authorization posture (no client-supplied action records) to prevent self-reported/duplicated entries from ever affecting future scoring.

## 11a. Addendum — Corrections from Parallel Research

Four background research passes were run in parallel with this document's authoring and completed afterward. Cross-checking them against the analysis above surfaced one genuine correction and three refinements (no change to the recommendation in §9):

1. **Correction — a `FairBalance` field already exists on `Member`, but it is completely inert.** `packages/types/src/domain/member.ts` defines `FairBalance { personal, community, regional, global }` and `Member.fair: FairBalance`. Every construction site in production code and every verification-script fixture hardcodes it to `{ personal: 0, community: 0, regional: 0, global: 0 }` (confirmed by repo-wide search: zero assignments of a non-zero value, zero increment/update functions anywhere). `implementation/08_BACKEND_IMPLEMENTATION_PLAN.md` independently flags it as *"Legacy FairBalance model — Not compatible with ImpactAssessment — LOW"* priority. This does not change §6's conclusion ("no scoring logic exists in production") but the precise statement is: **a placeholder field exists structurally; no calculation, mutation, or scoring logic exists anywhere** — it should be treated as legacy/inert, not as a foundation for a future Social Activity Score ledger.
2. **Refinement — canonical `initiative-*` modules are not entirely event-silent.** They call `emitCivicNotificationEvent(...)` at mutation points (e.g. `proposal_submitted`, `analysis_published`, `archive_published`) — a direct, synchronous notification side-effect. This is categorically different from, and does not substitute for, the transactional outbox/`DomainEvent`/idempotent-dispatch infrastructure (`enqueueDomainEvent`) that §5's gap analysis concerns — `emitCivicNotificationEvent` is not persisted to the `outbox` collection, has no `eventId`-based dedup, and is not replayable. §5's core finding (zero canonical modules use the reusable, ADR-referenced outbox infrastructure) stands unchanged; only the phrasing "emits no event of any kind" should be read precisely as "emits no durable, replayable, dedup-capable domain event."
3. **Refinement — the legacy Activity→Discussion→Proposal→Decision chain is more tightly coupled than a single event link.** Beyond `workspace` consuming `ActivityCreated`, the legacy `discussion`, `proposal`, and `decision` modules directly import `ActivityRecord`/`ActivityVisibility` types and call `findActivityById` from `apps/api/src/modules/activity` (e.g. `discussion/application/create-discussion.service.ts`, `proposal/application/{create,submit}-proposal.service.ts`). This is exactly the "Activity roots Discussion/Proposal/Decision" structure ADR §12 documents as the conflict to retire — it does not involve any canonical `initiative-*` module and does not change this document's recommendation.
4. **Minor doc/code naming drift (informational only):** `engineering/01_SYSTEM_ARCHITECTURE.md`'s Activity Context section names its illustrative published events `ActivityPublished`/`ActivityCorrected`, while the actual reserved-but-unused catalogue entries in code are `ActivityRevised`/`ActivityClosed` (`catalogue-events.ts`). Neither pair is implemented; this is a documentation-vocabulary inconsistency worth resolving whenever Phase 4 actually defines the event contract, not a code defect to fix now.

## 11. Non-Goals of This Document

This document does not: select Option 2 vs. 3 vs. 5's exact collection layout; define the `MemberActionRecorded` (or equivalent) event schema; add `initiativeId` to Activity; add any new event producer; implement scoring; implement the Collective Participation Journey UI/projection; or migrate any existing data. All of these are explicitly deferred to future, narrowly-scoped recovery tasks once the prerequisites in §10 are satisfied.
