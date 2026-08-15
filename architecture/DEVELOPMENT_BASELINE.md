# Development Baseline v1.0

**Produced by:** the Recovery Closure Task, as the authoritative rulebook for all development that follows Recovery Tasks 01–33.

**Status:** Normative. These rules govern how the recovered architecture (`architecture/recovery/RECOVERY_STATUS.md`) must be extended, and how any future recovery work must be conducted. They do not introduce new domain behavior; they codify constraints already established, task by task, during recovery.

---

## 1. Architecture Rules

These rules are mandatory for all code touching Participant, Member, Initiative, Vote, Petition, or Participant Action.

1. **Participant-first identity.** Every durable event, every ledger record, and every new participation-fact record MUST use `participantId` as its actor identity. `memberId` MUST NOT be introduced into any new event payload, Participant Action metadata, or public API response. (One legacy exception is grandfathered and MUST NOT be used as precedent: `petition_signatures`'s internal Mongo field/index name — see `RECOVERY_STATUS.md` §3.)
2. **Member is eligibility, not identity.** Member status answers "is this Participant currently allowed to perform this action" at the moment of mutation. It MUST NOT be re-checked, looked up, or otherwise consulted by any Participant Action consumer, projection, or any other code that only reads already-committed durable events.
3. **Initiative is the central participation entity.** Every civic record MUST resolve to exactly one Initiative, directly or transitively, via the shared `InitiativeAncestry` contract (`packages/types/src/domain/initiative-ancestry.ts`) and validator (`apps/api/src/shared/initiative-ancestry/`). New modules MUST NOT invent a parallel ancestry mechanism.
4. **The Participant Action Ledger is append-only.** No code may update, delete, supersede, or otherwise mutate an existing `ParticipantActionRecord`. A changed fact (e.g. a changed Vote) MUST be represented as a new, additional record, never as a rewrite of an earlier one.
5. **The Vote aggregate owns current Vote.** `initiative_decision_votes` is the only authoritative source for "what did this Participant currently choose." No other module, including the Participant Action Ledger, may be queried to answer that question.
6. **The Ledger never owns current state, for any domain.** The Participant Action Ledger's sole purpose is a durable, replayable history of facts. It MUST NOT become a read path for "current" anything (current Vote, current Petition status, current commitment state). If a "current state" read is needed, it MUST come from the owning aggregate.
7. **Durable events before projections.** A domain event MUST be atomically, transactionally durable (via the existing outbox pattern) before any consumer is built to project it. Building a consumer against a non-durable, fire-and-forget, or in-memory-only event is prohibited (this is exactly the mistake Task 22 made and Task 23–25 had to correct before Task 27 could proceed).
8. **Transactions before outbox.** A domain mutation and its outbox event enqueue MUST occur in the same Mongo transaction (`runMongoTransaction`). An event MUST NOT be enqueued outside the transaction that produced the fact it describes.
9. **No business logic in consumers.** A Participant Action (or any future ledger) consumer MUST be a pure mapping from event payload to record, plus an idempotent insert. It MUST NOT perform source-domain lookups (Vote, Decision, Initiative, Member, Profile), MUST NOT branch on business rules the producer already enforced, and MUST NOT call back into the producing domain's service layer.

---

## 2. Recovery Rules

Any future recovery task (further architectural corrections, additional producer onboarding, retirement of legacy modules) MUST:

1. **Preserve deterministic IDs.** Event IDs, action IDs, and any other identity derived from domain facts MUST remain reproducible from the same inputs (e.g. `participant-action:${sourceEventId}`), so replay and idempotency checks continue to work without a lookup table.
2. **Preserve replay safety.** Any consumer or projection MUST tolerate at-least-once delivery and out-of-order arrival of events within the same aggregate (e.g. a `Changed` event arriving before its corresponding `Cast` event has been projected) without producing incorrect or duplicate state.
3. **Preserve append-only history.** No recovery task may retroactively rewrite, backfill-with-mutation, or delete existing ledger records, outbox events, or vote/signature history rows as part of "fixing" them. Corrections are appended, following the same convention already used in `ADR-MEMBER-ACTION-LEDGER-v1.0` §4a/§31.
4. **Preserve transaction boundaries.** A recovery task MUST NOT split an existing atomic (mutation + event) transaction into two separate writes, even temporarily, "to make the migration easier." If a transaction boundary must change, that is itself the recovery task's primary, explicitly-scoped subject — not an incidental side effect.

---

## 3. Feature Rules

Any new feature that introduces a new civic participation action MUST be designed and delivered in this order:

1. **Start with the domain model.** Define the aggregate, its invariants, and its relationship to Initiative (direct or transitive ancestry) before writing any route or store code.
2. **Define persistence.** Choose the Mongo collection(s), unique indexes, and transaction boundary for the aggregate's mutations. Follow the Petition/Vote precedent (`petitions`/`petition_signatures`, `initiative_decision_votes`/`initiative_decision_vote_history`) rather than inventing a new persistence pattern.
3. **Define events.** Decide which mutations produce durable domain events, using the existing outbox/`enqueueDomainEvent` mechanism, inside the same transaction as the mutation. Do not ship a mutation without deciding this explicitly, even if the decision is "this mutation does not need a durable event yet."
4. **Define projections.** If the new action should appear in the Participant Action Ledger (or any future read-model), write a pure mapper and an idempotent, append-only consumer, following `petition-signed-to-participant-action.mapper.ts` / `initiative-decision-vote-cast-to-participant-action.mapper.ts` as the reference implementation.
5. **Define tests** covering: ancestry validation, mapper purity/determinism, consumer idempotency and append-only behavior, and — if the feature is a new Participant Action producer — a verification script mirroring `verify-initiative-decision-vote-participant-actions.ts`'s checkpoint structure.

No step may be skipped or reordered; a route MUST NOT be shipped ahead of its persistence/event/projection decisions, even provisionally.
