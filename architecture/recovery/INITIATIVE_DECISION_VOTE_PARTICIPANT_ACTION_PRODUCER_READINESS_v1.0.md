# Initiative Decision Vote — Participant Action Producer Readiness v1.0

**Authority:** Recovery Task 28 ("Assess Initiative Decision Vote as the Second Durable Producer for the Participant Action Ledger"), governed by the Participant-first correction (Recovery Task 26), the Participant Action Ledger implementation (Recovery Task 27), `MEMBER_ACTION_LEDGER_IMPLEMENTATION_BLUEPRINT_v1.0.md` §14–§15, `ADR-MEMBER-ACTION-LEDGER-v1.0.md`, and the transitive Initiative ancestry work of Recovery Tasks 10–12.

**Status:** Discovery/assessment artifact only. No production Vote code, event, catalogue entry, Participant Action vocabulary member, or Mongo index was added by this task. Every claim below is backed by direct source citation and/or a passing characterization test in `apps/api/test/unit/initiative-decision-vote/initiative-decision-vote-producer-readiness.test.ts` and `initiative-decision-vote-mutation-lifecycle.test.ts`.

**Verdict:** **Not production-ready.** 3 of 10 gates fail (Gate 5, Gate 6, Gate 7 — see §17). `InitiativeDecisionVoteCast` must **not** be implemented against the current Vote aggregate. A prerequisite migration task (§16, mirroring `PETITION_PERSISTENCE_AND_INITIATIVE_BOUNDARY_v1.0.md`'s role for Petition) is required first.

---

## 1. Current Flow

```text
route:        POST /api/v1/initiative-collective-decisions/:decisionId/vote
              GET  /api/v1/initiative-collective-decisions/:decisionId/my-vote
              (initiative-collective-decision-vote.routes.ts)
controller:   inline in the route handler (no separate controller file)
validator:    validateCastInitiativeDecisionVoteInput (initiative-decision-vote.validators.ts)
              — validates only { choice: "support" | "do_not_support" | "abstain" }
service:      castOrUpdateInitiativeDecisionVote / getMyInitiativeDecisionVote
              (initiative-decision-vote.service.ts)
store:        initiative-decision-vote.store.ts — in-memory Map<voteId, Vote>
              + Map<voteId, HistoryEntry> + Map<"decisionId::participantId", voteId>
persistence adapter: file (default) | memory | mongodb (env `INITIATIVE_DECISION_VOTE_PERSISTENCE`)
Mongo adapter:  initiative-decision-vote-mongo.persistence.ts → createMongoSnapshotPersistence
                → mongo-snapshot-store.ts (deleteMany + upsert bulkWrite, no session)
transaction helper: NONE — `runMongoTransaction` is never imported or called anywhere in this module
response mapper: none separate — the service returns the `InitiativeDecisionVote` object directly;
                  the route wraps it in `createSuccessResponse`
```

**Every mutation associated with voting**, discovered by source inspection of `initiative-decision-vote.service.ts`/`.store.ts` (confirmed by `verify-vote-casting-e2e.ts` and the new mutation-lifecycle test):

| Mutation | Exists? | Where |
|---|---|---|
| Cast vote (first time) | Yes | `castOrUpdateInitiativeDecisionVote` — `!existingVote` branch |
| Change vote (same participant, same decision, different choice) | **Yes** | same function — `existingVote` branch, `version` incremented, same `voteId` |
| Re-submit identical choice | Yes (no-op) | same function — `existingVote.choice === input.choice` → returns the existing row unchanged, no write, no history entry |
| Withdraw vote (delete/void) | **No** | no delete/withdraw mutation exists anywhere |
| Abstain | Partial | `"abstain"` is one of the three `choice` values, cast/changed exactly like `support`/`do_not_support` — it is not a separate withdrawal state |
| Invalidate | **No** | no invalidation mutation or status field exists on `InitiativeDecisionVote` |
| Close decision | Yes (Decision-side) | `closeInitiativeCollectiveDecision` (different module) — does not touch existing Vote rows; only blocks *future* casts via `assertDecisionAcceptsVotes` |
| Recount | N/A — no stored count exists to recount; every read recomputes from raw rows (§9) |
| Reset / administrative correction | **No** | no admin override mutation exists |

**The operation is confirmed NOT append-only**: `castOrUpdateInitiativeDecisionVote` mutates the same `voteId` row in place (`saveVoteRecord` does `votes.set(vote.voteId, ...)`, a keyed upsert) whenever a participant changes their choice. A parallel, genuinely append-only `InitiativeDecisionVoteHistoryEntry` collection records every transition, but the *authoritative current* row is mutable.

---

## 2. Authoritative Aggregate

`InitiativeDecisionVote` (`packages/types/src/domain/initiative-decision-vote.ts`) is an **independent aggregate** (Model C — "a participation record," per the module's own Task 12 doc comment) — not embedded inside `InitiativeCollectiveDecision`, and not a snapshot/derived model.

| Field | Present? | Notes |
|---|---|---|
| Aggregate identity / stable Vote ID | `voteId: string` | Generated as `initiative-decision-vote-${Date.now()}-${random}` — **not deterministic**, not derived from `(decisionId, participantId)` |
| Participant ID field | `participantId: MemberId` | Field name is canonical (`participantId`); the *type alias* is still `MemberId` (`= string`), same pattern as `ParticipantId = MemberId` elsewhere in `@hu/types` |
| Initiative ID field | **Absent** | By design — ancestry is transitive through `decisionId` (§4) |
| Decision ID field | `decisionId: InitiativeCollectiveDecisionId` | Present, mandatory |
| Vote choice field | `choice: InitiativeDecisionVoteChoice` = `"support" \| "do_not_support" \| "abstain"` | Present |
| Timestamps | `castAt`, `updatedAt` | `castAt` fixed at first cast; `updatedAt` bumped on every change |
| Status | **Absent** | No `status` field exists on the type at all (see §6 — a Mongo index references a nonexistent `status` field) |
| Version/concurrency field | `version: number` | Present, incremented on each change — application-managed, **not** used as a Mongo optimistic-concurrency token (no `findOneAndUpdate` with a version filter anywhere) |

A separate, genuinely append-only `InitiativeDecisionVoteHistoryEntry` exists (`historyId`, `voteId`, `previousChoice?`, `newChoice`, `changedAt`) and is the only part of this subsystem that behaves like a durable fact log today.

---

## 3. Persistence Classification

**Classification: B (file/snapshot persistence) by default; C (fire-and-forget Mongo mirror) when explicitly configured. Never D or E.**

- Default mode (no `INITIATIVE_DECISION_VOTE_PERSISTENCE` env var set — confirmed this is the actual state of `.env`/`.env.example` in this repository): **file**. `FileInitiativeDecisionVotePersistenceAdapter` synchronously reads/writes a single JSON file (`.runtime/initiative-decision-votes.json`) with a whole-file rewrite + atomic rename on every mutation.
- If `INITIATIVE_DECISION_VOTE_PERSISTENCE=mongodb` is set: `createMongoInitiativeDecisionVotePersistenceAdapter` wraps `createMongoSnapshotPersistence`, whose `save()` is **fire-and-forget by construction** — it stores the new snapshot in an in-memory `cache` synchronously, then calls `persistSnapshot(snapshot).catch(...)` **without awaiting it**. The caller (`initiative-decision-vote.store.ts`'s `persistStores()`) never awaits this either.
- The underlying write (`mongo-snapshot-store.ts`'s `replaceRecordMap`) is a **non-transactional, sessionless, whole-collection replace**: `deleteMany({ _id: { $nin: ids } })` followed by a `bulkWrite` of `replaceOne(..., { upsert: true })` for every row in the *entire* in-memory `votes`/`history` Map — not just the newly-changed row. No `ClientSession`, no `withTransaction`, no `session:` parameter exists anywhere in this call chain (confirmed by source inspection and the new characterization test).
- Collection names: `initiative_decision_votes`, `initiative_decision_vote_history` (`MONGO_COLLECTIONS.initiativeDecisionVotes` / `.initiativeDecisionVoteHistory`).
- Repository: none in the Petition/Participant-Action sense — the "repository" is the module-level singleton Maps in `initiative-decision-vote.store.ts`, loaded once at process start (`loadStores()`) and mutated in memory; `persistStores()` is a side-effecting mirror, not the source of truth for reads within a running process.
- Restart durability: **Yes**, in file mode (JSON file survives restart, proven by the existing `verify-vote-casting-e2e.ts` "14. Persistence — vote survives API restart" step and its `verify-initiative-decision-vote-store-reload.ts` subprocess). In Mongo mode, durability depends entirely on the fire-and-forget write actually completing before any crash — there is no guarantee, and no code awaits it.
- Insert/update semantics: keyed upsert by `voteId` (`Map.set`), i.e. the *store* itself has no insert-vs-update distinction — every `saveVoteRecord` call is a blind overwrite.
- Failure handling: a failed fire-and-forget Mongo write is swallowed into a `pendingWrite` promise that is only ever inspected by a manual `flush()` call used in scripts/tests (`hydrateInitiativeDecisionVoteMongoPersistence`/`flushInitiativeDecisionVoteMongoPersistence`), never by the request path. A production request that succeeds at the application layer can still silently fail to reach Mongo.
- Test cleanup: `deleteVotesByParticipantIdForTests(participantId)` exists and is scoped correctly (removes only the target participant's votes/history, matching the Task 06–10 convention for file-backed modules).

This is materially the same pattern already documented for other pre-Petition initiative-* modules, and is explicitly what the strict safety rules forbid presenting as transactional: **it is not**.

---

## 4. Initiative Ancestry

| Question | Answer |
|---|---|
| Does Vote contain `initiativeId` directly? | **No** — by design (Model C, confirmed unchanged since Recovery Task 10/12) |
| Is Initiative identity inherited from Decision? | **Yes**, transitively — `resolveVoteInitiativeAncestry` calls `validateTransitiveInitiativeAncestry({ parentArtifactType: "decision", parentArtifactId: decisionId }, ...)`, pinned to `initiative-collective-decision` only (Recovery Task 11) |
| Is the Decision itself directly ancestry-validated? | **Yes** — `createVoteParentDecisionResolver` looks up the real Collective Decision and returns its `initiativeId`; `createVoteInitiativeExistenceChecker` then confirms that Initiative actually exists |
| Can a Vote point to a nonexistent Decision? | **No** — rejected before any write (`ParentArtifactNotFoundError` / `InitiativeAncestryMissingError`, translated to `"Collective decision not found."`) |
| Can a Decision point to a nonexistent Initiative? | Rejected at cast-time (`InitiativeNotFoundError`) if it ever happened, but this is unreachable for any Decision created through the real service (Recovery Task 09 validates ancestry at Decision creation) |
| Is ancestry revalidated during voting? | **Yes, every single cast** — `resolveVoteInitiativeAncestry` runs on every `castOrUpdateInitiativeDecisionVote` call (both first cast and change), each performing exactly one Decision lookup and one Initiative lookup (captured once via `resolvedDecisionBox`/`resolvedInitiativeBox`, not repeated) |
| Is the persisted Initiative identity immutable? | Not applicable to Vote itself (it has no `initiativeId` field to mutate); the Decision's own `initiativeId` is set once at Decision creation and never reassigned by any Vote-side code |

**Conclusion:** ancestry resolution is correct and already production-grade (this is the one area of the Vote subsystem that Recovery Tasks 10–12 already hardened). A future `InitiativeDecisionVoteCast.payload.initiativeId` **can** come from a durable, previously-validated source invariant — but only by resolving it the same way the service does today (through the Decision), since the Vote row itself has no such field.

---

## 5. Participant Identity

| Field | Where | Classification |
|---|---|---|
| `RequestIdentity.participantId` | `request-identity.types.ts` | Canonical Participant identity — this is the field the route/service actually use |
| `InitiativeDecisionVote.participantId` | `initiative-decision-vote.ts` | Canonical field **name** (matches the participant-first correction), but its declared type is `MemberId` (`= string`), the same "correct name, legacy-typed alias" pattern already documented for `PetitionSignedPayload` pre-Task-26 |
| `InitiativeDecisionVoteHistoryEntry.participantId` | same file | Same as above |
| `memberId` | **Not used anywhere in this module** | N/A |
| `actorId` | **Not used anywhere in this module** | N/A |
| `voterId` | **Not used anywhere in this module** | N/A |

No ambiguous or legacy field name exists in the Vote module itself — `participantId` is used consistently end to end (route → service → store → history). The only latent issue is the same repo-wide `MemberId`/`ParticipantId` alias conflation already flagged in Recovery Task 26, not something new introduced by Vote. A future event's `participantId` field can safely use this exact value with no rename required.

---

## 6. Duplicate and Concurrency Guarantees — **FAILS Gate 5**

**Actual invariant enforced today:** an in-memory `Map<"decisionId::participantId", voteId>` (`participantDecisionIndex`), checked via `getActiveVoteForParticipant` **before** every write, with no database-level constraint backing it.

- The Mongo index list for `initiative_decision_votes` (`mongo-indexes.ts`) declares only three **non-unique** single-field indexes: `{ decisionId: 1 }`, `{ participantId: 1 }`, `{ status: 1 }`. **No unique index exists** on `voteId`, `(decisionId, participantId)`, or anything else. **Defect discovered:** the `{ status: 1 }` index is dead — `InitiativeDecisionVote` has no `status` field at all (§2).
- **REPRODUCED (test):** `initiative-decision-vote-producer-readiness.test.ts` → "REPRODUCES the defect: the store accepts two concurrently-created vote rows for the same (decisionId, participantId)". Two `saveVoteRecord` calls with distinct `voteId`s but the same `(decisionId, participantId)` are both accepted by the store; `listVotesForDecision` returns **2** rows; `getActiveVoteForParticipant` silently returns only whichever was written last; `computeInitiativeDecisionVoteAggregates` **double-counts** the participant in the unweighted tally as a direct consequence.
- 1. **Sequential duplicate voting** (same participant, same choice, one after another): correctly collapses to a no-op (no new row, no version bump, no history entry) — proven by the mutation-lifecycle test.
- 2. **Concurrent same-Participant voting:** the application-layer read-then-write check (`getActiveVoteForParticipant` → branch → `saveVoteRecord`) has an `await` gap immediately before it (`await evaluateVoteEligibility(...)`, which performs a real Mongo round trip via `getMemberById`). Two concurrent requests can both observe "no existing vote" before either writes, exactly the class of race the store-level test above reproduces the *consequence* of. This is a real, exploitable gap, not merely theoretical: the guard is single-process, in-memory, and non-atomic.
- 3. **Two Participants voting concurrently:** safe — they key on different `(decisionId, participantId)` pairs and never collide, regardless of ordering.
- 4. **Retry after timeout:** since `voteId` is generated fresh (`Date.now()-random`) inside the service on every "first cast" path, a client retry that races with its own original (still-in-flight) request can independently create two rows for itself, for the same reason as #2 — there is no idempotency key derived from the request.
- 5. **Vote modification:** supported and correct in the *sequential* case (§7); not database-enforced either — it depends entirely on the same in-memory check finding the row that already exists.
- 6. **Vote after Decision closes:** rejected, but **only at the application layer**, before Member eligibility is even checked (`assertDecisionAcceptsVotes` throws `"...is not open for voting."` / `"...voting window is not open yet."` / `"...voting window has closed."`), proven without Mongo by the new "Vote-after-close gating happens before any Member lookup" tests. Nothing in the database itself prevents a write against a closed Decision if that application check were ever bypassed.

**The database is not the final concurrency authority here — a pre-check is all that exists.** This is the same class of gap Recovery Task 24 fixed for Petition Signature with a real unique compound index; Vote has not received the equivalent fix.

---

## 7. Vote Mutability

| Capability | Supported? |
|---|---|
| Change choice | **Yes** — `support ↔ do_not_support ↔ abstain`, same `voteId`, `version` increments, one `InitiativeDecisionVoteHistoryEntry` per transition |
| Withdraw vote | **No** — no mutation removes or nulls a Vote |
| Replace a previous vote | Yes, this is exactly what "change choice" is — there is no distinct "replace" operation |
| Vote again after reopening | Not supported by any code path — `InitiativeCollectiveDecisionStatus` has no "reopened" transition in this module's view; once `closed`/`cancelled`, `assertDecisionAcceptsVotes` rejects permanently for that Decision |
| Vote invalidated (by anyone/anything) | **No** — no invalidation mutation or field exists |

**Consequence for event semantics (do not implement now, per task scope):** because the authoritative row is mutable and reused across choice changes, a single `InitiativeDecisionVoteCast` event **must not** be raised on every successful `castOrUpdateInitiativeDecisionVote` call — doing so would misrepresent a *change* as a brand-new completed fact, and would violate the append-only Participant Action ledger's one-fact-per-source-event model (a participant could otherwise accumulate multiple `initiative_decision_vote_cast` Participant Action rows for a single logical vote). The correct future design needs at least two distinct facts — `InitiativeDecisionVoteCast` (first cast only) and `InitiativeDecisionVoteChanged` (subsequent changes) — exactly as the task brief anticipates, and explicitly must not collapse them. `Withdrawn`/`Invalidated` are speculative today since no code path produces either state; they should not be designed in detail until such a mutation exists. The Participant Action ledger would need a future validity-transition mechanism (e.g. superseding a prior action, or a compensating action) to represent "Changed" — out of scope to design further here per Part 7's explicit instruction.

---

## 8. Transaction Boundary — **FAILS Gate 6 and Gate 7**

- `runMongoTransaction` and `ClientSession` are **never referenced** anywhere in `initiative-decision-vote.service.ts` or `.store.ts` (confirmed by source-text characterization test).
- The current write path is, at best (Mongo mode): `mutate in-memory Map` → `fire off an unawaited whole-collection Mongo mirror write` → `return to caller immediately`. This is precisely the "write Vote, commit, [maybe] mirror later" pattern the task explicitly instructs must **not** be accepted as sufficient.
- **The future safe unit (`insert Vote` + `enqueue InitiativeDecisionVoteCast` + `commit`) does not exist and cannot be built on top of the current adapter.** It would require the same migration Petition received in Recovery Task 24 (a real per-document Mongo collection with a unique index, written inside `runMongoTransaction`), not a reuse of `createMongoSnapshotPersistence`.
- Vote casting touches exactly one durable write target today: the Vote row itself. Decision totals are **not** written during casting (§9) — so, once migrated, the safe transactional unit is the simpler of the two shapes the task offers: `insert Vote` + `enqueue event` (no `update Decision count` step needed).

---

## 9. Derived Counters

`computeInitiativeDecisionVoteAggregates(decisionId)` (`initiative-decision-vote-aggregates.ts`) **recomputes from live Vote rows on every call** — it calls `listVotesForDecision(decisionId)` and folds `choice`/`transparencyCohort` into counts fresh each time. `InitiativeCollectiveDecision` (`initiative-collective-decision.ts`) stores **no** count/tally field at all (confirmed by source inspection and the new "carries no stored vote-count/tally field" test). There is no incremental "+1" write, no snapshot, and no eventual mirror of a count — the aggregate helper is a pure read-side function, proven to update immediately and correctly when an underlying Vote row's `choice` changes (new characterization test).

**Conclusion:** a future producer transaction requires only `insert Vote` + `enqueue event`, never `update Decision count` — there is no second write to fold into the same transaction.

---

## 10. Event Contract Design (Design Only — Not Implemented)

```ts
// NOT CREATED. Illustrative only.
interface InitiativeDecisionVoteCastPayload {
  voteId: string;
  decisionId: string;
  participantId: string;
  initiativeId: string;
  choice: "support" | "do_not_support" | "abstain"; // actual domain terminology — InitiativeDecisionVoteChoice
  votedAt: string; // = castAt (first-cast timestamp only; never updatedAt)
}
```

- **Aggregate type:** `InitiativeDecisionVote` (matching the `PetitionSignature`-as-aggregate-type precedent — the event represents a fact about the Vote aggregate itself, not the parent Decision).
- **Aggregate ID:** `voteId`.
- **Deterministic event ID:** **cannot** be built the way `buildPetitionSignedEventId(signatureId)` was, because `voteId` is generated with `Date.now()-random`, not derived from `(decisionId, participantId)`. A durable `InitiativeDecisionVoteCast` event ID would need to be `vote-cast:${decisionId}:${participantId}` (derived from the *natural key*, not the current opaque `voteId`) to be replay-safe across a transaction retry of the *same logical cast attempt* — this requires either changing how `voteId` is generated, or building the event ID from the natural key independently of `voteId`. This is a concrete, small design correction the follow-up implementation task must make.
- **Schema version:** the existing `DomainEventSchemaVersion` convention (e.g. `"1.0"`), unchanged mechanism from `PetitionSigned`.
- **`occurredAt` source:** `castAt` — the *original* first-cast timestamp, never `updatedAt` (which changes on every subsequent choice change and therefore must belong to a future `Changed` event's own `occurredAt`, not this one).
- **Privacy classification:** thin, privacy-safe, completed-fact payload — matches `PetitionSignedPayload`'s existing exclusion list.
- **Explicitly excluded** (per task instruction, and consistent with `PetitionSignedPayload`'s precedent): Participant display name, Member status, email, full Decision object, full Initiative object, mutable vote totals/aggregates, Fair, Journey fields, notification fields, `transparencyCohort` (mutable-adjacent, derived from Participation Area verification state at cast time, not a stable fact about the vote itself), and `version`/`updatedAt` (mutable).

---

## 11. Participant Action Mapping (Design Only — Not Implemented)

```text
actionType       = initiative_decision_vote_cast   (NOT added to ParticipantActionType — design only)
sourceType       = initiative_decision_vote        (NOT added to ParticipantActionSourceType — design only)
sourceId         = payload.voteId
sourceEventId    = envelope.eventId
participantId    = payload.participantId
initiativeId     = payload.initiativeId
occurredAt       = payload.votedAt
```

This mirrors `mapPetitionSignedToParticipantAction`'s shape exactly (`petition-signed-to-participant-action.mapper.ts`) — same validation depth (defense-in-depth field checks even though deserialization already validates), same deterministic `participantActionId = participant-action:${sourceEventId}` construction, same idempotency guarantee (outbox `processed-events` claim + a future unique index on `sourceEventId` in `participant_actions`).

**Required source lookups: zero** — exactly like the `PetitionSigned` consumer, every field the mapper needs would already be present on the thin event payload; no Decision/Initiative/Member re-lookup is required by the *consumer* (only the *producer*, at cast time, already performs those lookups today).

---

## 12. Member Status Independence — Ambiguity Confirmed, Not Resolved

Voting requires **both** of the following, conflated into a single "eligibility" check (`evaluateDecisionParticipationEligibility` in `@hu/types`, invoked via `evaluateVoteEligibility` → `getMemberById`):

1. `isRegistered` — a Member record must exist at all (`getMemberById(identity.participantId) !== null`).
2. `participantStatus === "active"` — the Member record's **`MemberStatus`** field (`"active" | "inactive" | "suspended" | "archived"`) must specifically be `"active"`.

**This is the same ambiguity already flagged for Petition signing**: "active account" and "earned Member status" are not actually distinguished anywhere in this check — both are gated through the *same* Member record and the *same* `status` field. There is no separate "Participant account is active" concept independent of the Member record; an authenticated Participant with no Member record at all is rejected (`"not_registered"`), and one with a Member record whose `status` is anything but `"active"` is rejected (`"inactive_participant"`) with a message that literally says "Participant must be active," reinforcing the conflation in user-facing text. **Confirmed by a new pure-function characterization test** (no Mongo required) exercising `evaluateDecisionParticipationEligibility` directly with `isRegistered: false` and `participantStatus: "inactive"`.

This task does not change eligibility policy, per instruction — it only documents that the ambiguity exists and is identical in shape to the one already known from Petition/PetitionSigned.

---

## 13. Outbox Compatibility

- Unknown events remain safe: `getHandlersForEvent` filters registered handlers by exact `eventName` (or the literal wildcard `"*"`, which nothing currently uses) — an event with no registered handler is simply not dispatched to anything; nothing crashes.
- Event handlers are registered by event name, one `registerDomainEventHandler({ consumerId, eventName, handle })` call per event — this is already the shape `registerParticipantActionHandlers()` uses for `PetitionSigned` (`participant-action/index.ts`).
- **A second Participant Action handler can coexist with the Petition handler with zero redesign** — proven by a new characterization test that registers two independent probe handlers (different `eventName`s, different `consumerId`s) against the real, process-global `event-handler-registry.ts` and confirms each receives only its own event. Adding `InitiativeDecisionVoteCast` support would be exactly one more `registerDomainEventHandler({...})` call inside the existing `registerParticipantActionHandlers()` function.
- Processed-event consumer IDs remain unique by construction — each handler supplies its own `consumerId` string (e.g. `participant-action.petition-signed.v1`); a hypothetical `participant-action.initiative-decision-vote-cast.v1` would not collide.
- Replay: the outbox dispatcher's idempotency is a `(consumerId, eventId)` claim (`processed-events.repository.ts`) — replaying historical events is already supported generically, no Vote-specific change needed.
- Outbox retention: unchanged by this assessment — no Vote-specific retention concern was found or introduced.

**Conclusion: the Participant Action module needs "one handler per event," which is exactly what it already has** — not a generic catch-all consumer, and not a redesign. This satisfies Gate 10's precondition (a deterministic, additive mapping) *architecturally*; the blocker is entirely upstream, in the Vote aggregate's own persistence/transaction/uniqueness gaps (§3, §6, §8), not in the consumer framework.

---

## 14. Blockers (Summary)

1. **No real Mongo transaction exists for Vote writes** (§8) — Gate 6 fails.
2. **No unique database constraint on `(decisionId, participantId)` or `voteId`** — Gate 5 fails; a reproducible double-write defect exists today (§6).
3. **No same-session outbox enqueue is possible** on top of the current fire-and-forget snapshot adapter (§3, §8) — Gate 7 fails.
4. **`voteId` is not deterministic** — blocks a replay-safe event ID the way `PetitionSigned` achieved via `signatureId` (§10); needs a natural-key-derived ID instead.
5. **Vote is mutable** — a naive one-event-per-cast design would misrepresent changes as new facts (§7); the follow-up task must design (but not yet implement) at least a `Cast`/`Changed` split.
6. Dead `{ status: 1 }` Mongo index on a field that does not exist on `InitiativeDecisionVote` (§2, §6) — cosmetic but should be cleaned up during the same migration.

---

## 15. Implementation Options

**Option A — Reuse `createMongoSnapshotPersistence` as-is and bolt an event onto `saveVoteRecord`.** Rejected: this is exactly the "copy a fire-and-forget snapshot adapter and represent it as transactional durability" pattern the task explicitly forbids; it would not close Gates 5–7 at all.

**Option B — Add a unique index to the existing snapshot-mirror collection without changing the write path.** Rejected: `replaceRecordMap`'s whole-collection `deleteMany` + upsert `bulkWrite` has no session/transaction, so even a unique index would only catch duplicates *after* the in-memory race has already produced two rows in the Map that then both get upserted (in mongo mode) or persisted to the JSON file (in file mode) — the index would reject the second Mongo write but the application-level state (and the file-mode default) would already be corrupted. Does not close Gate 6/7.

**Option C — Migrate Vote to a dedicated Mongo collection with a unique compound index and `runMongoTransaction`, mirroring exactly what Recovery Task 24 did for Petition Signature.** This is the only option that closes Gates 5, 6, and 7 simultaneously: `insert Vote` (rejected by a unique `(decisionId, participantId)` index on true duplicate) + `enqueue InitiativeDecisionVoteCast` (only on the true first-cast branch) inside one `runMongoTransaction`, with `voteId` derived deterministically from `(decisionId, participantId)` (e.g. `vote-${decisionId}-${participantId}`, matching Signature's `signature-${petitionId}-${participantId}` precedent) so the event ID stays stable across transaction retries.

**Recommended option: C.**

---

## 16. Migration Requirements (for the follow-up implementation task, not this one)

1. Introduce a dedicated `initiative_decision_votes` Mongo collection/repository (not the shared snapshot-mirror factory), following the Petition Signature repository shape from Recovery Task 24.
2. Make `voteId` deterministic (`vote-${decisionId}-${participantId}`) so both the unique index and the future event ID can key off it safely.
3. Add a unique compound index on `(decisionId, participantId)` (or on the now-deterministic `voteId`, which is equivalent) — this is the actual concurrency authority the database must provide (Gate 5).
4. Wrap the cast-or-update write in `runMongoTransaction`, matching the `sign-petition`-style session owner pattern.
5. Design (in that task, not this one) the split between `InitiativeDecisionVoteCast` (first cast) and `InitiativeDecisionVoteChanged` (subsequent changes), and decide whether `Changed` is in scope for that task's Participant Action projection or deferred further.
6. Add `initiative_decision_vote_cast` / `initiative_decision_vote` as new `ParticipantActionType`/`ParticipantActionSourceType` members (still forbidden in *this* task).
7. Remove the dead `{ status: 1 }` index, or add the field it was presumably meant to track, during the same migration.
8. Decide file-mode's fate: since Petition never had durable file-mode production data (per the Petition precedent doc), confirm whether the same is true for Vote before deciding whether a data migration (vs. a pure code migration) is needed.

---

## 17. Exact Next Task

**"Recover the Initiative Decision Vote Persistence Model and Transaction Boundary Before Durable Event Integration"** — the Vote-module equivalent of Recovery Task 23/24 for Petition: migrate `InitiativeDecisionVote` to a dedicated, transactional, uniquely-indexed Mongo collection with a deterministic `voteId`, *before* any `InitiativeDecisionVoteCast` event or Participant Action vocabulary extension is attempted. Only after that task closes Gates 5–7 should a Task-29-equivalent ("Introduce `InitiativeDecisionVoteCast` as the Second Durable Participant Action Producer") be authorized.

---

## Gate Results (Part 17)

| Gate | Requirement | Result |
|---|---|---|
| 1 | Durable authoritative Vote record | **Pass** (file mode: yes, survives restart; Mongo mode: fire-and-forget, weaker but present) |
| 2 | Stable Vote identity | **Conditional pass** — `voteId` is stable *once assigned* (reused across changes), but not deterministic/derivable, which blocks Gate 9's event-ID requirement |
| 3 | Validated Initiative ancestry | **Pass** — transitive ancestry via Decision is fully validated on every cast (§4) |
| 4 | Canonical `participantId` available | **Pass** — used consistently end to end (§5) |
| 5 | Database-enforced duplicate/concurrency rule | **FAIL** — no unique index exists; in-memory pre-check only; reproduced double-write defect (§6) |
| 6 | Real Mongo transaction support | **FAIL** — `runMongoTransaction`/`ClientSession` never used (§8) |
| 7 | Same-session outbox enqueue possible | **FAIL** — current adapter cannot support it; depends on Gate 6 (§8) |
| 8 | Lifecycle semantics understood | **Pass** — cast/change/no-op/close-rejection fully characterized; withdraw/invalidate confirmed absent (§7) |
| 9 | Event payload creatable without mutable lookups | **Conditional pass** — payload fields are all available on the Vote row without extra lookups, but the event *ID* is not yet derivable deterministically (depends on Gate 2's fix) |
| 10 | Deterministic Participant Action mapping | **Pass** — mapping design is a direct, lookup-free analogue of the proven `PetitionSigned` mapper (§11) |

**3 of 10 gates fail. Per Part 17's rule, the future producer may not proceed. §17's prerequisite implementation task is required first.**

---

## 18. Recovery Task 31 — Implementation Status (Factual Update, Discovery Findings Above Unchanged)

**Authority:** Recovery Task 31 ("Recover the Initiative Decision Vote Persistence Model and Transaction Boundary"), executed exactly as prescribed by §17 above. This section is an append-only factual status update; §1–§17 above describe the pre-Task-31 state as originally discovered and are preserved verbatim for historical record.

**Status:** Implemented and verified. No `InitiativeDecisionVoteCast`/`Changed` event, `ParticipantActionType`/`ParticipantActionSourceType` extension, or Participant Action consumer was added — exactly as this task's scope required.

### 18.1 Persistence Classification Change

| | Before (§3) | After (Task 31) |
|---|---|---|
| Classification | B (file/snapshot, default) or C (fire-and-forget Mongo mirror, opt-in) | **Dedicated, transaction-capable Mongo repository — authoritative** |
| Authoritative collection | `.runtime/initiative-decision-votes.json` (file) or whole-collection Mongo mirror | `initiative_decision_votes` — independently addressable per-document repository (`apps/api/src/modules/initiative-decision-vote/persistence/initiative-decision-vote.repository.ts`) |
| History collection | In-memory `Map`, mirrored the same fire-and-forget way | `initiative_decision_vote_history` — append-only, participates in the same transaction as the Vote mutation |
| Write model | Blind `Map.set` upsert + optional unawaited whole-collection `deleteMany`/`bulkWrite` | Per-document `insertOne` (first cast) / `findOneAndUpdate` with expected-version guard (changed choice), both inside `runMongoTransaction` with a real `ClientSession` |
| File/snapshot adapter | Default authoritative source | **Removed** — `initiative-decision-vote-file.persistence.ts`, `-memory.persistence.ts`, `-mongo.persistence.ts` (the old snapshot-mirror adapter), `-persistence.types.ts`, and `resolve-initiative-decision-vote-persistence.ts` are deleted; `INITIATIVE_DECISION_VOTE_PERSISTENCE` env var no longer read anywhere |
| Fire-and-forget mirror | Present (Mongo mode) | **Removed** — no unawaited write exists anywhere in the module; every successful API response now represents committed Mongo state |

### 18.2 Vote Identity Policy (Part 3)

**Chosen: Option A — deterministic, natural-key-derived ID**, per the recommendation already made in §15/§16 of this document.

```text
voteId    = initiative-decision-vote:${decisionId}:${participantId}
historyId = initiative-decision-vote-history:${decisionId}:${participantId}:${newVersion}
```

- Stable across retries and concurrent first-cast attempts (no timestamp, no randomness, no dependence on `choice`).
- Database-enforced uniqueness backs this identity independently via two separate unique indexes (`voteId`, `(decisionId, participantId)`), so even if the ID scheme is ever revisited, the natural-key constraint remains authoritative on its own.
- Old, non-deterministic `initiative-decision-vote-${Date.now()}-${random}` IDs are gone; no compatibility shim was needed (§18.5).

### 18.3 Indexes (Part 7)

**Vote collection (`initiative_decision_votes`):**
- `unique(voteId)` — new
- `unique(decisionId, participantId)` — new (the actual Gate 5 concurrency authority)
- `index(decisionId)` — retained
- `index(participantId)` — retained
- `index(decisionId, choice)` — new, supports tally queries
- `{ status: 1 }` — **removed** (dead index on a field `InitiativeDecisionVote` has never had; `dropDeadInitiativeDecisionVoteStatusIndex()` idempotently drops it on every `ensureMongoIndexes()` call, tolerating both `IndexNotFound` and `NamespaceNotFound`)

**History collection (`initiative_decision_vote_history`):**
- `unique(historyId)` — new
- `index(voteId, changedAt)` — new
- `index(decisionId, changedAt)` — new
- `index(participantId, changedAt)` — new

Verified against real Mongo index metadata by `initiative-decision-vote-producer-readiness.test.ts` ("the dead 'status' index no longer exists in real Mongo index metadata, and the required unique indexes do").

### 18.4 Transaction Boundary and Concurrency (Parts 8–11) — Closes Gates 5 and 6

- **First cast:** `insertInitiativeDecisionVote` (version 1) + `insertInitiativeDecisionVoteHistory` (cast row) inside one `runMongoTransaction`/`ClientSession`. A duplicate-key race on the deterministic `voteId` (two concurrent first casts) is caught and the loser re-reads authoritative state and retries — proven by both the focused test suite and the verification script's concurrent-first-cast fixture (4 concurrent callers → exactly 1 Vote row).
- **Changed choice:** `updateInitiativeDecisionVoteChoice` — a `findOneAndUpdate` guarded by `{ voteId, version: expectedVersion }` — plus `insertInitiativeDecisionVoteHistory` (one new row), inside the same transaction. A version-mismatch (another mutation won first) returns `null` (never throws), and the caller re-reads and retries.
- **Same-choice re-submit:** authoritative Vote is read first; if `choice` is unchanged, the function returns immediately with **no transaction opened, no Vote write, no history write** — proven not to race with a concurrent mutation because it is followed by the same version-guarded compare-and-swap path on any subsequent real change.
- **Retry loop:** `castOrChangeInitiativeDecisionVote` (the sole write entry point) bounds retries at `MAX_CONCURRENT_MUTATION_ATTEMPTS`; both duplicate-key errors and driver-level `TransientTransactionError`/`WriteConflict` labels (including when wrapped in `InitiativeDecisionVotePersistenceError`) are recognized as retryable. No new public error type was introduced — API compatibility (Part 17) is preserved.
- **Rollback:** proven directly — a forced duplicate-key collision on the history insert inside an in-flight change-choice transaction rolls back the paired Vote update (`version` and `choice` both revert to their pre-transaction values); no partial commit is observable.
- **Optimistic concurrency token:** `version` (Part 11), exactly as prescribed. The public API does not expose expected version to callers — the store internally loads current state and performs the compare-and-swap, documented here as a known internal-only limitation: a caller cannot express "change my vote only if it is still X" directly, only "cast/change to Y," which the retry loop resolves deterministically without exposing this internal detail as a new contract.

### 18.5 Decision/Eligibility Validation Placement (Part 12) and Initiative Identity (Part 13)

- Decision-exists, Decision-open, Initiative-ancestry, and Member-eligibility validation remain entirely in `initiative-decision-vote.service.ts`/`resolveVoteInitiativeAncestry`/`evaluateVoteEligibility` — **outside** the Mongo transaction, unchanged from the pre-Task-31 architecture (§4/§12 above remain accurate). The database enforces persistence/concurrency only; voting policy remains a domain/application-layer concern. Consistency assumption: these checks read state (Decision status, Member status) that is not itself mutated by the Vote transaction, so there is no atomicity requirement between "was eligible a moment ago" and "the Vote transaction commits now" beyond what already existed pre-Task-31.
- **`initiativeId` is now persisted** on the Mongo document (`InitiativeDecisionVoteMongoRecord`/`InitiativeDecisionVoteMongoDocument`), derived from the already-validated parent Decision at cast time, never accepted from the client, and never mutated after first cast. It is **not** exposed on the public `InitiativeDecisionVote` type (`toVoteResponse` strips it) — preserving Part 17 API/response-shape compatibility exactly. This closes the "zero post-commit source lookup" requirement for a future event (Part 18/§18.7 below).

### 18.6 Snapshot/Migration Compatibility Strategy (Parts 14–15)

**Option A — no migration**, selected and justified: `.runtime/initiative-decision-votes.json` and the pre-existing Mongo mirror collection contained only development/test fixture data (confirmed by direct inspection of the runtime snapshot file), never deployed production data — the same justification precedent already established and accepted for Petition (Recovery Task 23/24). No conflicting duplicate natural keys were found to report. The file/snapshot adapter and the fire-and-forget mirror have been fully removed (§18.1), not retained as a secondary authority.

### 18.7 Outbox/Gate 7 Readiness (Part 18)

Technical prerequisite closed; **no event was implemented**:
- The transaction callback exposes its `ClientSession` to every write inside it (already required for the two-write First-cast/Changed-choice units above).
- Every repository write function (`insertInitiativeDecisionVote`, `insertInitiativeDecisionVoteHistory`, `updateInitiativeDecisionVoteChoice`, `findInitiativeDecisionVoteByDecisionAndParticipant`) accepts an optional `{ session }`.
- The existing outbox `enqueueDomainEvent`-style helper already accepts a session (unchanged, pre-existing capability reused from the Petition precedent).
- A future event's payload (`voteId`, `decisionId`, `participantId`, `initiativeId`, `choice`, `castAt`) is fully available from the already-committed Vote record with **zero post-commit source lookups**, now that `initiativeId` is persisted (§18.5).
- Confirmed empty: no `initiative_decision_vote_*` outbox event exists, and Participant Action counts are unaffected by any Vote mutation (verified by both the focused test suite and the verification script).

### 18.8 Read Path / API Compatibility (Parts 16–17)

- `computeInitiativeDecisionVoteAggregates` still recomputes from live Vote rows on every call (now `async`, reading from Mongo) — no stored tally counter was introduced.
- Route paths, request bodies, response shapes, status codes, and existing domain error messages (`"Collective decision not found."`, decision-not-open messages, eligibility-rejection messages) are all unchanged. The only new internal behavior (retry-on-concurrency-conflict) is fully transparent to callers — it never surfaces as a new error type or status code.
- Propagating the store's necessary shift to `async`/`await` (Mongo I/O) required updating every direct and transitive caller (aggregates, public collective-decision projections/routes, platform statistics, workspace intelligence, civic action package content, and the relevant `verify-*-e2e.ts` scripts) to `await` results that were previously synchronous. This is a mechanical, behavior-preserving propagation, not an API or behavior change.

### 18.9 Verification and Regression (Parts 21–24)

- **Verification script:** `apps/api/src/scripts/verify-initiative-decision-vote-mongo-persistence.ts` (+ `-reload.ts` subprocess probe), covering all 24 Part 21 checkpoints. Run twice; both runs completed all 24 checkpoints and printed "Initiative Decision Vote Mongo persistence verification passed." with exit code 0.
  - **Known, pre-existing, unrelated environmental quirk documented and neutralized:** `finalizeVerificationResources()` (shared by every `runVerificationScript` caller repository-wide, not introduced by this task) triggers a fire-and-forget background Member lookup via importing the notification/email test-drain helpers; on a script that completes quickly, that lookup's Mongo operation can still be in flight when the shared client disconnects, surfacing as a delayed `unhandledRejection` (`MongoExpiredSessionError`/`MongoServerClosedError`) *after* every assertion has already passed. Reproduced in isolation with a completely empty `main()` and zero Vote code involved, confirming it is unrelated to Task 31's persistence logic. This script narrowly catches and logs (never silently swallows) exactly that known post-completion shape, only after its own pass/fail outcome is already decided — this does not mask any Vote-correctness signal. Recommended, but not made, follow-up: fix `finalizeVerificationResources()` itself at the shared-infrastructure level (out of Part 25's allowed-files list for this task).
- **Focused tests:** 65/65 passing (`initiative-decision-vote-mutation-lifecycle.test.ts`, `initiative-decision-vote-producer-readiness.test.ts` (rewritten for Task 31), `initiative-decision-vote-mongo-persistence.test.ts` (new, Part 20's 64-item matrix), `initiative-decision-vote-ancestry.test.ts`, `participation-area-cleanup.test.ts`).
- **Complete isolated `pnpm test`:** run twice. Both runs: 559 tests, 177 suites, 559 pass, 0 fail, 0 skipped, 0 cancelled; isolated Mongo test database generated and dropped cleanly both times (~14 min each). No orphaned `hu_test_*` database remained afterward; `humanity_union_dev` collection counts were confirmed unaffected (a small number of leftover debug fixture Votes created by this task's own interactive debugging, unrelated to any committed script or test, were found and removed as part of this verification, restoring the pre-task baseline).
- **`pnpm typecheck`, `pnpm build`, `git diff --check`:** all pass with zero errors.
- **ESLint** on every Task-31 production, script, and test file: zero lint errors on production/script files; the pre-existing, repository-wide test-tsconfig parsing limitation (test files are outside the ESLint project service's `tsconfig.json` inclusion) applies identically to Task 31's new test files and to already-committed test files from prior tasks (e.g. Petition's), confirmed side-by-side — not a regression or a new limitation introduced by this task.

### 18.10 Gate Reassessment (Part 27)

| Gate | Requirement | Result |
|---|---|---|
| 1 | Durable authoritative Vote record | **Pass** — dedicated Mongo collection, independently addressable, no file/snapshot fallback |
| 2 | Stable, retry-safe Vote identity | **Pass** — deterministic `initiative-decision-vote:${decisionId}:${participantId}`, no timestamp/randomness |
| 3 | Validated Initiative ancestry | **Pass** — unchanged, still enforced on every cast (§4) |
| 4 | Canonical `participantId` | **Pass** — unchanged (§5) |
| 5 | Database-enforced uniqueness | **Pass** — `unique(voteId)` + `unique(decisionId, participantId)`, verified against real Mongo index metadata; the previously-reproduced double-write defect is closed and re-tested as CLOSED |
| 6 | Real Mongo transaction support | **Pass** — every Vote mutation (first cast, changed choice) runs inside `runMongoTransaction` with a real `ClientSession`; rollback proven directly |
| 7 | Same-session outbox enqueue capability | **Technically ready — prerequisite closed, event integration not yet implemented.** Session plumbing, session-accepting repository writes, and a lookup-free future payload all exist; no event was created in this task |
| 8 | Lifecycle semantics understood | **Pass** — unchanged (§7), still fully characterized |
| 9 | Future payload available without mutable lookups | **Pass** — `initiativeId` is now persisted on first cast (§18.5), so a future event needs zero post-commit source lookups (upgraded from §17's "Conditional pass," which was blocked only on the non-deterministic `voteId` this task has now fixed) |
| 10 | Deterministic Participant Action mapping | **Pass** — unchanged design (§11), still architecturally ready |

**All 10 gates now pass or are explicitly marked "technically ready" per Gate 7's required wording. Vote persistence recovery is complete.**

### 18.11 Exact Next Task

Per §17's original sequencing and Gate 7's status above: **"Introduce `InitiativeDecisionVoteCast` (and, if in scope, `InitiativeDecisionVoteChanged`) as the Second Durable Participant Action Producer"** — the Vote-module equivalent of Recovery Task 25/29 for Petition/`PetitionSigned`, now unblocked because Gates 5, 6, and 9 (the Part 27 targets this task owned) all pass and Gate 7's technical prerequisite is closed. That follow-up task should also resolve the `Cast`/`Changed` event-split design already sketched in §7/§10 above, and add the corresponding `ParticipantActionType`/`ParticipantActionSourceType` vocabulary members — none of which this task added.

---

## 19. Recovery Task 32 — Implementation Status (Factual Update, §1–§18 Above Unchanged)

**Authority:** Recovery Task 32 ("Implement Atomic Initiative Decision Vote Durable Events"), executed exactly as prescribed by §18.11 above (the `Cast`/`Changed` split it names). This section is an append-only factual status update; §1–§18 above describe the pre-Task-32 state and are preserved verbatim for historical record.

**Status:** Implemented and verified. `InitiativeDecisionVoteCast` and `InitiativeDecisionVoteChanged` are now real, atomically-produced durable outbox events. No Vote event consumer, `ParticipantActionType`/`ParticipantActionSourceType` extension, or Participant Action projection was added — exactly as this task's scope required. This closes Gate 7.

### 19.1 Event Names and Versions (Parts 2–3)

```text
CATALOGUE_EVENTS.initiativeDecisionVoteCast    = "InitiativeDecisionVoteCast"
CATALOGUE_EVENTS.initiativeDecisionVoteChanged = "InitiativeDecisionVoteChanged"
```

Both use the exact names §10's design sketch and the task brief required — no naming conflict was found, so no deviation from `VoteCast`/`VoteUpdated`/etc. was needed. Both events use the repository's single global `DOMAIN_EVENT_SCHEMA_VERSION` metadata field (unchanged mechanism from `PetitionSigned` — the repository has no per-event-type version constant; the "1.0" schema version is a single global convention, not something Task 32 introduced or could vary per event). This is distinct from, and never confused with, `InitiativeDecisionVote.version` (the aggregate's own optimistic-concurrency counter, carried in the payload as `voteVersion`/`previousVoteVersion`/`newVoteVersion`).

### 19.2 Aggregate Identity (Part 4)

```text
aggregateType = "InitiativeDecisionVote"   (both events)
aggregateId   = voteId                      (both events)
```

`voteId` is the exact deterministic identity Task 31 established (`initiative-decision-vote:${decisionId}:${participantId}`) — never the Decision ID, Participant ID, history ID, or outbox document ID.

### 19.3 Payload Contracts (Parts 5–6, 18)

```ts
interface InitiativeDecisionVoteCastPayload {
  voteId: string;
  decisionId: string;
  participantId: string;
  initiativeId: string;
  choice: InitiativeDecisionVoteChoice;
  votedAt: string;
  voteVersion: number;
}

interface InitiativeDecisionVoteChangedPayload {
  voteId: string;
  decisionId: string;
  participantId: string;
  initiativeId: string;
  previousChoice: InitiativeDecisionVoteChoice;
  newChoice: InitiativeDecisionVoteChoice;
  changedAt: string;
  previousVoteVersion: number;
  newVoteVersion: number;
}
```

Both match §5/§6/§10's earlier design exactly, field-for-field. `participantId` is always present; `memberId` is never present in either payload (Part 18 — Vote never requires, checks, or depends on Member status, only on the actor's own account/Participant identity, matching the Task 26 correction already applied to `PetitionSignedPayload`). Deliberately excluded from both payloads, per Part 5/6: Member ID as a separate actor field, Member status, display name, email, profile data, Decision/Initiative titles or full objects, mutable Vote totals, `transparencyCohort`, Fair, Journey, Activity, notification instructions, and all request metadata (IP address, user agent). `initiativeId` is read directly from the already-committed Vote record persisted at first cast by Task 31 — zero post-commit Initiative/Decision lookup is performed by either factory (verified by source inspection: neither `createInitiativeDecisionVoteCastEvent` nor `createInitiativeDecisionVoteChangedEvent` imports or calls any Decision/Initiative/Member lookup function).

### 19.4 Event ID Formulas (Part 7)

```text
Cast:    initiative-decision-vote-cast:${voteId}
Changed: initiative-decision-vote-changed:${voteId}:v${newVoteVersion}
```

No timestamp, no randomness, in either formula. `voteId` already being deterministic (Task 31) makes the Cast ID stable across a transaction retry or a client command retry of the same logical first cast. The Changed ID is keyed on `newVoteVersion`, not on `previousChoice`/`newChoice`, precisely because a Participant returning to a prior choice (`support → abstain → support`) must produce two distinct events, never be treated as a duplicate of the first — proven by focused test 35 (`initiative-decision-vote-events.test.ts`) and verification-script step 22-23 (a second real change to a third choice produces a distinct v3 event with a distinct ID from the v2 event).

### 19.5 Timestamp Authority (Part 8)

One `timestamp = new Date().toISOString()` (or, for first cast, the same `timestamp` already used to build the Vote document) is computed exactly once per mutation attempt in `castOrChangeInitiativeDecisionVote`, before `runMongoTransaction` is entered, and passed unchanged into: the Vote document (`castAt`/`updatedAt`), the history row (`changedAt`), and the event factory (`votedAt`/`changedAt`, which becomes the envelope's `occurredAt`). No event factory calls `new Date()` internally — both `createInitiativeDecisionVoteCastEvent`/`createInitiativeDecisionVoteChangedEvent` require the timestamp as an input and pass it straight through to `createDomainEvent({ occurredAt: ... })`. Verified end-to-end by the verification script (`castEnvelope.metadata.occurredAt === cast.castAt`; `changedEnvelopeV2.payload.changedAt === changed.updatedAt`).

### 19.6 Transaction Integration (Parts 9–11, 17)

```text
First cast:      insert Vote + insert cast history row + enqueueDomainEvent(Cast)
Changed choice:  version-guarded update Vote + insert changed history row + enqueueDomainEvent(Changed)
Same-choice:     unchanged from Task 31 — pure read, no transaction, no write, no event
```

All three writes in each mutating branch share exactly one `ClientSession`, obtained from the same `runMongoTransaction` call already established by Task 31 — no second session, no fire-and-forget enqueue, no post-commit enqueue. `enqueueDomainEvent` is called only after the corresponding Vote write has already succeeded within the same, still-uncommitted transaction (Part 17 producer boundary: entirely inside `initiative-decision-vote.store.ts`'s `castOrChangeInitiativeDecisionVote`, the sole write entry point — never in the route, controller, Mongo document mapper, or Participant Action module). Proven by rollback tests (both focused-test and verification-script failure injection): a forced history-insert failure, outbox-insert failure, or duplicate-ID invariant conflict rolls back the Vote write in the same transaction, leaving no partial Vote, no partial history, and no partial outbox record.

### 19.7 Retry, Concurrency, and Duplicate-Handling Semantics (Parts 12–13)

- **Mongo transaction retries** (`session.withTransaction`'s built-in retry of transient errors): the event object is constructed once per `castOrChangeInitiativeDecisionVote` loop iteration, from the exact transition that iteration is attempting — if the transaction is retried internally by the driver, the same deterministic event is simply re-enqueued as part of the same logical attempt; if the whole iteration fails and the outer retry loop re-reads authoritative state, a stale event is never reused (it is discarded and rebuilt from the newly-read winning state next iteration).
- **Duplicate classification** (`isNonRetryableEventInvariantDuplicateError` in `initiative-decision-vote.store.ts`): a duplicate-key error is inspected for the outbox's `eventId` unique index or the history collection's `historyId` unique index (by index name or by `keyPattern`) and, if matched, is thrown as `InitiativeDecisionVoteEventInvariantConflictError` — a non-retryable invariant conflict, never silently retried and never silently swallowed. Vote's own natural-key/`voteId` duplicate — the pre-existing Task 31 concurrency signal — remains retryable exactly as before; the two are never conflated.
- **Cast duplicate:** a command retry of an already-committed first cast resolves through the pre-existing "existing Vote found, same choice → no-op" path (Task 31) before any event is ever considered — no second Cast event is possible for an already-settled first cast.
- **Changed duplicate:** a command retry of an already-committed change resolves the same way — if the Vote is already at the caller's requested choice, the no-op path returns immediately with no new event.
- **Genuine invariant conflict** (a duplicate `eventId`/`historyId` colliding with a *new* Vote mutation, deliberately reproduced by pre-seeding a colliding row in both the focused tests and the verification script): the whole transaction is rolled back and `InitiativeDecisionVoteEventInvariantConflictError` propagates to the caller — the Vote is never left in a state with a committed mutation but no matching event.

### 19.8 History/Event Correlation and Ordering (Parts 14, 24)

Every cast history row and its Cast event, and every changed history row and its Changed event for a given version, are written inside the same transaction and therefore share: `voteId`, `decisionId`, `participantId`, the one authoritative mutation timestamp, and the resulting Vote version. The event payload does not carry `historyId` (not required by any established architecture) but is fully correlatable via `voteId` + version. Ordering authority is `voteVersion` (never timestamp alone, since two mutations within the same fixture can share millisecond-precision timestamps): Cast is always version 1; each Changed event's `newVoteVersion` increments by exactly one from the previous committed version, verified directly by the verification script's three-event outbox sequence (`v1` cast, `v2` changed, `v3` changed, in strictly increasing version order) and by focused test 34/35.

### 19.9 Schema Validation (Part 15)

`initiative-decision-vote-event-shared.ts` provides shared, reusable runtime assertions (`assertNonEmptyEventField`, `assertValidEventChoice`, `assertValidEventTimestamp`, `assertValidEventVoteVersion`), and each event's own `assertValid*Payload` function additionally rejects: equal `previousChoice`/`newChoice` (Changed only) and a non-incrementing version transition (Changed only, `newVoteVersion !== previousVoteVersion + 1`). Both factories call their validator before constructing the envelope — validation happens at construction time, the same boundary the task's Part 15 requires; there is no separate outbox-deserialization-time re-validation step beyond the pre-existing, event-agnostic envelope shape validation `deserializeDomainEventEnvelope` already performs repository-wide (unchanged, not Vote-specific). This is an intentional, narrowly-scoped *addition* over the `PetitionSigned` precedent (which relies on TypeScript compile-time typing alone, with no runtime payload validator) — documented here as the one deliberate difference from that precedent, per Part 15's explicit instruction to add more for Vote.

### 19.10 Producer Boundary (Part 17)

Confirmed by a dedicated regression test (`initiative-decision-vote-producer-readiness.test.ts`, "durable events now exist" block): `initiative-decision-vote.store.ts` references `enqueueDomainEvent`, `createInitiativeDecisionVoteCastEvent`, and `createInitiativeDecisionVoteChangedEvent`; `initiative-decision-vote.service.ts` (the layer above the store) contains none of those four tokens. Event production is owned exclusively by the store's sole transaction boundary, never by routes, controllers, the Mongo document mapper, the outbox dispatcher, the history repository, or the frontend.

### 19.11 Outbox Compatibility and No-Consumer Scope (Parts 20–21)

- Both event names register and dispatch exactly like `PetitionSigned` — by exact `eventName`, through the same `outbox`/`event-handler-registry` infrastructure, unchanged.
- `getHandlersForEvent("InitiativeDecisionVoteCast")` and `getHandlersForEvent("InitiativeDecisionVoteChanged")` both return an empty array — no consumer is registered for either event (verified by both the focused test suite and the verification script).
- Outbox uniqueness remains enforced by the pre-existing `eventId` unique index (`outbox_event_id_unique`) — the same single-field mechanism `PetitionSigned` already relies on; Task 32 introduced no composite key or Vote-specific outbox schema change.
- Processed-event semantics, dispatcher event-name-driven loading, envelope (de)serialization, and Petition's own registered schema/catalogue entry are all confirmed unaffected by direct regression assertion (`PetitionSigned` catalogue entry equality check, in both the focused test file and the verification script).
- Participant Action module regression: `participant-action/index.ts`, its type unions, its mapper registry, and its Mongo document/repository files contain zero references to either new event name or to `initiative_decision_vote_cast`/`initiative_decision_vote_changed` — verified by direct source-text assertion (`initiative-decision-vote-producer-readiness.test.ts`), and `ParticipantActionType`/`ParticipantActionSourceType` remain byte-identical single-member unions from Recovery Task 27.

### 19.12 Failure Injection, Concurrency, and No-Op Regression (Parts 11, 22–23)

All of Part 22's ten failure-injection scenarios and Part 23's ten concurrency scenarios are covered across `initiative-decision-vote-events.test.ts`'s 40 focused tests (characterization items 21–38) and the verification script's rollback/retry/concurrency steps. Every scenario confirms the same invariant: **no partial Vote, no partial history, no partial outbox** on any rollback, and **exactly one event per committed mutation, zero events for any losing/rolled-back/no-op attempt.** The same-choice no-op — sequential and concurrent — remains a true no-op after Task 32 exactly as Task 31 established: no Vote write, no version change, no history row, and now additionally confirmed: no outbox event.

### 19.13 Verification and Regression (Part 25, 27)

- **New verification script:** `apps/api/src/scripts/verify-initiative-decision-vote-events.ts` (+ `-events-reload.ts` subprocess probe), covering all 30 of Part 25's checkpoints. Run more than twice during development; the two required official runs both completed all 30 checkpoints and printed "Initiative Decision Vote durable event verification passed." with exit code 0.
  - **Known, pre-existing, unrelated environmental race, same root cause already documented in Task 31's script** (§18.9): `finalizeVerificationResources()`'s fire-and-forget notification-module Member lookup can still be in flight when the shared Mongo client disconnects, surfacing as a delayed `unhandledRejection`. This script's own `unhandledRejection` guard flips its "outcome decided" flag at the end of `main()`'s own try block (before `runVerificationScript`'s `finally` block ever calls `finalizeVerificationResources()`), rather than after the whole `runVerificationScript(main)` call resolves as Task 31's script does — the later flip point was tried first here and reproduced this same race deterministically (100% of runs), because the fire-and-forget lookup's rejection can fire essentially synchronously with the client close, before control ever returns to the caller. Task 31's script's own flip point continues to pass reliably in this environment (spot-checked 3/3 during this task) and was left untouched, since it is unrelated to Task 32's own files and out of Part 30's allowed-files list.
- **Focused tests:** 95/95 passing across `initiative-decision-vote-events.test.ts` (new, 40 test cases covering all 56 of Part 26's numbered characterization items — several closely-related items are combined into one test where natural, e.g. one test covers items 29/31/32/33 together), `initiative-decision-vote-mongo-persistence.test.ts` (one test updated to assert the new Cast event, per Part 27's "update only where Gate 7 has become implemented"), `initiative-decision-vote-producer-readiness.test.ts` (one block rewritten from "no durable event exists today" to "durable events now exist"), `initiative-decision-vote-mutation-lifecycle.test.ts`, and `initiative-decision-vote-ancestry.test.ts` — the last two unchanged by Task 32 and rerun as regression.
- **Complete isolated `pnpm test`:** run twice. Both runs: 601 tests, 182 suites, 601 pass, 0 fail, 0 skipped, 0 cancelled; isolated Mongo test database generated and dropped cleanly both times (~12.2 minutes each). No orphaned `hu_test_*` database remained afterward. A small number of leftover outbox/history debug fixtures created by this task's own pre-isolation interactive debugging (before the isolated-database test-invocation convention below was adopted for all further ad hoc runs) were found and removed from `humanity_union_dev`, restoring the pre-task baseline — see §19.16.
- **`pnpm typecheck`:** passes with zero errors.
- **ESLint** on every Task 32 production/script file (`catalogue-events.ts`, `initiative-decision-vote.store.ts`, `initiative-decision-vote.errors.ts`, `initiative-decision-vote-event-shared.ts`, `initiative-decision-vote-cast.event.ts`, `initiative-decision-vote-changed.event.ts`, `verify-initiative-decision-vote-mongo-persistence.ts`, `verify-initiative-decision-vote-events.ts`, `verify-initiative-decision-vote-events-reload.ts`): zero lint errors. Test files hit the same pre-existing, repository-wide test-tsconfig parsing limitation already documented in §18.9 — confirmed identical for both a brand-new Task 32 test file and an already-committed Task 31 test file side by side; not a regression or a new limitation.

### 19.14 Targeted Regression Reruns (Part 27)

All explicitly named regression targets were re-executed as part of the two complete `pnpm test` runs above (the isolated runner discovers and runs the entire `test/` tree in one process, so these are not separate invocations): Task 31 Vote persistence tests, Task 30 Mongo isolation tests, Task 29 test discovery characterization, Task 28 producer-readiness tests (updated per §19.10/§19.11 above), Task 27 Participant Action tests, Task 26 Participant identity tests, Petition durable event tests, Petition consumer tests, outbox dispatcher tests, processed-event tests, Mongo transaction tests, Initiative ancestry tests, and Collective Decision lifecycle tests — all passing, 0 failures, both runs.

### 19.15 Gate Reassessment (Part 29)

| Gate | Requirement | Result |
|---|---|---|
| 1 | Authoritative durable Vote | **Pass** — unchanged from Task 31 |
| 2 | Stable deterministic Vote ID | **Pass** — unchanged from Task 31 |
| 3 | Validated Initiative ancestry | **Pass** — unchanged from Task 31 |
| 4 | Canonical `participantId` | **Pass** — unchanged from Task 31; both new event payloads carry it, never `memberId` |
| 5 | Database uniqueness | **Pass** — unchanged from Task 31 |
| 6 | Real transaction | **Pass** — unchanged from Task 31; now also carries the event enqueue inside the same transaction |
| 7 | Vote event enqueued in same transaction | **Pass** — upgraded from Task 31's "technically ready"; `InitiativeDecisionVoteCast`/`Changed` are now real, atomically-enqueued outbox events (§19.6) |
| 8 | Lifecycle represented by Cast and Changed events | **Pass** — new this task; first cast → Cast, every real change → Changed, no-op → no event, exactly matching the canonical lifecycle (§7) |
| 9 | Payloads require no mutable source lookups | **Pass** — confirmed by source inspection of both factories (§19.3); no Decision/Initiative/Member lookup exists in either |
| 10 | Deterministic future Participant Action mapping | **Pass** — unchanged design (§11); still architecturally ready, still not implemented |

**All 10 gates now pass outright. Vote is a durable event producer. Participant Action integration for Vote remains unimplemented — the two are explicitly distinct facts, not to be conflated.**

### 19.16 Dev-Database Hygiene Note

During this task's own interactive verification and debugging (before every subsequent ad hoc standalone test-file invocation was run with the isolated-database convention `MONGODB_TEST_DATABASE=hu_test_...` plus `--test-force-exit`, matching what `pnpm test` already does automatically), a small number of stray outbox/history fixture documents were written directly to `humanity_union_dev` by pre-isolation ad hoc runs whose test files' `after()` hooks predate outbox-awareness. These were identified by fixture-ID regex, deleted, and reverified at zero before any further work in this task, and again confirmed at zero after the final verification-script runs (§19.13). No `dev:api`-owned data was read or modified at any point — only this task's own uniquely-IDed fixture documents were ever touched.

### 19.17 Exact Next Task

Gate 7 and Gate 8 are now closed. The next task in this sequence, per §18.11's original naming (now fulfilled by Task 32) and Task 32's own Part 21 scope boundary, is: **"Implement the Participant Action Ledger Projection for `InitiativeDecisionVoteCast`/`InitiativeDecisionVoteChanged`"** — the Vote-module equivalent of Recovery Task 27 for `PetitionSigned`: register a Participant Action consumer for both events, add the corresponding `ParticipantActionType`/`ParticipantActionSourceType` vocabulary members (`initiative_decision_vote_cast`/`initiative_decision_vote_changed` and `initiative_decision_vote`, per §11's design), and decide how (or whether) a `Changed` fact should be represented in an append-only ledger that has, until now, only ever modeled single, non-superseding facts (`PetitionSigned`) — none of which this task implemented or was authorized to implement.

---

## 20. Recovery Task 33 — Implementation Status (Factual Update, §1–§19 Above Unchanged)

**Authority:** Recovery Task 33 ("Project Initiative Decision Vote Events into the Participant Action Ledger"), executed exactly as prescribed by §19.17 above. This section is an append-only factual status update; §1–§19 above describe the pre-Task-33 state and are preserved verbatim for historical record.

**Status:** Implemented and verified. `InitiativeDecisionVoteCast` and `InitiativeDecisionVoteChanged` are now consumed into the Participant Action Ledger as `initiative_decision_vote_cast` and `initiative_decision_vote_changed` actions, respectively. Vote is now the platform's second durable Participant Action producer, after `PetitionSigned`. The Vote aggregate remains the sole authority for current Vote state; the Participant Action Ledger is explicitly **not** the Vote event store and is never queried to reconstruct current choice.

### 20.1 Vocabulary Added (Parts 2–3)

```text
ParticipantActionType      += "initiative_decision_vote_cast" | "initiative_decision_vote_changed"
ParticipantActionSourceType += "initiative_decision_vote"
```

`"petition_signed"`/`"petition_signature"` are byte-identical to Task 27, confirmed by direct regression assertion. None of the explicitly forbidden alternative names (`member_vote`, `vote_activity`, `decision_participation`, `initiative_vote`, `vote_updated`) were introduced.

### 20.2 Source Identity (Part 3)

```text
sourceType = "initiative_decision_vote"   (both action types)
sourceId   = voteId                        (never decisionId, initiativeId, participantId, eventId, or historyId)
```

### 20.3 Deterministic Participant Action Identity (Part 4)

```text
Cast:    participant-action:initiative-decision-vote-cast:${voteId}
Changed: participant-action:initiative-decision-vote-changed:${voteId}:v${newVoteVersion}
```

Identical formula to Task 27's Petition precedent (`participant-action:${sourceEventId}`) — no new ID scheme was invented; the distinctness of Cast vs. each Changed version falls directly out of Task 32's own event-ID formulas (§19.4 above), never out of any new logic added by this task.

### 20.4 Mappers (Parts 5–8)

`mapInitiativeDecisionVoteCastToParticipantAction` and `mapInitiativeDecisionVoteChangedToParticipantAction` (`apps/api/src/modules/participant-action/application/`) are pure, synchronous, deterministic functions of the event envelope alone — no Mongo call, no Vote/Decision/Initiative/Member lookup, no system clock, no random ID, no event-object mutation. Both perform strict event-name/schema-version/aggregate-type/aggregate-id-vs-payload-voteId checks before mapping, reusing shared validators (`initiative-decision-vote-participant-action-shared.ts`) analogous to the producer's own `initiative-decision-vote-event-shared.ts`.

Mapped fields (both): `participantActionId`, `participantId`, `initiativeId`, `actionType`, `sourceType`, `sourceId` (= `voteId`), `sourceEventId`, `sourceEventName`, `sourceEventSchemaVersion`, `occurredAt`, `validityStatus` (always `"valid"`), `correlationId`, `causationId`, `metadata`.

### 20.5 Metadata Decision (Part 7)

Task 27's `ParticipantActionRecord` had no metadata field at all — Petition needed none. Per Part 7's preferred order ("extend an existing discriminated metadata union" before "add a narrow typed field," before "no metadata if it would require a broad redesign"), and because no existing union was there to extend, the smallest additive model was chosen: one new field, `metadata: ParticipantActionMetadata | null`, where `ParticipantActionMetadata` is a `kind`-discriminated union of exactly two interfaces:

```ts
interface InitiativeDecisionVoteCastParticipantActionMetadata {
  kind: "initiative_decision_vote_cast";
  decisionId: string;
  choice: InitiativeDecisionVoteChoice;
  voteVersion: number;
}

interface InitiativeDecisionVoteChangedParticipantActionMetadata {
  kind: "initiative_decision_vote_changed";
  decisionId: string;
  previousChoice: InitiativeDecisionVoteChoice;
  newChoice: InitiativeDecisionVoteChoice;
  previousVoteVersion: number;
  newVoteVersion: number;
}
```

Petition's own mapper was updated to set `metadata: null` (no back-filled content — Petition genuinely has none of these fields) so that the schema stays a single, non-nullable-shaped column across all three action types, never an optional field only some rows have. Every value in both metadata shapes is reconstructible directly from the source event payload — no derived, mutable, or looked-up data.

### 20.6 Fields Intentionally Excluded (Parts 5–6, 19)

Never persisted: display name, Member status, Decision/Initiative titles, mutable Vote tallies, a full event envelope, the full Vote object, email, pseudonym, authentication identifiers, IP address, user agent, or any request-context metadata. `sourceId` is the Vote's own `voteId`, never a lookup-derived alias.

### 20.7 Participant Identity, Member Terminology (Parts 16, 19)

`participantId` is the sole actor-identity field on every Vote-sourced action, exactly as it already is for `petition_signed`. No field named `memberId`, `memberAction`, or `memberActivity` was introduced. The consumer never queries current Member status — the durable event already proves the validated mutation committed; a Participant Action remains attributable to the Participant even if Member status later changes, identically to the existing Petition guarantee.

### 20.8 Consumer Handlers and IDs (Parts 9–10)

```text
handleInitiativeDecisionVoteCastForParticipantAction     → consumerId "participant-action.initiative-decision-vote-cast.v1"
handleInitiativeDecisionVoteChangedForParticipantAction  → consumerId "participant-action.initiative-decision-vote-changed.v1"
```

Both follow the exact `<module>.<event>.v1` convention Task 27 already established for `"participant-action.petition-signed.v1"` (not the Member Action Ledger blueprint's illustrative flat-string convention — a naming-convention alignment, not a contract change, identical in kind to Task 27's own §15.1 note). Both are registered via the existing `registerDomainEventHandler`/`event-handler-registry` framework inside `registerParticipantActionHandlers()` (`apps/api/src/modules/participant-action/index.ts`) — no custom polling, no direct outbox-collection read, no bypass of processed-event infrastructure. `resetParticipantActionHandlersForTests()` was extended to reset all three registrations together, exactly as it already reset the one Petition registration.

### 20.9 Petition Handler Compatibility (Part 17)

Confirmed unchanged, by both direct regression assertion (`initiative-decision-vote-producer-readiness.test.ts`) and the verification script's step 30: `petition-signed.participant-action-handler.ts` and `petition-signed-to-participant-action.mapper.ts` contain zero references to any Vote-specific token; `PARTICIPANT_ACTION_PETITION_SIGNED_CONSUMER_ID` is unchanged; a `PetitionSigned` event dispatched alongside Cast/Changed events in the same test run projects correctly with no cross-contamination of action type, source type, or metadata shape.

### 20.10 Processed-Event Claim and Delivery Model (Parts 11, 20, 23)

Reused unmodified: the dispatcher's existing `processed-events` claim on `(consumerId, eventId)`, with the existing stale-claim reclaim window. No new idempotency mechanism was invented for Vote. Physical delivery model, stated precisely per Part 20's required language:

```text
At-least-once event delivery + deterministic idempotent projection
    = exactly one logical Participant Action per durable Vote event.
```

This is not physical exactly-once execution — a handler can genuinely run more than once for the same event (retry, redispatch, concurrent workers) — but the deterministic `participantActionId`/`sourceEventId` plus the storage-level unique indexes guarantee the *effect* is exactly one row, every time, proven by 10x-replay, concurrent-replay, and cross-restart tests below.

### 20.11 Insert Conflict Classification (Part 12, narrows Task 27)

`insertParticipantActionIfAbsent` (`participant-action.repository.ts`) was extended: on a duplicate-key error, the already-stored document is re-read and compared field-for-field against the incoming record (excluding `recordedAt`, the one field expected to legitimately differ between two mapper invocations of the identical source event). An exact match returns `"idempotent_replay"` (the same successful outcome Task 27 already specified for every real replay); a mismatch throws the new `ParticipantActionConflictError` rather than being silently swallowed as a false-positive replay. This closes a latent gap in the original Task 27 implementation — never exercised by Petition's own tests, since nothing had previously attempted two different contents under one key — without changing any real Petition or Vote replay's observed behavior.

### 20.12 Append-Only Enforcement (Parts 13–14, 19.3 how Changed is represented)

No `updateParticipantAction`/`replaceParticipantAction`/`invalidateParticipantAction`/`deleteParticipantAction`/`supersedeParticipantAction` function was added — confirmed by the same "no general update export" regression test Task 27 already established, now also covering the two new handler files. A Changed fact is projected as an **ordinary, independent row** — same shape, same repository path as Cast/Petition — never a mutation of, or reference to, the Cast row (`previousParticipantActionId`, the blueprint's illustrative reversal-linkage field, is deliberately left unused here: a Vote change is not a correction of the Cast fact, which remains true; it is a second, independent fact). Verified end-to-end: `version 1 cast → support` produces one Cast action; `version 2 changed → support→oppose` produces one Changed action; `version 3 changed → oppose→support` produces a second, distinct Changed action; all three remain durable, unmutated, and independently addressable by both focused tests and the verification script.

### 20.13 Replay and Ordering Independence (Parts 14, 21)

Both handlers were verified to require zero prior state: a Changed event's projection never reads, requires, or waits for its corresponding Cast action to exist. The verification script's dedicated out-of-order fixture proves this directly — a v3 Changed event is projected via a direct handler call while its Cast and v2 Changed events remain completely unprocessed, then the v2 Changed event is projected "late," with both actions ending up present, correct, and mutually unaffected regardless of arrival order. Ten repeated replays of the Cast event (via direct handler invocation interleaved with real dispatch) leave the ledger at a stable count the entire time — no duplicate is ever created mid-sequence, not merely at the end.

### 20.14 Concurrency (Part 22)

Concurrent-replay coverage (focused tests 41–42, `initiative_decision_vote_cast`/`_changed` variants of Task 27's existing `Promise.all`-based duplicate-consumption pattern) confirms: `Promise.all`-issued concurrent deliveries of the same event settle to exactly one row, with the loser resolving through the same `"idempotent_replay"`/duplicate-key path already proven for Petition. No deadlock, no cross-event-type corruption, and no source lookup was introduced by concurrent delivery.

### 20.15 Same-Choice No-Op Projection (Part "same-choice no-op projection behavior")

Task 32 already guarantees a same-choice re-submit produces zero events. Since this consumer only ever runs in response to a real, produced event, a same-choice no-op necessarily produces zero Participant Actions — verified directly by the verification script (step 14-15: re-submitting the identical Vote choice yields no new outbox event and no new Participant Action).

### 20.16 Zero Source Lookups (Part 15, 32-36 of the final-response numbering)

Confirmed by direct source inspection (neither mapper imports or calls any Vote/Collective-Decision/Initiative/Member/profile lookup function) and by the verification script's explicit design (every fixture's `initiativeId`/`decisionId`/`choice`/`version` facts flow from the event payload the mapper already receives, never from a re-fetch). Vote lookup count: 0. Decision lookup count: 0. Initiative lookup count: 0. Member lookup count: 0.

### 20.17 Failure Semantics (Part 20)

| Scenario | Verified behavior |
|---|---|
| Mapper validation failure (wrong event name, bad schema version, aggregate/voteId mismatch, missing/invalid field, equal previous/new choice, non-incrementing version) | Throws before any repository call; zero Participant Action created |
| Participant Action insert failure (`setForceParticipantActionInsertFailureForTests`) | `ParticipantActionPersistenceError` propagates; the dispatcher releases the processed-event claim; no successful "processed" marking survives a failed insert |
| Processed-event claim failure (event already claimed/in-progress) | The handler is never invoked while a claim is held (`claimEventForProcessing` reports `inProgress: true`, `claimed: false`); zero Participant Action created until the claim is released and processing legitimately resumes |
| Duplicate same-event replay | `"idempotent_replay"`, zero new row |
| Duplicate action ID / sourceEventId, compatible content | `"idempotent_replay"`, zero new row (§20.11) |
| Duplicate action ID / sourceEventId, incompatible content | `ParticipantActionConflictError` thrown, never silently swallowed (§20.11) |
| Retry after transient failure | A subsequent legitimate handler invocation succeeds and produces exactly one row, proven directly after simulating both an insert failure and a claim-held condition |
| Restart/reconstruction | A Participant Action inserted by one process is read back byte-identical by a freshly-started OS process (verification script steps 31-32, via `verify-initiative-decision-vote-participant-actions-reload.ts`) |

### 20.18 Public API and Read Compatibility (Parts 18, 25)

No public Vote-action API, route, or participant-facing wording was added — Task 27 never added a public Participant Action API either, so there was none to extend. The pre-existing internal repository reads (`listParticipantActionsByParticipantId`, `listParticipantActionsByInitiativeId`, `findParticipantActionById`, `findParticipantActionBySourceEventId`) were confirmed, by a new dedicated focused test, to return a **mixed** set of `petition_signed`/`initiative_decision_vote_cast`/`initiative_decision_vote_changed` rows together — correct `occurredAt`-descending ordering across types, no unsafe cast, no schema rejection, no metadata loss for any of the three shapes, and Petition's `metadata: null` unaffected by Vote's now-populated metadata.

### 20.19 Verification and Regression (Parts 23, 29)

- **New verification script:** `apps/api/src/scripts/verify-initiative-decision-vote-participant-actions.ts` (+ `-participant-actions-reload.ts` subprocess probe), covering all 36 of Part 23's checkpoints end-to-end against a real Mongo instance (the dev database, per this repository's established verification-script convention — see §20.19.1 below). Run twice as required, both immediately re-confirmed in this pass: both runs printed every numbered step (1 through 36) and "Initiative Decision Vote Participant Action verification passed." with exit code 0, with zero manual intervention between runs.
  - **Known, pre-existing, unrelated environmental race** (same root cause already documented in Task 31 §18.9 and Task 32 §19.13): a concurrently running long-lived `dev:api` process's own background outbox dispatcher — which, after this task, also registers the two new Vote consumers — can independently pick up and project a fixture's Cast event before this script's own explicit dispatch call runs. The script's out-of-order fixture step is written to prove the property that matters (a Changed action is projected correctly without this script itself ever having dispatched or handled the corresponding Cast event), rather than asserting the Cast event's global processing count is zero, which cannot be guaranteed in a shared-database development environment with a live consumer now registered. The same `unhandledRejection` "outcome decided" guard from Task 32's script is reused unmodified for the identical fire-and-forget-notification-module race. Neither of the two runs in this pass actually hit the race (both completed all steps including step 27's out-of-order assertions cleanly), but the tolerant assertion remains in place for when a `dev:api` process is running concurrently.
  - **New operational fact this task surfaces (§20.20 below):** because a real consumer is now wired into `bootstrapEventInfrastructure()` (called by the live `dev:api` process, which hot-reloads via `tsx watch`), any Vote mutation performed against the shared development database — including by ad hoc, non-isolated test-file invocations — can now produce a real, durable Participant Action row as an automatic side effect. This was not previously possible for Vote (no consumer existed before this task).
- **Focused tests:** all of Part 24's 72 characterization items are covered (several combined into one test where natural, e.g. one test per numbered mapper-validation rejection) across three new dedicated files (`initiative-decision-vote-participant-action-mapping.test.ts`, `initiative-decision-vote-participant-action-consumer.test.ts`, `initiative-decision-vote-participant-action-failure-and-scope.test.ts`) plus targeted updates to `participant-action-vocabulary.test.ts` (vocabulary exhaustiveness), `participant-action-repository.test.ts` (metadata field + new Part 25 mixed-type query-compatibility test), and `initiative-decision-vote-producer-readiness.test.ts` (one characterization block flipped from "no Vote consumer exists" to "a Vote consumer now exists," matching this file's own established convention from Task 31/32 for closed-defect/closed-gap sections). Isolated run (all seven `participant-action` test files together, via `--import ./test/helpers/test-setup.ts` and a freshly generated `MONGODB_TEST_DATABASE`, dropped on completion): **132 tests, 33 suites, 132 pass, 0 fail, 0 skipped.**
- **Complete isolated `pnpm test`:** run twice via `apps/api`'s own `pnpm test` (`run-tests-recursively.ts`, which generates and drops its own isolated database automatically). Both runs: **686 tests, 195 suites, 686 pass, 0 fail, 0 skipped, 0 cancelled, 0 todo.** Run 1: isolated database `hu_test_ms6yepvr_1v5h_2c770808`, duration 849063ms (~14.15 min). Run 2: isolated database `hu_test_ms6yxgf6_1vse_0b59adf7`, duration 811408ms (~13.52 min). Both isolated databases were dropped cleanly by the runner itself immediately after each run; no orphaned `hu_test_*` database was observed afterward.
- **`pnpm typecheck`, `pnpm build`, `git diff --check`:** all pass with zero errors.
- **ESLint** on every Task 33 production/script file (`domain/participant-action.types.ts`, `infrastructure/participant-action.mongo-document.ts`, `infrastructure/participant-action.repository.ts`, `participant-action.errors.ts`, `application/petition-signed-to-participant-action.mapper.ts`, `application/initiative-decision-vote-participant-action-shared.ts`, `application/initiative-decision-vote-cast-to-participant-action.mapper.ts`, `application/initiative-decision-vote-cast.participant-action-handler.ts`, `application/initiative-decision-vote-changed-to-participant-action.mapper.ts`, `application/initiative-decision-vote-changed.participant-action-handler.ts`, `index.ts`, `verify-initiative-decision-vote-participant-actions.ts`, `verify-initiative-decision-vote-participant-actions-reload.ts`): zero lint errors. Test files hit the same pre-existing, repository-wide test-tsconfig parsing limitation already documented in §18.9/§19.13 — confirmed identical for Task 33's own new test files; not a regression or a new limitation.

### 20.20 Dev-Database Hygiene Note (Extends §19.16)

Identical root cause to §19.16, with one new wrinkle specific to this task: because `dev:api`'s background dispatcher now runs real Vote-consuming handlers (not merely "mark published, no-op" as before Task 33), an ad hoc, non-isolated test-file invocation against the shared `humanity_union_dev` database that calls `castOrChangeInitiativeDecisionVote` directly — even one that never itself dispatches or asserts anything about Participant Action — can, via the independently-running `dev:api` process, produce real Participant Action rows as a side effect. A concrete instance of exactly this was hit and confirmed during this task's own final regression pass: the focused `participant-action` suite was, once, launched by hand without the `--import ./test/helpers/test-setup.ts` flag that `run-tests-recursively.ts` normally supplies, so `MONGODB_TEST_DATABASE` was set but never enforced by `test/helpers/test-setup.ts`, and that one run executed directly against `humanity_union_dev`. A direct post-run query of `participantActions` (count and a fixture-ID-prefix scan) found **zero** stray documents — the test files' own `after`/`afterEach` cleanup hooks (which delete by explicit fixture ID regardless of which database they are pointed at) had already removed everything they created — so no manual deletion was required. The suite was then re-run correctly, with `--import ./test/helpers/test-setup.ts` and a freshly generated, dropped-on-completion isolated database, for the numbers recorded in §20.19. **Recommendation for future tasks:** always invoke test files through `pnpm test` (or replicate its exact `--import ./test/helpers/test-setup.ts` + generated `MONGODB_TEST_DATABASE` invocation) rather than a bare `node --test`/`tsx --test`, now that Vote has a live consumer — omitting the import silently disables the isolation guard instead of failing loudly.

### 20.21 Readiness Status (Part 27)

```text
Initiative Decision Vote
    = durable event producer (Task 32, unchanged)

Vote Participant Action consumer
    = implemented (this task)

Participant Action Ledger
    = records Cast and Changed facts (petition_signed unaffected)

Vote aggregate
    = remains the sole authority for current choice; never reconstructed from the ledger
```

Precise, non-overclaiming statement of the delivery/idempotency guarantee (Part 20/27's required wording): **at-least-once event delivery with deterministic idempotent projection produces exactly one logical Participant Action per durable Vote event.** The Participant Action Ledger is explicitly **not** the Vote event store, and is never the system of record for current Vote choice — both remain the Vote aggregate's exclusive responsibility, unchanged by this task.

### 20.22 Exact Next Task

Vote is now fully symmetric with Petition as a Participant Action source: both have a durable producer and a registered, idempotent, append-only consumer. Per this blueprint's §9 rollout order, the next task in sequence is either (a) onboard the next Phase 4 producer (a third `initiative-*` module's own durable event, following the identical Task 31→32→33 pattern now proven twice), or (b) begin Phase 3 (a private, read-only Participant timeline projection over the now-two-producer ledger) — neither of which this task implemented or was authorized to implement.
