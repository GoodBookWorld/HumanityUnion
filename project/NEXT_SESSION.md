# NEXT_SESSION

Humanity Union

Next Engineering Session

Version 1.6

---

# Purpose

Canonical live engineering handoff.

AI recovery entry: `architecture/recovery/chat-agent/README.md`

---

# Last Completed

**LIFECYCLE UX COMPLETION PACK 01 — Collective Decision Participant Voting**

Participant ballot wired into canonical Initiative lifecycle shell
(`InitiativeCollectiveDecisionPublicResult`), reusing existing
`POST .../vote` + `GET .../my-vote` (choices: support / do_not_support / abstain).
No parallel voting domain. Ledger consumers unchanged (backend path preserved).

Prior: Lifecycle UX Current-State Audit; Recovery Packs 01–05 CLOSED.

---

# Immediate Objective

**LIFECYCLE UX COMPLETION — PHASE 2 (recommended next)**

From audit §15:

1. Confirm/force Improvement Proposals stage persistence = mongodb on staging.
2. Prefer Initiative-shell deep links; begin Stage URL quarantine/redirects (Analysis first).
3. Fix orphan `/official-responses/public/{id}` hrefs → shell `#official-responses`.

Do **not** implement full Collective Participation Journey UX in Phase 2 unless scoped as its own Pack after Phase 2 review.

Authority: `architecture/recovery/LIFECYCLE_UX_CURRENT_STATE_AUDIT_v1.0.md`

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
