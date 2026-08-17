# INITIATIVE LIFECYCLE FINALIZATION — PHASE 05 REPORT v1.0

**Phase:** INITIATIVE LIFECYCLE FINALIZATION — PHASE 05  
**Nature:** Participant actions & Collective Participation Journey  
**Date:** 2026-08-16  
**Branch:** `staging`  
**Baseline checkpoint:** `be12c77` — ARCH: unify initiative lifecycle author workflow  

---

## 1. Participant Action Matrix (STANDARD)

| Stage | Participant purpose | Actions | Ledger | Deep link |
|-------|---------------------|---------|--------|-----------|
| Initiative | Discover / signal | support like/dislike | DOMAIN_DERIVED (no event yet) | `#initiative` |
| Initiative | — | view / bookmark | NOT_A_LEDGER_ACTION | — |
| Discussion | Contribute | comment | DOMAIN_DERIVED | `#discussion` |
| Discussion | Collaborate | ally interest/invite/accept | relationship (not ledger) | `#discussion` |
| Analysis | React to published | support reaction | MISSING_LEDGER_CONSUMER (justified deferred) | `#collaborative-analysis` |
| Proposal | React / Cap-02 submit | reaction / submit | MISSING / LEGACY_ONLY | `#improvement-proposals` |
| Revision | React to published | support reaction | MISSING_LEDGER_CONSUMER (deferred) | `#revision` |
| Petition | Endorse | sign | CANONICAL_LEDGER | `#petition` |
| Decision Session | — | NONE (read) | NOT_A_LEDGER_ACTION | `#decision-session` |
| Collective Decision | Decide | cast / change vote | CANONICAL_LEDGER | `#collective-decision` |
| Commitment | Respond if targeted | accept/decline | MISSING_LEDGER_CONSUMER (deferred) | `#implementation-commitments` |
| Tracking / Official / Impact / Archive | — | NONE (read) | NOT_A_LEDGER_ACTION | stage hashes |

Do not invent actions. Author-only stage work is not Participant civic action.

---

## 2. Existing ledger coverage

| Action | Event | Consumer | Status |
|--------|-------|----------|--------|
| `petition_signed` | `PetitionSigned` | `participant-action.petition-signed.v1` | CANONICAL_LEDGER |
| `initiative_decision_vote_cast` | `InitiativeDecisionVoteCast` | `…vote-cast.v1` | CANONICAL_LEDGER |
| `initiative_decision_vote_changed` | `InitiativeDecisionVoteChanged` | `…vote-changed.v1` | CANONICAL_LEDGER |

Idempotency: `participantActionId = participant-action:${sourceEventId}` + unique `sourceEventId`.

---

## 3. Missing ledger coverage found

Important gaps without durable catalogue events today:

- Discussion comment / comment reaction
- Initiative support like/dislike
- Analysis / proposal / revision Support widgets
- Allies lifecycle transitions
- Commitment accept/decline

**Phase 05 justification:** Journey `pastActions` derive from **domain stores** (`domain_derived`) for comments + support + signature fallback; ledger remains sole append-only civic ledger for petition/votes. No second ledger. Full event→consumer expansion deferred until catalogue events exist (do not invent Web-side ledger writes).

---

## 4. Action vocabulary (journey)

`support_initiative` · `discussion_comment` · `petition_signature` · `decision_vote` · `commitment_response`

Excludes: page views, navigation, preview, interest-match preference hits.

---

## 5. Domain event → ledger mapping

Unchanged for existing three. No new consumers added in Phase 05 (events absent for comments/support).

---

## 6. Collective Participation Journey contract

Type: `CollectiveParticipationJourney` (`packages/types`).

Fields: `initiativeId`, `participantId`, `lifecycleProfile`, `currentStage*`, `pastActions[]`, `availableActions[]`, `nextAction`, `activeAlly`, `viewerIsSteward`.

Service: `buildCollectiveParticipationJourney` — projection only; never mutates lifecycle.

---

## 7. pastActions derivation

1. Ledger (petition + votes), with cast+changed **collapsed** to one `decision_vote`.
2. Domain comments by `authorUserId`.
3. Domain support signal (like/dislike only).
4. Petition signature domain fallback if ledger empty/unavailable.

---

## 8. availableActions derivation

LifecycleProfile applicability + stage open/closed + eligibility + soft-fail `unavailable`.

---

## 9. nextAction resolver

Pure `resolveNextMeaningfulParticipationAction`: prefer current-stage eligible action; else forward along profile route; never NOT_APPLICABLE stages.

---

## 10. Eligibility behavior

`eligible` | `already_completed` | `requires_sign_in` | `stage_not_open` | `stage_not_applicable` | `not_eligible` | `unavailable`

---

## 11. Active Allies behavior

Relationship via `initiative_allies`. Exposed as `activeAlly` flag only — **not** fabricated pastAction history.

---

## 12. Signed-out behavior

Empty `pastActions`; opportunities with `requires_sign_in`; nextAction points to meaningful opportunity with sign-in reason.

---

## 13. Author behavior

`viewerIsSteward` preserved. UI note: Author Mode remains primary; journey is optional civic participation.

---

## 14. Canonical deep links

`/initiatives/public/{id}#{stage-hash}` via `buildInitiativeShellDeepLink`. Discussion → `#discussion`.

---

## 15. STANDARD result

Petition unsigned → Sign; signed → may advance to later eligible (e.g. vote); discussion/support still addressable.

---

## 16. PUBLIC_CHOICE result

Route Initiative → Discussion → Collective Decision → Archive. Resolver never selects Petition/Analysis/etc.

---

## 17. Workspace readiness

Same projection:

- `GET /api/v1/participants/me/initiatives/:id/participation-journey`
- `GET /api/v1/participants/me/participation-journeys`

Experience embeds `participationJourney` soft field. No second Workspace model.

---

## 18. Notification readiness

Interest-match / preferences coexist; preference match does **not** fabricate pastActions. Phase 06 fan-out not implemented.

---

## 19. Idempotency

Ledger retry identity unchanged. Journey collapses vote history. Soft-fail optional domains.

---

## 20–24. Quality gates

| Gate | Result |
|------|--------|
| Focused tests | PASS (`phase05-participation-journey.test.ts`) |
| Typecheck | PASS (`@hu/types`, `@hu/api`, `@hu/web`) |
| Lint (touched) | PASS |
| Builds | PASS |
| `git diff --check` | PASS |

---

## 25. Files created/modified (primary)

**Created:** journey types; journey module (service, resolver, deep-link, routes); YourParticipationPanel; Phase 05 tests; this report.

**Modified:** experience projection; sidebar; app mount; participant-action repository query; continuity docs.

---

## 26. Remaining risks

- Comments/support lack catalogue events → domain_derived until Phase later.
- Stage reaction widgets / commitments not yet in journey availableActions.
- Journey stage counts are a soft subset of Experience `buildStageRecords` (acceptable soft projection).
- Phase 06 notification recipient matrix still pending.

---

## 27–29. Git / confirmation

See live `git status --short`. Staged count: **0**.  
**Confirmed:** no commit / push / deploy / staging write / R2 / migration.

---

## Exit criteria

All Phase 05 exit criteria **PASS**. Phase 05 is **COMPLETE**.
