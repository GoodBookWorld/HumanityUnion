# Chat Agent Recovery Entry Point

Humanity Union — AI engineering architect recovery kit

**Pack:** CHAT AGENT CONTINUITY PACK 01 (+ Documentation Recovery 2026-08-30)
**Role:** Entry point only. Does not replace Blueprint, ADRs, or live command-center documents.

---

## A. Purpose

This folder is the **entry point kit** for a new ChatGPT / AI engineering architect.

**Primary live handoff (authoritative next task):** `project/NEXT_SESSION.md`

The **repository** is the source of truth for product identity, accepted architecture, live engineering state, and next work.

Chat history and AI memory are supplemental only. Do not reconstruct the platform from conversation alone.

Paste-ready bootstrap: [`NEW_CHAT_RECOVERY_PROMPT.md`](./NEW_CHAT_RECOVERY_PROMPT.md)

---

## B. Recovery sequence

Read in this order. Prefer existing authoritative files; do not invent parallel summaries.

| Step | Recover | Read |
|------|---------|------|
| 1 | **Exact current objective** | `project/NEXT_SESSION.md` (**canonical live handoff** — includes START HERE) |
| 2 | Concise status | `project/PROJECT_DASHBOARD.md` |
| 3 | Durable detailed state | `project/PROJECT_STATE.md` |
| 4 | Product identity | `blueprint/Book_01_Foundation/04_LIVINGi_PLATFORM_BLUEPRINT.md` (and sibling Book 01 docs as needed) |
| 5 | Recovered architecture baseline | `architecture/recovery/RECOVERY_STATUS.md` → `architecture/DEVELOPMENT_BASELINE.md` |
| 6 | Initiative-root rule | `architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md` (registry: `architecture/ARCHITECTURE_DECISION_RECORDS.md`) |
| 7 | Participant-first identity | `architecture/DEVELOPMENT_BASELINE.md` §1; `architecture/decisions/ADR-MEMBER-ACTION-LEDGER-v1.0.md` |
| 8 | Lifecycle / Author Mode | `architecture/lifecycle/LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md` |
| 9 | Current Pack / domain docs | Follow pointers in `project/NEXT_SESSION.md` (today: **Pack 02B Language Registry**; Pack 02A summary `architecture/recovery/PRODUCTION_COMPLETION_PACK_02A_MULTILINGUAL_AUDIT_v1.0.md`; language vertical slice `project/architecture/core/LANGUAGE_TRANSLATION_ARCHITECTURE_v1.0.md`) |
| 10 | Ops / staging / production config (non-secret) | `docs/operations/production-configuration-checklist-pack01.md`; `project/architecture/operations/STAGING_DEPLOYMENT_VERIFICATION_v1.0.md` |
| 11 | Forward architecture plan (not live handoff) | `architecture/ARCHITECTURE_EVOLUTION_ROADMAP_v2.0.md` |

Then: `git status`, confirm branch, and wait for owner approval before issuing a Cursor implementation task.

**Procedure wrapper:** `project/PROJECT_RECOVERY_PROTOCOL.md` (points here and to NEXT_SESSION).

---

## C. Authority hierarchy

### NORMATIVE (must not be casually reversed)

- Blueprint (`blueprint/…`)
- Accepted ADRs (`architecture/decisions/…`, indexed in `architecture/ARCHITECTURE_DECISION_RECORDS.md`)
- `architecture/DEVELOPMENT_BASELINE.md`
- Accepted lifecycle architecture (`architecture/lifecycle/LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md`)

### RECOVERED ARCHITECTURE (current architectural baseline after Recovery Tasks 01–33)

- `architecture/recovery/RECOVERY_STATUS.md`
- `architecture/ARCHITECTURE_EVOLUTION_ROADMAP_v2.0.md` (forward plan)

### LIVE ENGINEERING STATE (where we are *now*)

- `project/NEXT_SESSION.md` ← **canonical next-task handoff / primary onboarding**
- `project/PROJECT_STATE.md` ← durable detailed state
- `project/PROJECT_DASHBOARD.md` ← concise progress view

### HISTORICAL (context only)

- `project/WORK_LOG.md`
- Superseded roadmaps and completed Pack reports under `architecture/recovery/` and `project/architecture/`

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
| Activity must not become a parallel civic root | same ADR |
| Civic artifacts require valid Initiative ancestry | ADR + `architecture/DEVELOPMENT_BASELINE.md` |
| Participant is the universal actor identity | `architecture/DEVELOPMENT_BASELINE.md`; ledger ADR |
| Member is earned/honorary status, not base identity | same |
| Accepted Initiative Lifecycle + Author Mode | `architecture/lifecycle/LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md` |
| Translations never overwrite canonical civic source | Language Architecture + Pack 02A summary |
| Staging cleanup tools must not be weakened for production | Pack 01.1 / NEXT_SESSION open item O1 |

Staging-data constraints (migration Packs): preserve staging admin; keep historical Vlad Gmail separate from staging-admin Vlad HUWS; do not restore password hashes/sessions as auth truth; do not bulk-import obsolete Activity/Discussion/Proposal/Decision roots; do not fabricate Initiative ancestry.

---

## E. Bash execution matrix

The project owner is not assumed to know which shell to use. **Every** future instruction that includes Bash/operator commands **must** label the execution location explicitly.

| Location | Typical prompt | Used for |
|----------|----------------|----------|
| **1. CURSOR AGENT** | Cursor agent / IDE agent session | Code changes; repository inspection; tests requested as part of implementation; documentation changes |
| **2. LOCAL MAC TERMINAL** | local shell | `git status` / `git add` / `git commit` / `git push`; local operator commands when explicitly requested |
| **3. RENDER API WEB SHELL** | Render API service shell | **Only** when instructions say **RENDER API WEB SHELL**. Staging/production API runtime inspection; approved operator scripts |
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

**Production Completion Pack 02A:** COMPLETED.
**Next:** Pack **02B** — Language Registry API / canonical registry foundation.

**Historical staging recovery (Packs 01–05): CLOSED.**
**Production Completion Pack 01 / 01.1: COMPLETED** (staging diagnostics healthy after bootstrap cleanup).

Update this section only when recovery paths, authority structure, environment topology, or major current focus change. Do **not** paste full Pack reports into this folder.

---

## Continuity maintenance / Documentation Gate (before any Pack reports COMPLETE)

1. Update `project/NEXT_SESSION.md`.
2. Update current-focus / last-completed in `project/PROJECT_STATE.md`.
3. Update `project/PROJECT_DASHBOARD.md` when capability/Pack status actually changed.
4. Add a `project/WORK_LOG.md` entry when useful for historical traceability.
5. Update ADR / change register when architectural decisions changed.
6. Update this README only when recovery paths, authority structure, environment topology, or major current focus changed.
7. Do **not** paste full Pack reports into `architecture/recovery/chat-agent/`.
8. Completion reports must state which canonical documents were updated or why no update was required.

A Pack/Epic is **not CLOSED** until this Documentation Gate is evaluated.
