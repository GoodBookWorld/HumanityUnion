# Chat Agent Recovery Entry Point

Humanity Union — AI engineering architect recovery kit

**Pack:** CHAT AGENT CONTINUITY PACK 01
**Role:** Entry point only. Does not replace Blueprint, ADRs, or live command-center documents.

---

## A. Purpose

This folder is the **entry point** for a new ChatGPT engineering architect.

The **repository** is the source of truth for product identity, accepted architecture, live engineering state, and next work.

Chat history and AI memory are supplemental only. Do not reconstruct the platform from conversation alone.

Paste-ready bootstrap: [`NEW_CHAT_RECOVERY_PROMPT.md`](./NEW_CHAT_RECOVERY_PROMPT.md)

---

## B. Recovery sequence

Read in this order. Prefer existing authoritative files; do not invent parallel summaries.

| Step | Recover | Read |
|------|---------|------|
| 1 | Product identity | `blueprint/Book_01_Foundation/04_LIVINGi_PLATFORM_BLUEPRINT.md` (and sibling Book 01 foundation docs as needed) |
| 2 | Current project state | `project/PROJECT_DASHBOARD.md` → `project/PROJECT_STATE.md` |
| 3 | Exact current objective | `project/NEXT_SESSION.md` (**canonical live handoff**) |
| 4 | Recovered architecture baseline | `architecture/recovery/RECOVERY_STATUS.md` → `architecture/DEVELOPMENT_BASELINE.md` |
| 5 | Initiative-root rule | `architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md` (registry: `architecture/ARCHITECTURE_DECISION_RECORDS.md`) |
| 6 | Participant-first identity | `architecture/DEVELOPMENT_BASELINE.md` §1; `architecture/decisions/ADR-MEMBER-ACTION-LEDGER-v1.0.md` |
| 7 | Lifecycle / Author Mode | `architecture/lifecycle/LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md` |
| 8 | Current Pack / domain docs | Follow pointers in `project/NEXT_SESSION.md` (today: Lifecycle Finalization Phase 02 — Phase 01 audit at `architecture/recovery/INITIATIVE_LIFECYCLE_FINALIZATION_AUDIT_v1.0.md`; stage intelligence `architecture/lifecycle/LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md`) |
| 9 | Ops / staging / deploy constraints | `project/architecture/operations/STAGING_DEPLOYMENT_VERIFICATION_v1.0.md` → `project/architecture/operations/PRODUCTION_CONFIGURATION_OPERATIONS_v1.0.md` |
| 10 | Forward architecture plan (not live handoff) | `architecture/ARCHITECTURE_EVOLUTION_ROADMAP_v2.0.md` |

Then: `git status`, confirm branch (`staging` is the current engineering branch), and wait for owner approval before issuing a Cursor implementation task.

**Procedure wrapper:** `project/PROJECT_RECOVERY_PROTOCOL.md` (points here first).

---

## C. Authority hierarchy

### NORMATIVE (must not be casually reversed)

- Blueprint (`blueprint/…`)
- Accepted ADRs (`architecture/decisions/…`, indexed in `architecture/ARCHITECTURE_DECISION_RECORDS.md`)
- `architecture/DEVELOPMENT_BASELINE.md`
- Accepted lifecycle architecture (`architecture/lifecycle/LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md`)

### RECOVERED ARCHITECTURE (current architectural baseline after Recovery Tasks 01–33)

- `architecture/recovery/RECOVERY_STATUS.md`
- `architecture/ARCHITECTURE_EVOLUTION_ROADMAP_v2.0.md` (forward plan; supersedes next-steps framing of the old Initiative recovery roadmap)

### LIVE ENGINEERING STATE (where we are *now*)

- `project/PROJECT_DASHBOARD.md`
- `project/PROJECT_STATE.md`
- `project/NEXT_SESSION.md` ← **canonical next-task handoff**

### HISTORICAL (context only)

- `project/WORK_LOG.md`
- Superseded roadmaps (e.g. `architecture/recovery/INITIATIVE_ARCHITECTURE_RECOVERY_ROADMAP_v1.0.md` next-steps framing)
- Completed Pack reports and assessments under `architecture/recovery/` and `project/architecture/`

**Conflict rules**

1. A **stale live-state** document must **not** override a **normative ADR**.
2. A **superseded ADR** (e.g. ADR-002 Activity-as-root) must **not** override its **replacement** (`ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0`).
3. When live-state docs disagree with git/code, treat **repository implementation** as authoritative for what exists, then **synchronize documentation**.

---

## D. Critical architecture protections

Do not reverse these. Read the cited authorities; do not treat this list as a substitute ADR.

| Protection | Authority |
|------------|-----------|
| Initiative is the sole canonical civic root | `architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md` |
| Activity must not become a parallel civic root | same ADR; see also `architecture/recovery/ACTIVITY_RETARGETING_DISCOVERY_v1.0.md` |
| Civic artifacts require valid Initiative ancestry | ADR + `architecture/DEVELOPMENT_BASELINE.md` |
| Participant is the universal actor identity | `architecture/DEVELOPMENT_BASELINE.md`; ledger ADR |
| Member is earned/honorary status, not base identity | same |
| Accepted Initiative Lifecycle + Author Mode | `architecture/lifecycle/LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md` |

Staging-data constraints (migration Packs): preserve staging admin; keep historical Vlad Gmail separate from staging-admin Vlad HUWS; do not restore password hashes/sessions as auth truth; do not bulk-import obsolete Activity/Discussion/Proposal/Decision roots; do not fabricate Initiative ancestry. See `architecture/recovery/STAGING_DATA_MIGRATION_EXECUTION_PLAN_v1.0.md`.

---

## E. Bash execution matrix

The project owner is not assumed to know which shell to use. **Every** future instruction that includes Bash/operator commands **must** label the execution location explicitly.

| Location | Typical prompt | Used for |
|----------|----------------|----------|
| **1. CURSOR AGENT** | Cursor agent / IDE agent session | Code changes; repository inspection; tests requested as part of implementation; documentation changes |
| **2. LOCAL MAC TERMINAL** | `vlad@Vlads-MacBook-Air HumanityUnion %` | `git status` / `git add` / `git commit` / `git push`; local operator commands when explicitly requested |
| **3. RENDER API WEB SHELL** | `render@srv-…:~/project/src$` | **Only** when instructions say **RENDER API WEB SHELL**. Staging API runtime inspection; staging migration dry-runs; explicitly approved staging migration `--execute`; API-local curl checks |
| **4. RENDER WEB WEB SHELL** | Render Web service shell | **Only** when instructions say **RENDER WEB WEB SHELL**. Web-service inspection only. **Do not** run API database migration commands here |

**Rule:** Never assume the owner knows which shell is intended. Label every command block.

---

## F. Working relationship

| Role | Responsibility |
|------|----------------|
| **User** | Idea author and product authority |
| **ChatGPT** | Architecture and engineering planning; task editor; reviews Cursor reports before choosing the next Pack |
| **Cursor** | Repository implementation agent |

Prefer simple instructions for the user. Cursor implementation tasks may be technically detailed. Do not ask the user to manually edit source code when Cursor can perform the change safely.

---

## Current focus (pointer only)

See `project/NEXT_SESSION.md`.

**Historical staging recovery (Packs 01–05): CLOSED.**

**Lifecycle Finalization Phase 01 complete:**
`architecture/recovery/INITIATIVE_LIFECYCLE_FINALIZATION_AUDIT_v1.0.md`

**Next:** INITIATIVE LIFECYCLE FINALIZATION — PHASE 02 (state + persistence convergence).

Prior UX audit remains useful: `architecture/recovery/LIFECYCLE_UX_CURRENT_STATE_AUDIT_v1.0.md`

Update this section only when recovery paths, authority structure, environment topology, or major current focus change. Do **not** paste full Pack reports into this folder.

---

## Continuity maintenance (before any Pack reports COMPLETE)

1. Update `project/NEXT_SESSION.md`.
2. Update current-focus / last-completed in `project/PROJECT_STATE.md`.
3. Update `project/PROJECT_DASHBOARD.md` only when capability/Pack status actually changed.
4. Add a `project/WORK_LOG.md` entry when useful for historical traceability.
5. Update this README only when recovery paths, authority structure, environment topology, or major current focus changed.
6. Do **not** paste full Pack reports into `architecture/recovery/chat-agent/`.
