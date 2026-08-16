# NEXT_SESSION

Humanity Union

Next Engineering Session

Version 1.5

---

# Purpose

Canonical live engineering handoff.

AI recovery entry: `architecture/recovery/chat-agent/README.md`

---

# Last Completed

**LIFECYCLE UX COMPLETION — CURRENT-STATE AUDIT**

Primary audit: `architecture/recovery/LIFECYCLE_UX_CURRENT_STATE_AUDIT_v1.0.md`

Prior: RECOVERY PHASE CLOSURE — STAGING VERIFIED PASS (Packs 01–05 CLOSED).

Audit headline: Author Mode vertical slices Analysis→Archive are largely present (~85%). Largest gaps are Collective Decision **vote UI** (API exists), Participant Action Ledger **journey UX** (backend partial), Improvement Proposals **memory-default** persistence risk, and live legacy Stage/Activity parallels.

---

# Immediate Objective

**LIFECYCLE UX COMPLETION — PHASE 1: Collective Decision Vote in Initiative Shell**

Implementation Pack (first): connect the broken Participant transition.

Scope:

1. Add cast/update vote UI inside lifecycle `InitiativeCollectiveDecisionPublicResult`.
2. Reuse existing `POST /api/v1/initiative-collective-decisions/:decisionId/vote` and `getMyInitiativeDecisionVote`.
3. Keep Participant Action Ledger consumers recording vote cast/changed.
4. Do **not** redesign Author Mode, reopen recovery, or create parallel civic roots.

Authority / sequencing: audit §15 Phase 1.
Later phases (durability, journey projection, Stage URL quarantine) wait until Phase 1 is reviewed.

---

# Architectural Rules (unchanged)

1. Initiative = sole canonical civic root.
2. Initiative Ancestry Invariant mandatory.
3. Participant-first; Member honorary.
4. No Activity / Discussion / Proposal / Decision parallel roots.
5. Author Mode begins at Collaborative Analysis.
6. Reuse before invent.
7. Collective Participation Journey = projection, not a new root.
8. Recovery Packs 01–05 remain CLOSED unless a concrete blocking defect appears.

---

# Engineering Reminder

Label every Bash command with execution location (CURSOR AGENT / LOCAL MAC TERMINAL / RENDER API WEB SHELL / RENDER WEB WEB SHELL).
