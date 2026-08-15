# Petition Persistence and Initiative Boundary — Recovery Design v1.0

**Authority:** Recovery Task 23 ("Recover the Petition Persistence Model and Initiative Validation Boundary Before Durable Event Integration"), governed by `ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md`, `ADR-MEMBER-ACTION-LEDGER-v1.0.md`, `MEMBER_ACTION_LEDGER_IMPLEMENTATION_BLUEPRINT_v1.0.md` §13, and Recovery Task 22's petition pilot-safety findings.

**Status:** Discovery/design artifact only. No production Petition code, Mongo collection, migration, index, or event was added by this task. All claims below are backed by either direct source citation or a passing characterization test in `apps/api/test/unit/petition/petition-persistence-characterization.test.ts`.

---

## 1. Current State

### 1.1 Petition's purpose and lifecycle

Petition is the fourth canonical civic-artifact stage (`discussion → proposal → petition → decision`, per `CIVIC_ARTIFACT_TYPES`): after a Collective Decision approves an Initiative to proceed, a Petition collects public endorsement signatures during an open period, then closes with a recorded outcome. Lifecycle: `Draft → Ready → Published → Open → Closed → Archived` (`ALLOWED_TRANSITIONS`, `petition.helpers.ts`).

### 1.2 Production mutations (all in `petition.store.ts` unless noted)

1. `createPetition` — validates an Approved, existing Collective Decision (`assertApprovedCollectiveDecision`) and decision-path uniqueness (`assertUniqueCollectiveDecisionPath`); does **not** validate `subject.initiativeId` existence, and does not check `decision.decisionSubjectType === "Initiative"`.
2. `updatePetition` — merges `subject`/`policy` while `Draft`/`Ready`.
3. `preparePetition` — `Draft → Ready`, requires non-empty title/summary.
4. `publishPetition` — `Ready → Published`, builds `shareLink`.
5. `openPetition` — `Published → Open`, sets `endorsementPeriod.opensAt`.
6. `signPetition` — the authoritative signing mutation (see §1.3).
7. `closePetition` — `Open → Closed`, sets `endorsementPeriod.closesAt`.
8. `archivePetition` — `Closed → Archived` (read-only afterward, `assertMutablePetition`).
9. **No signature withdrawal/removal mutation exists** — `Signature.status` includes `"Withdrawn"` in the type, but no code path ever sets it.
10. **No deletion mutation exists.**
11. **No process-reload/rehydration path exists** — see §1.6.

### 1.3 Signing flow, precisely

```text
signPetitionHandler (petition.controller.ts)
  → validateSignBody / parseSignRequest (petition.validators.ts)
  → signPetition(petitionId, participantId, participationMode) [petition.store.ts]
      → getMutablePetition(petitionId)                      [1 Petition lookup]
      → assertMutablePetition / status === "Open" check
      → hasParticipantSigned(petition, participantId)        [1 duplicate check, synchronous]
      → await isParticipantEligibleForPetition(...)          [ONLY await point; calls getMemberById → Mongo/fixture]
      → construct Signature, assertSignaturesImmutable, append
      → touchPetition (recompute supportMetrics/outcome, clone, return)
  → mapPetitionResponse (structuredClone) → 201 response
```

**Zero Initiative lookups occur anywhere in this path** (confirmed by source inspection and by `apps/api/test/unit/petition/petition-persistence-characterization.test.ts`, describe block 2).

### 1.4 Aggregate shape (exact, `Petition` in `@hu/types`)

```ts
interface Petition {
  petitionId: string;
  collectiveDecisionId: string;       // mandatory, assigned at creation, never re-validated against subject.initiativeId
  status: PetitionState;
  createdAt: string; updatedAt: string;   // updatedAt bumped by touchPetition on every mutation
  subject: { decisionId; initiativeId; title; summary };  // initiativeId typed InitiativeId (= plain string, no runtime brand)
  policy: PetitionPolicy;
  shareLink: ShareLink | null;
  signatures: Signature[];            // EMBEDDED array, full objects
  supportMetrics: SupportMetrics;     // derived, recomputed on every touchPetition
  outcome: PetitionOutcome | null;    // derived from status, recomputed on every touchPetition
}
```

There is **no version field** on `Petition` (no optimistic-concurrency counter) — `updatedAt` is a timestamp, not a monotonic version. Signatures are embedded, fully returned through every API that returns a Petition, and are **not independently addressable** (no `getSignatureById`, confirmed by test). `participationMode` is optional and not enforced as one-per-mode; a Member cannot hold two signatures under the current model because `hasParticipantSigned` keys only on `participantId`, ignoring `participationMode` entirely.

### 1.5 Signature shape (exact, `Signature` in `@hu/types`)

```ts
interface Signature {
  signatureId: string;    // deterministic: `signature-${petitionId}-${participantId}` — see §1.7
  petitionId: string;
  participantId: string;  // MemberId
  signedAt: string;
  visibility: SignatureVisibility;  // "operational" | "restricted" | "public" — always "operational" in practice
  status: SignatureStatus;          // "Active" | "Withdrawn" — "Withdrawn" is dead code today
  participationMode?: ParticipationMode;  // "Community" | "Public"
}
```

No `initiativeId` on Signature today. No schema version field.

### 1.6 Persistence model, exact

`petition.store.ts` line 31: `const petitions = new Map<string, Petition>([[bootstrapPetition.petitionId, structuredClone(bootstrapPetition)]])`. This is a **bare in-process singleton Map**, not a pluggable adapter. Confirmed empirically (`petition-persistence-characterization.test.ts`, describe block 10): a Petition created in one Node process is invisible to a freshly-spawned process — **all Petition/Signature data is lost on every restart, redeploy, or crash**, and does not survive horizontal scaling (each instance has its own Map).

**This is unlike almost every other `initiative-*` module.** `initiative-decision-vote`, and (per `apps/api/src/infrastructure/mongodb/mongo-collections.ts` naming and matching `*-mongo.persistence.ts` files) most other `initiative-*` stores use a **pluggable three-mode snapshot adapter** (`memory` | `file` (default) | `mongodb`, selected via an env var like `INITIATIVE_DECISION_VOTE_PERSISTENCE`). Petition has none of this — no env var, no adapter file, no `file`-mode fallback. It is a strictly weaker persistence story than its siblings.

**Critical nuance about that adapter pattern (do not copy blindly):** `createMongoSnapshotPersistence` (`apps/api/src/infrastructure/mongodb/create-mongo-snapshot-persistence.ts`) implements `save()` as **synchronous-looking but fire-and-forget**: it updates an in-memory `cache` immediately, then kicks off `persistSnapshot(...)` (a whole-collection `deleteMany` + bulk `replaceOne upsert` via `replaceRecordMap`) **without awaiting it** (`pendingWrite = persistSnapshot(snapshot).catch(...)`), no session, no transaction. It durably mirrors state across restarts *eventually*, but provides **no atomicity, no transactional guarantee, and no compatibility with a same-transaction outbox enqueue** — it is architecturally the same class of "fire-and-forget" pattern Task 21 already rejected for `emitCivicNotificationEvent`, just applied to core aggregate persistence instead of notifications. **Adopting this exact pattern for Petition would fix process-restart durability but would not unblock Task 22's resumption**, since Task 22's binding precondition is atomic signature+outbox enqueue, not just durability.

### 1.7 Concurrency guarantee: none — reproduced defect

The in-memory sequence is `check duplicate (sync) → await eligibility → append (sync)`. Because the only `await` sits *between* the duplicate check and the append, **two concurrent `signPetition` calls for the same participant both pass the duplicate check before either appends**, producing two active signatures for one participant. This is not a multi-instance-deployment hypothetical — it reproduces within a single Node process/event loop and is now pinned by a passing test (`petition-persistence-characterization.test.ts`, describe block 4, "KNOWN DEFECT"). The deterministic signature ID (`signature-${petitionId}-${participantId}`) means the second append does not even collide on ID — both signatures get literally identical `signatureId`s, silently violating the assumption that `signatureId` is unique, since uniqueness is never checked, only array-append.

### 1.8 Initiative and Collective Decision boundary

- `petition.subject.initiativeId`: syntactically-required non-empty string at creation (`validateCreatePetition`); **never existence-checked**, at creation or signing (Task 22 finding, reconfirmed here).
- `petition.collectiveDecisionId`: mandatory, assigned at creation, checked for existence and `outcome.outcomeType === "Approved"` — but **never checked that `decisionSubjectType === "Initiative"`**, nor cross-checked against `subject.initiativeId` (the `CollectiveDecision` type has no `initiativeId` field at all to compare against). A Petition can, today, be created referencing an Approved Decision whose subject is a `"Candidate"` or `"Policy"`, with a completely unrelated `subject.initiativeId` string, and nothing rejects it.
- `toPublicPetitionProjection` does call `getInitiativeById(petition.subject.initiativeId)`, but only as a **soft, read-only enrichment** (falls back to `petition.subject.summary` if null) — not a validation gate, and it runs long after creation/signing.

### 1.9 Direct callers (read-only; no write caller outside `petition.controller.ts`)

11 call sites across 9 files call `getPetition` / `getPetitionByInitiativeId` / `listPetitions` **synchronously** today: `implementation.store.ts` (×2 incl. `assertPetitionEligibility`), `implementation-commitment.store.ts` (×2), `public-implementation-commitment.projection.ts`, `public-implementation.projection.ts`, `public-civic-archive-lifecycle.projection.ts`, `public-initiative-experience.service.ts` (×2), `capability02-integration.service.ts` (×3), `global-search.index.ts`, `public-petition.routes.ts`. **None call any write function.** Every one of these 9 files' enclosing functions is currently synchronous — migrating Petition reads to async (required once Mongo-backed) requires converting all of them, transitively up their own call chains, to `async`/`await`. `global-search.index.ts` confirms Petition already participates in search indexing (read-only, via `listPetitions`).

### 1.10 Tests, fixtures, verification scripts

Zero test files referenced `petition` before Recovery Tasks 22/23. No dedicated Petition verification script exists; a text search of `apps/api/src/scripts/**` found only incidental frontend-path string references (`verify-world-navigation-home-preferences-e2e.ts`, `verify-workspace-ux-e2e.ts`), none exercising `petition.store.ts` mutations or asserting event counts. No `resetForTests`/`clearForTests` helper is exported by the petition module (confirmed by test), unlike Mongo-backed modules that commonly expose one.

---

## 2. Aggregate Classification

**Selected model: B — Petition and Signature are separate aggregate roots**, with Petition as the parent/definition aggregate and Signature as an independently-identified child aggregate whose own uniqueness is enforced by the database, not by array membership.

Why not the others:

- **Model A (embedded, Petition-versioned)** is what exists today and is precisely what produces the reproduced concurrency defect (§1.7) and the "no independent addressability" gap the future Member Action ledger needs (a `sourceId`/aggregate identity distinct from an array index). Embedding also does not scale past a small number of signers per document (16MB Mongo document limit is a real, if distant, ceiling for popular petitions) and makes "insert one signature" require a full-document read-modify-write of the parent, which is exactly the high-contention pattern §1.7 already demonstrates is unsafe.
- **Model C (generic participation record)** would require inventing a new, broader "participation record" concept encompassing Votes/Petitions/other signals — this redesigns Collective Decision/Vote scope, which Task 23 explicitly forbids ("Do not redesign Collective Decision").
- **Model D (hybrid: Petition stores counters, Signatures separate)** was seriously considered — see §5, it is the fallback if `SupportMetrics` recomputation cost ever becomes a real bottleneck — but is **not selected as the primary target** because it reintroduces exactly one field (`totalSignatures`/`supportThresholdStatus`) that must stay consistent with a separate collection, which is unnecessary complexity before there's evidence of a performance problem (`SupportMetrics` today is cheap to compute from a scoped `find({petitionId})` query).
- **Model E (projection-based signature list)** is functionally very close to the selected model B plus a read-time join; it's kept as the *read strategy* (§7's "Petition detail response" projects signatures via a scoped query, not an embedded array) rather than a distinct storage model.

This is chosen on today's actual behavior (independent signature identity already exists via `signatureId`, signatures are already conceptually a append-only ledger of facts, not a document Petition "owns" in a way that requires whole-parent rewrites) — not selected merely to make future event production convenient, though it happens to also satisfy that need (§8).

---

## 3. Petition Responsibilities

**Petition owns:** identity (`petitionId`), Initiative/Decision reference fields, `subject` (title/statement/requested action), `policy` (eligibility, participation rules, signature policy, endorsement period, visibility rules), lifecycle status and transitions, `shareLink`, and the *definition* half of "result" (its own `outcome`, derived from lifecycle status).

**Petition does not own:** Member identity/profile, Initiative lifecycle, Vote records, Collective Decision outcome (it *reads* an already-decided Decision, never mutates one), Member Action ledger entries, Fair points, public archive records, or notification delivery — all confirmed unchanged by this task and untouched by the design.

**Petition's derived, read-model responsibility** (`supportMetrics`, embedded `outcome`) becomes, under the target model, a *computed projection* over the separate Signature collection rather than a field mutated in lockstep with every signature write — see §7.

---

## 4. Signature Responsibilities

**Signature owns:** its own `signatureId`, `petitionId` (parent reference), `memberId`, `participationMode`, `signedAt`, `status`, and — under the target design — `initiativeId` (duplicated, see below) and `schemaVersion`.

Answering Part 5's specific questions:

1. **Needs its own ID:** yes — already has one (`signatureId`).
2. **Currently stable:** **no** — it's deterministically derived (`signature-${petitionId}-${participantId}`) but *not* enforced unique by anything (§1.7); two concurrent signings silently produce two identical, non-unique IDs.
3. **Immutable:** intended to be (`assertSignaturesImmutable` protects existing entries within a single Petition's array), but this only protects against removal/field-mutation of *already-appended* array entries — it does nothing to prevent the duplicate-append race.
4. **May be withdrawn:** the type reserves `"Withdrawn"` but no code path sets it — dead capability today.
5. **Repeated signing:** rejects sequentially (`already signed`), but **does not reject concurrently** (§1.7).
6. **Pseudonymous public identity while canonical identity stays private:** not implemented — `visibility` is always `"operational"`; the field exists in the type (`SignatureVisibility` includes `"public"`/`"restricted"`) but nothing branches on it differently today. Out of scope to design further here (no behavior change requested).
7. **Initiative ID copied into Signature:** **recommended, yes** — see §7.3.
8. **Schema version:** recommended addition, matching the convention already used by `DomainEvent`/outbox envelopes (`DOMAIN_EVENT_SCHEMA_VERSION`) and by the illustrative `MemberActionRecord.schemaVersion` in the Task 21 blueprint.
9. **Future event aggregate ID:** **yes, `signatureId` should be the event's `aggregateId`** — see §8.
10. **Must remain queryable after Petition closure:** yes — nothing in current policy deletes signatures on close/archive, and the target design must preserve that (a separate collection naturally supports this; no TTL should ever be added to it).

---

## 5. Cardinality and Uniqueness

Current (implicit, race-prone) invariant: `Member × Petition → 0..1 active signature`, ignoring `participationMode` (one signature per member per petition regardless of mode — confirmed: `hasParticipantSigned` does not branch on mode). `Petition → 0..N signatures`. `signatureId` is *intended* globally unique but **not enforced** today (§1.7).

**Target, database-enforced invariants** (illustrative — no index created by this task):

```text
unique(signatureId)                          — primary key / _id
unique(petitionId, memberId)                 — the actual duplicate-signing guarantee; DB-enforced, not application-checked
index(petitionId, signedAt)                  — daily-activity / support-metrics queries
index(memberId, signedAt)                    — future Member timeline / Member Action backfill
```

`unique(petitionId, memberId)` (not `unique(signatureId)` alone) is the invariant that actually closes §1.7's race: a database unique-index violation on a second concurrent insert turns the race into a deterministic duplicate-key error the service layer maps to the existing "already signed" error, instead of two silently-coexisting rows.

---

## 6. Concurrency Analysis and Target Guarantee

Evaluated approaches against the reproduced race (§1.7):

| Approach | Verdict |
|---|---|
| Optimistic Petition version check | Insufficient alone — the race is *between two signature inserts*, not between two Petition-document writes; a Petition-level version guard does not by itself prevent two Signature rows for one member unless signatures are embedded (which §2 rejects). |
| Atomic `$addToSet` on an embedded array | Would work for uniqueness *if* Model A were kept, but reintroduces the whole-document contention and 16MB ceiling §2 rejects Model A for. |
| **Unique index on a separate Signature collection (selected)** | Closes the race at the only layer that can: the database. A second concurrent insert for `(petitionId, memberId)` fails with a duplicate-key error; the service maps that to the existing "already signed" `409`. No apparent-success race window remains. |
| Idempotency key | Complementary, not a substitute — useful for the *event* layer (§8's `sourceEventId`), not a replacement for the storage-layer uniqueness constraint. |

**Target guarantee:** a `unique(petitionId, memberId)` index on the Signature collection, with the service treating a duplicate-key error exactly like today's pre-check "already signed" error (same public message/status), so a concurrent duplicate now **fails loudly and correctly** instead of silently succeeding twice.

---

## 7. Initiative Boundary Design

### 7.1 Selected creation-time boundary: **Boundary C-at-creation, D-at-signing** (hybrid, matching Task 22's actual finding, not an idealized one)

Petition is a **direct-ancestry** artifact (`CIVIC_ARTIFACT_TYPE_CANONICAL_MODULE.petition === "petition"`, confirmed §1's test). The correct target, matching the already-proven pattern in `initiative-improvement-proposal.service.ts` (`assertEligibleAnalysisAndInitiativeAncestry`, using `validateDirectInitiativeAncestry`):

- **At creation:** call `validateDirectInitiativeAncestry({ initiativeId: petition.subject.initiativeId }, { initiativeExists: getInitiativeById })` **before** persistence, exactly like `initiative-improvement-proposal` already does. This closes §1.8's gap with **zero new architecture** — it is a pure integration of an already-existing, already-proven shared validator (not a new validator, not a change to `apps/api/src/shared/initiative-ancestry`). Additionally, cross-check `decision.decisionSubjectType === "Initiative"` and (once `CollectiveDecision` is confirmed unrelated to this task's scope) that its `decisionSubjectId` matches the validated `initiativeId`, closing the second gap noted in §1.8. **This part is a plausible "narrow, non-semantic correction" candidate for a future task, not this one** (Task 23 is discovery-only).
- **At signing:** **Boundary D — trust the persisted, now-validated Petition; do not re-look-up the Initiative.** Once creation validates existence, `petition.subject.initiativeId` is a trustworthy, already-validated value for the lifetime of that Petition (Petition's `initiativeId` cannot change after creation — no mutation path touches `subject.initiativeId` outside `updatePetition`, and `updatePetition` is only permitted in `Draft`/`Ready`, before signing is even possible in `Open`). This matches Strategy A/C in Part 10 and the same trust model already used by `initiative-improvement-proposal`'s downstream reads.

**Target Initiative lookup counts:** creation = 1 (new); signing = 0 (unchanged from today). This is the same "already-validated Initiative identity" guarantee Task 22 needs, achieved with **zero additional lookups on the hot (signing) path**.

### 7.2 Is the direct ancestry validator recommended?

**Yes**, unconditionally — it is the same validator already adopted for `initiative-improvement-proposal`, requires no shared-code change, and directly fixes the exact stop condition Task 22 raised. This is the single highest-leverage, lowest-risk correction available, independent of the Mongo persistence migration.

### 7.3 Does Petition ancestry become a persisted invariant?

Yes, in two places: (a) Petition's own `subject.initiativeId`, now creation-validated and immutable after creation (already true structurally, now also existence-checked); (b) **Signature duplicates `initiativeId`** at write time, copied from the parent Petition at the moment of signing — an **immutable ancestry snapshot**, not a live reference. Reasons to duplicate (per Part 15): it lets the future `PetitionSigned` event and any Initiative-scoped Signature query avoid a Petition reload, and it is consistent with "the event carries an already-validated Initiative ID" (Task 22 Part 6). Consistency risk is mitigated because Petition's `initiativeId` is immutable post-creation (§7.1) — there is no future write path that could desynchronize the copy from its source.

---

## 8. Collective Decision Coupling

`collectiveDecisionId` is mandatory, assigned once at creation, never re-validated afterward. `CollectiveDecision` does not reference Petition back, and has no `initiativeId` field (§1.8) — so today's coupling is one-directional and structurally loose. **No circular ownership exists.** Signing is permitted from `Open` status regardless of the linked Decision's later state (Decision cannot regress once Approved, so this is not currently exploitable, but it is not actively re-checked either).

**Persistence migration can proceed without changing this coupling.** Nothing in §2–§7's design requires touching `collective-decision.store.ts`, its type, or its relationship to Petition — Petition's persistence model is orthogonal to how it references a Decision ID. This task does not redesign it, per its own constraint, and found no blocking conflict that would require doing so.

---

## 9. Persistence Target Options — Scored

| Option | Domain fidelity | Atomicity | Concurrency | Scalability | Migration complexity | API compat | Event integration | Initiative validation | Fixture impact | Rollback |
|---|---|---|---|---|---|---|---|---|---|---|
| 1. Embedded signatures | Low (contradicts §2) | Medium (single-doc) | Poor (array race, no DB uniqueness) | Poor (doc growth, 16MB ceiling) | Low | High (no shape change) | Poor (no stable signature aggregate) | N/A | Low | Easy |
| **2. Petition + separate Signature collection (selected)** | High | **High (per-signature transaction)** | **High (DB unique index)** | High | Medium | High (with a thin projection, §11) | **High (Signature = natural aggregate)** | High | Medium | Medium |
| 3. Signature-only, Petition counts projected | High | High | High | High | Medium-High (Petition doc drops fields entirely) | High | High | High | Medium-High | Medium |
| 4. Hybrid (Petition stores counters + separate signatures) | Medium-High | Medium (two writes to keep consistent) | High for signatures; counters still race-prone unless atomic `$inc` | High | Medium-High | High | High | High | Medium | Medium |
| 5. Keep in-memory Petition + durable signature command log | Low (transitional, two sources of truth) | Low | Medium | Low | High (still need eventual full migration) | Medium | Medium (log is not the aggregate) | Medium | High | Hard (two systems to unwind) |

**Selected: Option 2.** It has no atomicity/concurrency compromise (unlike 1, 4, 5), no unnecessary scope growth relative to 3 (Petition keeps owning its lifecycle/definition fields, including a cheap-to-compute `supportMetrics` projection), and it is the option that makes the future `PetitionSigned` event's aggregate identity unambiguous (§10). Option 3 is a reasonable second choice if a future task later finds `SupportMetrics` recomputation genuinely expensive at scale; nothing in this design forecloses migrating from 2 to 3 later, since both already treat Signature as the source of truth.

---

## 10. Mongo Transaction Boundary (Target, Not Implemented)

```text
begin session/transaction
  1. resolve Petition (read, can be outside the transaction — see below)
  2. re-confirm Petition.status === "Open" (must be inside the transaction if Petition status can change concurrently; today status transitions are separate admin-only mutations, low contention — read-outside is acceptable but the insert's uniqueness check below is still the real guarantee)
  3. insert Signature { signatureId, petitionId, initiativeId (copied), memberId, participationMode, signedAt, status: "Active", schemaVersion }
     — relies on unique(petitionId, memberId) index; a duplicate-key error here IS the concurrency guarantee (§6)
  4. enqueueDomainEvent(PetitionSigned, { session })   [Task 22 — not part of this task]
commit
```

- **Eligibility check** (`isParticipantEligibleForPetition`, which calls `getMemberById`) must run **before** the transaction opens (it is a read against a different aggregate — Member — and should not hold a Petition/Signature transaction open across a cross-module network call). This matches Task 22 Part 9's required failure ordering (eligibility before persistence).
- **Petition metadata/count/version update is NOT required inside the transaction** under Option 2, because `supportMetrics`/`outcome` become a read-time projection (§7), not a field mutated per-signature. This matches Part 13's guidance: "If Petition does not store count/version changes, the unit may be: insert Signature + enqueue outbox event."
- **Session owner:** a new `sign-petition.service.ts` (or equivalent), following the exact shape of `create-proposal.service.ts`/`confirm-member-registration.service.ts` — `runMongoTransaction(async (session) => { ...insert...; await enqueueDomainEvent(event, { session }); })`.
- **Duplicate-key mapping:** a Mongo `E11000` on `(petitionId, memberId)` maps to the same public "already signed" error/status the current pre-check throws — no new public error.
- **Retry handling:** transient transaction errors (Mongo `TransientTransactionError`/`UnknownTransactionCommitResult` labels) should retry the whole transaction body once or twice, matching whatever convention the five existing `runMongoTransaction` callers use (this design does not invent a new retry policy — inspect `mongo-transaction.js`'s current retry behavior before implementing).
- **Reads inside the transaction:** none required beyond the insert's own uniqueness check.

---

## 11. Outbox Readiness (Task 22 Prerequisite, Confirmed Sufficient)

The existing outbox APIs (`enqueueDomainEvent`, `runMongoTransaction`, `createDomainEvent`) are already proven sufficient by five independent producers (`member`, `activity`, `discussion`, `proposal`, `decision`) — nothing about Petition requires any change to this shared infrastructure. What Petition's migration must *provide* before Task 22 can resume is exactly: (a) a real `ClientSession`-based transaction wrapping a Signature insert, and (b) that insert's own natural, stable identity (`signatureId`) to use as the event's `aggregateId`. Both are delivered by §2/§10 above. Consumer idempotency (`processed-events.repository.ts`, claim-based) requires no Petition-specific change — it is fully generic.

---

## 12. Schema Design (Illustrative)

```ts
// Petition document — apps/api/src/modules/petition (illustrative, not created)
interface PetitionDocument {
  _id: string;              // petitionId
  initiativeId: string;     // validated at creation (§7.1), immutable after
  collectiveDecisionId: string;
  subject: { title: string; summary: string };  // decisionId/initiativeId promoted to top-level fields above, not duplicated inside subject
  policy: PetitionPolicy;
  status: PetitionState;
  shareLink: ShareLink | null;
  createdAt: string; updatedAt: string;
  schemaVersion: number;
  // NOTE: no embedded signatures[]; no supportMetrics/outcome persisted —
  // both remain response-time projections computed from the Signature
  // collection plus `status`, exactly matching today's derivation logic in
  // petition.helpers.ts (calculateSupportMetrics/buildPetitionOutcome),
  // just re-sourced from a query instead of an in-memory array.
}

// Signature document — separate collection
interface SignatureDocument {
  _id: string;          // signatureId
  petitionId: string;
  initiativeId: string; // duplicated, immutable snapshot (§7.3)
  memberId: string;
  participationMode?: "Community" | "Public";
  signedAt: string;
  status: "Active" | "Withdrawn";
  schemaVersion: number;
}
```

No field is added beyond what's needed for (a) the invariant Petition already has today, (b) the uniqueness guarantee (§6), and (c) the event-readiness Task 22 needs (§7.3, §10). `visibility` is preserved as-is (unchanged behavior, out of scope to redesign).

---

## 13. Migration Strategy

**Migration inventory:**

| Source | Current data | Target | Migration required | Compatibility risk |
|---|---|---|---|---|
| `petitions` in-memory Map | 1 bootstrap fixture only (`bootstrapPetition`); no real production data exists anywhere (confirmed — no persistence means nothing has ever survived a restart) | `petitions` Mongo collection | **None** — no real data migration needed, only a fixture→seed translation | None (bootstrap fixture is small and already fully typed) |
| Embedded `Petition.signatures[]` | Whatever signatures exist in the current process's memory at any instant (never durable) | `signatures` Mongo collection | **None** — same reasoning | None |

Because **no durable production data has ever existed** for Petition (§1.6), this is a pure code migration, not a data migration: there is nothing to backfill, no ID-preservation risk beyond the bootstrap fixture, and no dual-write period is needed or justified. **One authoritative store (Mongo) should replace the in-memory Map outright**, not run alongside it. No feature flag is needed for the *data* — but a feature flag (or a phased PR sequence) is reasonable for the *code path itself* (route → Mongo-backed service) to allow the future implementation task to land the persistence layer and the route-wiring separately if it chooses; this document does not mandate a specific rollout granularity for that task.

**Fixtures:** `bootstrapPetition`/`bootstrapCollectiveDecision`-style constants translate directly into a one-time Mongo seed (matching how other Mongo-backed modules seed their bootstrap fixture today). Existing verification-fixture conventions (Task 13/14) are not blocked by this — they were never wired to Petition in the first place (§1.10).

---

## 14. API Compatibility

Every current response shape can be preserved:

- **Creation/detail/signing responses:** the `Petition` object's public shape (§1.4) does not need to change — `signatures[]` can remain in the JSON response as a **read-time projection** (a scoped `find({petitionId, status: "Active"})` query mapped back to the existing `Signature` shape), not an embedded document field. Consumers see no difference.
- **Signature count / support statistics:** `supportMetrics` becomes computed from a `countDocuments`/aggregation over the Signature collection instead of `Array.filter` — same output shape.
- **Duplicate-signature response/status, validation messages, status codes:** unchanged — mapped from the new unique-index duplicate-key error to the exact same message/409 (§10).
- **Sorting/timestamps:** unchanged — `signedAt` remains the sort key for `dailyActivity`.

No response currently depends on signature *array-index* ordering being meaningful in a way a query's `sort({signedAt: 1})` couldn't reproduce.

---

## 15. Test and Fixture Migration Scope

- **Tests to add (future implementation task, not this one):** Mongo-backed unit tests for the Signature unique-index race fix (re-run this task's "KNOWN DEFECT" test and assert it now reliably shows `signatureCount === 1`), transaction-boundary tests (signature-insert failure ⇒ no event; event-enqueue failure ⇒ transaction rolled back, no signature), and read-path tests (`getPetition` now returns a Promise, response shape unchanged).
- **Fixture helper replacements:** none exist to replace yet (§1.10 — zero prior fixtures). The future task should add narrow `ForTests` cleanup (`deletePetitionsByIdForTests`/`deleteSignaturesByPetitionIdForTests`), following the exact convention already used elsewhere (`deleteOutboxEventsByAggregateIdForTests`-style).
- **Direct-caller migration:** all 11 read call sites in the 9 files listed in §1.9 must add `await` and, where not already `async`, become `async` — traced transitively up each call chain. This is the single largest mechanical-change surface of the eventual implementation task and should be sized accordingly (likely its own reviewable step, per Task 22 Part 14's "add mechanical awaits" guidance).
- **Task 13 isolation / Task 14 harness:** no conflict — those hardened Participation Area and general async-verification-script conventions, never touched Petition, and nothing here requires changing them.

---

## 16. Verification Impact

**No existing verification script exercises Petition** (§1.10). **Recommendation:** the future implementation task should add exactly one new primary verification script, e.g. `verify-petition-signing-persistence-e2e.ts`, covering create → prepare → publish → open → sign → duplicate-reject → (Mongo-restart) persistence check, run via `runVerificationScript(main)` (Mongo-backed) and executed twice per Task 14 convention. This task does not create it now (Part 19 explicitly permits deferring), since writing it well requires the actual Mongo-backed store to exist first.

---

## 17. Error Taxonomy (Target, Illustrative)

| Error | Raised when | Public mapping |
|---|---|---|
| `PetitionNotFoundError` | Petition ID doesn't resolve | unchanged (404, existing message) |
| `InitiativeNotFoundError` (shared) | `validateDirectInitiativeAncestry` fails at creation | new — 400/404 per existing shared-validator convention, only at creation, not signing |
| Existing "not eligible" | unchanged | unchanged |
| Existing "already signed" | now raised for **both** pre-check duplicates and unique-index duplicate-key races | unchanged public message/409 |
| `PetitionSignaturePersistenceError` (internal) | Mongo insert fails for a non-duplicate reason | mapped to existing generic persistence-failure handling, no Mongo details leaked |
| Transaction/outbox errors | Task 22 scope, not this task | N/A here |

No new *public* petition error beyond the (already-precedented) Initiative-not-found case, which every other direct-ancestry module already exposes identically.

---

## 18. Rollback and Failure Strategy (Target)

| Scenario | Required behavior |
|---|---|
| Signature insert succeeds, event enqueue fails | Whole transaction aborts (both operations in one `runMongoTransaction` body) — no signature persists, matching Task 22 Part 8's non-atomic-emission prohibition. |
| Duplicate key during retry after client timeout | Retry safely returns/maps to "already signed" — idempotent from the client's perspective. |
| Transient transaction error | Retry the transaction body (bounded attempts, matching existing `runMongoTransaction` convention). |
| Process crash before commit | No partial state — Mongo transactions are all-or-nothing. |
| Process crash after commit, before response | Client should retry; retry hits the duplicate-key path safely (idempotent). |
| Outbox dispatcher unavailable | Signature is still durably committed; event dispatch is a separate, retriable concern (Task 22 §12/13 already confirmed outbox events are retained/replayable). |
| Initiative becomes unavailable mid-transaction | Not applicable at signing (§7.1 — no Initiative lookup at signing; ancestry was already validated and frozen at creation). |

---

## 19. Prerequisites for Resuming Task 22

1. Petition and Signature are Mongo-backed per §2/§12 (Option 2), with the transaction boundary in §10 implemented (`runMongoTransaction` + Signature insert).
2. The `unique(petitionId, memberId)` index exists and the service maps its duplicate-key error to the existing public "already signed" behavior (§6, §17).
3. `validateDirectInitiativeAncestry` is integrated at Petition creation (§7.1) — closing Task 22's ancestry stop condition.
4. All 11 direct read call sites (§1.9/§15) are updated to `await` the now-async read functions, with their own callers verified not to break (mechanical, but must be verified, not assumed).
5. Only then does "add `enqueueDomainEvent` inside the transaction in §10" become Task 22's entire remaining scope — at that point Task 22's Parts 3–25 can resume essentially as originally written, against a module that now actually satisfies its own Part 2 preconditions.

This is recommended as **one bounded implementation task** (not further split), because §10's transaction body needs the Signature insert and the future event enqueue to be designed together even though the event itself is added by Task 22, not this prerequisite task — but the *event enqueue call* should be deferred to Task 22 itself; this prerequisite task stops at "insert Signature transactionally, with the unique index and ancestry check in place," and does not add `enqueueDomainEvent` itself, to keep the two tasks' review surfaces cleanly separated exactly as Task 22/23 already are.

---

*This document is a Recovery Task 23 work product. It complements, and does not replace, `MEMBER_ACTION_LEDGER_IMPLEMENTATION_BLUEPRINT_v1.0.md` §13, which remains the authority on the Member Action ledger side of Task 22's prerequisites; this document is the authority on Petition's own persistence/ancestry prerequisites.*
