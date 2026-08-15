# ADR — Canonical Member Action Ledger and Legacy Activity Disposition

**⚠ Terminology correction (Recovery Task 26): read §4a before relying on any "Member Action" / `memberId` term below — the platform is participant-first and this ADR's vocabulary is corrected, without reopening its decision, in §4a.**

## 1. Title

**A Durable Member Action Ledger, Populated Exclusively From Canonical Source Events, Is the Platform's Sole Participation-Fact Record — Legacy Activity Is Frozen, Not Retargeted**

*(Corrected reading, Recovery Task 26 — decision unchanged: "A Durable **Participant** Action Ledger, Populated Exclusively From Canonical Source Events, Is the Platform's Sole Participation-Fact Record — Legacy Activity Is Frozen, Not Retargeted". See §4a.)*

---

## 2. Status

**Accepted** (transitioned from `Proposed` by the Recovery Closure Task; see §31 below for the evidentiary basis. Per `architecture/ARCHITECTURE_DECISION_RECORDS.md` §3.2, `Proposed → Accepted` is a permitted transition; per §3.3, everything above this line — the original decision, its reasoning, and its rejected alternatives — remains historically preserved and unmodified by this transition.)

*(Original status text, preserved for historical record per §3.3: "This ADR is not marked `Accepted` because it commits the platform to a new module, a new persistence collection, and a new event-ingestion pattern that has not yet been implemented or validated end-to-end (see §25 Implementation Prerequisites). Per `architecture/ARCHITECTURE_DECISION_RECORDS.md` §3.1, `Proposed` is the correct initial status for a decision still pending architectural review and pending the Phase 0/1 evidence described in §20 (Rollout). It governs planning and implementation sequencing from this point forward; it does not yet authorize treating any Member Action ledger as live.")

---

## 3. Date

2026-07-28

---

## 4. Decision Authority

| Field | Value |
|---|---|
| **Decision Owner** | Architecture Recovery Task 21 (Humanity Union Product Owner directive, converting Task 20 discovery into a binding decision) |
| **Architectural Authority** | Subordinate to, and elaborating, `architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md` §8 ("Activity") and §12 ("Activity Target Role"). Where this ADR's evidence-based conclusions diverge from that ADR's Phase-4-oriented wording (specifically P4.3's assumption that `activity` becomes the ledger's persistence owner), this ADR's §12 and §17 record the divergence explicitly, as directed by the governing task ("the ADR must validate this model against the actual Task 20 findings rather than merely restating it"). It does not contradict or supersede ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0's binding decision that Initiative is the sole canonical civic root, nor its redefinition of Activity's target role in principle (§8) — it makes a narrower, evidence-based decision about *where the resulting record should live* and *what infrastructure feeds it*. |
| **Evidentiary Basis** | `architecture/recovery/ACTIVITY_RETARGETING_DISCOVERY_v1.0.md` (Recovery Task 20, including its Addendum §11a), Recovery Task 19's Activity boundary characterization, and the additional first-party code inspection recorded in §5–§10 below. |
| **Related Blueprint/Architecture Documents** | `architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md`, `architecture/recovery/INITIATIVE_ARCHITECTURE_RECOVERY_ROADMAP_v1.0.md` (Phase 4), `architecture/recovery/ACTIVITY_RETARGETING_DISCOVERY_v1.0.md` |
| **Related Implementation Document** | `architecture/recovery/MEMBER_ACTION_LEDGER_IMPLEMENTATION_BLUEPRINT_v1.0.md` (companion blueprint produced alongside this ADR) |
| **Supersedes** | None |
| **Superseded By** | None |

---

## 4a. Terminology Correction Notice (Recovery Task 26)

**⚠ Read this before §5.** Recovery Task 26 ("Correct the Participant-First Identity and Action Vocabulary Before Implementing the Participation Ledger") found that this ADR's vocabulary — written under Recovery Task 21 — used **Member** where the binding, accepted domain model requires **Participant**. This section is an **appended correction**, not a rewrite: per this registry's own Historical Integrity principle (`architecture/ARCHITECTURE_DECISION_RECORDS.md` §1.2, "Clarifications MAY be appended where they do not alter the original decision"), the body below (§5 onward) is preserved exactly as Task 21 wrote it. The architectural *decision* (Option E, the outbox-ingestion contract, idempotency, rollout phasing, pilot selection) is **not** reopened or changed by this correction — only its vocabulary is corrected, before any producer or consumer code is built on it.

**Binding domain model (established elsewhere; restated here for this ADR's purposes):**

```text
Participant
    = foundational platform actor identity

Member
    = earned or honorary status/title held by a Participant
```

```text
every Member is a Participant
not every Participant is a Member
```

This is not a new invention — `packages/types/src/domain/membership.ts`'s `MembershipSummary.cohortLabel: "Participant" | "Member"` already encodes exactly this distinction as pre-existing, accepted domain fact: an account is labeled `"Participant"` until it earns Membership (`MembershipRecord.status === "active_member"`), at which point its cohort label becomes `"Member"`. Participation facts belong to the Participant identity, which every account has from the start; Member status is a separate, later, optional achievement.

**Read the following substitutions wherever they appear in §5 through §30 below:**

| As written (Task 21, §5–§30) | Corrected reading (Task 26) |
|---|---|
| "Member Action" / "Member Action Ledger" / "Member Action Record" / "Member Action row" / "Member Action consumer" | "Participant Action" / "Participant Action Ledger" / "Participant Action Record" / "Participant Action row" / "Participant Action consumer" |
| `MemberActionType` | `ParticipantActionType` |
| `MemberActionSourceType` | `ParticipantActionSourceType` |
| `MemberActionRecord` (illustrative interface, §15) | `ParticipantActionRecord` |
| `memberActionId` | `participantActionId` |
| `previousMemberActionId` | `previousParticipantActionId` |
| `member_actions` (illustrative collection name, §16) | `participant_actions` |
| `apps/api/src/modules/member-action` (illustrative module path, §16) | `apps/api/src/modules/participant-action` |
| `memberId` **as the ledger row's/event's acting-identity field** (§10 "Preferred event shape", §15 illustrative interface, §9 Q12, indexes in §15) | `participantId` |
| "the acting Member" / "a Member may hide..." / "Member-profile visible" (§17, Privacy Model — describing the actor who performed the recorded action) | "the acting Participant" / "a Participant may hide..." / "Participant-profile visible" |
| "No Member-facing API..." (§18, describing who may trigger a row's creation) | "No Participant-facing API..." |
| "every record created directly by a Member's `POST /api/v1/activities` request" (§5 fact 1, §22 — describing the acting requester) | "...a Participant's `POST` request" |

**Do NOT substitute** — these remain correct, unaffected references to the actual, distinct, existing technical entity/field named `Member` (Category B/C: genuine Member-status or legacy-compatible technical references, not the ledger's actor-identity vocabulary):

- `Member.fair` / `FairBalance` (§5 fact 5, §8, §19, §23, §24) — the literal, existing `packages/types/src/domain/member.ts` field name; not renamed by this or any bounded task.
- The `Member` domain type, module, collection (`members`), and its exported functions (`getMemberById`, `toMemberDomain`, etc.) — the base account aggregate's actual, existing technical name (a pre-existing legacy-compatibility naming fact this ADR itself already documents in §5 fact 5 and §8; not renamed here — see `PersistedMemberRecord`, `Member` interface).
- References to genuine, earned Membership status/cohort (none currently appear as ledger-blocking logic in this ADR — §18's "Member-facing API" was the one case that needed correction above, and has been).
- Direct verbatim quotations of `ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md` (e.g. the `MemberActionRecorded`-class reference in §6) — that ADR is a separate, already-Accepted, out-of-scope document; quoting it verbatim is preserved for accuracy, and its own terminology is not corrected by this notice (documented as a residual, tracked risk — see the companion blueprint's terminology-correction section and Recovery Task 26's final report).

**Non-decisional:** this correction changes no field's underlying value, no persistence shape, no idempotency mechanism, no rollout phase, and no pilot selection. It is a pre-implementation vocabulary correction only, made because Recovery Task 25 (the Phase-0 pilot producer) had already introduced the provisional `memberId` name into `PetitionSigned.payload` before this ADR's own terminology was checked against the accepted Participant/Member model — Task 26 corrects both the producer contract and this ADR's vocabulary together, before any consumer (Phase 1+) is built against either.

---

## 5. Context

Recovery Task 20 established, with first-party code evidence, the following facts about `apps/api/src/modules/activity`:

1. It is a legacy, manually created, client-submitted, **private** aggregate — every record is created directly by a Member's `POST /api/v1/activities` request, never by a domain service or event consumer.
2. It has **no Initiative ancestry** — `ActivityRecord` has no `initiativeId` field, and no code path resolves one for it.
3. It is **directly coupled to the legacy Discussion/Proposal/Decision modules** — those modules import `ActivityRecord`/`ActivityVisibility` types and call `findActivityById` from `apps/api/src/modules/activity` to root their own (superseded, per ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0 §12/§14) four-stage lifecycle.
4. It is **not a suitable durable normalized Member Action ledger without major semantic change** — it has no source-artifact reference fields of any kind, no listing/query API (only creator-only fetch-by-id), a single frozen lifecycle status (`"open"`), and no content-based idempotency.
5. `Member.fair: FairBalance` **exists structurally but is inert** — the type is declared in `packages/types/src/domain/member.ts`, every construction site (production `toMemberDomain`, `member.sample.ts`, and every verification-script fixture) hardcodes it to `{ personal: 0, community: 0, regional: 0, global: 0 }`, and no exported function anywhere mutates it. It must not be described as absent; it must be described as a structurally-present, operationally-inert placeholder.
6. Canonical `initiative-*` modules emit **lightweight civic notification events** (`emitCivicNotificationEvent`) at mutation points, but this is not durable, replay-safe action-event coverage — it is a fire-and-forget, non-transactional, non-persisted, non-deduplicated side effect (confirmed at first-party code level in §8 below).
7. The accepted Collective Participation Journey concept (documentation/UX-copy only today; no code identifier exists) requires **historical actions to remain distinct from recommended next actions** — a UX/architecture requirement this ADR must honor even though the Journey itself is out of scope.
8. **Canonical source aggregates must remain authoritative** — no secondary record may ever replace `initiative-decision-vote`, `initiative-comments`, `initiative-implementation-commitment`, `initiative-public-impact`, `public-civic-archive`, etc. as the record of what actually happened.
9. **A participation ledger must not become a second write-side source of truth** — this is the architectural failure mode this ADR is designed to prevent by construction, not merely by convention.

This ADR converts these nine established facts, plus the additional evidence gathered in §8–§10 below, into a binding decision about the future participation-record model and Activity's disposition.

---

## 6. Problem Statement

`architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md` §12 directs that Activity's *infrastructure* (outbox, event envelope, idempotent dispatch) "SHOULD be retargeted" to emit `MemberActionRecorded`-class events, and the companion roadmap's Phase 4 (P4.1–P4.3) describes a plan in which Activity's own creation entry point is ultimately "retargeted to be driven by" those events — implying Activity itself becomes the ledger's persistence owner.

Task 20's discovery (§5 above, points 1–4) demonstrates that this literal reading is not safe to implement as written: Activity's current shape, authorization model, and legacy coupling make it structurally unsuited to hold event-consumer-created, Initiative-scoped, source-attributed participation records without changes so extensive that the result would not meaningfully be "the same module reused" — it would be a rewrite wearing Activity's name, while inheriting Activity's legacy Discussion/Proposal/Decision coupling as unwanted baggage.

At the same time, no canonical `initiative-*` module today emits any durable domain event (§5 point 6; confirmed again in §8 below), which means **no version of a Member Action ledger — living inside Activity or elsewhere — can be populated today** without first adding event emission somewhere in the canonical pipeline. This is a load-bearing prerequisite, not a detail.

This ADR resolves both problems: it decides the ledger's target architecture and Activity's future role (§7, §12), and it makes the event-emission prerequisite an explicit, sequenced part of the rollout (§20) rather than an implicit assumption.

---

## 7. Alternatives Considered (Options A–E)

| Option | Description | Reason not selected |
|---|---|---|
| **A — Extend legacy Activity** | Transform the existing `activity` module into Member Action infrastructure in place. | Rejected. Activity has no source-reference fields, no listing/query API, a creator-only private authorization model incompatible with event-consumer-created records, and live, direct import coupling to the legacy Discussion/Proposal/Decision chain that this ADR does not want to inherit into new, permanent infrastructure (§5 points 1–4, §9 below). Adopting Option A would require rebuilding nearly every property of the module while keeping only its name and its outbox plumbing — the cost is equivalent to building new, but with legacy baggage retained. |
| **B — Version legacy Activity in place** | Store legacy Activity and new Member Action records in the same `activities` collection with schema/version discrimination. | Rejected as the final target (this was Task 20's tentative lean, based on roadmap P4.3's literal wording; this ADR revisits and rejects it with the fuller evidence in §9). It shares Option A's authorization-model and coupling problems, and additionally forces a single collection to serve two semantically different purposes (self-reported private civic-participation records vs. event-derived, Initiative-scoped, source-attributed facts), which complicates every future index, query, and privacy rule on that collection indefinitely. |
| **C — New Member Action aggregate, legacy Activity retained** | Create a separate canonical secondary record while retaining Activity untouched. | Directionally correct — separation is the right instinct — but underspecified on its own: "aggregate" implies independent lifecycle/command authority, which §14 explicitly rejects for Member Action (it is not a command-driven aggregate; it is a consumer-written ledger). Option E adopts this option's separation but corrects its framing. |
| **D — Rebuildable projection only, no durable ledger** | Derive Member activity timelines directly from canonical events at read time, without persisting a normalized record. | Rejected for now, for two independent reasons. First, it is presently **blocked**: no canonical `initiative-*` module emits any event to project from (§8), so there is nothing to derive from yet. Second, even once events exist, a pure at-read-time projection cannot economically serve per-Member timeline queries, Initiative-participant/steward views, and a future Fair Accounting Ledger's need for stable, individually-referenceable rows (§16) without re-deriving the same computation repeatedly; it also cannot represent `validityStatus` transitions (reversal/supersession, §15) without an intermediate durable state to transition. A durable ledger does not preclude later rebuilding it from the event log if ever needed (§14, point 6) — it is a materialized, replayable projection of the event stream, not an alternative to one. |
| **E — Durable Member Action ledger plus projections** | A normalized, append-oriented ledger populated from canonical source events (once those events exist), with timeline/scoring/profile projections built on top of it. | **Selected.** See §7.1. |

### 7.1 Why Option E, specifically, and not a restatement of the roadmap's default

Option E is not adopted merely because the governing task named it as the expected candidate. It is adopted because it is the only option that simultaneously satisfies all nine facts in §5:

- It satisfies fact 8/9 (canonical aggregates remain authoritative; the ledger is never a second write-side source of truth) by construction: the ledger is populated *only* by consuming already-committed, already-validated canonical events (§13), never by direct Member-facing writes (§18).
- It satisfies fact 4 (Activity is unsuited to hold it) by not requiring Activity to hold it — a new, purpose-built persistence home is used instead (§16).
- It satisfies fact 6 (notification events are insufficient) by making the durable outbox — not `emitCivicNotificationEvent` — the ingestion boundary (§13).
- It satisfies fact 7 (historical actions distinct from recommendations) by scoping the ledger strictly to historical facts (§17) and explicitly excluding recommendation logic from it.
- It satisfies fact 5 (Fair is inert) by defining Fair's eventual relationship to the ledger as a *separate*, later-built accounting ledger (§19), never as a field mutated on Member Action rows.

Options A–C fail one or more of these; Option D fails all of them today because its precondition (canonical events) does not exist. Option E is therefore the only option this ADR can respons­ibly select, given the specific evidence gathered, not merely the option the governing task suggested.

---

## 8. Additional Evidence Gathered for This ADR (Beyond Task 20)

This ADR was authored after independently re-verifying, at the source-code level, the two claims in §5 that most directly determine the event-ingestion decision in §13:

**`emitCivicNotificationEvent` is fire-and-forget and non-durable.**

```143:152:apps/api/src/modules/notifications/notification.service.ts
export function emitCivicNotificationEvent(input: CivicNotificationEventInput): void {
  const task = createNotificationsForEvent(input).catch(() => {
    // Notification delivery must not block civic workflows.
  });

  pendingNotificationTasks.add(task);
  void task.finally(() => {
    pendingNotificationTasks.delete(task);
  });
}
```

`CivicNotificationEventInput` (`apps/api/src/modules/notifications/notification.recipients.ts`) has no `eventId`, no `metadata` envelope, and no persisted representation — it is a plain function argument, not a `DomainEvent`. Errors are deliberately swallowed ("must not block civic workflows"), the call is not awaited by any caller, and nothing writes it to the `outbox` collection or checks it against `processed-events`. It provides **none** of the five guarantees Part 7 of the governing task requires (durability, replay, stable IDs, transactional guarantees, idempotent delivery) and is therefore formally rejected in §13 as a Member Action ingestion mechanism.

**`Member.fair` is hardcoded to zero at the one production read path that constructs it, with no persisted source field:**

```83:106:apps/api/src/modules/member/infrastructure/member.persistence.ts
export function toMemberDomain(record: PersistedMemberRecord): Member {
  return {
    id: record.memberId,
    profile: { /* ... */ },
    status: record.status,
    verificationLevel: record.verificationLevel,
    roles: record.roles,
    fair: {
      personal: 0,
      community: 0,
      regional: 0,
      global: 0,
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
```

`fair` is not read from `record` (`PersistedMemberRecord`) at all — it is a literal in the mapper. The module's declared public API surface, `apps/api/src/modules/member/member-access.ts`, exports only `getMemberById`, `getMemberByUniqueName`, `getMemberByIdSync`, `getMemberByUniqueNameSync`, `listMembers`, and `updateMemberProfile`; `updateMemberProfile`'s own input type, `EditableMemberProfileFields`, contains only `displayName`, `country`, `region`, `city`, `languages` — no `fair` field exists anywhere in the writable surface. This confirms §5 point 5 precisely and is pinned as an executable contract test in §22.

---

## 9. Domain Semantics — Is Member Action an Aggregate?

**Member Action is not an aggregate.** It has no command surface, no invariant-enforcing constructor invoked by a Member action, and no independent lifecycle transitions driven by business rules of its own. It is a **durable, append-oriented, secondary participation-ledger record derived from authoritative canonical domain behavior.**

The governing task's recommended principle is adopted verbatim:

> Member Action is a durable secondary participation ledger record derived from authoritative canonical domain behavior. It is not the authority for the underlying civic action.

This is **confirmed, not merely restated**, against the nine §5 facts and the Option comparison in §7: every fact points toward a consumer-written, source-attributed, non-authoritative record, and none points toward an independent aggregate with its own command surface.

### 9.1 The seventeen semantic questions

| # | Question | Answer |
|---|---|---|
| 1 | Is Member Action canonical? | **No.** The canonical record is always the source aggregate (vote, comment, commitment, impact, archive entry, etc.). |
| 2 | Is it a source of truth? | **No**, never, for the underlying civic action. It may become the source of truth for *derived* concerns built on top of it (a timeline, a Fair Accounting Ledger entry) once those are themselves defined, but not for the action it records. |
| 3 | Can it be edited? | **No.** The fact fields (`actionType`, `sourceType`, `sourceId`, `sourceEventId`, `memberId`, `initiativeId`, `occurredAt`, `schemaVersion`) are immutable once written. Only `validityStatus` may transition, and only via the mechanism in §15, never via an in-place field rewrite. |
| 4 | Can it be deleted? | **No**, as a normal operation. Historical erasure is prohibited by the same institutional-memory principle already binding on the platform (ADR-006: "Historical erasure SHALL NOT occur"). Exceptional legal/administrative erasure (e.g. right-to-erasure requests) is explicitly out of scope for this ADR (§24) and must be addressed by a separate privacy-governance decision if it ever becomes necessary. |
| 5 | Can it be invalidated? | **Yes**, via a `validityStatus` transition (`valid → reversed` / `valid → superseded`), triggered only by a corresponding source correction/reversal event — never by direct administrative edit of the historical fact. |
| 6 | Can it be rebuilt? | **Yes.** The ledger is a materialized, replayable projection of the durable outbox event stream; in principle it can be reconstructed by replaying retained source events, though this ADR does not mandate that the raw event log itself be retained indefinitely (that is a separate outbox-retention decision, out of scope here). |
| 7 | Can it be replayed? | **Yes.** The consumer that writes it is required to be idempotent (§15); replaying the same source event must produce no duplicate and no error. |
| 8 | Does it have its own ID? | **Yes** — `memberActionId`, generated by the consumer at write time. |
| 9 | Does it preserve source event ID? | **Yes, mandatory** — `sourceEventId`, and it is the primary idempotency key (§15). |
| 10 | Does it preserve source aggregate ID? | **Yes** — `sourceId`, the source aggregate's own natural ID (e.g. `commentId`, `voteId`, `petitionSignatureId`), not a composite key and not the event ID. |
| 11 | Does it preserve source artifact type? | **Yes** — `sourceType`, drawn from a dedicated `MemberActionSourceType` vocabulary (§11), not `CivicArtifactType`. |
| 12 | Does it preserve Member ID? | **Yes, mandatory** on every row. |
| 13 | Does it preserve Initiative ID? | **Conditionally mandatory**, per the action-type classification in §10 — mandatory for Initiative-scoped action types, absent for platform-scoped action types. |
| 14 | Does it preserve organization context? | An `organizationId` field is **reserved** in the persistence shape (§16) for future institution/organization scoping, but is not populated by any producer or pilot defined in this ADR. |
| 15 | Does it preserve occurrence time? | **Yes** — `occurredAt`, copied from the source event's own `metadata.occurredAt`, not the consumer's processing time. |
| 16 | Does it preserve ingestion time? | **Yes** — `recordedAt`, the ledger consumer's own write time, kept distinct from `occurredAt` for audit and eventual-consistency reasoning. |
| 17 | Does it preserve event schema version? | **Yes** — `schemaVersion`, the version of the *source event's* payload schema (so the consumer can correctly interpret older event shapes as producers evolve); this is independent of any versioning of the ledger row's own shape, which evolves additively (§16). |

---

## 10. Initiative Relationship

**Rule, adopted exactly as directed by the governing task, with no unrestricted optional field:**

```text
initiativeId is mandatory for Initiative-scoped action types
initiativeId is absent for explicitly platform-scoped action types
```

`initiativeId` is never a bare, producer-discretionary optional field. Every `MemberActionType` (§11) is assigned, at definition time, to exactly one of two classes, and that classification — not the producer's runtime choice — determines whether `initiativeId` is required:

- **Initiative-scoped action classes:** all actions sourced from `initiative-comments`, `initiative-comment-reactions`, `initiative-collaborative-analysis`, `initiative-improvement-proposal`, `petition`, `decision-session`, `initiative-collective-decision`, `initiative-decision-vote`, `initiative-support`, `initiative-implementation-commitment`, `initiative-implementation-tracking`, `initiative-public-impact`, and `public-civic-archive` — i.e., exactly the Initiative-mandatory action set Task 20 §3 already identified as unconditionally Initiative-scoped in production today.
- **Platform-scoped action classes:** platform membership/joining (`membership`), member badge/merchandise contribution (`member-badge-contribution`), and any future authentication/session/account action. These carry no `initiativeId` by design, matching their source modules, which have no Initiative concept at all.
- **Global governance actions:** none exist in the codebase today (Task 20 confirmed no such module or event). This ADR does not invent one; if a genuinely platform-wide governance action is introduced in the future, it is classified as platform-scoped unless and until a future ADR amendment defines an Initiative-independent governance action class with different rules.

**How Initiative identity is obtained:** for every Initiative-scoped action, `initiativeId` **must originate from the producer's already-validated ancestry boundary** — the same direct or transitively-derived, existence-checked `initiativeId` the producing module already establishes under `ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0` §10–§11 (Tasks 04–18) — and must be included as a field on the durable outbox event itself at the moment that event is written, inside the same transaction as the canonical mutation.

**Consumers do not rediscover ancestry.** The Member Action consumer copies `initiativeId` directly from the event payload. It **must not** re-walk source-artifact ancestry at consumption time to compute or confirm `initiativeId`, per the governing task's explicit direction to avoid replay-time ancestry rediscovery. A consumer **may**, as a defensive measure, verify that `initiativeId` is present and well-formed for an action type classified as Initiative-scoped (rejecting/quarantining an event that violates this as a producer defect — see the blueprint's error taxonomy), but this is a shape check, not an independent ancestry re-derivation, and it is optional hardening, not a required architectural step.

**Preferred event shape**, adopted as directed:

```text
memberId
initiativeId?         // present iff actionType is Initiative-scoped
actionType
sourceEntityType
sourceEntityId
sourceEventId
occurredAt
schemaVersion
```

---

## 11. Action Vocabulary

A dedicated `MemberActionType` vocabulary is established. **It is not, and must never become, an alias for `CivicArtifactType`.** `CivicArtifactType` answers "what canonical artifact is this and which module owns its ancestry validation" (`packages/types/src/domain/initiative-ancestry.ts`); `MemberActionType` answers "what did a Member do, as a completed fact, that is worth recording in the participation ledger." These are different questions with different stability requirements — `CivicArtifactType` changes only when ancestry ownership changes; `MemberActionType` grows every time a new kind of participation fact is worth recording, even if no new civic artifact is introduced.

**Naming convention:** `snake_case`, and every value names a **completed fact**, never an intent or a request. `comment_added`, not `add_comment`; `vote_cast`, not `cast_vote`; `petition_signed`, not `sign_petition`. This mirrors the past-tense convention already used by `CATALOGUE_EVENTS` (`ActivityCreated`, `ProposalSubmitted`) and by the illustrative examples in the governing task (`discussion_created`, `comment_added`, `contribution_submitted`, `evidence_submitted`, `proposal_created`, `proposal_supported`, `petition_signed`, `signal_recorded`, `vote_cast`, `commitment_created`, `implementation_started`, `implementation_updated`, `public_impact_published`, `archive_contribution_published`, `volunteer_offer_submitted`). These remain **illustrative examples**, not an exhaustive or committed list; the exact first-shipped value is fixed narrowly to the pilot in §21.

**Reversals use separate, explicit action types.** A reversal or correction is never represented by mutating the original entry's `actionType`; it is a new row with its own action type (e.g. `vote_recast`, `commitment_withdrawn`) that references the entry it corrects via `previousMemberActionId` (§16). This preserves both facts — "the vote was cast" and "the vote was later recast" — as distinct, individually timestamped, individually attributable rows, consistent with the append-only requirement in §15.

**Corrections invalidate, they do not replace.** A correction/reversal action, when consumed, both (a) writes the new corrective row and (b) transitions the original row's `validityStatus` to `reversed` or `superseded` (§9, question 5) — it never rewrites or deletes the original row's fact fields.

**Extension rule (stable, not exhaustive):** a new `MemberActionType` value may be added at any time under the following conditions, all of which must hold before a new producer ships:

1. It is assigned an explicit Initiative-scoped/platform-scoped classification (§10) at the time it is defined, not left ambiguous.
2. It has exactly one owning canonical source module, which is the only module ever permitted to emit the durable outbox event that produces it.
3. That source module supplies a stable `sourceEventId` per §15 before its first production emission.
4. It has test coverage (unit + integration) proving idempotent consumption before its producer ships.

No future task may add a `MemberActionType` value without satisfying all four conditions; this rule itself does not need to be repeated in a new ADR each time a value is added.

---

## 12. Source Entity Vocabulary

A new, dedicated `MemberActionSourceType` vocabulary is established, **distinct from `CivicArtifactType` and from `CivicEntityType`.**

- `CivicArtifactType` is rejected as the source vocabulary because it exists specifically to gate the Initiative Ancestry Invariant for canonical civic artifacts (`ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0` §11) and, per Task 19's already-executable boundary test, explicitly excludes `activity` and anything Activity-adjacent. Forcing every Member Action source into `CivicArtifactType` would either wrongly imply every source is a canonical-ancestry artifact (untrue for platform-scoped sources like `membership`) or require polluting `CivicArtifactType` with non-artifact concepts, which this ADR explicitly refuses to do (§24: "Do not modify `CivicArtifactType`").
- `CivicEntityType` (`packages/types/src/domain/capability02-integration.ts`) is rejected as the *sole* source vocabulary because it exists for search/notification entity categorization and is not guaranteed to enumerate every future Member Action source (e.g. a platform-scoped membership-lifecycle transition is not necessarily a `CivicEntityType` member) — coupling the ledger's source vocabulary to a vocabulary owned by a different concern (search/notifications) would create an unwanted cross-dependency and force every future ledger source addition through search/notification's own review process.

`MemberActionSourceType` may **reference or mirror** values from `CivicArtifactType`/`CivicEntityType` where they already correctly describe a canonical source (naming consistency is encouraged, e.g. a Member Action sourced from an `initiative-collective-decision` vote and the corresponding civic-artifact/entity vocabulary should use recognizably similar names), but it is defined and versioned independently, so Member Action's evolution is never blocked on, or accidentally coupled to, changes in the ancestry or search/notification vocabularies.

**Source ID rule:** `sourceId` is the source aggregate's own natural ID (e.g. `commentId`, `voteRecordId`, `petitionSignatureId`) — never a composite key and never the source event's ID. The source event's ID is tracked separately, as `sourceEventId`, which serves a different purpose (idempotency, §15) than `sourceId` (traceability/deep-linking back to the originating record).

---

## 13. Event Ingestion Contract

**Target model, selected exactly as directed:**

```text
canonical transaction
    ↓
durable outbox event
    ↓
idempotent Member Action consumer
```

Concretely: the canonical service (e.g. `initiative-decision-vote`'s vote-casting service) persists its own aggregate mutation and calls `enqueueDomainEvent` inside the same Mongo transaction — the exact pattern already proven and reused by the legacy `activity`/`discussion`/`proposal`/`decision`/`member` modules today (`runMongoTransaction` + `enqueueDomainEvent`, `apps/api/src/infrastructure/outbox/outbox.repository.ts`). A separate Member Action consumer then reads that event and writes the corresponding ledger row idempotently, using the existing `(consumerId, eventId)` claim pattern already implemented and battle-tested in `apps/api/src/infrastructure/outbox/processed-events.repository.ts`.

**Rejected: "Producer writes ledger directly."** A single transaction that writes both the source aggregate and the Member Action row is rejected because it couples every canonical service's transaction boundary, and its module-level code, to the Member Action ledger's schema and write path. This creates exactly the "second write-side source of truth" risk §5 fact 9 warns against — a bug or partial failure in ledger-writing code could then abort or corrupt a canonical civic mutation it has no business being coupled to. The outbox pattern decouples these concerns: a canonical mutation's success does not depend on the ledger consumer succeeding, and the ledger consumer can retry indefinitely without ever touching the canonical aggregate again.

**Rejected: "Existing notification-event consumer" (`emitCivicNotificationEvent`).** Per the governing task's own conditional test — "this option must be rejected unless it provides: durability; replay; stable IDs; transactional guarantees; idempotent delivery semantics" — §8's first-party evidence shows it provides **none** of the five. It is formally rejected as a Member Action ingestion mechanism. It may continue to serve its existing, narrower purpose (best-effort notification delivery) unchanged; this ADR does not modify it (§24).

**Mixed transitional model — permitted, bounded, and temporary only.** Because zero canonical `initiative-*` modules emit any durable domain event today (§5 fact 6, reconfirmed independently here), the rollout (§20) necessarily proceeds one producer at a time: the pilot producer (§21) gains durable outbox emission first, while every other Initiative-scoped module remains outbox-silent until its own turn in Phase 4 of the rollout. This is an explicitly bounded, sequenced transitional state, not a permanent architecture — every Initiative-scoped producer is expected to converge on durable outbox emission by the end of Phase 4. No producer is authorized to ship using `emitCivicNotificationEvent`, direct producer writes, or any other non-outbox mechanism as its **permanent** Member Action ingestion path.

---

## 14. Idempotency

**Canonical idempotency key: `sourceEventId`.** The ledger's persistence layer enforces a unique index on `sourceEventId` (§16), and the consumer additionally claims each `(consumerId, sourceEventId)` pair via the existing `processed-events` claim pattern before writing, exactly mirroring the dedup mechanism already proven for `workspace`'s event handlers. This is not a new idempotency mechanism invented for this ADR — it is deliberate reuse of infrastructure Task 20 already confirmed is correct and reusable.

**Fallback candidate — documented contingency, not an authorized default.** `sourceEntityType + sourceEntityId + actionType + eventVersion` is recorded here as a documented fallback for a hypothetical future scenario where a producer cannot yet supply a stable `sourceEventId` (e.g., mid-migration before that producer has outbox integration). This ADR does **not** authorize any producer to ship without a stable `sourceEventId` — extension rule 3 in §11 makes a stable `sourceEventId` a precondition for any new producer going live. The fallback exists only so that a future reviewer facing an unanticipated transitional gap has a documented, deliberately-considered option, not a silent gap.

**Behavior table:**

| Scenario | Behavior |
|---|---|
| Duplicate event delivery | The unique index on `sourceEventId` (or the prior `processed-events` claim) causes the second write to be treated as an idempotent no-op, not an error. |
| Event replay | Identical to duplicate delivery — safe by construction. |
| Consumer retry after partial failure | Resumes from the `processed-events` claim's `processing`/`completed`/`failed` state and 5-minute staleness-reclaim window, exactly as already implemented. |
| Source correction | The source module emits a distinct correction/reversal-class event (its own new `actionType`, e.g. `vote_recast`); the consumer writes a **new** row referencing the original via `previousMemberActionId` and transitions the original's `validityStatus` (§9 Q5, §11). The original row's fact fields are never rewritten. |
| Source supersession (e.g. vote recast, comment edited into a new canonical revision) | Same pattern as source correction: new row, `previousMemberActionId` chain, original `validityStatus` transitioned. |
| Source deletion (rare/administrative) | If a canonical source record is ever deleted, its owning module MAY emit a corrective `*_removed`-class event so the ledger reflects the removal via a new row, never by deleting the historical row that recorded the original action occurred (consistent with ADR-006's "historical erasure SHALL NOT occur"). |
| Reversible actions generally | Always represented via compensating entries (new rows), never via physical deletion or in-place mutation of the ledger's historical rows. |
| Repeated comments (multiple distinct comments by the same Member) | Each comment has its own `sourceId` and therefore its own `sourceEventId` — each produces its own, non-duplicate Member Action row. Deduplication applies only to *redelivery of the same event*, never across distinct actions of the same type. |
| Vote replacement/recasting | As "source supersession" above. |
| Lifecycle transitions (e.g. proposal draft → submitted) | Each transition the producer wishes to appear in the ledger must be emitted as its own distinct, explicitly named `actionType`/event by the producer. The consumer never infers a transition by diffing two states — that would require the consumer to read canonical aggregate state directly, which is out of scope for an event-driven consumer and would reintroduce the ancestry-rediscovery problem §10 already rejects. |

The ledger remains **append-oriented**: the only permitted "mutation" to an existing row is the `validityStatus` transition described above, performed atomically alongside the write of the compensating row, by the consumer, never by a client-facing API.

---

## 15. Persistence Model

The illustrative record shape provided by the governing task is adopted, with the following decisions made explicit. **No production TypeScript interface is created by this ADR** (per Part 21's prohibition); the shape below is illustrative and belongs to the companion blueprint (`architecture/recovery/MEMBER_ACTION_LEDGER_IMPLEMENTATION_BLUEPRINT_v1.0.md`) as a non-normative reference for the eventual Phase 1 implementation.

```ts
// Illustrative only — not created as production code by this ADR.
interface MemberActionRecord {
  memberActionId: string;          // required — consumer-generated
  memberId: string;                // required
  initiativeId?: string;           // required iff actionType is Initiative-scoped (§10); absent otherwise
  organizationId?: string;         // reserved, unpopulated by any producer defined here

  actionType: MemberActionType;    // required — §11 vocabulary

  sourceType: MemberActionSourceType; // required — §12 vocabulary
  sourceId: string;                // required — source aggregate's natural ID
  sourceEventId: string;           // required — primary idempotency key, §14

  previousMemberActionId?: string; // optional — reversal/supersession chain, §11/§14

  occurredAt: string;              // required — copied from source event metadata.occurredAt
  recordedAt: string;              // required — consumer's own write time

  schemaVersion: number;           // required — version of the *source event* payload schema
  validityStatus: "valid" | "reversed" | "superseded"; // required, defaults to "valid"
}
```

**Decisions:**

- **Required fields:** `memberActionId`, `memberId`, `actionType`, `sourceType`, `sourceId`, `sourceEventId`, `occurredAt`, `recordedAt`, `schemaVersion`, `validityStatus`.
- **Optional fields:** `initiativeId` (conditionally required at the ingestion-contract level per §10, not a bare optional at the domain level — the ingestion function must reject an Initiative-scoped `actionType` with a missing `initiativeId` as a producer defect, per the blueprint's error taxonomy), `organizationId` (reserved), `previousMemberActionId` (present only on reversal/supersession rows).
- **Indexes:** unique index on `sourceEventId` (idempotency); compound index on `(memberId, occurredAt)` descending (Member timeline queries); compound index on `(initiativeId, occurredAt)` descending, sparse/partial where `initiativeId` exists (Initiative-participant/steward views); index on `(actionType, memberId)` (filtered timeline/reporting queries).
- **Uniqueness:** `sourceEventId` unique (idempotency guarantee); `memberActionId` unique (its own generated identity, not otherwise load-bearing for dedup).
- **Ordering:** primary chronological ordering is by `occurredAt` (the fact's true time), never by `recordedAt`, which exists only for audit/eventual-consistency reasoning (e.g. detecting unusually delayed ingestion).
- **Versioning:** `schemaVersion` tracks the *source event's* payload version, allowing the consumer to interpret older event shapes correctly as producers evolve their event payloads over time. The ledger row's own shape evolves additively (new optional columns only), following the same forward-compatible reader pattern already proven in `fromActivityMongoDocument` (Task 20's characterization test already pins this pattern as reusable) — it does not need, and does not have, its own separate row-schema version field.
- **Validity/correction model:** as defined in §14 — `validityStatus` transitions only, never row deletion or fact-field rewrite.
- **Payload metadata:** **not embedded.** The ledger row is a thin pointer record — IDs, type, and timestamps only. It does not copy the source record's content (comment text, proposal body, vote choice, impact narrative, etc.).
- **Sensitive source data:** **must not be copied** into the ledger under any circumstance defined by this ADR. If a future read-performance need justifies denormalizing a small, already-public, non-sensitive field (e.g. a title snippet) onto a projection, that is a projection-layer decision (§17) requiring its own future ADR amendment — it is not authorized by default here.
- **Retention:** indefinite by default, consistent with the platform's institutional-memory principle (ADR-006). A future, separate privacy/retention-governance decision may impose limits; that is explicitly out of scope for this ADR (§24).

---

## 16. Target Persistence Home

The Member Action ledger lives in a **new**, dedicated Mongo collection (illustratively `member_actions`), owned by a **new**, dedicated module (illustratively `apps/api/src/modules/member-action`) — **not** inside the existing `activities` collection and **not** inside the existing `activity` module. This directly resolves the Option A/B vs. Option E choice made in §7: the ledger's persistence home is new, not reused, precisely because §5 facts 1–4 and §9's "not-an-aggregate, consumer-written" semantics are structurally incompatible with Activity's existing collection, index set, and authorization model. Neither the collection nor the module is created by this ADR (§21); this section fixes the *decision* of where they will live once Phase 1 (§20) is implemented, so that the blueprint and the pilot task have an unambiguous target.

---

## 17. Privacy Model

Visibility is **explicitly separate from persistence.** The ledger's existence, and a row's presence in it, never by itself makes that row publicly queryable — the governing instruction's rule ("the ledger itself should not automatically be publicly queryable") is adopted without qualification.

**Visibility classes:**

| Class | Meaning | Default applicability |
|---|---|---|
| **Private** | Visible only to the acting Member. | **Default for every Member Action row**, unless a projection explicitly and deliberately elevates it. |
| **Member-profile visible** | Shown on the Member's own public profile, if the Member has opted in and the source record's own visibility permits it. | Opt-in only; never automatic. |
| **Initiative-participant visible** | Visible to participants/stewards of the same Initiative, mirroring the source record's own participant-visibility rules. | Derived from source, not invented independently by the ledger. |
| **Public aggregate only** | Counted in totals/statistics (e.g. "N actions this month") without exposing the individual entry. | Available to any future aggregate-statistics projection; does not expose row-level detail. |
| **Public entry** | The individual entry itself is publicly visible. | Only when the source record is already fully public **and** the Member has opted in — never by ledger default. |
| **Administrative/audit only** | Visible only to platform administrators for accountability/abuse investigation. | Not a general product surface; a narrow, separately-governed access path. |

**Derivation rule:** a Member Action's eligible visibility is bounded above by its **source record's own current visibility** — a row sourced from a private or no-longer-public record can never become more visible than the source permits, regardless of the ledger's own settings. The ledger does not invent an independent visibility policy; it can only be *more* restrictive than the source, never less.

**Member control:** a Member may hide an otherwise-eligible entry from their public profile. This is a **projection-layer** toggle, not a ledger mutation — hiding an entry does not delete or alter the underlying `MemberActionRecord`.

**Score-relevant actions may be hidden but still counted.** Because persistence (§15–§16) and visibility (this section) are separate, a Member may hide an action from their public profile while it still contributes to a future Fair Accounting Ledger's computation (§19) — this is exactly the reason the separation is required, not an incidental side effect.

**Sensitive/pseudonymous protection:** no public projection may expose an action_type + source_type combination that would deanonymize a pseudonymous Member's true civic position or identity beyond what the source record's own public visibility already permits. Default posture, absent an explicit future decision, is **non-disclosure** for anything not unambiguously already public via its source.

---

## 18. Authorization / Producer Model

Member Action rows may be created **only** by the event-consumer path described in §13. Concretely, of the four producer models the governing task lists:

- **User-created:** rejected. No Member-facing API ever writes a Member Action row directly.
- **Domain-service-created (synchronous, in the same call as the canonical mutation, bypassing the outbox):** rejected, for the same reason "Producer writes ledger directly" is rejected in §13.
- **Event-consumer-created:** **accepted, and is the exclusive general-case mechanism.**
- **Administrative correction:** accepted only as a **bounded special case** that itself flows through the same durable-outbox/idempotent-consumer pipeline (i.e., an administrative correction is *itself* modeled as a distinct, audited event with its own `actionType`, per §11/§14) — never as an ad hoc direct database write that bypasses idempotency and audit guarantees.

---

## 19. Fair / Social Activity Score Relationship

`Member.fair: FairBalance` **exists as an inert legacy structure** (§5 fact 5, §8 evidence). This ADR does not implement Fair scoring and does not add, remove, or mutate `Member.fair` in any way.

**Decision: Member Action Ledger and Fair Accounting are distinct ledgers.** The separation the governing task offers for evaluation is explicitly adopted:

```text
Member Action Ledger
    = participation facts

Fair Accounting Ledger
    = scored accounting entries derived from policy
```

**Reasoning:** Member Action's guarantees — idempotency via `sourceEventId`, append-only history, source-authoritative content, reversal-awareness via `validityStatus` — are necessary and largely sufficient *primitives* for a scoring ledger to be built on top of. But scoring introduces genuinely different, and independently mutable, concerns: point values, decay functions, fraud/abuse adjustment, multipliers, and policy versioning. Embedding any of these into Member Action rows would make a change in scoring *policy* require rewriting participation *history*, which directly violates the append-only, non-authoritative nature this ADR establishes for the ledger (§9, §15).

Therefore: a future Fair Accounting Ledger, when built, **must** consume Member Action records (not raw canonical events directly, and not a re-derivation of canonical aggregate state) as its input, with each Fair Accounting entry referencing the `memberActionId` it was derived from plus the scoring-policy version applied. A change in scoring policy is handled by producing new Fair Accounting entries under a new policy version, never by rewriting Member Action history.

**Explicit non-guarantee:** Member Action's idempotency and reversal-awareness are necessary but not sufficient for fraud-resistant scoring on their own — fraud detection, rate-limiting, and abuse adjustment are Fair Accounting Ledger (Phase 6, §20) concerns, not solved by this ADR.

---

## 20. Rollout Phases

No phase below is implemented by this task (§21). Phase 0 is newly introduced by this ADR, narrowing Task 20's broader "add events to all `initiative-*` modules" prerequisite into the smallest sequenceable first step.

| Phase | Objective | Scope | Gate |
|---|---|---|---|
| **Phase 0 (prerequisite)** | Add durable outbox (`enqueueDomainEvent`) emission to the single selected pilot producer only (§21), carrying `initiativeId` per its already-validated ancestry, inside its existing transaction. | One module only — not all eight Initiative-scoped modules at once, narrowing Task 20's broader prerequisite to the minimum needed to unblock Phase 2. | `pnpm typecheck`; new test asserting the event is emitted with the correct `initiativeId` on the pilot's existing mutation; no change to the pilot's existing response contract. |
| **Phase 1** | Member Action contracts and ledger core: `packages/types` shape, Mongo store, unique index on `sourceEventId`, idempotent consumer skeleton. No public API, no scoring, no UI. | New module/collection only (§16); zero changes to any existing module. | Unit tests for idempotent consumption (duplicate event → single row); no route mounted. |
| **Phase 2** | Wire the Phase 0 pilot's event end-to-end into the Phase 1 consumer. | Integration test: emit → consume → ledger row, with correct `initiativeId`/`memberId`/`sourceEventId`. | Existing pilot-module test suite remains green; new integration test passes. |
| **Phase 3** | Private Member timeline projection (the Member's own history only; no public exposure). | Read-only projection over the ledger; no writes. | Manual/automated verification that no other Member can read another Member's timeline. |
| **Phase 4** | Expand durable outbox emission and ledger consumption to the remaining Initiative-scoped producers, one module per task (per `ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0` Migration Principle 6: "one bounded architectural change per task"). | `initiative-comments`, `initiative-collaborative-analysis`, `initiative-improvement-proposal`, `initiative-decision-vote`/`initiative-collective-decision`, `initiative-support`, `initiative-implementation-commitment`, `initiative-implementation-tracking`, `initiative-public-impact`, `public-civic-archive`. | Per-module: typecheck, focused tests, and a new test asserting correct event emission, before that module's turn is considered complete. |
| **Phase 5** | Collective Participation Journey: combine ledger-derived history, a live/derived current-commitments view, and a separately-built next-action recommendation projection. | Presentational; must remain non-mutating per the already-accepted Journey principle (§5 fact 7). | Historical vs. recommended-action separation verified (§17 of this ADR — see also §17 above for the general historical/next-action boundary rule). |
| **Phase 6** | Fair Accounting Ledger: a separate, policy-versioned scoring implementation consuming Member Action records (§19). | New, independent module; does not modify Member Action rows. | Explicit fraud/abuse-resistance review before any public-facing score is derived. |

---

## 21. Pilot Selection

**Selected pilot: `petition_signed`, sourced from the `petition` module (`apps/api/src/modules/petition`).**

Evaluated against the governing task's criteria:

| Criterion | Petition signing | Vote casting | Implementation commitment created | Comment added |
|---|---|---|---|---|
| Clear actor identity | Yes | Yes | Yes | Yes |
| Valid Initiative ancestry | **Direct**, typed `initiativeId`, already classified Class A / High confidence and stated to "already satisfy §11" in `ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0` §14 | Direct/transitive via Decision (Tasks 09/12) | Transitive (Task 15) — one rank below direct per the ADR's own ancestry-strength ordering (§10 point 2) | Direct, but the ADR itself flags `initiative-comments` as validating `initiativeId` only at the route boundary, not inside the service layer — a known, unremediated gap (ADR §10 point 4) |
| Stable source ID | Yes | Yes | Yes | Yes |
| Durable persistence | Yes (Mongo-backed per Task 13/14 hardening) | Yes | Yes | Yes |
| Clear completion semantics | **Signing is a single, terminal, non-reversible fact** — no "unsign" function exists in the module today | **Reversible** — votes may be recast/changed (Task 20 table: "vote cast/changed") | Not append-only; the aggregate has further lifecycle stages after creation (draft→active→…) | Not append-only; comments may be edited/removed (Task 20 table: "active/edited/removed") |
| Low reversal complexity | **Lowest of the four** | Explicitly excluded by the governing task's own guidance ("avoid a highly mutable or reversible action as the first pilot") | Medium | Medium |
| Existing event/outbox support | None (true of all four — Phase 0 adds it regardless of choice) | None | None | None |
| Low authorization sensitivity | Yes — public action by design | Medium (eligibility-gated) | Medium | Low-medium |
| Test coverage | Recovery Tasks 13/14 specifically hardened petition E2E verification-fixture idempotency | Good (Task 12 regression suite) | Good (Task 15 regression suite) | Good (Task 11 regression suite) |

**Rationale:** Petition signing has the strongest ancestry (direct, not transitive), the simplest and least reversible completion semantics of the four candidates, the lowest authorization sensitivity, and already-hardened fixture idempotency from prior recovery work (Tasks 13/14) that directly reduces Phase 0/2 test-flakiness risk. It uniquely satisfies the governing task's explicit warning against choosing "a highly mutable or reversible action as the first pilot" — vote casting is explicitly disqualified by that rule, and both implementation-commitment-created and comment-added carry more lifecycle/mutability surface than a first pilot should.

**Noted caveat:** `ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0` §14 flags `petition`'s coupling to the legacy, untyped-reference `collective-decision` module as needing remediation. This does not affect `petition`'s own `initiativeId` typing (already direct and compliant), but a future reviewer who judges this coupling disqualifying for a "cleanest possible" pilot should treat **implementation commitment created** (`initiative-implementation-commitment`) as the strong runner-up alternative — it has no such legacy coupling, at the cost of a transitive (not direct) `initiativeId` and additional post-creation lifecycle mutability that the "created" action type itself does not need to represent.

---

## 22. Legacy Activity Disposition

**Decision: Freeze.** Of the five dispositions offered (Retain indefinitely, Freeze, Deprecate, Migrate, Remove after compatibility period), **Freeze** is selected.

| Question | Decision |
|---|---|
| Does its API remain? | **Yes**, unchanged. `POST /api/v1/activities` and `GET /api/v1/activities/:activityId` remain mounted exactly as they are. |
| Does its collection remain? | **Yes**, unchanged. The `activities` Mongo collection is not renamed, merged, or repurposed. |
| Does its event remain? | **Yes.** `ActivityCreated` remains the only implemented Activity event. `ActivityRevised`/`ActivityClosed` remain reserved-but-unimplemented catalogue names (§23 records the associated, still-unresolved naming drift). |
| Does it receive new fields? | **No.** Activity does **not** receive `initiativeId`, `sourceEventId`, `sourceType`, or any other Member-Action-shaped field under this ADR. |
| Are existing records migrated? | **No.** See §22.1. |
| Is its Discussion/Proposal/Decision coupling removed now? | **No**, not by this task. It is recorded as a recommended future remediation (§25), not performed here. |
| Is it marked legacy in documentation? | **Yes** — this ADR, together with `architecture/recovery/ACTIVITY_RETARGETING_DISCOVERY_v1.0.md`, is the authoritative statement that Activity is frozen and is not, and will not become, the Member Action ledger's persistence home. No other production document is modified by this task. |

**This is a formally logged deviation from a literal reading of `INITIATIVE_ARCHITECTURE_RECOVERY_ROADMAP_v1.0.md` Phase 4 (P4.3),** which describes retargeting Activity's own creation entry point to be driven by the new events. Per this task's own governing instruction ("the ADR must validate this model against the actual Task 20 findings rather than merely restating it"), the fuller evidence in §5, §8, and §9 shows that Activity's authorization model (creator-private, client-submitted), absent source-reference fields, absent listing/query API, and live coupling to the legacy Discussion/Proposal/Decision chain make it structurally unfit to be that persistence owner without a rewrite indistinguishable in cost from building new. `ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0` §12's *directive that Activity's infrastructure (outbox, event envelope, idempotent dispatch) is reusable* is honored in full — the exact same infrastructure patterns are reused in §13's ingestion contract — but the *aggregate/collection itself* is not reused, correcting the roadmap's more specific P4.3 assumption with first-party evidence gathered after the roadmap was written.

### 22.1 Legacy Data Migration

**Decision: Do not migrate legacy Activity records into verified Member Action history.**

| Question | Answer |
|---|---|
| Do they represent verified canonical actions? | No — they are self-reported, client-submitted records with no reference to any canonical civic artifact. |
| Were they manually submitted? | Yes, exclusively — Activity has no other creation path today. |
| Do they contain sufficient source identity? | No — `ActivityRecord` has no `sourceType`/`sourceId`/`sourceEventId` of any kind (Task 19/20 confirmed this). |
| Can Initiative ancestry be reconstructed? | No — no reference exists from which to derive one; any attempt would be fabrication, not recovery. |
| Would migration create false participation history? | Yes — a migrated record would appear alongside genuine, event-verified Member Action rows with no way for a consumer to distinguish self-reported claims from verified facts, undermining the ledger's core guarantee. |
| Would migrated entries be score-eligible? | No — and they must never be, given the above. |
| Can they be marked `legacy_unverified`? | Conceptually yes, if a future task ever chooses to surface them in a unified read view — but this is not implemented, decided in detail, or required by this ADR. |

**Preferred, adopted outcome:** legacy Activity records are **not** migrated. If retained for historical Member access, they remain readable only via the existing, unchanged Activity API and collection — they are never blended into the Member Action ledger's read path.

---

## 23. Compatibility Strategy

| Surface | Current behavior | Target behavior | Migration needed | Breaking risk |
|---|---|---|---|---|
| Existing Activity API (`POST`/`GET /api/v1/activities*`) | Creator-submitted, creator-only read | Unchanged (frozen, §22) | No | None |
| Activity Mongo collection (`activities`) | Dedicated, single-writer collection | Unchanged | No | None |
| Activity IDs (`activityId`) | Server-generated `randomUUID()` | Unchanged | No | None |
| `ActivityCreated` event | Sole implemented Activity event, consumed only by `workspace`'s legacy handler | Unchanged | No | None |
| Member DTO (`Member`) | Includes `fair: FairBalance`, always zero (§8) | Unchanged by this ADR; future Fair work is a separate, later ADR-governed change (§19) | No | None |
| `Member.fair` | Structurally present, inert | Unchanged; remains inert until a future, separate scoring ADR | No | None |
| Canonical Initiative routes (`initiative-*`) | No durable event emission today | Gains durable outbox emission one module at a time, starting with the Phase 0 pilot (§20–§21); existing route contracts, request/response shapes, and authorization remain unchanged | Additive only (new `enqueueDomainEvent` call inside the existing transaction) — no schema/contract migration | Low, contained per-module by Migration Principle 6 (one bounded change per task) |
| Notifications (`emitCivicNotificationEvent`) | Fire-and-forget, non-durable, unaffected by this ADR | Unchanged; remains rejected as a Member Action ingestion mechanism (§13) but continues serving its existing purpose | No | None |
| Public profiles | No Member Action-derived content today | Gains opt-in, source-visibility-bounded entries only from Phase 3 onward (§17, §20) | N/A (new capability, not a migration) | None to existing profile behavior |
| Future Journey UI | Documentation/UX-copy only; no data model | Gains a historical-facts feed from Phase 5 onward, kept explicitly separate from next-action recommendations (§17 of this ADR / §5 fact 7) | N/A (new capability) | None to existing UI copy, which is unaffected by this ADR |

---

## 24. Non-Goals

This ADR explicitly does **not**:

- Implement any part of the Member Action ledger, its module, its collection, its consumer, or any producer's event emission.
- Modify `CivicArtifactType`, `CivicEntityType`, any shared Initiative ancestry validator, or any canonical Initiative module's production code.
- Modify Activity's production code, routes, persistence, or events.
- Implement Fair scoring, a Fair Accounting Ledger, or any change to `Member.fair`.
- Implement the Collective Participation Journey UI or projection.
- Resolve the documented `ActivityPublished`/`ActivityCorrected` (docs) vs. `ActivityRevised`/`ActivityClosed` (code) naming drift (§25).
- Resolve the legacy Activity → Discussion/Proposal/Decision direct-import coupling (§25).
- Define a data-retention or legal-erasure policy for Member Action rows (§9 Q4, §15).
- Define the exact mechanics of the future recommendation engine that produces "next available actions" (§20 Phase 5).

---

## 25. Rejected Alternatives (Consolidated)

In addition to Options A–D (§7):

- **Reusing `emitCivicNotificationEvent` as the permanent ingestion path** — rejected in §13 on evidentiary grounds (§8).
- **A bare, unconditionally optional `initiativeId`** — rejected in §10 in favor of an action-type-classified mandatory/absent rule.
- **Embedding source payload content in ledger rows** — rejected in §15 to avoid content duplication, privacy risk, and a second content-authority surface.
- **Embedding Fair scoring fields directly on Member Action rows** — rejected in §19 in favor of a separate Fair Accounting Ledger.
- **Migrating legacy Activity records into the Member Action ledger** — rejected in §22.1.
- **Retargeting Activity itself into the ledger's persistence home (a literal reading of roadmap P4.3)** — rejected in §22, with the deviation explicitly logged.

---

## 26. Implementation Prerequisites

Before Phase 1 (§20) may begin implementation:

1. This ADR must complete architectural review and move from `Proposed` toward `Accepted` (or be explicitly revised), per `architecture/ARCHITECTURE_DECISION_RECORDS.md` §3.1's status-transition rules.
2. The companion blueprint (`architecture/recovery/MEMBER_ACTION_LEDGER_IMPLEMENTATION_BLUEPRINT_v1.0.md`) must remain consistent with any revision made during that review.
3. Phase 0's pilot module (`petition`, §21) must gain durable outbox emission as its own narrowly-scoped, independently-reviewable recovery task, before any Member Action consumer is built to read it.

**Exact scope of the first implementation task following this ADR:** add `enqueueDomainEvent` emission of a `petition_signed`-class durable domain event to `petition`'s existing signing mutation, carrying `initiativeId` from `petition`'s own already-validated ancestry, inside the existing transaction, with no other change to `petition`'s routes, response contract, or persistence shape (Phase 0 only — §20). Building the Member Action ledger's own store/consumer (Phase 1) is the task that follows it, not this one.

---

## 27. Consequences

**Positive:**

- The platform gains a single, precisely-defined target architecture for participation history, replacing an ambiguous roadmap directive with a decision validated against first-party code evidence.
- Canonical aggregates' authority is protected by construction — the ledger cannot become a second write-side source of truth because it has no write path other than consuming already-committed events.
- Activity's genuine engineering investment (outbox, event envelope, idempotent dispatch) is preserved and reused in the new ledger's ingestion contract (§13), honoring `ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0` §12's infrastructure-reuse directive, without inheriting Activity's legacy coupling or authorization-model mismatch.
- Fair/scoring and the Collective Participation Journey each get a clean, explicitly separate future home, preventing premature conflation of participation facts with mutable policy or presentational recommendation logic.

**Negative / costs:**

- A materially larger prerequisite than "just retarget Activity": every Initiative-scoped canonical module must eventually gain durable outbox emission (Phase 4), which is a substantial, multi-task body of work this ADR sequences but does not perform.
- Two ledgers (Member Action, and eventually Fair Accounting) must be maintained long-term instead of one, at the cost of additional operational surface area, in exchange for policy/fact separation.
- Legacy Activity remains permanently frozen rather than being either fully retired or fully repurposed, leaving a small amount of dead-but-preserved surface area in the codebase indefinitely (consistent with, and required by, the platform's institutional-memory and no-premature-deprecation principles).

---

## 28. Risks

1. **Sequencing risk:** if a future implementer skips Phase 0 and attempts to build a Member Action consumer before any producer emits durable events, there is nothing to consume — Phase 1 and Phase 2 are explicitly ordered to prevent this, but nothing in the code today enforces the ordering mechanically.
2. **Scope-creep risk:** the temptation to let Phase 4's "one producer at a time" become "all at once" would violate `ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0` Migration Principle 6 and reintroduce large-bang-change risk; the rollout table (§20) exists specifically to resist this.
3. **Privacy risk:** if a future projection is built without honoring §17's "visibility bounded above by source visibility" rule, a Member Action entry could leak information the source record itself no longer exposes (e.g., a subsequently-privatized comment). This ADR does not implement enforcement of this rule in code; it is a binding requirement for whichever future task builds the first public-facing projection.
4. **Naming-drift risk (low):** the unresolved `ActivityPublished`/`ActivityCorrected` (docs) vs. `ActivityRevised`/`ActivityClosed` (code) drift (Task 20 Addendum §11a point 4) remains unresolved; it does not block this ADR but should be closed before any future work relies on Activity's reserved event names meaning what the documentation currently implies.
5. **Coupling risk on the pilot:** `petition`'s known coupling to the legacy `collective-decision` module (ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0 §14) is not remediated by choosing it as the pilot; Phase 0's scope (§26) is deliberately limited to adding event emission to petition's signing mutation, not to remediating that coupling, to avoid conflating two independent bounded changes.

---

## 29. Future Review Conditions

This ADR SHALL be reviewed if:

- Phase 0/1/2 implementation reveals that `petition`'s signing mutation cannot cleanly emit a durable event inside its existing transaction (e.g. due to an undiscovered persistence-layer constraint), requiring a different pilot.
- A future privacy/legal-erasure requirement makes §9 Q4's "no deletion" rule untenable as stated, requiring an explicit erasure exception.
- Fair scoring work (Phase 6) discovers that the Member Action Ledger / Fair Accounting Ledger separation (§19) is insufficient for a concrete scoring design, requiring a schema not yet anticipated here.
- The Collective Participation Journey's actual UI design (Phase 5) requires a "current commitments" representation that cannot be satisfied by either a ledger-derived projection or a live source join, as anticipated in this ADR.

---

## 30. Related ADRs

- `architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md` (parent decision; §8/§12 elaborated by this ADR)

---

## 31. Recovery Closure — Acceptance Record (Appended, Does Not Reopen §1–§30)

**Produced by:** the Recovery Closure Task ("Finalize Recovery Phase and Establish the Authoritative Development Baseline"), following the same append-only correction convention already used by §4a above. Nothing in §1–§30 is altered, reopened, or reinterpreted by this section; it records that the §26 "Implementation Prerequisites" have now been satisfied and updates only the Status field (§2) accordingly.

**Evidentiary basis (§26 prerequisites, checked against what was actually built and verified):**

| §26 Prerequisite | Satisfied by | Evidence |
|---|---|---|
| 1. ADR review moves from `Proposed` toward `Accepted` | This section | — |
| 2. Companion blueprint stays consistent with any revision | `MEMBER_ACTION_LEDGER_IMPLEMENTATION_BLUEPRINT_v1.0.md` §16 (Task 33 update) | No revision was needed beyond the terminology correction already captured in §4a |
| 3. Phase 0 pilot (`petition`) gains durable outbox emission, narrowly scoped | Recovery Task 25 | `PetitionSigned` event, atomic with the signing transaction |

**Rollout status against §20's table, as of this closure:**

| Phase | Status | Evidence |
|---|---|---|
| Phase 0 (pilot producer) | **Complete** | Recovery Task 25 — `PetitionSigned` durable event |
| Phase 1 (ledger core) | **Complete** | Recovery Task 27 — Participant Action Ledger, Mongo store, unique indexes, idempotent consumer skeleton |
| Phase 2 (wire pilot end-to-end) | **Complete** | Recovery Task 27 — `PetitionSigned` → `petition_signed` Participant Action |
| Phase 4 (remaining producers, one per task) | **Partially complete — 1 of 9 listed modules** | Recovery Tasks 31–33 — `initiative-decision-vote` (`InitiativeDecisionVoteCast`/`Changed` → `initiative_decision_vote_cast`/`_changed`). The remaining eight modules listed in §20's Phase 4 row (`initiative-comments`, `initiative-collaborative-analysis`, `initiative-improvement-proposal`, `initiative-support`, `initiative-implementation-commitment`, `initiative-implementation-tracking`, `initiative-public-impact`, `public-civic-archive`) have **not** been onboarded as Participant Action producers |
| Phase 3 (private timeline projection) | **Not started** | No read-only projection exists |
| Phase 5 (Collective Participation Journey) | **Not started** | No implementation exists (matches Task 20's discovery finding, unchanged) |
| Phase 6 (Fair Accounting Ledger, §19) | **Not started** | No implementation exists |

**Terminology note:** all vocabulary in this acceptance record uses the corrected Participant-first terms per §4a (`participantId`, Participant Action) even where §1–§20's original text says "Member Action" — the correction in §4a already governs how this ADR's decision is to be read; this section does not restate that correction.

**Net effect of this closure:** the Member Action Ledger (implemented as the Participant Action Ledger) is no longer a proposed, unimplemented design — it is a live, tested, durable subsystem with two producers (Petition, Vote) and a passing full regression suite (see `architecture/recovery/RECOVERY_STATUS.md`). Marking this ADR `Accepted` reflects that reality; it does not authorize or imply that Phases 3, 4 (remaining), 5, or 6 are complete — those remain future work, tracked in `architecture/recovery/RECOVERY_STATUS.md`'s "Future Recovery Work" section.

---

*This ADR is a Recovery Task 21 work product, corrected for terminology by Recovery Task 26 (§4a), and accepted by the Recovery Closure Task (§31) once its own Implementation Prerequisites (§26) were satisfied by Recovery Tasks 25, 27, and subsequent Phase 4 work (Tasks 31–33). Its companion implementation blueprint is `architecture/recovery/MEMBER_ACTION_LEDGER_IMPLEMENTATION_BLUEPRINT_v1.0.md`.*
