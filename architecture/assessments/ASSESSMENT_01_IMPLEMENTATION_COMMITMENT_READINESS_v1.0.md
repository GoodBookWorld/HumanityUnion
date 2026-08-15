# Assessment 01 — Implementation Commitment Architecture Readiness v1.0

**Authority:** `architecture/ARCHITECTURE_EVOLUTION_ROADMAP_v2.0.md` §"Approved Assessment Backlog" (Assessment 01) and §"Architecture Assessment Pipeline" ("No implementation begins without completing the assessment."). Governed by `ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md`, `ADR-MEMBER-ACTION-LEDGER-v1.0.md`, `architecture/DEVELOPMENT_BASELINE.md`, and the proven Vote assessment/recovery arc (Recovery Tasks 28 → 31 → 32 → 33), whose gate-based method this assessment reuses.

**Status:** Discovery/assessment artifact only. No production code, route, event, catalogue entry, Mongo index, or domain type was added, removed, or modified by this assessment. Every claim below is backed by direct source citation and/or an existing, independently re-run passing test (`initiative-implementation-commitment-ancestry.test.ts`, 14/14 passing in isolation — see §11).

**Verdict:** **Not ready for durable-event or Participant Action Ledger work — and not for the reason Vote was.** The canonical module (`initiative-implementation-commitment`) is architecturally close to Vote's pre-Task-31 state (file/Mongo-mirror persistence, no transactions, no unique indexes, no history log) and would fail the same persistence/transaction/duplicate gates. But a **prior, higher-priority problem exists that Vote and Petition never had**: the canonical module has **zero live mutation route** — no HTTP endpoint anywhere calls `createInitiativeImplementationCommitmentDraft`, `publishInitiativeImplementationCommitment`, `withdrawInitiativeImplementationCommitment`, or `completeInitiativeImplementationCommitment`. All real user-facing write traffic for "Implementation Commitment" today flows through a **second, mounted, competing module** (`apps/api/src/modules/implementation-commitment`, the older "Stage" pipeline, already classified **C — Transitional, live mutation UI** by `ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md` §14) whose aggregate has no relationship whatsoever to Initiative ancestry. See §1 and §10.

---

## 1. Current Flow — Two Competing Live Modules

```text
CANONICAL (Initiative-rooted, ancestry-hardened, Recovery Task 15):
route (write):     NONE MOUNTED
route (read):      GET /api/v1/initiative-implementation-commitments/mine  (authenticated, own records only)
                   GET /api/v1/initiative-implementation-commitments/:commitmentId          (public, if published/withdrawn/completed)
                   GET /api/v1/initiatives/:initiativeId/implementation-commitments         (public)
                   GET /api/v1/initiative-collective-decisions/:decisionId/implementation-commitments (public)
service:           initiative-implementation-commitment.service.ts
                   createInitiativeImplementationCommitmentDraft / update.../publish.../withdraw.../complete...
                   — all five mutation functions exist, but are called ONLY by verification scripts
                     and the one ancestry test file (grep-confirmed, §1a below); never by any route.
store:             initiative-implementation-commitment.store.ts — in-memory Map<commitmentId, Commitment>
persistence:       file (default) | memory | mongodb (env INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE)
Mongo adapter:     createMongoSnapshotPersistence — same fire-and-forget mirror as pre-Task-31 Vote
transaction:       NONE — grep for runMongoTransaction/ClientSession/withTransaction across the module: 0 hits

LEGACY / OLD-STAGE ("implementation-commitment", ADR Classification C):
route (write):     POST   /api/v1/implementation-commitments
                   PATCH  /api/v1/implementation-commitments/:commitmentId
                   POST   /api/v1/implementation-commitments/:commitmentId/submit
                   POST   /api/v1/implementation-commitments/:commitmentId/activate
                   POST   /api/v1/implementation-commitments/:commitmentId/contribution-profile
                   POST   /api/v1/implementation-commitments/:commitmentId/contribution-items
                   POST   /api/v1/implementation-commitments/:commitmentId/contribution-items/:itemId/remove
                   POST   /api/v1/implementation-commitments/:commitmentId/contribution-items/:itemId/withdraw
                   POST   /api/v1/implementation-commitments/:commitmentId/withdraw
                   POST   /api/v1/implementation-commitments/:commitmentId/complete
                   POST   /api/v1/implementation-commitments/:commitmentId/archive
service/store:     implementation-commitment.store.ts — depends directly on
                   collective-decision.store.ts (old Stage, untyped-reference, ADR Classification D),
                   petition.store.ts (old Stage, NOT the Recovery-Task-23/24-hardened Petition),
                   member.member-access.ts (Member, not Participant, lookups)
both mounted in:   apps/api/src/app.ts lines 205–206 and 222–223, simultaneously, at all times
```

**§1a — verified call sites of the canonical mutation functions** (`grep -rl` across `src/scripts/` and `test/`):

| Caller | Kind |
|---|---|
| `verify-civic-archive-e2e.ts`, `verify-civic-archive-lifecycle-e2e.ts`, `civic-archive-verification-fixture.ts` | verification script / fixture |
| `verify-initiative-public-impact-e2e.ts` | verification script |
| `verify-capability02-integration-e2e.ts` | verification script |
| `verify-global-search-e2e.ts`, `verify-grouped-search-pagination-e2e.ts` | verification script |
| `verify-initiative-implementation-commitment-e2e.ts`, `verify-initiative-implementation-tracking-e2e.ts` | verification script |
| `initiative-implementation-commitment-ancestry.test.ts` | the one real test file for this module |

Zero non-test, non-script callers exist. **The canonical Implementation Commitment lifecycle, as it exists today, is a service-layer capability with no product surface** — every "commitment" any real user has ever created through the live app was created through the *other* module, against an aggregate with no Initiative ancestry at all.

This is a materially different starting condition than Vote or Petition had at their respective Assessment/Recovery Task 28/22 starting points: both of those already had a real, single, mounted write route on the canonical aggregate. Implementation Commitment does not.

---

## 2. Authoritative Aggregate (Canonical Module)

`InitiativeImplementationCommitment` (`packages/types/src/domain/initiative-implementation-commitment.ts`) is an independent aggregate, not embedded in Initiative or Collective Decision.

| Field | Present? | Notes |
|---|---|---|
| Aggregate identity | `commitmentId: string` | `implementation-commitment-${Date.now()}-${random}` — **not deterministic**, same non-idempotent pattern Vote had pre-Task-31 |
| Participant ID field | `participantId: MemberId` | Field **name** is canonical (`participantId`); declared **type** is the legacy `MemberId` alias — same "correct name, legacy-typed alias" pattern already documented for Vote/Petition pre-Task-26. No `memberId`, `actorId`, or other ambiguous name is used anywhere in this module. |
| Initiative ID field | `initiativeId: InitiativeId` | Present, **direct** (not derived) |
| Decision ID field | `decisionId: InitiativeCollectiveDecisionId` | Present, mandatory |
| Status | `status: "draft" \| "published" \| "withdrawn" \| "completed"` | Present, with an explicit transition table (`INITIATIVE_IMPLEMENTATION_COMMITMENT_TRANSITIONS`) and terminal-state guard (`isInitiativeImplementationCommitmentTerminal`) |
| Timestamps | `createdAt`, `updatedAt`, `publishedAt?`, `withdrawnAt?`, `completedAt?` | Present |
| History / audit log | **Absent** | Unlike Vote (which has a separate, genuinely append-only `InitiativeDecisionVoteHistoryEntry` collection), Implementation Commitment has **no** parallel history collection of any kind. Every status transition is a blind, untracked overwrite (§7). |

---

## 3. Persistence Classification — same class as pre-Task-31 Vote

**Classification: B (file/snapshot) by default; C (fire-and-forget Mongo mirror) when `INITIATIVE_IMPLEMENTATION_COMMITMENT_PERSISTENCE=mongodb` is set. Never D or E.**

- Default mode: file (`resolveInitiativeImplementationCommitmentPersistenceAdapter` defaults to `"file"` when the env var is unset — confirmed against source, same three-way switch pattern as every pre-recovery `initiative-*` module).
- Mongo mode: `createMongoInitiativeImplementationCommitmentPersistenceAdapter` wraps `createMongoSnapshotPersistence` — the exact same helper Vote used pre-Task-31, whose `save()` is fire-and-forget by construction (in-memory cache updated synchronously, Mongo write kicked off via `.catch(...)` without being awaited by the caller).
- No `ClientSession`, `withTransaction`, or `runMongoTransaction` call exists anywhere in the module (confirmed by `grep`, zero hits — §1).
- No unique index exists on this collection at all — `mongo-indexes.ts` declares five **non-unique** indexes for `initiative_implementation_commitments` (`initiativeId`, `decisionId`, `participantId`, `status`, `updatedAt`), and **not even `commitmentId` itself is uniquely indexed** at the database level. This is a strictly weaker state than Vote's pre-Task-31 baseline, which at least had non-unique indexes plus one (dead) `status` index reference; here every index is live and correctly named, but none enforces uniqueness.
- Repository: none in the Petition/Participant-Action sense — module-level singleton `Map`, loaded once at process start, mutated in memory; the Mongo mirror is a side effect, not the read path.
- Insert/update semantics: keyed upsert by `commitmentId` (`Map.set`) — the store has no insert-vs-update distinction.

---

## 4. Initiative Ancestry — already hardened, but correction to a prior recovery document

| Question | Answer |
|---|---|
| Does Commitment carry `initiativeId` directly? | **Yes** — direct, typed, mandatory field |
| Is ancestry direct or transitive? | **Direct** (`validateDirectInitiativeAncestry`), **not transitive**. `CreateInitiativeImplementationCommitmentDraftInput` supplies its own independent `initiativeId` *and* a mandatory `decisionId`; the Decision-consistency check (`decision.initiativeId === ancestry.initiativeId`) is a **separate** invariant on top of ancestry, not ancestry derivation itself. |
| Is the Decision itself validated? | **Yes** — `assertEligibleDecision` resolves the real Collective Decision and enforces `decision.status === "closed"` plus the Initiative-match invariant, throwing a dedicated `ImplementationCommitmentInitiativeMismatchError` for the mismatch case (Recovery Task 15) |
| Is ancestry revalidated on every mutation, or only at creation? | **Only at creation.** `updateInitiativeImplementationCommitmentDraft`/`publish.../withdraw.../complete...` all resolve the commitment by ID and check ownership (`commitment.participantId === identity.participantId`), but perform no further Initiative/Decision re-validation — acceptable, since ancestry fields are immutable post-creation and no code path can change them. |

**Correction:** `architecture/recovery/RECOVERY_STATUS.md`'s Recovery Task 15 row currently reads "Enforced canonical (transitive) Initiative ancestry in `initiative-implementation-commitment`". Direct source inspection (`initiative-implementation-commitment.service.ts`'s own doc comment, quoted verbatim: *"Ancestry is DIRECT (`validateDirectInitiativeAncestry`). `validateTransitiveInitiativeAncestry` does not apply..."*) shows this ancestry is **direct**, not transitive. This is a documentation inaccuracy introduced during the Recovery Closure Task's summarization, not a code defect. Recommended fix: a one-line correction to that row (see §12).

---

## 5. Duplicate and Concurrency Guarantees — no enforcement at any layer

- **No uniqueness check exists at all**, application- or database-level, for "one active draft per (initiativeId, decisionId, participantId)". The module's own regression test explicitly characterizes and accepts this: `"preserves the existing 'no duplicate protection' rule: a second commitment for the same Decision also persists"` (`initiative-implementation-commitment-ancestry.test.ts`).
- Cardinality is unconstrained: 0..N commitments per Decision, 0..N per Initiative, 0..N per (Decision, Participant) pair — a single participant may create unlimited drafts for the same Decision with no rejection, no merge, and no warning.
- `commitmentId` is generated fresh per call (`Date.now()-random`), so even a client-side retry race can independently create two drafts for what the user experienced as one submission — the same class of gap Recovery Task 24 fixed for Petition Signature with a real unique compound index, and the same class of gap Recovery Task 28 found (and Task 31 fixed) for Vote.
- This is strictly worse than Vote's pre-Task-31 state: Vote at least had an in-memory `Map` keyed on `"decisionId::participantId"` providing a single-process, best-effort "one active vote per participant per decision" guard. Implementation Commitment has **no equivalent in-memory guard of any kind** — the duplicate-vote race Vote had to defend against does not even have an application-layer mitigation here.

---

## 6. Commitment Mutability

| Capability | Supported? |
|---|---|
| Draft → Published | Yes, `publishInitiativeImplementationCommitment`, one-way, sets `publishedAt` |
| Draft → Withdrawn | Yes, `withdrawInitiativeImplementationCommitment` |
| Published → Withdrawn | Yes, same function, transition table allows it |
| Published → Completed | Yes, `completeInitiativeImplementationCommitment`, sets `completedAt` |
| Edit draft fields (title/summary/scope/dates/org) | Yes, `updateInitiativeImplementationCommitmentDraft`, but **only** while `status === "draft"` (`assertDraftEditable`) |
| Edit fields after publish | **No** — no mutation path exists once published |
| Re-open a terminal commitment (`withdrawn`/`completed`) | **No** — `isInitiativeImplementationCommitmentTerminal` blocks all further transitions unconditionally |
| Any transition history / audit trail | **No** — every transition is `commitments.set(commitmentId, ...)`, a blind overwrite; there is no parallel append-only log recording that a transition happened, when, or from what prior status (contrast with Vote's `InitiativeDecisionVoteHistoryEntry`) |

**Consequence for future event design (do not implement now, per this assessment's scope):** because there is no history log at all, a future durable-event design for this module would need to derive its "changed" semantics purely from the status-transition table itself (`draft→published`, `published/draft→withdrawn`, `published→completed`), each as its own discrete event type — there is no existing "Changed" concept to reuse the way Vote's `InitiativeDecisionVoteChanged` could reuse the existing `HistoryEntry` shape. Candidate event names, sketched only, not implemented: `InitiativeImplementationCommitmentPublished`, `InitiativeImplementationCommitmentWithdrawn`, `InitiativeImplementationCommitmentCompleted`. Draft creation and draft edits are lower-value candidates for durable events (drafts are private, pre-decision, and mutable-until-published; the Participant Action Ledger's existing precedent — one fact per completed public action — argues for emitting only at `published`, at minimum, mirroring why Petition emits on `signed`, not on an intermediate state).

---

## 7. Participant Identity

Consistent with Vote and Petition: `participantId` is used correctly and exclusively (route → service → store), declared with the legacy `MemberId` type alias but never confused with `memberId`/`actorId`/`voterId`. No new naming defect exists in this module beyond the repo-wide alias issue already tracked by Recovery Task 26/`TECHNICAL_DEBT.md`.

One exception worth flagging: `publishInitiativeImplementationCommitment` calls `emitCivicNotificationEvent({ ..., actorMemberId: identity.participantId })` — the notification input field is literally named `actorMemberId` even though the value passed is `identity.participantId`. This is a pre-existing naming leak in the **notifications** module's input contract (`CivicNotificationEventInput`), not something Implementation Commitment introduced; it is the same class of "correct value, legacy-named field" issue documented elsewhere, and is out of scope to fix here.

---

## 8. Transaction Boundary — fails, same as pre-Task-31 Vote

No `ClientSession`, no `withTransaction`, no `runMongoTransaction` anywhere in `apps/api/src/modules/initiative-implementation-commitment/` (grep-confirmed, zero hits). Every mutation is: read from in-memory `Map` → mutate in place → fire-and-forget Mongo mirror. A crash between the in-memory mutation and the Mongo write completing loses the write with no retry, no compensating record, and no signal to the caller (who already received a 200-equivalent success from the in-process read).

---

## 9. Durable Event Infrastructure — absent

- No `CATALOGUE_EVENTS` entry exists for any Implementation Commitment event today (`grep` for `ImplementationCommitment` in `catalogue-events.ts`: zero hits) — a clean slate, unlike Activity's dead reserved-but-unused event names.
- The only "event-like" signal this module emits is `emitCivicNotificationEvent(...)` on publish, which is fire-and-forget (`.catch()`, never awaited, errors swallowed — confirmed by reading `notification.service.ts`), non-durable, and explicitly not routed through the transactional outbox (`enqueueDomainEvent`/`CATALOGUE_EVENTS`). This is the same class of non-durable signal `ADR-MEMBER-ACTION-LEDGER-v1.0.md` already rules out as a Participant Action ingestion source (§13 of that ADR) — consistent with, not a new exception to, existing architecture policy.
- No downstream consumer exists that treats any Implementation Commitment state change as a durable fact.

---

## 10. Downstream Coupling — call-site fan-out

Three in-process call sites read directly from `initiative-implementation-commitment.store.ts`'s `getCommitmentById`:

| Caller | Module |
|---|---|
| `initiative-implementation-tracking-eligibility.ts` | Implementation Tracking (Assessment 02) |
| `initiative-implementation-tracking.service.ts` | Implementation Tracking (Assessment 02) |
| `public-initiative-implementation-tracking.routes.ts` | Implementation Tracking (Assessment 02) |

Any future repository/interface change to the canonical module (e.g. introducing a Mongo-transactional repository to replace the in-memory `Map`, per §3) must preserve `getCommitmentById`'s existing synchronous, no-lookup-failure-on-missing contract for these three call sites, exactly as Recovery Task 31 had to preserve Vote's store-level read functions for its own downstream callers. This is a dependency to account for in a future persistence-recovery task's design, not a blocker to this assessment's conclusions.

---

## 11. Verification

Re-ran the module's only existing test file in the repository's real isolation harness (not a standalone `node --test`, which produces a spurious cross-test-file `unhandledRejection` failure unrelated to this module — the same MONGODB_TEST_DATABASE isolation nuance documented in `INITIATIVE_DECISION_VOTE_PARTICIPANT_ACTION_PRODUCER_READINESS_v1.0.md` §20.20):

```text
MONGODB_TEST_DATABASE="hu_test_assessment01_check" node --import tsx \
  --import ./test/helpers/test-setup.ts --test --test-concurrency=1 --test-force-exit \
  test/unit/initiative-implementation-commitment/initiative-implementation-commitment-ancestry.test.ts

tests 14 / pass 14 / fail 0
```

All 14 pre-existing ancestry characterization tests (Recovery Task 15) pass unmodified. No code was changed by this assessment.

---

## 12. Readiness Gates Summary

| Gate | Requirement | Result |
|---|---|---|
| 1 | Single, unambiguous, canonical live mutation surface | **FAIL** — two mounted modules; the canonical one has zero live write route; all real write traffic hits the non-canonical legacy aggregate |
| 2 | Initiative ancestry integrity | **PASS** (Recovery Task 15; correction filed in §4 re: direct vs. transitive) |
| 3 | Participant-first identity naming | **PASS** (same repo-wide `MemberId` alias caveat as every other module) |
| 4 | Deterministic/idempotent aggregate identity | **FAIL** — `Date.now()-random`, not derived from a stable key |
| 5 | Database-enforced duplicate/concurrency protection | **FAIL** — no unique index at all, not even on `commitmentId` itself |
| 6 | Transactional persistence | **FAIL** — no transactions anywhere, fire-and-forget Mongo mirror |
| 7 | Durable event infrastructure | **FAIL** — no events, no outbox integration; only a non-durable notification ping |
| 8 | Append-only history / audit trail | **FAIL** — no history collection; every transition is a blind overwrite |
| 9 | Self-contained event payload feasibility (zero future source lookups) | **PASS (design-feasible)** — the aggregate already carries `initiativeId`, `decisionId`, `participantId`, and `status`/timestamps directly; a future event would not need any additional lookup beyond what §6's candidate event list already assumes |
| 10 | Downstream call-site safety | **PASS (tracked, not blocking)** — exactly 3 known call sites, all read-only, all documented in §10 |

**5 of 10 gates fail**, and Gate 1's failure is structurally prior to and independent of Gates 4–8 — fixing persistence/transactions/events on the canonical module would still leave real users mutating a different, non-canonical aggregate that no future event or Participant Action projection would ever observe.

---

## 13. Candidate Participant Action Ledger Projection — design sketch only, not implemented

Per `MEMBER_ACTION_LEDGER_IMPLEMENTATION_BLUEPRINT_v1.0.md`'s established pattern (Petition and Vote as producers #1–#2), a third producer for Implementation Commitment would, once Gates 1, 4–8 are closed, plausibly need:

- New `ParticipantActionType` members: `initiative_implementation_commitment_published`, `_withdrawn`, `_completed` (mirroring §6's candidate event list — draft creation/edits are deliberately excluded from the Ledger, consistent with the Ledger's existing "durable public fact" scope, not private draft state).
- New `ParticipantActionSourceType`: `initiative_implementation_commitment`.
- Deterministic `participantActionId = participant-action:${sourceEventId}`, unchanged formula.
- Metadata shape (discriminated union member): `{ kind: "initiative_implementation_commitment_published", initiativeId, decisionId }` and analogous shapes for withdrawn/completed — no Member/Decision/Initiative lookups required, consistent with the Ledger's zero-source-lookup guarantee.

This sketch is recorded here only to confirm Gate 9's feasibility finding; it is explicitly **not** a commitment to implement this shape, and must be re-validated once the prerequisite work in §14 is complete and the real event contract is designed end-to-end (per the Roadmap's own Assessment → Domain Model → Persistence → Events → Projection → API → UI sequence).

---

## 14. Recommended Sequencing

Unlike Vote (Assessment → Persistence Recovery → Events → Projection, Tasks 28→31→32→33), Implementation Commitment needs a **prerequisite product/architecture decision before persistence recovery can even be scoped**, because Gate 1's failure is not a persistence defect — it is a live routing/ownership question:

1. **Decide the write-surface consolidation strategy** (product + architecture decision, not covered by this assessment): either (a) build the missing write API on `initiative-implementation-commitment` and migrate the old-Stage module's live UI to call it (the direction `ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md` §14 already points to — "needs UI components built before old-Stage counterpart can retire"), or (b) some other explicit resolution. This assessment does not decide this; it only confirms the decision is still open and blocking.
2. **Persistence & transaction recovery** for the canonical module (mirroring Recovery Task 31): Mongo-transactional repository, deterministic IDs, unique index on `commitmentId` (and likely `(decisionId, participantId)` if a "one active draft" rule is adopted as part of step 1's product decision).
3. **Durable events** (mirroring Recovery Task 32): `InitiativeImplementationCommitmentPublished`/`Withdrawn`/`Completed`, atomic with the transaction of step 2, via the existing outbox.
4. **Participant Action Ledger projection** (mirroring Recovery Task 33, "producer #3"): consume the events from step 3 per §13's sketch.

This assessment's role in the Roadmap's Assessment Pipeline is complete at this point — Domain Model / Persistence Design / Event Design / Projection Design for this capability cannot proceed further without step 1's decision, which is a product/architecture decision for the platform owner, not something this discovery-only assessment is scoped to make unilaterally.

---

## 15. Minor Correction Filed

`architecture/recovery/RECOVERY_STATUS.md`, Recovery Task 15 row: "Enforced canonical (transitive) Initiative ancestry" should read "Enforced canonical (direct) Initiative ancestry" per §4. Recommended as a follow-up one-line edit; not applied by this assessment to keep this document's own scope strictly to discovery (the Recovery Status document is itself a closure deliverable, and editing it is a documentation-only correction with no code or behavior impact — left for explicit approval).
