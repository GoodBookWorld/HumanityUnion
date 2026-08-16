# LIFECYCLE UX CURRENT-STATE AUDIT v1.0

**Pack / task:** LIFECYCLE UX COMPLETION — CURRENT-STATE AUDIT  
**Date:** 2026-08-16  
**Branch baseline:** `staging` @ recovery closure `6ac334e`  
**Nature:** Repository audit only — no implementation, no schema changes, no migration reopen  

**Authorities consulted (in Continuity Pack order):**  
`architecture/recovery/chat-agent/README.md` → `project/NEXT_SESSION.md` →  
`architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md` →  
`architecture/DEVELOPMENT_BASELINE.md` →  
`architecture/lifecycle/LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md` →  
`architecture/decisions/ADR-MEMBER-ACTION-LEDGER-v1.0.md` (Participant Action Ledger vocabulary)

---

## 1. Executive Summary

The approved Initiative lifecycle is **far more implemented than a greenfield UX effort would suggest**.

A shared **Lifecycle Stage Workspace** already exists on the canonical public Initiative experience (`/initiatives/public/[initiativeId]`). From **Collaborative Analysis through Civic Archive**, Author Mode (steward-only `author_workspace`), Generate / Edit / Draft / Preview / Publish loops, public results, stage navigation unlock rules, Active Allies collaboration channel gating, and per-stage e2e/unit coverage are largely present.

**Maturity estimate (product UX coherence, not type/route existence):**

| Lens | Estimate |
|------|----------|
| Author Mode vertical slices (Analysis → Archive) | **~85%** |
| Canonical stage registry coverage (12 stages) | **~90% domain/shell; ~70% participant actions in-shell** |
| End-to-end Participant journey coherence | **~55–65%** |
| Collective Participation Journey (“what I did / what’s next”) | **~15%** (backend ledger partial; **no UX**) |
| Legacy / duplicate pipeline cleanup | **Not done** (many live parallels remain) |

**Highest-value next work is integration and completion**, not redesign:

1. Wire Collective Decision **vote casting** into the lifecycle public result (API already exists).  
2. Make Improvement Proposals stage persistence durable by default in staging/production (today defaults to **memory**).  
3. Project Participant Action Ledger into a journey UX **without** a new civic root.  
4. Prefer Initiative-shell deep links; quarantine or redirect older Stage/Activity pages.  
5. Fix orphan `/official-responses/public/{id}` hrefs.

**Do not reopen staging recovery/migration** unless a concrete blocking defect is found. None was found that requires reopening Packs 01–05.

---

## 2. Canonical Architecture Confirmed

| Rule | Status in codebase |
|------|--------------------|
| Initiative = sole canonical civic root | Confirmed — ADR + public experience shell |
| Initiative Ancestry Invariant | Enforced in lifecycle publish / vote / petition paths via shared ancestry errors |
| Participant-first identity | Confirmed — `participantId` / stewardId; Member honorary |
| Author Mode begins at Collaborative Analysis | Confirmed — `authorModeApplies: false` only for `initiative`; `resolveInitiativeLifecyclePresentationMode` |
| Active Allies = derived (`status === "active"`) + author projection | Confirmed — Pack 05 model; author not in `activeAlliesCount` |
| Activity / Discussion / Proposal / Decision must not be parallel roots | **Normative** — but **legacy Activity modules remain mounted** (see §8) |
| Collective Participation Journey = projection, not new root | ADR ledger exists partially; **UX missing** |

### Registry note (product vs code)

Product journey lists **Discussion** between Initiative and Collaborative Analysis.  
Code registry `INITIATIVE_LIFECYCLE_STAGE_REGISTRY` (`packages/types/src/domain/initiative-lifecycle-stage.ts`) has **12 stages** and treats **Discussion as a Center tab** (`#discussion`), not a lifecycle stage hash.

This audit scores Discussion as an **IMPLEMENTED Initiative-rooted civic surface**, while noting the naming mismatch with the product journey list.

---

## 3. Lifecycle Stage Matrix

Legend — Classification: **IMPLEMENTED** = meaningful canonical vertical slice (domain + persistence path + API + frontend in Initiative shell). Types/routes alone are insufficient.

| Stage | Domain | Persistence | API | Frontend | Author Mode | Participant UX | Tests | Classification | Primary Gap | Gap type |
|-------|--------|-------------|-----|----------|-------------|----------------|-------|----------------|-------------|----------|
| Initiative | Strong | Mongo (+ file resolve) | Strong | Public + create + owner | N/A (by design) | Discover, open, support | Strong | **IMPLEMENTED** | Dual `lifecyclePhase` vs 12-stage nav (naming) | A |
| Discussion *(tab, not registry stage)* | Comments + allies + proposal candidates | Mongo (+ memory fallback) | Strong | `#discussion` tab | N/A as stage | Comment, react, Ally invite/accept | Strong | **IMPLEMENTED** *(surface)* | Not in 12-stage registry; legacy Activity Discussion API still mounted | E |
| Collaborative Analysis | Strong | Mongo / file default | Strong | Shell Author + Public | Full loop | Reactions; sources from Discussion | Unit + e2e | **IMPLEMENTED** | Parallel legacy `/collaborative-analysis` | E |
| Improvement Proposals | Strong | **Default memory** (`INITIATIVE_IMPROVEMENT_PROPOSALS_STAGE_PERSISTENCE`) | Strong | Shell Author + Public + reaction widget | Full loop | Proposal reactions | Unit + e2e | **PARTIAL** | Staging durability risk if env unset; dual proposal modules | B/E |
| Revision | Strong | Mongo / file | Strong | Shell Author + Public | Full loop | Revision reactions | Unit + e2e | **IMPLEMENTED** | Minor dual deep-link surfaces | A |
| Petition | Strong | Drafts + `petitions` / signatures | Lifecycle + petition domain | Shell + signature widget (+ standalone pages) | Full loop | Sign / withdraw | Unit + e2e | **IMPLEMENTED** | Dual standalone petition pages | E |
| Decision Session | Strong | Drafts + sessions | Lifecycle + domain | Shell Author + Public | Full loop | Ally recommendations (advisory) | Unit + e2e | **IMPLEMENTED** | Dual session stores / pages | E |
| Collective Decision | Strong | Decisions + votes | Publish + **POST vote** | Author + **read-only** PublicResult | Full Author loop | **No cast-vote UI** (GET my-vote only) | Unit + vote e2e | **PARTIAL** | Backend vote without lifecycle ballot UX | C |
| Implementation Commitments | Strong | Packages / bridge | Lifecycle publish + accept/decline | Shell + ProposalInbox | Full loop | Accept / decline proposals | Unit + e2e | **IMPLEMENTED** | Legacy Stage commitment pages | E |
| Implementation Tracking | Strong | Packages / bridge | Lifecycle | Shell + ProgressInbox | Full loop | Progress participation | Unit + e2e | **IMPLEMENTED** | Legacy tracking pages | E |
| Official Responses | Strong | Lifecycle packages + CAP legacy | Lifecycle + CAP | Shell PublicResult | Full loop | Public read | Unit + e2e | **IMPLEMENTED** | Orphan CAP `publicHref`; dual CAP model | E |
| Public Impact | Strong | Reports / bridge | Lifecycle + TASK-033 | Shell + standalone | Full loop | Public report | Unit + e2e | **IMPLEMENTED** | Dual impact models / routes | E |
| Civic Archive | Strong | Versions + TASK-037 | Lifecycle + archive | Shell + `/civic-archive` | Full loop | Browse / search | Unit + e2e | **IMPLEMENTED** | Dual archive models | E |

**Gap types:** A = complete enough; B = backend durability/config gap; C = frontend missing; D = domain-only; E = legacy needs canonical integration; F = completely missing.

---

## 4. Participant Journey Audit

Reference journey vs actual reachability on **canonical** shell `/initiatives/public/[initiativeId]`:

| Step | Can Participant do it today? | Evidence / break |
|------|------------------------------|------------------|
| Discover Initiative | **Yes** | `/initiatives`, country rails, mini-cards, search, `/media` |
| Open public Initiative | **Yes** | `/initiatives/public/[id]` |
| Comment / contribute | **Yes** | Center tab `#discussion` → `PublicDiscussionPanel` |
| Signal support | **Yes** | Public sidebar support statistics |
| Become / interact as Ally | **Yes** | Ready to Collaborate / Invite / Accept in Discussion; Active Allies widget |
| Participate in Discussion | **Yes** | Same tab |
| Participate in Collaborative Analysis | **Partial** | Can view published analysis + react; cannot author |
| Improvement Proposal interact | **Partial** | Reaction widget when published; not full proposal authorship |
| Petition | **Yes** (when published) | `InitiativePetitionSignatureWidget` in shell |
| Decision Session | **Partial** | Advisory recommendations; not a ballot |
| Collective Decision | **Broken transition** | **POST `/vote` exists**; lifecycle PublicResult is **read-only**; web client has **no cast** API helper beyond `getMyInitiativeDecisionVote` |
| Implementation Commitment | **Yes** (when proposed) | Accept/decline inbox in shell |
| Follow Implementation | **Yes** (when published) | Tracking public result / progress inbox |
| Official Responses | **Yes** (when published) | Shell public result; some CAP record links orphan |
| Public Impact | **Yes** (when published) | Shell + `/public-impact/[id]` |
| Civic Archive | **Yes** (when published) | Shell + `/civic-archive` |

### Broken / weak transitions (backend may exist)

1. **Collective Decision vote** — highest severity participant break inside an otherwise complete Author stage.  
2. **Stage unlock UX** — intentional locking (`isLifecycleStageSelectable`) can feel “dead” until Author publishes prior stage; not a bug, but journey friction.  
3. **Parallel Stage URLs** — `/collaborative-analysis/...`, `/collective-decisions/...`, `/implementation-commitments/...`, etc. compete with shell hashes.  
4. **Orphan** `/official-responses/public/{responseId}` — projected in `public-initiative-experience.service.ts` without matching `apps/web/src/app` route (shell `#official-responses` is the live path).  
5. **Related Civic Records tab** removed from UI while records may still be projected — “now-dead menu entry” comment in CenterPanel.  
6. **No “what’s next for me”** surface — see §7.

---

## 5. Author Mode Audit

**Rule confirmed:** Author Mode begins at Collaborative Analysis.

| Concept | Exists? | Evidence |
|---------|---------|----------|
| Author Mode detection | **Yes** | `resolveInitiativeLifecyclePresentationMode` — `apps/api/src/shared/initiative-lifecycle-stage/initiative-lifecycle-author-mode.ts` |
| Steward authorization | **Yes** | Compares `viewerParticipantId` to `Initiative.stewardId`; Allies never get `author_workspace` |
| Stage-aware author workspace | **Yes** | `InitiativeLifecycleStageWorkspace` + per-stage `*AuthorWorkspace` wired in `PublicInitiativeCenterPanel.tsx` |
| Working sidebar swap | **Yes** | `InitiativeLifecycleWorkingSidebar` replaces public sidebar for Author on Analysis+ |
| AI Assistant entry | **Yes** | Per-stage intelligence / assistant open patterns (Analysis strongest) |
| Sources / intelligence snapshot | **Yes** | Stage-specific Source / Intelligence panels |
| Draft status | **Yes** | `supportsDraft` stages + draft APIs |
| Unresolved questions | **Partial** | Present in Analysis intelligence model; not uniformly surfaced as a shared control across all stages |
| Generate / Edit / Preview / Publish | **Yes** | Per-stage editors (Analysis → Archive) |
| Stage transition controls | **Yes (publish unlock)** | No global “advance Initiative stage” machine; each stage publishes its own artifact and unlocks nav |

**Missing / weak for Author Mode completion (not implementation in this audit):**

- Shared `participationSlot` on shell unused by CenterPanel (participation embedded in public-result widgets).  
- Collective Decision Author can publish a decision Participants **cannot vote on in-shell**.  
- Improvement Proposals Author workflow can lose drafts if memory persistence is active.

---

## 6. Active Allies Integration Audit

**Canonical model (Pack 05):** `initiative_allies`; Active Allies = author projection + `status === "active"`; author excluded from `activeAlliesCount`.

| Surface | Integrated? | Notes |
|---------|-------------|-------|
| Discussion Ally invite / accept | **Yes** | `initiative-discussion-collaboration` |
| Active Allies widget (public sidebar) | **Yes** | `InitiativeActiveAlliesWidget` |
| Collaboration Channel + Sessions | **Yes** | Shown for Author/Ally when lifecycle ≥ Analysis (`PublicExperienceSidebarOrChannel`) |
| Group chat / Messages | **Yes** | Reuses Active Allies team API |
| Lifecycle notify / eligibility | **Yes** | Multiple `initiative-*-lifecycle` modules call `listActiveAlliesByInitiative` |
| Author Mode tools | **Correctly excluded** | Allies do not receive Author editing controls |
| Pack 05 messages/reads | **Connected to UX** | Channel UI reads canonical collaboration APIs; restored rows are not orphan persistence-only |

**Gap:** No need for a second team model. Main Ally UX gap is journey coherence (when Channel appears relative to stage), not missing Ally persistence.

---

## 7. Collective Participation Journey Audit

**Intent:** Participant understands prior actions, current stage, and next available actions — as a **projection**, not a new civic root.

| Layer | Status |
|-------|--------|
| ADR / blueprint | Accepted Participant Action Ledger direction (`ADR-MEMBER-ACTION-LEDGER-v1.0.md` + Task 26 vocabulary correction) |
| Runtime ledger module | **Partial** — `apps/api/src/modules/participant-action/` |
| Action types today | `petition_signed`, `initiative_decision_vote_cast`, `initiative_decision_vote_changed` only |
| Persistence | Mongo `participant_actions` (+ repository/indexes) |
| Event consumers | Registered (petition signed, decision votes) |
| packages/types export | **Not** a first-class public type export for UX |
| HTTP read API for “my actions” | **Missing** |
| Web UX (“what I did / what’s next”) | **Missing** — zero `apps/web` references |
| `/civic-activity` | Aggregates **owned** artifacts / reads — **not** the Participant Action Ledger |
| Comments, support, Ally actions | Live in domain collections; **not** yet mirrored into ledger vocabulary |

**Conclusion:** Reuse the existing ledger + domain events; expand vocabulary and add a read projection + UI. Do **not** invent an Activity root or parallel journey aggregate.

---

## 8. Legacy / Duplicate Pipeline Audit

Three stacks remain visible:

1. **Canonical Initiative lifecycle pipeline** — `initiative-*` + public experience shell  
2. **Older Stage pipeline** — standalone pages under `/collaborative-analysis`, `/collective-decisions`, `/implementation-commitments`, `/implementations`, etc.  
3. **Activity-root pipeline** — `activity` / `discussion` / `proposal` / `decision` modules still mounted in API; **no web clients found**

| Artifact | Classification |
|----------|----------------|
| `/initiatives/public/[id]` + lifecycle shell | **CANONICAL** |
| `initiative-collaborative-analysis` + Analysis→Archive lifecycle packs | **CANONICAL** |
| `initiative_allies` / collaboration channel / sessions | **CANONICAL** |
| `participant_actions` module | **CANONICAL (backend)** / **DEAD UX** |
| Petition signing domain used by lifecycle | **CANONICAL** (shared) |
| Older Stage CA / collective-decision / implementation pages | **LEGACY** (still live) |
| Activity `discussion` / `proposal` / `decision` APIs | **LEGACY** / **DEAD/UNREFERENCED by web** |
| `execution-pipeline` feature components | **DEAD/UNREFERENCED** (verify scripts cite; not primary app routes) |
| CAP Official Response + TASK-033/037 parallels | **COMPATIBILITY** / **LEGACY** dual models |
| Workspace-home transitional APIs | **COMPATIBILITY** |
| Discussion naming vs Analysis ancestry type `"discussion"` | **UNCLEAR — NEEDS DECISION** (documentation clarity only) |

**Do not delete in the first UX Pack.** Prefer redirects into shell hashes and stop promoting Stage URLs in navigation.

---

## 9. Frontend Navigation & Reachability Audit

**Canonical entry:** `/initiatives/public/[initiativeId]`

- Tabs: Overview | Discussion | Manage (owner)  
- Lifecycle nav: 12 registry stages with hash deep links  
- Unlock rule: published/unlocked stages + single next Not Started (`lifecycle-stage-navigation.ts`)

**Reachable but non-canonical:** many standalone Stage/domain pages (see §8).

**Unreachable / broken:**

- `/official-responses/public/{id}` href without page  
- Removed Related Civic Records tab  

**Redirect example (good pattern):** `/initiative-analyses/public/[id]` → shell `#collaborative-analysis`.

---

## 10. Persistence / API Gap Audit

| Gap | Severity | Detail |
|-----|----------|--------|
| Improvement Proposals stage default **memory** | **High** (ops) | `resolve-initiative-improvement-proposals-stage-persistence.ts` defaults to memory unless env forces mongodb |
| Collective Decision vote API without web cast | **High** (UX) | POST exists; UI missing |
| Participant Action Ledger read API | **Medium** | Write/consume only |
| Dual persistence bridges (file/mongo) across stages | **Medium** | Works but increases staging config risk |
| Activity APIs still mounted | **Low** (security/confusion) | No web callers found |

---

## 11. Test Coverage Audit

**Strong:** Per-stage unit folders under `apps/api/test/unit/initiative-*-lifecycle*` / collaborative-analysis / improvement-proposals-stage / version-revision-stage; shared `initiative-lifecycle-stage`; many `verify-initiative-lifecycle-*-e2e` scripts; web lifecycle nav tests.

**Weak / missing relative to journey:**

- No frontend test asserting Collective Decision **cast** in shell  
- No web tests for Participant Action Ledger journey UI (none exists)  
- Limited automated coverage that Stage URLs redirect to shell  

---

## 12. Critical Architectural Risks

1. **Participant journey false completeness** — Author can publish Collective Decision while Participants cannot vote in the primary shell.  
2. **Memory-default stage persistence** — Improvement Proposals can appear “working” in tests/dev and vanish in staging if env misconfigured.  
3. **Triple pipeline confusion** — Initiative / Stage / Activity stacks still coexist; new work must not attach to Stage/Activity.  
4. **Ledger ADR vs thin vocabulary** — Expanding journey UX without expanding ledger types will invent parallel “history” stores.  
5. **Do not reopen bulk migration** — no audit finding requires Pack 01–05 recovery reopen.

---

## 13. UX Gaps Ranked by Severity

| Rank | Gap | Severity |
|------|-----|----------|
| 1 | Collective Decision ballot missing in lifecycle PublicResult | **Critical** |
| 2 | No Participant “what I did / what’s next” journey UX on ledger + domain facts | **High** |
| 3 | Improvement Proposals memory-default durability | **High** |
| 4 | Parallel Stage pages still discoverable | **Medium** |
| 5 | Orphan official-responses public href | **Medium** |
| 6 | Incomplete ledger vocabulary (comments/support/Ally not recorded) | **Medium** |
| 7 | Discussion-as-product-stage vs registry-as-tab documentation mismatch | **Low** |
| 8 | Dead Related Civic Records tab / deferred placeholders | **Low** |

---

## 14. Reusable Existing Components

Prefer reuse over new frameworks:

- `InitiativeLifecycleStageWorkspace` + working sidebar  
- `PublicInitiativeCenterPanel` stage wiring  
- `PublicInitiativeLifecycleNav` + unlock helpers  
- Per-stage `*AuthorWorkspace` / `*DraftPreview` / `*PublicResult` / editors  
- `InitiativePetitionSignatureWidget`, proposal reaction widgets, commitment ProposalInbox, tracking ProgressInbox  
- `InitiativeActiveAlliesWidget`, Collaboration Channel / Sessions  
- `resolveInitiativeLifecyclePresentationMode`  
- `publishInitiativeLifecycleStage` publication fan-out  
- `participant-action` consumers + vote/petition services  
- `PublicDiscussionPanel` + discussion collaboration APIs  

---

## 15. Recommended Lifecycle UX Completion Sequence

### Phase 0 — Guardrails (docs / ops only if needed)

- Confirm staging env: Improvement Proposals persistence mode = mongodb.  
- Do not reopen recovery Packs.

### Phase 1 — Connect the broken Participant transition *(first implementation Pack)*

**Connect immediately:**

- Add Collective Decision **cast/update vote** UI inside lifecycle `InitiativeCollectiveDecisionPublicResult` (reuse `initiative-decision-vote` API).  
- Surface current vote via existing `getMyInitiativeDecisionVote`.  
- Ensure Participant Action Ledger consumers continue to record cast/changed events.

### Phase 2 — Durability + shell primacy

- Force/verify mongodb persistence for Improvement Proposals stage in staging/prod.  
- Redirect or soft-deprecate primary nav into Stage URLs toward Initiative shell hashes (Analysis first, then others).  
- Fix official-responses `publicHref` to shell `#official-responses` (or add route — prefer shell).

### Phase 3 — Collective Participation Journey projection

- Add read API: actions by participant (optionally filtered by initiative).  
- Expand ledger vocabulary carefully (comments/support/Ally) **from existing domain events**, not new roots.  
- Build a lightweight “My participation on this Initiative” panel on the public experience (projection only).

### Phase 4 — Canonicalization / defer

- Quarantine Activity-root APIs (no web callers) — decide freeze vs remove in a dedicated safety Pack.  
- Defer full CAP/TASK dual-model merges unless blocking.  
- Defer Civic Archive / Impact redesign — already have vertical slices.

### Explicitly deferred

- Redesigning Author Mode shell  
- New team/membership model  
- New Activity root  
- Bulk historical migration  
- Building every Stage page from scratch  

---

## Appendix A — Key file index

| Area | Path |
|------|------|
| Stage registry | `packages/types/src/domain/initiative-lifecycle-stage.ts` |
| Author Mode | `apps/api/src/shared/initiative-lifecycle-stage/initiative-lifecycle-author-mode.ts` |
| Public experience | `apps/web/src/features/public-initiative-experience/` |
| Stage shell | `apps/web/src/features/initiative-lifecycle-stage-workspace/` |
| Center wiring | `.../PublicInitiativeCenterPanel.tsx` |
| Allies | `apps/api/src/modules/initiative-discussion-collaboration/` |
| Participant actions | `apps/api/src/modules/participant-action/` |
| Vote API | `apps/api/src/modules/initiative-collective-decision/initiative-collective-decision-vote.routes.ts` |
| Proposals persistence | `apps/api/src/modules/initiative-improvement-proposals-stage/persistence/resolve-initiative-improvement-proposals-stage-persistence.ts` |

---

## Appendix B — Classification rollup

| Classification | Stages / surfaces |
|----------------|-------------------|
| IMPLEMENTED | Initiative; Discussion (tab); Collaborative Analysis; Revision; Petition; Decision Session; Implementation Commitments; Implementation Tracking; Official Responses; Public Impact; Civic Archive |
| PARTIAL | Improvement Proposals (durability); Collective Decision (vote UX) |
| SCAFFOLD | — (none primary) |
| MISSING | Collective Participation Journey UX; in-shell vote casting |
| LEGACY / NON-CANONICAL | Activity Discussion/Proposal/Decision APIs; older Stage pages; CAP/TASK dual paths |

**End of audit.**
