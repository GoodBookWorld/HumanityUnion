# Member Action Ledger — Implementation Blueprint v1.0

**Authority:** This blueprint translates `architecture/decisions/ADR-MEMBER-ACTION-LEDGER-v1.0.md` ("the ADR") into sequenced, reviewable implementation tasks. Where this document and the ADR conflict, the ADR controls. This document does not itself change the ADR's decisions; it only makes them concrete enough to schedule as bounded engineering tasks.

**Status:** Planning artifact for §1–§14. As of Recovery Task 27 (see §15), the Phase 1 ledger core and the `petition_signed` portion of Phase 2 are real, shipped code — see §15 for exactly what now exists. `activity` remains frozen and unchanged (ADR §22); no canonical `initiative-*` module is modified; `packages/types` gains no new production export from this document or from Task 27 (Task 27 added types only under `apps/api/src/modules/participant-action/`, not `packages/types`).

**⚠ Superseded pilot-readiness claim (Recovery Task 22, see §13):** Task 22's pre-implementation inspection (required by this blueprint's own §5/§10 before any Phase 0 code is written) found that §5's premise — that `petition` already has "an already-validated, direct `initiativeId` field" and an existing "transaction/persistence boundary" for the signing mutation to enqueue an event inside — does not hold. §5 and the "Runner-up" note below are corrected by §13, which also found the same gap in the stated runner-up. No Phase 0 code was written as a result; read §13 before starting any implementation task derived from this blueprint.

**⚠ Terminology correction (Recovery Task 26, see §14):** the platform is participant-first (every Member is a Participant; not every Participant is a Member — `packages/types/src/domain/membership.ts`'s `MembershipSummary.cohortLabel` already encodes this). This blueprint's "Member Action" vocabulary, `memberId` field name, and `member_actions`/`member-action` illustrative paths are corrected to "Participant Action" / `participantId` / `participant_actions`/`participant-action` by §14, appended without reopening any decision. Read §14 alongside §1–§13 below; the substitution table in §14 is authoritative for how to read every occurrence below.

**⚠ Implementation status (Recovery Task 27, see §15):** the Participant Action ledger core and its `PetitionSigned` consumer are now real, shipped code under `apps/api/src/modules/participant-action/`, using the §14-corrected vocabulary throughout. §15 lists exactly what now exists versus what remains planned-only.

**Produced by:** Architecture Recovery Task 21, building on Task 19's Activity boundary contract, Task 20's Activity retargeting discovery, and Tasks 04–18's canonical Initiative ancestry recovery.

---

## 1. Target Module and Type Paths

| Concern | Path (illustrative — none created by this task) | Notes |
|---|---|---|
| Production module | `apps/api/src/modules/member-action/` | New module. Never merges into `apps/api/src/modules/activity` (ADR §16, §22). |
| Domain types | `apps/api/src/modules/member-action/domain/member-action.types.ts` | `MemberActionRecord`, `MemberActionType`, `MemberActionSourceType`, `validityStatus` union. |
| Shared/public types | `packages/types/src/domain/member-action.ts` | Only if the shape needs to be shared outside `apps/api` (e.g. future admin/frontend read models); Phase 1 may keep types API-internal until a real external consumer exists. |
| Persistence | `apps/api/src/modules/member-action/infrastructure/member-action.persistence.ts` (Mongo doc ↔ domain mapping, forward-compatible reader per ADR §15) and `member-action.repository.ts` (CRUD + idempotent insert) | Mirrors the existing `activity.persistence.ts` / `activity.repository.ts` split, which the ADR already treats as the proven pattern to imitate for reader forward-compatibility. |
| Mongo collection | `member_actions`, registered in `apps/api/src/infrastructure/mongodb/mongo-collections.ts` | New collection name. Not a rename or repurposing of `activities` (ADR §16, §22). |
| Event consumer | `apps/api/src/modules/member-action/application/consume-member-action-event.service.ts` | Subscribes to the durable outbox via the existing dispatch/handler-registry pattern (`registerWorkspaceProjectionHandlers` is the closest existing analog). |
| Idempotency | Reuses `apps/api/src/infrastructure/outbox/processed-events.repository.ts` unmodified, claiming `(consumerId = "member-action-ledger", eventId = sourceEventId)` before writing. | No new idempotency mechanism is invented (ADR §14). |

None of the paths above are created by this task. They are recorded here so that the first real implementation task has an unambiguous target instead of re-deriving it from the ADR's prose.

---

## 2. Illustrative Interfaces (Non-Normative)

These are documentation aids only, matching the ADR §15 shape. They are **not** written to any `.ts` file by this task.

```ts
// apps/api/src/modules/member-action/domain/member-action.types.ts (illustrative)

export type MemberActionSourceType =
  | "initiative-comment"
  | "initiative-collaborative-analysis-contribution"
  | "initiative-improvement-proposal"
  | "petition-signature"
  | "initiative-collective-decision-vote"
  | "initiative-support-signal"
  | "initiative-implementation-commitment"
  | "initiative-implementation-tracking-update"
  | "initiative-public-impact"
  | "public-civic-archive-entry"
  | "membership"
  | "member-badge-contribution";
  // Additive-only. Never CivicArtifactType or CivicEntityType directly (ADR §12).

export type MemberActionType =
  | "petition_signed"          // Phase 0/2 pilot — the only value shipped by this blueprint's first task
  | "comment_added"
  | "contribution_submitted"
  | "evidence_submitted"
  | "proposal_created"
  | "proposal_supported"
  | "vote_cast"
  | "vote_recast"
  | "commitment_created"
  | "commitment_withdrawn"
  | "implementation_started"
  | "implementation_updated"
  | "public_impact_published"
  | "archive_contribution_published"
  | "volunteer_offer_submitted";
  // Illustrative and non-exhaustive (ADR §11). Extension requires the four
  // conditions in ADR §11 before any new value is emitted in production.

export interface MemberActionRecord {
  memberActionId: string;
  memberId: string;
  initiativeId?: string;          // mandatory iff actionType is Initiative-scoped (ADR §10)
  organizationId?: string;        // reserved, unpopulated

  actionType: MemberActionType;

  sourceType: MemberActionSourceType;
  sourceId: string;
  sourceEventId: string;

  previousMemberActionId?: string;

  occurredAt: string;
  recordedAt: string;

  schemaVersion: number;
  validityStatus: "valid" | "reversed" | "superseded";
}
```

```ts
// apps/api/src/modules/member-action/application/consume-member-action-event.service.ts (illustrative)

interface MemberActionSourceEvent {
  eventId: string;               // becomes sourceEventId
  eventName: string;             // e.g. "PetitionSigned"
  aggregateType: string;
  aggregateId: string;           // becomes sourceId
  payload: {
    memberId: string;
    initiativeId?: string;
    actionType: MemberActionType;
    sourceType: MemberActionSourceType;
    occurredAt: string;
    schemaVersion: number;
  };
}

// Illustrative signature only — not implemented.
declare function consumeMemberActionEvent(
  event: MemberActionSourceEvent,
): Promise<{ outcome: "inserted" | "duplicate-ignored" }>;
```

---

## 3. Indexes

| Index | Fields | Purpose |
|---|---|---|
| Unique | `sourceEventId` | Idempotency guarantee at the storage layer (ADR §14/§15) — belt-and-suspenders alongside the `processed-events` claim. |
| Unique | `memberActionId` | Row identity. |
| Compound | `(memberId, occurredAt DESC)` | Member timeline queries (Phase 3). |
| Compound, sparse/partial (`initiativeId` exists) | `(initiativeId, occurredAt DESC)` | Initiative-participant/steward views. |
| Compound | `(actionType, memberId)` | Filtered timeline/reporting queries. |

---

## 4. Idempotency Contract

Two independent layers, both reused rather than invented (ADR §14):

1. **Claim layer:** before processing, the consumer claims `(consumerId: "member-action-ledger", eventId: sourceEventId)` via the existing `processed-events.repository.ts` `processing → completed/failed` state machine, with the existing 5-minute stale-claim reclaim window. A claim that is already `completed` short-circuits to a no-op.
2. **Storage layer:** the `member_actions` collection's unique index on `sourceEventId` rejects a duplicate insert even if the claim layer were ever bypassed or raced, so no single point of failure can produce a duplicate row.

Reversal/correction/supersession all follow the pattern in ADR §14: a **new** row referencing the original via `previousMemberActionId`, plus a `validityStatus` transition applied to the original row in the same consumer operation — never an in-place rewrite of the original row's fact fields.

---

## 5. Pilot Producer

**`petition_signed`, sourced from `apps/api/src/modules/petition`** (ADR §21).

Phase 0's scope, precisely bounded:

- Add `enqueueDomainEvent` emission of a new, additive `PetitionSigned`-class durable domain event from `petition`'s existing signing mutation (`signPetition(petitionId, participantId, participationMode)` in `petition.store.ts`, invoked from `signPetitionHandler` in `petition.controller.ts`), inside whatever transaction/persistence boundary that mutation already uses.
- The event payload carries `memberId` (or `participantId`, mapped consistently), `initiativeId` (from petition's own already-validated, direct `initiativeId` field), `sourceType: "petition-signature"`, `sourceId` (the petition/signature's own ID), `occurredAt`, `schemaVersion`.
- **Explicitly out of scope for Phase 0:** the Member Action consumer itself (Phase 1/2), any change to `petition`'s response contract, routes, or persistence shape beyond the additive event write, and any remediation of `petition`'s known legacy coupling to `collective-decision` (ADR §21 caveat, §28 risk 5).

**Runner-up, if a future reviewer judges petition's legacy coupling disqualifying:** `initiative-implementation-commitment`'s `commitment_created` action (ADR §21).

---

## 6. Consumer / Projection Boundaries

```text
canonical transaction (petition.store.ts)
    ↓ enqueueDomainEvent (same transaction)
durable outbox (existing `outbox` collection)
    ↓ dispatch (existing handler-registry pattern)
Member Action consumer (new, Phase 1/2)
    ↓ idempotent insert (processed-events claim + unique index)
member_actions collection
    ↓ read-only projections (Phase 3+)
Private timeline projection → Initiative-participant projection → public/opt-in profile projection → Collective Participation Journey (Phase 5) → Fair Accounting Ledger (Phase 6)
```

**Boundary rule (ADR §13, §18):** nothing left of "durable outbox" may be modified by the consumer or any projection; nothing right of "member_actions collection" may write back into the outbox, the canonical aggregate, or the `member_actions` collection outside the consumer itself. Projections are strictly read-only.

---

## 7. Error Taxonomy (Illustrative)

| Error | Raised when | Handling |
|---|---|---|
| `MemberActionDuplicateSourceEventError` | A `sourceEventId` already has a `completed` claim or an existing row. | Not surfaced as a failure — treated as a successful idempotent no-op (ADR §14). |
| `MemberActionUnknownSourceTypeError` | An event's `sourceType` is not a recognized `MemberActionSourceType`. | Reject/quarantine the event; do not insert a partial row. Producer defect — alert, do not guess. |
| `MemberActionMissingInitiativeIdError` | `actionType` is classified Initiative-scoped (ADR §10) but the event payload has no `initiativeId`. | Reject/quarantine. This is a producer defect, not a consumer-side ancestry rediscovery opportunity (ADR §10 explicitly forbids the consumer from re-deriving it). |
| `MemberActionUnexpectedInitiativeIdError` | `actionType` is classified platform-scoped but the event payload includes an `initiativeId`. | Reject/quarantine — signals a producer misclassification. |
| `MemberActionSourceNotResolvableError` | `sourceId`/`sourceType` combination cannot be mapped to any known source module for that `actionType`. | Reject/quarantine; do not fabricate a resolution. |
| `MemberActionValidationError` | Any other required field (§15 of the ADR) is missing or malformed. | Reject/quarantine before any write is attempted. |

"Quarantine" means: the claim is marked `failed` (reusing the existing `processed-events` state), the event is not silently dropped, and it remains visible for operator investigation — it is never retried automatically as if it were a transient failure, since these are producer-contract violations, not infrastructure flakiness.

---

## 8. Test Strategy

| Layer | What is tested | Where (illustrative future path) |
|---|---|---|
| Contract/type | `MemberActionRecord` field presence/shape; `MemberActionType`/`MemberActionSourceType` closed unions | `apps/api/test/unit/member-action/member-action-types.test.ts` |
| Idempotency (unit) | Duplicate event delivery → single row; replay → no-op; claim state transitions | `apps/api/test/unit/member-action/member-action-idempotency.test.ts` |
| Ingestion contract (unit) | Missing `initiativeId` on an Initiative-scoped action type is rejected; unexpected `initiativeId` on a platform-scoped action type is rejected | `apps/api/test/unit/member-action/member-action-ingestion-contract.test.ts` |
| Integration | Emit `PetitionSigned` from a real (test) `petition.store.ts` mutation → durable outbox → consumer → `member_actions` row, with correct `initiativeId`/`memberId`/`sourceEventId` | `apps/api/test/integration/member-action-petition-pilot.test.ts` |
| Regression | Existing `petition` test suite remains green after Phase 0's additive event emission | Existing petition test files, unmodified in assertions, re-run after the change |
| Boundary (already added by this task) | See §11 below — pins the pre-implementation baseline this blueprint starts from | `apps/api/test/unit/member-action-ledger/*.test.ts` |

---

## 9. Rollout Order

Identical to ADR §20: Phase 0 (pilot event emission) → Phase 1 (ledger core) → Phase 2 (pilot wired end-to-end) → Phase 3 (private timeline) → Phase 4 (remaining producers, one module per task) → Phase 5 (Collective Participation Journey) → Phase 6 (Fair Accounting Ledger). No phase in this list is implemented by this task.

---

## 10. Compatibility Checks (Per Phase)

Every phase above must, before being considered complete, verify:

1. `pnpm typecheck`, `pnpm lint` (changed files), relevant focused tests, and `pnpm build` all pass (ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0 Migration Principle 7).
2. The pilot/producer module's existing route contract, response shape, and authorization are unchanged.
3. `activity`'s API, collection, and event remain untouched (ADR §22).
4. `CivicArtifactType`/`CivicEntityType` are untouched (ADR §12).
5. No new Mongo collection is created before Phase 1, and no route is mounted before Phase 3 chooses to expose one.

---

## 11. Rollback Boundaries

| Phase | Rollback action | Blast radius if reverted |
|---|---|---|
| Phase 0 | Remove the added `enqueueDomainEvent` call and its event-shape addition. | None — `petition`'s existing behavior is fully restored; no other module depends on the new event yet. |
| Phase 1 | Remove the new module/collection entirely. | None — nothing yet reads from or writes to it outside its own tests. |
| Phase 2 | Disable/unregister the consumer's subscription to `PetitionSigned`. | Ledger simply stops gaining new rows from this producer; no data corruption, since the consumer never writes back to the source. |
| Phase 3 | Unmount the timeline projection route/component. | No effect on the ledger's data; purely a read-surface rollback. |
| Phase 4 | Revert one producer's event-emission addition at a time (never all at once, per Migration Principle 6). | Contained to that one producer; other producers already onboarded are unaffected. |
| Phase 5 | Revert the Journey projection to documentation/UX-copy-only, as it is today. | No effect on the ledger or any producer. |
| Phase 6 | Remove the Fair Accounting Ledger module. | No effect on Member Action rows, since Fair Accounting only reads them and never mutates them (ADR §19). |

---

## 12. Non-Goals of This Blueprint

This blueprint does not: implement any listed path, module, collection, or interface as executable production code; define the exact wire format of `PetitionSigned` beyond the illustrative shape in §2; resolve the `petition`/`collective-decision` legacy coupling; or schedule exact dates/owners for each phase. All of these remain for the first real implementation task (§5, ADR §26) and subsequent phase-specific tasks to define narrowly, one bounded change at a time.

---

## 13. Task 22 Pilot-Safety Errata (Factual Correction, Not a New Decision)

**Produced by:** Architecture Recovery Task 22 ("Introduce the Durable Initiative-Scoped Petition Signed Event as the Member Action Ledger Pilot Producer"), during the mandatory pre-implementation inspection this blueprint's §5/§10 require. This section corrects specific factual claims made in §5 above; it does not reopen or change the ADR's decisions (Option E, vocabulary, idempotency contract, rollout phases). Per Task 22's own governing rules, only this blueprint — not the ADR — was corrected, and no `member-action` code, collection, consumer, or `PetitionSigned` catalogue entry was created.

### 13.1 Corrected finding: `petition` has no transaction/persistence boundary to enqueue an event inside

`apps/api/src/modules/petition/petition.store.ts` is a bare in-process `Map<string, Petition>` (`const petitions = new Map(...)`, line 31). It has **zero** imports of `mongo-transaction.js`, `mongo-database.js`, `outbox.repository.js`, or `ClientSession`. `signPetition` mutates the in-memory `Petition` object directly and returns it; there is no Mongo document, no session, and no durable persistence of any kind — state does not survive a process restart. This directly triggers Task 22 Part 8 **Outcome D** ("Atomicity is not currently available. Stop and report the architectural limitation rather than pretending the event is transactional") and the Part 2 stop condition "transaction infrastructure cannot atomically include the event."

A repository-wide check (`grep -r "runMongoTransaction|enqueueDomainEvent" apps/api/src/modules`) found these helpers used **only** by `member`, `activity`, `discussion`, `proposal`, and `decision` — the legacy pre-Initiative pipeline plus member registration. **Zero** `initiative-*` module, and zero `petition`, `decision-session`, `collective-decision`, or `implementation-commitment` module uses them. A further check of every `*.store.ts` file in `apps/api/src/modules` found every one of them (including `petition.store.ts` and `initiative-implementation-commitment.store.ts`, this blueprint's stated runner-up) backed by a bare `new Map`, not Mongo. This means the gap identified below is not unique to petition — **no current Initiative-scoped civic-artifact mutation in this codebase has a Mongo transaction boundary to extend**, so "add one durable outbox-backed event to an existing successful mutation" (Task 22's own framing) cannot be satisfied by any of them today without first building real Mongo persistence for that module — a materially larger, out-of-scope prerequisite, not an additive Phase 0 change.

### 13.2 Corrected finding: `petition`'s `initiativeId` is not existence-validated, at creation or at signing

§5 stated petition's `initiativeId` field is "already-validated." Inspection found: `validateCreatePetition` (`petition.validators.ts`) only checks `subject.initiativeId` is a non-empty trimmed string; no code path in `petition.store.ts`, `petition.controller.ts`, or `petition.helpers.ts` calls `getInitiativeById` or any other Initiative-existence check, at creation or at signing. The linked `CollectiveDecision` record (`collective-decision.store.ts`) has no `initiativeId` field at all, so no transitive cross-check is possible either. A focused test (`apps/api/test/unit/member-action-ledger/petition-signed-pilot-safety-baseline.test.ts`) confirms a Petition can be created and fully signed with a `subject.initiativeId` that does not exist in the Initiative store. This directly triggers the Task 22 Part 2 stop condition "the Initiative ID available at signing is not ancestry-validated."

### 13.3 Corrected finding: the stated "Task 13/14 test coverage" advantage does not apply to `petition`

§21 of the ADR (not modified by this errata) credited "Recovery Tasks 13/14 specifically hardened petition E2E verification-fixture idempotency" as part of petition's pilot suitability. Inspection found **zero** existing test files reference `petition` anywhere in `apps/api/test/` prior to Task 22. Tasks 13/14 hardened **Participation Area** verification fixtures — a different module — and the verification-harness async-helper conventions generally; neither touched `petition` specifically. This does not, by itself, disqualify petition, but the stated evidence for it was incorrect and should not be relied on by a future task.

### 13.4 What was empirically confirmed safe (Task 22 Part 12/13)

Independent of the above, Task 22 also confirmed — via `apps/api/test/integration/petition-signed-pilot-safety-outbox.test.ts`, using a probe event name not in `CATALOGUE_EVENTS` and no registered handler — that the outbox/dispatcher itself is **not** a blocker for a future pilot, on any module:

- `dispatchEnvelopeToHandlers` (`event-handler-registry.ts`) iterates zero times for an event with no matching handler; it does not throw, retry, or poison unrelated records.
- `dispatchOutboxBatch` then unconditionally calls `markOutboxRecordPublished` even when zero handlers matched — an unconsumed event is marked `"published"` on its very first dispatch cycle, indistinguishable in status from a truly-consumed one.
- No TTL index or cleanup routine exists on the `outbox` collection (`mongo-indexes.ts` has no `outbox` entry); `published` records are never deleted by ordinary dispatch and remain fully queryable (including their full envelope/payload) via `findOutboxRecordById` or a direct collection query.
- **Conclusion:** Phase-0-before-Phase-1 sequencing is **retention-safe** — a future Phase 2 backfill can recover pre-consumer events from the retained `published` records. The outbox/dispatcher was not the reason this task stopped; the two findings in §13.1/§13.2 were.

### 13.5 Corrected runner-up guidance

§5's runner-up (`initiative-implementation-commitment`'s `commitment_created`) was checked and found to have the **same** §13.1 gap: `initiative-implementation-commitment.store.ts` is also a bare in-memory `Map`, with no Mongo persistence or transaction support. It is **not** a ready substitute pilot without the same prerequisite work. Per Task 22's explicit instruction ("Do not silently select another pilot"), no alternative pilot was substituted in this task.

### 13.6 Recommended correction to rollout order

A future task must not repeat Task 22's Phase-0 framing verbatim against any current in-memory civic-artifact module. The realistic prerequisite, in order, is:

1. Choose one Initiative-scoped candidate module (petition remains attractive on every non-persistence axis: clear actor, simple completed-fact semantics, low reversal complexity) and give it real Mongo-backed persistence and a `runMongoTransaction`-compatible write path for its core mutation — a bounded persistence-migration task in its own right, touching only that module's store/service/persistence layer, with no behavior/contract change (same pattern already proven by `confirm-member-registration.service.ts`, `create-proposal.service.ts`, etc.).
2. Only after that module has a real transaction boundary, resume Task 22's Part 3–25 exactly as written against it: name the event, define its contract, enqueue it inside the now-real transaction, and add the same class of focused tests this task added for the safety inspection.
3. Independently of (1)–(2), a separate task should decide whether petition's `initiativeId` needs an explicit existence check added (fixing §13.2) before or alongside its event producer, since an unvalidated ancestry field is an existing correctness gap regardless of whether Task 22 proceeds.

### 13.7 Further correction (Recovery Task 23): §13.1/§13.5's "bare `new Map`" claim was imprecise for most non-petition modules

Recovery Task 23 ("Recover the Petition Persistence Model and Initiative Validation Boundary Before Durable Event Integration") found that §13.1's supporting claim — "every one of them (including `petition.store.ts` and `initiative-implementation-commitment.store.ts`) [is] backed by a bare `new Map`, not Mongo" — is imprecise for `initiative-implementation-commitment` and, on inspection, for most other `initiative-*` stores (`initiative-decision-vote`, `initiative-collective-decision`, `decision-session`, `initiative-improvement-proposal`, `initiative-implementation-tracking`, `initiative-public-impact`, `initiative-version-revision` — see `apps/api/src/infrastructure/mongodb/mongo-collections.ts`, which reserves a Mongo collection for every one of these but reserves **none** for `petition`). Each of these modules' `Map` is populated from a **pluggable three-mode snapshot-persistence adapter** (`memory` | `file` (default) | `mongodb`, selected by a per-module env var, e.g. `INITIATIVE_DECISION_VOTE_PERSISTENCE`) — so in `mongodb` mode, the in-memory `Map` genuinely is backed by Mongo, not purely by process memory.

**This does not change §13.1's conclusion.** That adapter's `mongodb` mode (`createMongoSnapshotPersistence`, `apps/api/src/infrastructure/mongodb/create-mongo-snapshot-persistence.ts`) writes via a **fire-and-forget, non-transactional, whole-collection `deleteMany` + bulk `replaceOne upsert`** on every `save()` call (`pendingWrite = persistSnapshot(...).catch(...)`, never awaited by the caller, no `ClientSession`, no `runMongoTransaction`). It provides eventual cross-restart durability, not atomicity, and cannot host an atomic outbox enqueue — so §13.1's actual claim ("no current Initiative-scoped civic-artifact mutation has a Mongo **transaction boundary** to extend") remains correct for every module checked, `petition` included.

**What does change:** `petition` is not merely "the same as its siblings" — it is the **outlier**. It has no adapter at all (no env var, no `file`/`mongodb` mode, no reserved Mongo collection), making it strictly weaker than every other `initiative-*` module on cross-restart durability, even though none of them yet clear the transaction-boundary bar Task 22 actually needs. See `architecture/recovery/PETITION_PERSISTENCE_AND_INITIATIVE_BOUNDARY_v1.0.md` for the full persistence-migration design this implies for `petition` specifically, and for why that design does not simply copy the existing snapshot-adapter pattern.

---

## 14. Terminology Correction — Participant-First Identity (Recovery Task 26, Not a New Decision)

**Produced by:** Architecture Recovery Task 26 ("Correct the Participant-First Identity and Action Vocabulary Before Implementing the Participation Ledger"). This section corrects vocabulary only, exactly as its companion ADR's §4a does; it does not reopen or change §1–§13's module paths, indexes, idempotency contract, pilot selection, rollout order, or error taxonomy as *decisions* — it corrects the names those decisions were written under, before any of them is implemented as code (this blueprint remains a planning artifact only; no production module, collection, route, event, or migration exists as a result of Task 21, 22, 23, or 26).

### 14.1 Why now, and why here

Recovery Task 25 implemented this blueprint's own §5 pilot (`petition_signed`) and, in doing so, named the durable event's actor field `memberId`, copying this blueprint's own §2/§5 illustrative wording verbatim. Recovery Task 26 found that `memberId` was the wrong name for that field under the platform's own accepted domain model — the acting identity on every participation fact is a **Participant** (an account may or may not additionally hold the separate, earned **Member** status) — and corrected the actual, shipped `PetitionSigned.payload` contract from `memberId` to `participantId` (`apps/api/src/modules/petition/petition-signed.event.ts`). This section brings the blueprint's own illustrative vocabulary into agreement with that correction, so a future Phase 1 implementer building the real ledger does not re-copy the now-corrected provisional name from this document.

### 14.2 Substitution table (authoritative reading of §1–§13 above)

| As written above (§1–§13) | Corrected reading |
|---|---|
| "Member Action" (ledger/module/consumer/record name, throughout §1–§13) | "Participant Action" |
| `MemberActionType` | `ParticipantActionType` |
| `MemberActionSourceType` | `ParticipantActionSourceType` |
| `MemberActionRecord` (§2 illustrative interface) | `ParticipantActionRecord` |
| `memberActionId` | `participantActionId` |
| `previousMemberActionId` | `previousParticipantActionId` |
| `member_actions` (illustrative collection, §1, §3, §4, §6) | `participant_actions` |
| `apps/api/src/modules/member-action/*` (illustrative paths, §1, §2, §5–§8) | `apps/api/src/modules/participant-action/*` |
| `packages/types/src/domain/member-action.ts` (illustrative shared type path, §1) | `packages/types/src/domain/participant-action.ts` |
| `memberId` as the illustrative event/ledger-row actor field (§2's `MemberActionRecord.memberId` and `MemberActionSourceEvent.payload.memberId`, §3's `(memberId, occurredAt DESC)`/`(actionType, memberId)` indexes) | `participantId` |
| `"member-action-ledger"` (illustrative `consumerId` string, §4, §1) | `"participant-action-ledger"` |
| Error names `MemberActionDuplicateSourceEventError`, `MemberActionUnknownSourceTypeError`, `MemberActionMissingInitiativeIdError`, `MemberActionUnexpectedInitiativeIdError`, `MemberActionSourceNotResolvableError`, `MemberActionValidationError` (§7) | `ParticipantActionDuplicateSourceEventError`, `ParticipantActionUnknownSourceTypeError`, `ParticipantActionMissingInitiativeIdError`, `ParticipantActionUnexpectedInitiativeIdError`, `ParticipantActionSourceNotResolvableError`, `ParticipantActionValidationError` |
| Illustrative test paths `apps/api/test/unit/member-action/*` (§8) | `apps/api/test/unit/participant-action/*` |
| "Member timeline" (§3, §9's Phase 3 description) | "Participant timeline" |

**§5's actual, shipped correction (not merely illustrative):** §5's line "The event payload carries `memberId` (or `participantId`, mapped consistently)..." is superseded by fact: Recovery Task 25 shipped `memberId`; Recovery Task 26 corrected it in place to `participantId` — there was never a dual-naming period in production, since no consumer existed yet (§14.3 below).

### 14.3 Why no schema-version or dual-naming compatibility burden was introduced

At the time of this correction: zero Participant Action / Member Action consumer exists (§1's paths remain entirely unimplemented); `PetitionSigned` had exactly one producer (`petition.store.ts`) and zero registered consumers (confirmed structurally by `getHandlersForEvent(CATALOGUE_EVENTS.petitionSigned)` returning `[]` in both `petition-signed-event.test.ts` and the verification script); and all existing `memberId`-shaped outbox/test records were local, uncommitted development/test fixtures, not a deployed or externally-consumed contract. Per this blueprint's own §12 non-goals and the ADR's own "correct before first consumer" preference (ADR §4a's Task 26 evidence), the field was renamed in place, with no schema-version bump and no dual-field (`memberId` + `participantId`) transitional period — there is nothing to migrate and no consumer to break.

### 14.4 What remains correctly named "Member" and is not touched by this correction

- `Member.fair` / `FairBalance` — genuine, existing technical field name (§19 of the ADR); unrelated to the ledger's actor-identity vocabulary.
- The `Member` domain type/module/collection and its exported read/write functions — the base account aggregate's actual existing name, a legacy-compatibility fact this blueprint and its ADR already inherit from the codebase, not renamed by this bounded task.
- Any future, genuinely earned-Member-status-specific concept (none currently appears as ledger-blocking logic anywhere in §1–§13).

---

## 15. Implementation Status Update — First Vertical Slice Shipped (Recovery Task 27, Not a New Decision)

**Produced by:** Architecture Recovery Task 27 ("Implement the Durable Participant Action Ledger Core and Idempotently Project PetitionSigned Events"). This section is a factual status update only — it does not reopen or change §1–§14 as decisions. Every path below already used the §14-corrected Participant-first name; no second renaming occurred.

### 15.1 What now exists as real, shipped code (previously "entirely unimplemented" per §14)

| §1–§14 illustrative/planned path | Real, shipped path |
|---|---|
| `apps/api/src/modules/participant-action/*` | Shipped: `domain/participant-action.types.ts`, `participant-action.errors.ts`, `infrastructure/participant-action.mongo-document.ts`, `infrastructure/participant-action.repository.ts`, `application/petition-signed-to-participant-action.mapper.ts`, `application/petition-signed.participant-action-handler.ts`, `index.ts` |
| `participant_actions` collection, indexes (§3) | Shipped exactly as specified: unique `participantActionId`, unique `sourceEventId`, plus the `(participantId, occurredAt)`, `(initiativeId, occurredAt)`, `(participantId, initiativeId, occurredAt)`, `(sourceType, sourceId)`, `(actionType, occurredAt)` compound indexes — registered in `apps/api/src/infrastructure/mongodb/mongo-indexes.ts`, idempotent via the existing `ensureCollectionIndexes` |
| `"participant-action-ledger"` consumerId convention (§4, §14.2) | Shipped as `"participant-action.petition-signed.v1"`, following the existing `<module>.<event>.v1` convention already used by `WORKSPACE_MEMBER_REGISTERED_CONSUMER_ID` et al., not the blueprint's illustrative flat string — a naming-convention alignment, not a contract change |
| Idempotency (§4): processed-events claim + storage unique index | Shipped unmodified/reused exactly as specified: the existing `outbox.dispatcher.ts` claims `(consumerId, eventId)` via `processed-events.repository.ts` before invoking the consumer; `participant_actions.sourceEventId` carries the second, storage-level unique index |
| `ParticipantActionType`, `ParticipantActionSourceType`, `ParticipantActionRecord` (§2, §14.2) | Shipped with only `"petition_signed"` / `"petition_signature"` — no speculative future member added, per this task's explicit scope |
| Consumer only for `PetitionSigned` (§5, §6) | Shipped: `handlePetitionSignedForParticipantAction`, registered only for `CATALOGUE_EVENTS.petitionSigned`, performing zero Petition/Signature/Participant/Initiative/Member-status lookups (verified by both dedicated tests and end-to-end/verification-script evidence) |

### 15.2 What remains exactly as planned, not yet built

Reversal/correction/supersession rows (§4's `previousParticipantActionId` + `validityStatus` transition), the error taxonomy of §7 (no `ParticipantAction*Error` beyond the two generic `ParticipantActionValidationError`/`ParticipantActionPersistenceError` classes actually needed by this first slice), any second source-event consumer, any public Participant Action API/route, Fair accounting, and the Collective Participation Journey (§9's later phases) are all still unimplemented, exactly as this blueprint's §12 non-goals and Recovery Task 27's own explicit scope require.

### 15.3 Rollout order status (§9)

Recovery Task 27 corresponds to this blueprint's Phase 1 ("ledger core") together with the `petition_signed` portion of Phase 2 ("wire the pilot producer's event end-to-end into the consumer") from §9's rollout order — both delivered in one bounded task rather than two, since the pilot producer (`PetitionSigned`, Task 25/26) and the ledger core were both prerequisites this task was explicitly authorized to combine. No other Phase 2+ source event, and no Phase 3+ item, was started.

---

## 16. Implementation Status Update — Second Durable Producer Wired (Recovery Task 33, Not a New Decision)

**Produced by:** Architecture Recovery Task 33 ("Project Initiative Decision Vote Events into the Participant Action Ledger"). This section is a factual status update only — it does not reopen or change §1–§15 as decisions. §15.2's "any second source-event consumer" line is now factually superseded below; everything else in §15 remains accurate.

### 16.1 Second producer now real, shipped code

| §15.2 "not yet built" item | Real, shipped path (Task 33) |
|---|---|
| Any second source-event consumer | `application/initiative-decision-vote-cast.participant-action-handler.ts` and `application/initiative-decision-vote-changed.participant-action-handler.ts`, registered in `index.ts`'s `registerParticipantActionHandlers()` alongside the unchanged Petition handler |
| `ParticipantActionType`/`ParticipantActionSourceType` — Vote members | Added: `"initiative_decision_vote_cast"`, `"initiative_decision_vote_changed"` action types; `"initiative_decision_vote"` source type. `"petition_signed"`/`"petition_signature"` are byte-identical, unrenamed |
| Typed per-action metadata | Added: `ParticipantActionMetadata` discriminated union (`kind: "initiative_decision_vote_cast" | "initiative_decision_vote_changed"`), stored as `ParticipantActionRecord.metadata: ParticipantActionMetadata | null`. Petition rows carry `metadata: null` (no metadata need existed for Petition; the field was added additively without back-filling any real content for the pilot producer) |
| Insert-conflict classification (§7's error taxonomy, narrowed) | `insertParticipantActionIfAbsent` now distinguishes a duplicate-key error that is a byte-for-byte-identical replay (`"idempotent_replay"`, unchanged outcome) from one whose content differs (`ParticipantActionConflictError`, new) — see §16.4 |

### 16.2 Deterministic identity, unchanged formula, two new instantiations

Both new action types reuse the exact §4/Task 27 formula, `participant-action:${sourceEventId}`, with no new ID scheme:

```text
initiative_decision_vote_cast:    participant-action:initiative-decision-vote-cast:${voteId}
initiative_decision_vote_changed: participant-action:initiative-decision-vote-changed:${voteId}:v${newVoteVersion}
```

Because Task 32's Changed event ID already embeds the resulting Vote version, every committed change maps to a distinct, non-colliding Participant Action without this task inventing any new versioning concept in the ledger itself — the ledger's identity scheme is completely unaware of "versions"; it only ever sees distinct `sourceEventId`s.

### 16.3 How a Changed fact is represented (§12's "Exact Next Task" question, now answered)

The Task 32 readiness doc's §19.17 (and this blueprint's own §15.2) left open how a `Changed` fact should be represented "in an append-only ledger that has, until now, only ever modeled single, non-superseding facts." The answer implemented: **no new representational concept was needed.** A `Changed` action is projected as an ordinary, independent `ParticipantActionRecord` — same shape, same repository, same insert path as `petition_signed`/`initiative_decision_vote_cast` — whose `metadata` happens to carry both `previousChoice`/`newChoice` and `previousVoteVersion`/`newVoteVersion`. It never references, mutates, deletes, or supersedes the Cast action or any earlier Changed action; `previousParticipantActionId` (§4's illustrative reversal-linkage field) is **not** used or populated by this task, since a Vote change is not a reversal/correction of the Cast fact — the Cast still validly occurred — it is simply a second, independent fact. `validityStatus` on every Vote-sourced row remains `"valid"` permanently, exactly like Petition.

### 16.4 Idempotency and conflict classification (§4, narrowed)

Both layers described in §4 are reused unmodified: the dispatcher's `processed-events` claim (`consumerId + eventId`) and the storage-level unique indexes (`participantActionId`, `sourceEventId`). Task 33 narrows what happens on a storage-level duplicate-key hit: the existing document is re-read and compared field-for-field (excluding `recordedAt`, the one field expected to legitimately differ between two mapper invocations of the same event) — an identical match is the same successful idempotent no-op §4 already specified; a mismatch now throws `ParticipantActionConflictError` instead of being silently treated as a replay. This closes a gap that existed in the original Task 27 implementation (which treated every duplicate-key hit as idempotent) but was never exercised by Petition's own tests, since nothing previously attempted to insert two different contents under the same key.

### 16.5 Zero-lookup guarantee extended to the second producer

§6's "nothing left of durable outbox may be modified by the consumer" boundary, and Task 27's zero-Petition/Signature/Participant/Initiative/Member-lookup precedent, both hold identically for the two new handlers: both mappers are pure functions of the event payload alone (verified by source inspection and dedicated tests) — no Vote, Collective Decision, Initiative, Member, or profile lookup exists in either `mapInitiativeDecisionVoteCastToParticipantAction` or `mapInitiativeDecisionVoteChangedToParticipantAction`.

### 16.6 Rollout order status (§9)

Task 33 completes the `initiative_decision_vote` portion of §9's Phase 4 ("remaining producers, one module per task") — the same phase Petition's Phase 0/2 belonged to for its own producer. Phase 3 (private timeline), Phase 5 (Collective Participation Journey), and Phase 6 (Fair Accounting Ledger) remain entirely unimplemented, exactly as before.

### 16.7 Rollback boundary (§11), Vote-specific

Identical in kind to §11's existing Phase 2 row: disable/unregister the two new handlers' subscriptions (or revert `registerParticipantActionHandlers()`'s two new `registerDomainEventHandler` calls) and the ledger simply stops gaining new rows from `InitiativeDecisionVoteCast`/`Changed` — no data corruption, since neither consumer ever writes back to the Vote aggregate, Vote history, or the outbox.

---

*This blueprint is a Recovery Task 21 work product, companion to `architecture/decisions/ADR-MEMBER-ACTION-LEDGER-v1.0.md`. §13 is a Recovery Task 22 factual-correction addendum; §13.7 is a Recovery Task 23 further correction; §14 is a Recovery Task 26 terminology-correction addendum; §15 is a Recovery Task 27 implementation-status addendum; §16 is a Recovery Task 33 implementation-status addendum.*
