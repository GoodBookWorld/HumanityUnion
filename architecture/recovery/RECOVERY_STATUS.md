# Recovery Status v1.0

**Successor note:** the Recovery Phase this document closes out is now superseded, as a forward-looking roadmap, by `architecture/ARCHITECTURE_EVOLUTION_ROADMAP_v2.0.md` ("Architecture Evolution Roadmap v2.0"). This document's own content — the historical record of Tasks 01–33 — remains accurate and authoritative for what was recovered; only the *next-steps* framing (previously `INITIATIVE_ARCHITECTURE_RECOVERY_ROADMAP_v1.0.md`'s Phases 3–9) is superseded. See the Evolution Roadmap's "Approved Assessment Backlog" for the current forward plan, beginning with Assessment 01 — Implementation Commitment.

**Produced by:** the Recovery Closure Task ("Finalize Recovery Phase and Establish the Authoritative Development Baseline"), summarizing Architecture Recovery Tasks 01–33.

**Authority:** `architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md`, `architecture/decisions/ADR-MEMBER-ACTION-LEDGER-v1.0.md`, `architecture/recovery/INITIATIVE_ARCHITECTURE_RECOVERY_ROADMAP_v1.0.md`, `architecture/recovery/MEMBER_ACTION_LEDGER_IMPLEMENTATION_BLUEPRINT_v1.0.md`.

**Status of this document:** authoritative, current-state summary. It does not replace or duplicate the detailed per-task reports (still available in each task's own architecture document and in the agent transcript history) — it is the single place a future contributor should start.

---

## 1. Recovery Overview

The repository entered recovery because its documentation and its running code disagreed about the platform's canonical civic-lifecycle architecture: `ADR-002` (part of a "Blueprint v2.0" corpus added immediately before recovery began) declared `Activity` the universal starting object, while `Initiative` was already the platform's live, 11-module, frontend-integrated product surface, and `Activity` had zero frontend callers. A second, independent gap was discovered alongside the first: none of the platform's real participation actions (petition signatures, votes, comments, etc.) had a durable, replayable event history — mutations were either in-memory, file-backed, or fire-and-forget Mongo mirrors, with no transactional guarantee and no consumer-facing event contract.

Recovery Tasks 01–33 addressed both gaps through two related but independently-scoped tracks:

- **Track A — Initiative Ancestry Hardening** (Tasks 01–19): establish Initiative as the sole canonical civic root, formalize the "every civic record resolves to one Initiative" invariant as a shared, typed contract, and retrofit ancestry validation and automated tests across every `initiative-*` module and its adjacent modules (`decision-session`, `participation-area`).
- **Track B — Member (Participant) Action Ledger Pilot** (Tasks 20–33): investigate whether the existing `activity` module could serve as the platform's durable participation-fact ledger (it could not — Task 20), decide on a new, dedicated ledger instead (Task 21's ADR), correct its vocabulary to be participant-first rather than member-first (Task 26), recover the Petition and Vote persistence models to be transaction-capable and Mongo-authoritative (Tasks 23–24, 31), give both modules atomic durable domain events (Tasks 25, 32), build the ledger itself (Task 27), and wire both event producers into it as idempotent, append-only consumers (Tasks 27, 33). Tasks 29–30 are a supporting sub-track: fixing the test runner itself (recursive discovery had been silently skipping most of `test/unit/**`) and isolating it from the shared development database, without which none of Track B's regression claims would have been trustworthy.

This recovery is **narrower than** the full 10-phase migration described in `INITIATIVE_ARCHITECTURE_RECOVERY_ROADMAP_v1.0.md`. That roadmap's Phases 1–2 (ancestry contracts and tests) correspond to Track A above and are complete. Its Phases 3 (Workspace reconciliation), 5 (Discussion/Proposal retirement), 6 (Decision/Petition consolidation beyond Petition's own recovery), 7 (Implementation/Impact UI migration), 8 (legacy retirement), and 9 (documentation alignment) were **not** attempted by Tasks 01–33 and remain entirely open. Separately, the roadmap's Phase 4 ("reuse Activity as participation-trace infrastructure") was **not executed as originally planned** — Task 20's discovery led to a different decision (Track B's dedicated Participant Action Ledger, ADR-MEMBER-ACTION-LEDGER-v1.0) rather than retargeting `activity`. See §4 below for the precise current boundary.

---

## 2. Completed Recovery Tasks

### Track A — Initiative Ancestry Hardening (Tasks 01–19)

| Task | Summary |
|---|---|
| 01 | Produced `INITIATIVE_ARCHITECTURE_RECONCILIATION_REPORT_v1.0.md`, documenting the three parallel, partially-contradictory civic-lifecycle pipelines (Initiative, Activity, older Stage) and their actual, code-verified state. |
| 02 | Decided `ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0`: Initiative is the sole canonical civic root; ADR-002 is superseded. |
| 03 | Produced `INITIATIVE_ARCHITECTURE_RECOVERY_ROADMAP_v1.0.md`, the 10-phase, ~50-task migration plan referenced throughout this document. |
| 04 | Defined the shared `InitiativeAncestry`/`CivicArtifactType` contract (`packages/types/src/domain/initiative-ancestry.ts`) and validator utility (`apps/api/src/shared/initiative-ancestry/`), used by every subsequent ancestry task. |
| 05 | Enforced Initiative ancestry in `initiative-comments`, with tests. |
| 06 | Enforced Initiative ancestry in `initiative-collaborative-analysis`, with tests. |
| 07 | Enforced Initiative ancestry in `initiative-improvement-proposal`, with tests. |
| 08 | Enforced direct, mandatory Initiative ancestry in `decision-session`, with tests. |
| 09 | Disambiguated and enforced Initiative ancestry in `initiative-collective-decision`, with tests. |
| 10 | Audited and enforced Initiative ancestry in `initiative-decision-vote`. |
| 11 | Disambiguated the canonical civic artifact vocabulary for Initiative Collective Decision (resolving the `collective-decision` vs. `initiative-collective-decision` naming ambiguity noted in §5 below). |
| 12 | Adopted production transitive Initiative ancestry validation in `initiative-decision-vote`. |
| 13 | Discovered a Participation Area E2E fixture cleanup gap (non-idempotent verification fixtures). |
| 14 | Made the affected verification scenarios repeatable without weakening Participation Area domain rules. |
| 15 | Enforced canonical (direct) Initiative ancestry in `initiative-implementation-commitment`. [Corrected 2026-07-30 by Architecture Evolution Assessment 01 §4/§15 — this task's ancestry is direct (`validateDirectInitiativeAncestry`), not transitive; the original row misstated the mechanism.] |
| 16 | Enforced canonical Initiative ancestry in `initiative-implementation-tracking`. |
| 17 | Enforced canonical Initiative ancestry in `initiative-public-impact`. |
| 18 | Determined the write-side authority and canonical Initiative ancestry of `public-civic-archive`. |
| 19 | Confirmed and enforced the boundary between Initiative civic artifacts and Activity impact/archive records (`activity-impact-archive-boundary.test.ts`). |

**Result:** every `initiative-*` module, plus `decision-session`, `participation-area`, and `public-civic-archive`, now has an explicit, tested Initiative Ancestry enforcement point (direct or transitive), backed by the shared `packages/types` contract and validator from Task 04.

### Track B — Member (Participant) Action Ledger Pilot (Tasks 20–33)

| Task | Summary |
|---|---|
| 20 | **Discovery only.** Inventoried every Member action in the platform and concluded `activity` cannot become the participation ledger without duplicating already-canonical `initiative-*` data; produced `ACTIVITY_RETARGETING_DISCOVERY_v1.0.md`. No code changed. |
| 21 | Decided `ADR-MEMBER-ACTION-LEDGER-v1.0`: a new, dedicated, append-only ledger (not `activity`) is the platform's sole participation-fact record; Petition signing selected as the Phase 0 pilot producer. Produced the companion `MEMBER_ACTION_LEDGER_IMPLEMENTATION_BLUEPRINT_v1.0.md`. |
| 22 | First attempt at a durable `PetitionSigned` outbox event — later found to require persistence recovery first (see Task 23). |
| 23 | Recovered the Petition persistence model and Initiative validation boundary as a prerequisite for durable event integration; produced `PETITION_PERSISTENCE_AND_INITIATIVE_BOUNDARY_v1.0.md`. |
| 24 | Implemented Mongo-backed `Petition`/`PetitionSignature` aggregates with direct Initiative validation and transactional signing (`petition.repository.ts`, `petition-signature.repository.ts`). |
| 25 | Added an atomic durable outbox event (`PetitionSigned`) to the now transaction-capable Petition signing mutation. |
| 26 | Corrected the ledger's vocabulary from provisional `memberId`/"Member Action" to the binding participant-first model (`participantId`/Participant Action), before any consumer was built — applied to the ADR, the blueprint, and `PetitionSigned`'s own payload. |
| 27 | Implemented the Participant Action Ledger core (domain types, Mongo repository, unique indexes on `participantActionId`/`sourceEventId`, idempotent processed-event claim) and its first consumer, projecting `PetitionSigned` → `petition_signed`. |
| 28 | Assessed `initiative-decision-vote` as the second durable producer candidate; found 3 of 10 readiness gates failing (no transactions, no durable events, file/memory persistence) — recovery required before proceeding. |
| 29 | Fixed the API test runner: the previous `test/**/*.test.ts` shell glob silently failed to recurse under `/bin/sh`, skipping most of `test/unit/**` while still exiting 0. Replaced with a Node-native recursive walker (`run-tests-recursively.ts`). |
| 30 | Isolated the complete API test suite from any concurrently running `dev:api` process by generating and injecting a unique, disposable Mongo database per `pnpm test` run (`test-mongo-isolation.ts`), dropped automatically on completion. |
| 31 | Recovered `initiative-decision-vote`'s persistence model to be Mongo-backed and transaction-capable (removing the old file/memory/fire-and-forget-mirror adapters entirely), closing the gates Task 28 found failing. |
| 32 | Implemented atomic durable `InitiativeDecisionVoteCast`/`InitiativeDecisionVoteChanged` outbox events inside the same transaction as the Vote mutation and its history row. |
| 33 | Projected both Vote events into the Participant Action Ledger as `initiative_decision_vote_cast`/`initiative_decision_vote_changed`, making Vote the ledger's second durable producer. |

**Result:** the Participant Action Ledger is live, with two durable, idempotent, append-only producers (Petition, Vote) and a passing full regression suite. See §4 for the exact rollout-phase boundary.

---

## 3. Recovered Architecture

### Participant-first model

`participantId` is the canonical actor identity across every durable event and every Participant Action record. `memberId` was the original, provisional identifier (Task 25) and was corrected platform-wide before any consumer was built (Task 26). One legacy exception is intentionally preserved: `petition_signatures`'s own Mongo document and unique index (`petitionId`, `memberId`) still use the internal field name `memberId` for persistence/index continuity — this is a deliberate, documented naming choice (see the field's own doc comment in `petition-signed.event.ts`), not an oversight; every event, API response, and ledger record built from it uses `participantId`.

### Member eligibility

Member status remains the *prior* gate that determines whether a Vote/Petition-signing mutation is allowed to occur at all (unchanged by this recovery). Once a mutation commits and its durable event is produced, the Participant Action consumer never re-checks Member status and never performs a Member lookup — the event's occurrence is itself proof that eligibility was already validated by the producer.

### Vote lifecycle

`initiative-decision-vote` is now Mongo-backed and transaction-capable: `initiativeDecisionVotes` (current choice, database-enforced `unique(voteId)` and `unique(decisionId, participantId)`) plus `initiativeDecisionVoteHistory` (append-only mutation log), both written inside one `runMongoTransaction`, atomically with a durable outbox event (`InitiativeDecisionVoteCast` on first cast, `InitiativeDecisionVoteChanged` on a real choice change — never on a same-choice re-submit, which is a deliberate no-op with no event and no history row).

### Petition lifecycle

`petition`/`petition_signatures` are Mongo-backed with direct, immutable Initiative ancestry validated at signing time, transactional signing, and a durable `PetitionSigned` outbox event carrying `participantId`/`initiativeId` from the transaction itself.

### Participant Action Ledger

`participant_actions` is a new, dedicated, append-only Mongo collection, populated exclusively by idempotent consumers reading `PetitionSigned`/`InitiativeDecisionVoteCast`/`InitiativeDecisionVoteChanged` from the existing durable outbox — never by direct writes from any domain module, and never by re-deriving current state from Vote/Petition. It is explicitly **not** a second source of truth for current Vote choice or Petition signature status; those remain the exclusive responsibility of their own aggregates. Deterministic action IDs (`participant-action:${sourceEventId}`) and a unique index on both `participantActionId` and `sourceEventId` make replay idempotent independent of the processed-event claim.

### Durable events

`PetitionSigned`, `InitiativeDecisionVoteCast`, and `InitiativeDecisionVoteChanged` are all produced atomically (same Mongo transaction as the domain mutation, via `enqueueDomainEvent`/the outbox pattern) and dispatched at-least-once by the shared outbox dispatcher. Deterministic event IDs make redelivery safe.

### Mongo persistence

All three recovered domains (Petition, Vote, Participant Action) share the same infrastructure: `mongo-connection`/`mongo-database`/`mongo-config` for the connection, `runMongoTransaction` for atomicity, `mongo-collections`/`mongo-indexes` for schema, and the outbox/processed-events pair for exactly-once *logical* (not physical) event effects.

### Testing infrastructure

`pnpm test` (`apps/api/scripts/run-tests-recursively.ts`) now genuinely discovers every file under `test/**`, and generates + injects + drops a uniquely-named, disposable Mongo database per run (`test/helpers/test-setup.ts` enforces this — it throws rather than silently falling back to the development database if the isolation variable is absent).

---

## 4. Current Baseline

### Full regression status

Both `pnpm test` runs performed as part of this closure task passed cleanly. See `architecture/TECHNICAL_DEBT.md` and this task's own final report for exact figures (test/suite counts, durations, database names) — recorded once, not duplicated here to avoid this document going stale as later tasks change the total count.

### Authoritative persistence boundaries

| Domain | Authoritative store | Notes |
|---|---|---|
| Vote (current choice) | `initiative_decision_votes` (Mongo) | `unique(voteId)`, `unique(decisionId, participantId)` |
| Vote (mutation history) | `initiative_decision_vote_history` (Mongo) | append-only |
| Petition / Signature | `petitions`, `petition_signatures` (Mongo) | direct Initiative ancestry |
| Participant Action | `participant_actions` (Mongo) | append-only projection, never authoritative for current Vote/Petition state |
| Outbox | `outbox` (Mongo) | shared by all three producers |
| Processed events | `processed_events` (Mongo) | `unique(consumerId, eventId)` |

### Event architecture

At-least-once physical delivery, deterministic event and action IDs, idempotent consumer projection — combined, this yields exactly one logical effect per durable event even though the physical handler may run more than once (retry, redispatch, or concurrent workers).

### Consumer architecture

Two registered Participant Action consumers as of this baseline: `participant-action.petition-signed.v1` and `participant-action.initiative-decision-vote-cast.v1`/`participant-action.initiative-decision-vote-changed.v1`, all registered through the shared `event-handler-registry`, none performing source-domain lookups.

---

## 5. Known Remaining Risks

1. ~~**`verify-collective-decision-e2e.ts` is broken by Task 31's cleanup.**~~ **Resolved** — persistence verification uses the Mongo Vote reload probe; obsolete file/memory Vote env flags removed from related `verify:*` scripts.
2. ~~**Four standalone `verify:*` npm scripts set a now-inert environment variable.**~~ **Resolved** — see item 1.
3. **Shared-development-database race in verification scripts.** Documented repeatedly across Tasks 31–33: a concurrently running `dev:api` process's own background outbox dispatcher can race a verification script's own explicit dispatch call for the same event. Verification scripts are written to tolerate this (asserting invariants, not exact processing counts) but the race itself is not eliminated.
4. **Two similarly-named Collective Decision modules coexist.** `collective-decision` (used by `petition`) and `initiative-collective-decision` (used by `initiative-decision-vote`) are different modules; Task 11 disambiguated the vocabulary but did not merge them. `petition`'s coupling to the older module is explicitly flagged as unremediated in `ADR-MEMBER-ACTION-LEDGER-v1.0` §21's pilot-selection caveat.
5. **The Participant Action Ledger has only 2 of Phase 4's planned 9 producer modules onboarded** (Petition, Vote). The remaining seven (`initiative-comments`, `initiative-collaborative-analysis`, `initiative-improvement-proposal`, `initiative-support`, `initiative-implementation-commitment`, `initiative-implementation-tracking`, `initiative-public-impact`, `public-civic-archive` — eight, not seven; see the ADR's own §20 table) have no durable events and no ledger projection yet.
6. **`pnpm test` takes roughly 13–15 minutes** and runs with `--test-concurrency=1` by design (to avoid cross-test Mongo interference within the one isolated database) — a slow feedback loop for day-to-day development.
7. **Full details in `architecture/TECHNICAL_DEBT.md`**, which also separates genuine debt from the above operational risks.

---

## 6. Future Recovery Work

The following are the next candidate bodies of work, in rough priority order. None are designed here, per this closure task's instruction.

1. **Implementation Commitment assessment** — an analogous readiness assessment to Task 28's Vote assessment, determining whether `initiative-implementation-commitment` (and/or `initiative-implementation-tracking`, `initiative-public-impact`) can become the Participant Action Ledger's third producer, and what persistence/transaction recovery (if any) is a prerequisite, following the exact Task 28 → 31 → 32 → 33 pattern already proven twice.
2. **Private Participant Timeline** (the Member Action Ledger blueprint's Phase 3) — a read-only projection over the now-two-producer ledger, restricted to the owning Participant.
3. **Collective Participation Journey** (Phase 5) — remains entirely unimplemented; only narrative UI copy references the concept today (Task 20's finding, unchanged).
4. **Fair policy recovery** — the Fair Accounting Ledger referenced in `ADR-MEMBER-ACTION-LEDGER-v1.0` §19 as a deliberately separate concern from the Participant Action Ledger does not exist in code and has not been assessed by any recovery task.
5. **Public Civic Archive** — Task 18 established write-side authority and ancestry for the existing implementation, but did not give it the same Mongo-transaction/durable-event recovery treatment Petition and Vote received; whether that treatment is needed is itself an open question for a future assessment task.
