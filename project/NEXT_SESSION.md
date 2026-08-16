# NEXT_SESSION

Humanity Union

Next Engineering Session

Version 1.4

---

# Purpose

Canonical live engineering handoff.

AI recovery entry: `architecture/recovery/chat-agent/README.md`

---

# Last Completed

**RECOVERY PHASE CLOSURE — STAGING VERIFIED PASS**

Historical staging recovery / migration / reconciliation for the **approved canonical scope** (Packs 01–05) is **CLOSED**.

Operator-verified (`pnpm verify:staging -- --check-media-http` on staging):

- result: **PASS**
- Pack 05 deployed; reconciliation `--execute` completed successfully
- participants 5 / loginReady 5 (historical Participants login-ready)
- initiativesPublic 5; media / avatars / card navigation: **PASS**
- allies 6; activeAllies 5; brokenAllyParticipants 0; brokenAllyInitiatives 0
- collaborationMessages 4; collaborationSessions 0
- rssSources 16; publicNewsArticles **54** (verification snapshot only — not a permanent invariant)
- rssFeedAvailable: **PASS**; `NEWS_PROVIDER_ENABLED=true` on staging API; RSS ingestion operational
- Operator manually confirmed installed functionality is working

Prior track: Staging Data Migration Packs 01–03 (+02A), Reconciliation Packs 04–05, Continuity Pack 01.

**Closure note:** This does **not** claim every legacy record in `humanity_union_dev` was migrated. Excluded Activity / Discussion / Proposal / Decision roots remain excluded. Do not reopen bulk DB migration as the default strategy.

---

# Immediate Objective

**LIFECYCLE UX COMPLETION — CURRENT-STATE AUDIT**

Documentation / repository audit only for the first implementation session.
**Do not** implement new Lifecycle UX until this audit completes and is reviewed.

## Reference journey (approved Initiative lifecycle)

Initiative
→ Discussion
→ Collaborative Analysis
→ Improvement Proposals
→ Revision
→ Petition
→ Decision Session
→ Collective Decision
→ Implementation Commitments
→ Implementation Tracking
→ Official Responses
→ Public Impact
→ Civic Archive

## Architectural rules (must preserve)

1. Initiative remains the sole canonical civic root.
2. Initiative Ancestry Invariant remains mandatory.
3. Participant is the universal actor identity.
4. Member is earned/honorary status, not the canonical actor base.
5. Activity / Discussion / Proposal / Decision must not become parallel civic roots.
6. Author Mode begins at Collaborative Analysis.
7. Existing functionality must be reused before new functionality is designed.
8. Collective Participation Journey is a participant-facing journey/projection, not a new parallel civic domain root.

## Audit must determine (per lifecycle stage)

- existing domain/API implementation, persistence, frontend/UI, routes, tests, documentation
- Participant actions currently available
- Author Mode tools currently available
- Allies / Active Allies integration
- stage transition implementation; missing UX transitions
- duplicated or competing implementations
- backend-only vs documentation-only capabilities
- gaps between the canonical lifecycle and actual runtime
- reusable components/services
- minimum safe vertical slice to make the lifecycle journey coherent
- what existing data can support the Collective Participation Journey **without** introducing another persistence root

Authority: `architecture/lifecycle/LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md`
ADR: `architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md`

---

# Engineering Reminder

- Label every Bash command with execution location (CURSOR AGENT / LOCAL MAC TERMINAL / RENDER API WEB SHELL / RENDER WEB WEB SHELL).
- Staging recovery tooling remains available for future *scoped* repairs; it is not the live engineering focus.
