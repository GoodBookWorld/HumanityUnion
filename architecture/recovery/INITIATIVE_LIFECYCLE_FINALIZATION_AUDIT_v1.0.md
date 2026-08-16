# INITIATIVE LIFECYCLE FINALIZATION AUDIT v1.0

**Phase:** INITIATIVE LIFECYCLE FINALIZATION — PHASE 01  
**Nature:** System architecture & runtime convergence audit (**no implementation**)  
**Date:** 2026-08-16  
**Branch:** `staging`  
**Prior:** Lifecycle UX Current-State Audit v1.0; Pack 01 Collective Decision voting; Recovery Packs 01–05 CLOSED  

**Authorities:**  
`architecture/recovery/chat-agent/README.md` → live state →  
`architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md` →  
`architecture/lifecycle/LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md` →  
`architecture/recovery/LIFECYCLE_UX_CURRENT_STATE_AUDIT_v1.0.md` → runtime code under `apps/api` / `apps/web`

---

## 1. Executive Summary

Individual lifecycle **capabilities exist**, but the Initiative lifecycle does **not** yet behave as one deterministic system on staging.

**Primary diagnosis:** convergence failure, not missing stages.

| Finding | Verdict |
|---------|---------|
| Stage Author tools (Analysis→Archive) | Largely present in Initiative shell |
| One current-stage authority | **No** — derived progress + legacy `status` + UI selection compete |
| Persistence | **Many mechanisms** (file / memory / mongodb / mongo-only / bridges) |
| Local vs staging | Local `.runtime` file/memory can “work”; staging `NODE_ENV=production` forces Mongo — optional Mongo reads without isolation → **500** |
| `/experience` | **Fragile** — one failed optional lookup can take down whole Initiative UX |
| Author Mode | Can disappear when experience/stage projection fails |
| Transitions | Publish unlocks nav; **does not** initialize next stage; outbox **post-commit / best-effort** |
| Notifications | Ally-only on stage publish; Author excluded; topic/interest match **not** wired to stage publish |
| Pack 01 vote UI | Narrow completion; does **not** fix system fragility |

**Immediate next phase (after this audit):**  
**PHASE 02 — Canonical lifecycle state + persistence convergence + experience resilience**  
(not Collective Participation Journey Pack 02).

---

## 2. Original Intended Lifecycle Architecture

Reconstructed from `LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md` + Part A workspace foundation + Pack B Collaborative Analysis reference:

### Intended automation model

| Concern | Intended | Status |
|---------|----------|--------|
| Stage registry (12 + Discussion as civic surface) | Config vocabulary + hashes | **IMPLEMENTED** (`initiative-lifecycle-stage.ts`) |
| Source snapshot from prior stages | Automatic collection, no AI | **IMPLEMENTED** per stage (varying maturity) |
| Deterministic / AI draft generation | Prepare draft only; **never auto-publish** | **IMPLEMENTED** pattern |
| Author Edit / Save Draft / Preview / Publish | Steward-only Author Mode from Analysis onward | **IMPLEMENTED** shell; outliers in labels/controls |
| Stage publication event | `InitiativeLifecycleStagePublished` via outbox | **IMPLEMENTED** |
| Ally notification + next-stage Reminder | One fan-out per publish | **IMPLEMENTED** (Ally-only) |
| Automatic stage skip | **Forbidden** | Preserved |
| Next-stage auto-initialization | Deterministic empty workspace after unlock | **NEVER COMPLETED** as auto-create; Author Generate starts next |
| Single durable persistence | Restart-safe Mongo in deployed envs | **PARTIALLY** — contract forces mongodb in production, but local defaults differ and some paths are mongo-only without soft-fail |
| Experience resilience | Missing optional artifact → empty stage, not shell death | **NEVER COMPLETED** |
| Topic-interest recipients on stage publish | Spec Part 12 = Allies only | Interest-match exists for **Initiative publish** only — **PLACEHOLDER** relative to broader delivery ambition |

### Product journey vs registry

Product lists Discussion between Initiative and Analysis.  
Code registry has **12 stages**; Discussion is a **Center tab**, not a registry stage. Treat as intentional civic surface, not missing registry entry.

---

## 3. Current Runtime Architecture

```text
Initiative (root)
  ├─ public experience projection  (/experience)     ← aggregates ALL stages
  ├─ per-stage projection          (/lifecycle-stage/:id)
  ├─ Discussion tab                (comments + allies)
  └─ per-stage domain modules
       draft store  →  publish artifact  →  publishInitiativeLifecycleStage (outbox)
            ↓
       Ally notifications (+ optional reminders)
```

**Shell:** `/initiatives/public/[initiativeId]` (+ owner `/initiatives/[initiativeId]`)  
**Author Mode:** `resolveInitiativeLifecyclePresentationMode` — steward + Analysis+ only  
**Current progress (UX):** `resolveCurrentStageIdFromPublicationMetadata` — first unpublished stage after furthest published artifact counts  

There is **no** persisted “currentStageId” field on Initiative.

---

## 4. Local vs Staging Divergence

### Why local can appear to work while staging fails

| Factor | Local typical | Staging (`NODE_ENV=production`) |
|--------|---------------|----------------------------------|
| Persistence | Mostly **file** under `apps/api/.runtime/*.json`; some **memory** | Durable keys forced to **mongodb** |
| Optional missing artifact | File/memory returns empty | Mongo-only reads **throw** if URI/mode/data path fails |
| Experience isolation | Soft success with empty stages common | Uncaught rejection → Express 500 |
| Legacy analysis API | In-memory sample may exist | Empty → 404 |
| Bootstrap / fixtures | Local bootstrap + `.runtime` history | Migrated Initiatives with incomplete stage artifacts |
| Petition applicability bug | Same code (Promise always truthy) | Exposes Petition nav even when no petition |

### Divergence table (selected)

| Subsystem | Local DEFAULT | Staging EXPECTED | Risk |
|-----------|---------------|------------------|------|
| Most domain + lifecycle drafts | file | mongodb | Data in `.runtime` not on staging |
| Improvement Proposals **stage** collection | **memory** | mongodb | Local work evaporates / diverges |
| Notifications / reminders | memory | mongodb | Local notify state not durable |
| Published **petition** | **mongodb-only** | mongodb | Local without Mongo → experience/petition **500** |
| **Allies** | mongodb-only | mongodb | Same |
| Decision **votes** | mongodb-only | mongodb | Vote path requires Mongo |
| Comments / support | mongo-if-configured else memory | mongodb | Dual behavior |

**Conclusion:** Staging is not “missing features”; it exercises the **production persistence contract**. Local file-mode hides Mongo-only and isolation bugs.

---

## 5. Current-State Authority Analysis

| Representation | Classification | Role |
|----------------|----------------|------|
| `INITIATIVE_LIFECYCLE_STAGE_REGISTRY` | **CANONICAL** vocabulary | Stage IDs, hashes, Author Mode flags |
| Experience `currentStageId` (from published artifact counts) | **DERIVED** progress | Public/Author nav “where we are” |
| Per-artifact `status` / lifecycleStatus | **DOMAIN-SPECIFIC** | Authoritative for that artifact |
| Frontend `activeStageId` (hash) | **DERIVED** UI selection | Not server truth |
| `Initiative.lifecyclePhase` (`draft|published|projected|archived`) | **CANONICAL** for **Initiative record** publication | **Not** 12-stage index |
| `Initiative.status` (`proposal|discussion|petition|…`) | **LEGACY / AMBIGUOUS** | Can stay `proposal` while later stages published |
| Capability02 `pipelineStatus.currentStageId` | **DUPLICATE / AMBIGUOUS** | Different stage list (omits petition) |
| Activity / Stage-root aggregates | **LEGACY** | Must not govern progression |

**Verdict today:** There is **no single persisted current-stage authority**. Progress is **derived**. That is acceptable **if** derivation is resilient and `Initiative.status` stops being treated as progress — today it still leaks (e.g. petition applicability).

---

## 6. Stage-by-Stage Runtime Matrix (compact)

Conceptual contract (audit model, **not** a new DB aggregate):

```text
INPUT (prior published evidence)
→ WORKING STATE (draft + source snapshot)
→ PUBLIC OUTPUT (published artifact)
→ TRANSITION (publish + event)
→ NEXT (nav unlock; Author generates next draft)
```

| Stage | Persistence pattern | API surface | Shell | Author loop | Transition | Primary runtime risk |
|-------|---------------------|-------------|-------|-------------|------------|----------------------|
| Initiative | file→mongo | initiatives | Overview | N/A Author Mode | Publish Initiative | Dual phase/status |
| Discussion | comments+allies | comments / collaboration | Tab | N/A | N/A | Allies Mongo-only on experience |
| Analysis | file→mongo | initiative-analyses | Yes | Full | Publish + event | Legacy `/initiatives/:id/analysis` 404 |
| Improvement Proposals | domain file + **stage memory default** | improvement-proposal-collections | Yes | Full | Publish + event | Memory default / dual modules |
| Revision | file→mongo | initiative-revisions | Yes | Start/Edit/Publish | Publish + event | Publish validators (communitySlug) |
| Petition | draft file→mongo + **petition Mongo-only** | initiative-petitions + petitions | Yes | Full | Publish + event | Experience/stage 500; applicability bug |
| Decision Session | domain+draft+bridge | lifecycle + decision-sessions | Yes | Full | Publish + event | Dual stores |
| Collective Decision | domain+draft; votes Mongo-only | lifecycle + vote | Yes + Pack 01 ballot | Full | Publish + event | Votes need Mongo |
| Commitments | domain+draft+package | lifecycle | Yes | Full | Publish + event | Dual Stage pages |
| Tracking | domain+draft+package | lifecycle | Yes | Full | Publish + event | Dual |
| Official Responses | domain+draft+package + CAP | lifecycle + CAP | Yes | Full | Publish + event | Orphan CAP hrefs |
| Public Impact | domain+draft+report | lifecycle | Yes | Full | Publish + event | Dual |
| Civic Archive | draft+version + TASK-037 | lifecycle + archive | Yes | Full | Publish + event | Dual |

---

## 7. Author Workflow Matrix

Expected: Source Snapshot → Generate → Edit → Save Draft → Preview → Publish → Transition → Next.

| Stage | Uniform? | Notes |
|-------|----------|-------|
| Analysis | Yes | Reference implementation |
| Improvement Proposals | Partial | Per-proposal edits; weak global Save Draft |
| Revision | Partial | “Start Revision Draft” not Generate; strict publish validators |
| Petition → Archive | Mostly yes | Shared shell + editors |
| Next-stage init | Manual Generate | Not auto-created on prior publish |
| Author Mode disappearance | **Yes risk** | Experience 500 / stage loadFailed / Allies team fetch forces non-author sidebar |

**Principle violated today:** Author controls can disappear because a **secondary optional projection dependency** fails (petition Mongo, allies Mongo), not because stewardship changed.

---

## 8. Participant / Ally / Author Action Matrix

| Stage / surface | Public visitor | Signed-in Participant | Active Ally | Author (steward) |
|-----------------|----------------|----------------------|-------------|------------------|
| Initiative overview | View | View + support/bookmark | Same + Ally tools | Manage / edit Initiative |
| Discussion | Read (as allowed) | Comment / react / Ally request | Collaborate | Invite / moderate via tools |
| Analysis | Published result + reactions | React | Channel + react | Author Mode full loop |
| Improvement Proposals | Published + reactions | React | Channel | Author Mode |
| Revision | Published + reactions | React | Channel | Author Mode |
| Petition | Published | Sign / withdraw | Channel | Author Mode |
| Decision Session | Published | Advisory as allowed | Recommendations / channel | Author Mode |
| Collective Decision | Results | **Vote** (Pack 01) | Vote if eligible + channel | Author Mode + vote if eligible |
| Commitments | Published | Accept/decline proposals | Same + channel | Author Mode |
| Tracking | Published | Progress participation | Same | Author Mode |
| Official / Impact / Archive | Published read | Read | Read + channel | Author Mode |
| Lifecycle notifications | — | Not on stage publish | **Yes** (stage published) | **Excluded** as actor |

---

## 9. Notification & Workspace Delivery Audit

### Existing

| Piece | Status |
|-------|--------|
| `publishInitiativeLifecycleStage` → outbox | Implemented |
| Ally fan-out + Reminder | Implemented |
| Workspace `/notifications` aggregation (UI) | Present |
| Interest match (`preferredActivityAreas`, topics, geography) | Implemented on **Initiative publish** only |
| Stage publish → topic-priority recipients | **Not wired** |
| Author notified of own publish | **No** (by design) |
| Participants-already-engaged (beyond Allies) | **Not wired** |

### Proposed trigger matrix (architecture — reuse existing models)

| EVENT | Recipients (reuse) | Workspace | CTA | Destination |
|-------|-------------------|-----------|-----|-------------|
| Stage published | Active Allies (existing) | Notification + Reminder | Review / continue | Shell `#stage` |
| Stage published | Topic/activity-area matches (`interestMatch…`) | Notification | Discover / review | Shell `#stage` |
| Petition opened / CD voting opened | Allies + eligible participants (future; use eligibility services) | Notification | Sign / Vote | Shell hash |
| Commitment proposed to participant | Target Participant | Notification | Accept/decline | Shell `#implementation-commitments` |
| Official response / Impact / Archive | Allies + interest matches | Notification | Review | Shell hash |

**Do not invent a second subscription root.** Extend interest-match + Allies + existing eligibility.

**Workspace readiness:** Can carry initiativeId / stage / relatedUrl today via lifecycle event payload; needs richer **action** / **recipientBasis** fields for Journey UX later — extend notification payload, don’t create Lifecycle Inbox.

---

## 10. Experience Projection Audit

`GET /api/v1/public/initiatives/:id/experience`  
→ `buildPublicInitiativeExperienceProjection` (**no try/catch** on route).

### Fragility

- Fans out **all** stage lookups in `Promise.all`.
- Petition + Allies (+ proposal candidates when comments exist) are **Mongo-only** and **throw** on infra failure.
- Optional missing **data** is usually empty; optional **infra throw** kills entire Initiative UX.
- Author Mode / stage nav / Discussion all depend on this payload loading.

### Desired resilient contract (Phase 03)

- Isolate stage fan-out failures → empty stage + warning, not HTTP 500.
- Never block Overview/Discussion/Author shell on petition/allies infra.
- Stage-specific `/lifecycle-stage/:id` may still 500 isolated, but shell remains.

### Bug: petition applicability

```ts
getPetitionByInitiativeId(...) !== null  // async → Promise always truthy
```

Petition stage treated applicable even when no petition exists → nav/UX mismatch.

---

## 11. Navigation Audit

| Surface | Class |
|---------|-------|
| `/initiatives/public/:id` + hashes | **CANONICAL** |
| `/initiatives/:id` owner shell | **CANONICAL** |
| `/initiative-analyses/public/:id` → redirect | **COMPATIBILITY** |
| `/collaborative-analysis`, `/petitions`, `/collective-decisions`, `/implementation-*`, … | **LEGACY** |
| Orphan `/official-responses/public/:id` | **REMOVE LATER** |
| Activity-root APIs | **LEGACY** (no web clients) |

**Final model:** one Initiative shell; Stage URLs quarantine/redirect.

---

## 12. Persistence Convergence Audit

**Count of mechanisms (order of magnitude):**  
file adapters · memory adapters · mongodb adapters · mongo-only repos · legacy file↔mongo bridges · engagement dual-mode · production durable-key override.

Roughly **6+ mechanism families**, **30+ env keys**, **dozens of collections / `.runtime` files**.

**Convergence target:**

1. Staging/production: mongodb for all durable lifecycle state (already mostly contracted).  
2. Eliminate silent memory defaults for Author stage collections in any deployed env.  
3. Soft-fail or cache optional mongo reads in experience.  
4. Stop treating local `.runtime` as proof of staging readiness.

---

## 13. Failure Atomicity / Idempotency Audit

| Concern | Reality |
|---------|---------|
| Domain publish vs outbox | **Post-commit**; optional `session` unused by callers |
| Publish then notify fail | Often **publish succeeds**, notify skipped (`try/catch` + warn) |
| Outbox retry | Deterministic eventId → **idempotent** enqueue |
| Next-stage creation | **None** — no partial next-stage artifact |
| Duplicate publish | Domain guards + event idempotency |
| Restart safety | Staging Mongo OK; local file/memory not staging-equivalent |
| Experience lag | Derived from artifact lists; can disagree with legacy `status` |

**Not restart-unsafe on staging Mongo for published artifacts**, but **not atomic** across publish+notify, and **not resilient** to optional-read failures.

---

## 14. Lifecycle Black Holes Register

| ID | Black hole | Stage | Severity | Cause | Current | Correct | Fix phase | Migration? | Test |
|----|------------|-------|----------|-------|---------|---------|-----------|------------|------|
| BH-01 | Experience 500 on optional Mongo throw | All (shell) | **BLOCKER** | Uncaught petition/allies/candidates | Whole Initiative dead | Soft-fail stages | 02–03 | No | Experience isolation e2e |
| BH-02 | Petition stage 500 without petition if Mongo fails | Petition | **BLOCKER** | Mongo-only adapter | Stage unusable | Empty result if no petition | 02–03 | No | Petition stage empty |
| BH-03 | Petition always “applicable” | Petition | **HIGH** | Async Promise truthy bug | Nav lies | Await / sync check | 02 | No | Unit |
| BH-04 | Legacy analysis 404 while lifecycle analysis exists | Analysis | **HIGH** | Wrong module/API | Author tools via wrong path fail | Use initiative-analyses only | 03 | No | Route contract |
| BH-05 | Revision publish 400 on empty communitySlug | Revision | **HIGH** | Validator vs migrated empty slug | Can’t publish | Align validators / data repair policy | 02/04 | Maybe repair metadata | Publish validation |
| BH-06 | Author Mode vanishes on Allies fetch fail | Analysis+ | **HIGH** | Sidebar demotes viewerRole | No working sidebar | Degrade Allies, keep Author | 03 | No | Sidebar resilience |
| BH-07 | Improvement Proposals stage memory default | Proposals | **HIGH** | Env default memory | Local illusion | Mongo in deployed envs | 02 | No | Persistence contract |
| BH-08 | Dual Stage URLs vs shell | Many | **MEDIUM** | Legacy pages | Conflicting UX | Redirect | 03 | No | Nav |
| BH-09 | Publish without notify | All | **MEDIUM** | Best-effort outbox | Allies miss event | Metric + retry; optional txn | 06 | No | Outbox |
| BH-10 | No topic-interest on stage publish | All | **MEDIUM** | Interest only on Initiative publish | Limited reach | Extend consumer | 06 | No | Fan-out |
| BH-11 | No next-stage draft auto-init | All | **LOW** | By design today | Author Generate | Keep Generate; document | — | No | — |
| BH-12 | Competing current-stage signals | All | **HIGH** | status vs derived | Inconsistent copy | One derived authority + stop status misuse | 02 | No | Projection |
| BH-13 | CAP official-response orphan href | Official | **MEDIUM** | Dual model | Dead link | Shell hash | 03 | No | Links |
| BH-14 | Vote requires Mongo | Collective Decision | **MEDIUM** | Mongo-only votes | Ballot fails if Mongo down | Expected on staging | — | No | — |

**Counts:** BLOCKER **2** · HIGH **5** · MEDIUM **5** · LOW **1** (selected register; not exhaustive of every dual-store nuance).

---

## 15. Forensic Case: `initiative-1785948978037`

**Title:** Development of the Humanity Union platform  

Observed staging: `lifecyclePhase: projected`, `status: proposal`, empty `communitySlug`, comments/allies present, revision v1, **no** petition artifact, lifecycle analysis separate from legacy analysis store.

| Endpoint | Status | Chain |
|----------|--------|-------|
| `GET …/experience` | **500** | Builder awaits `getPetitionByInitiativeId` + `attachCollaborationStateToComments` (allies/candidates). Mongo-only throws → uncaught → Express 500. Optional data absence alone would be empty; **infra throw** kills shell. |
| `GET …/lifecycle-stage/petition` | **500** | `adaptPetitionStage` → same Mongo-only petition read. |
| `GET …/initiatives/:id/analysis` | **404** | **Legacy** in-memory `collaborative-analysis` store; not lifecycle `initiative-analyses`. Expected for this Initiative. |
| Revision draft/publish | **400** on publish | `validateInitiativeRevisionDraftForPublication` requires non-empty `communitySlug` + `revisionSummary`; migrated empty slug + empty summary. |

### Read-only diagnostics (RENDER API WEB SHELL) — do not write

```bash
# RENDER API WEB SHELL
# Confirm Mongo + collections only (read-only). Do not paste secrets.
node -e '/* inspect initiative + petition by initiativeId + allies count via existing stores if bootstrapped */'
# Prefer: existing admin/debug only if already available.
# Or: mongosh read-only queries against humanity_union_staging for
#   initiatives { initiativeId: "initiative-1785948978037" }
#   petitions { initiativeId: "..." }
#   initiative_allies { initiativeId: "..." }
#   initiative_analyses { initiativeId: "..." }
#   initiative_version_revisions / drafts
```

Do **not** mutate. Use results to confirm BH-01/02/05 hypotheses before Phase 02.

---

## 16. Final Target Architecture

```text
ONE INITIATIVE
ONE LIFECYCLE (registry + Discussion surface)
ONE CURRENT-STAGE AUTHORITY = derived from published lifecycle artifacts
  (stop using Initiative.status as progress)
ONE STAGE REGISTRY (existing)
ONE AUTHOR WORKFLOW (shared shell; Generate→Edit→Save→Preview→Publish)
ONE PUBLIC/PARTICIPANT SHELL (/initiatives/public/:id)
ONE TRANSITION CONTRACT (publish artifact → unlock next → Author Generate)
ONE NOTIFICATION PIPELINE (extend InitiativeLifecycleStagePublished fan-out)
```

**Reuse first:** experience service, stage adapter, Author workspace, outbox publish, Allies, interest-match, Pack 01 vote path.  
**Canonicalize second:** persistence modes, soft-fail experience, nav redirects.  
**Replace only:** dead Stage/Activity governance of progression (not wholesale rewrite).

---

## 17. Proposed Lifecycle Invariants

1. Every lifecycle artifact belongs to exactly one Initiative (ancestry).  
2. Canonical **progress** = derived from published lifecycle artifacts (not `Initiative.status`).  
3. A stage cannot publish without its documented prerequisites.  
4. Published outputs are versioned per existing stage rules; AI never auto-publishes.  
5. Next-stage **nav unlock** is deterministic after publish; next **draft** starts via Author Generate (until a future explicit init Pack).  
6. Successful publish retry is idempotent (domain + eventId).  
7. Deployed lifecycle state survives restart (Mongo).  
8. Public projection cannot invent progress contradicting published artifacts.  
9. Failure of optional stage/infra **must not** destroy Initiative shell.  
10. Author permissions = Initiative stewardship only.  
11. Active Ally ≠ Author.  
12. Participant actions use Participant identity.  
13. Lifecycle progression emits `InitiativeLifecycleStagePublished` (or successor).  
14. Relevant events produce Workspace delivery per recipient rules (Allies now; interest-match extended later).  
15. Activity / legacy Stage aggregates do not govern Initiative progression.

*(ADR only if Phase 02 requires binding a new “current-stage authority” decision beyond existing docs.)*

---

## 18. Verification Harness Design (`pnpm verify:lifecycle`)

**Not implemented in Phase 01.**

### Modes

- Local synthetic Initiative (create/cleanup; never touch historical IDs by default)  
- `--target=humanity_union_staging` read+controlled synthetic write under allow flag  

### Checks (design)

1. Initiative root + ancestry  
2. Experience 200 with soft-empty stages  
3. Each `/lifecycle-stage/:id` for unlocked stages  
4. Author Mode presentation for steward  
5. Source → draft → save → preview → publish per stage (synthetic)  
6. Transition unlock next  
7. Petition / vote / commitment participant actions  
8. Outbox event + Ally notification presence  
9. Persistence mode = mongodb when production  
10. No competing Activity-root progression  

### Safety

Synthetic Initiative ID prefix `initiative-lifecycle-verify-*`; ban mutation of approved historical five unless explicit override.

---

## 19. Finalization Implementation Plan

### Phase 01 — Architecture/runtime audit — **THIS DOCUMENT**  
Exit: approved understanding; NEXT_SESSION points to Phase 02.

### Phase 02 — Canonical lifecycle state + persistence convergence  
**Objective:** One progress authority story; Mongo durability; stop local/staging illusion.  
**Reuse:** `resolveCurrentStageIdFromPublicationMetadata`, production persistence contract, petition/allies repos.  
**Close:** BH-03, BH-07, BH-12; start BH-05 policy; groundwork BH-01.  
**Risk:** Low–medium (env + small bugfix; optional metadata repair).  
**Exit:** Staging persistence contract verified; status not used as progress; petition applicability fixed.

### Phase 03 — Experience shell resilience + navigation convergence  
**Objective:** Soft-fail experience; Author Mode survives optional failures; Stage URL quarantine.  
**Reuse:** experience service, adapter, redirects pattern from analysis.  
**Close:** BH-01, BH-02, BH-04, BH-06, BH-08, BH-13.  
**Exit:** Historical Initiative experience loads; petition stage empty≠500; Author tools visible for steward.

### Phase 04 — Uniform Author workflow convergence  
**Objective:** Same Generate/Save/Preview/Publish semantics; align Revision validators with migrated data policy.  
**Close:** BH-05 remainder; Proposals Save Draft clarity.  
**Exit:** Author can complete Revision→Petition on staging for synthetic + forensic Initiative.

### Phase 05 — Participant actions + stage interaction convergence  
**Objective:** Ensure in-shell actions (vote Pack 01, petition, commitments) work under staging Mongo.  
**Exit:** Participant matrix actions work on synthetic Initiative.

### Phase 06 — Lifecycle notifications + Workspace delivery  
**Objective:** Extend fan-out (interest-match / engaged participants) without new inbox.  
**Close:** BH-09, BH-10.  
**Exit:** Stage publish notifies Allies + configured interest matches; Workspace deep links work.

### Phase 07 — End-to-end verification harness  
**Objective:** Implement `pnpm verify:lifecycle`.  
**Exit:** Green on synthetic local + staging allowlisted run.

### Phase 08 — Staging lifecycle certification  
**Objective:** Operator-certified full path on staging without corrupting historical Initiatives.  
**Exit:** Certification checklist signed; Journey UX may begin afterward.

---

## 20. Recommended Immediate Next Phase

**PHASE 02 — Canonical lifecycle state + persistence convergence**

Then Phase 03 experience resilience (may be combined with 02 if scoped tightly — prefer separate Packs if size grows).

**Do not** start Collective Participation Journey Pack next.  
**Do not** individually patch Petition/Analysis/Revision in isolation without Phase 02/03 contracts.

---

## Appendix A — Key paths

| Concern | Path |
|---------|------|
| Experience | `apps/api/src/modules/initiatives/public-initiative-experience.service.ts` |
| Experience route | `…/public-initiative-experience.routes.ts` |
| Stage projection | `…/initiative-lifecycle-stage-projection.service.ts` |
| Adapter | `…/initiative-lifecycle-stage-adapter.ts` |
| Author Mode | `apps/api/src/shared/initiative-lifecycle-stage/initiative-lifecycle-author-mode.ts` |
| Publish/notify | `…/initiative-lifecycle-stage-publication.service.ts` |
| Persistence contract | `apps/api/src/config/production-persistence-contract.ts` |
| Interest match | `apps/api/src/modules/notifications/initiative-interest-match.service.ts` |
| Intelligence model | `architecture/lifecycle/LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md` |

---

**End of Phase 01 audit. No application runtime changes in this Pack.**
