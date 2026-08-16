# NEXT_SESSION

Humanity Union

Next Engineering Session

Version 1.2

---

# Purpose

This document is the **canonical live engineering handoff**.

AI recovery entry: `architecture/recovery/chat-agent/README.md`

---

# Current Platform State

Branch:

`staging`

Architecture:

Initiative = sole canonical civic root. Participant-first identity. Do not revive Activity as a parallel civic root.

Staging:

Historical Participants (4) + Initiatives (5) present; staging admin protected; media on R2.

---

# Last Completed

**STAGING HISTORICAL DATA RECONCILIATION PACK 04** — tooling + dry-run + Web media rendering hardening (documentation + code).

Real staging reconciliation `--execute` was **not** run in the Cursor development task.

Prior: CHAT AGENT CONTINUITY PACK 01; Admin Packs 02–05; Staging Data Migration Packs 01–03 (+02A).

---

# Immediate Objective

**Operator execute Pack 04 on staging** (when ready):

1. **RENDER API WEB SHELL:** `ALLOW_STAGING_RECONCILIATION=true pnpm reconcile:staging-historical-data -- --execute`
2. **RENDER API WEB SHELL:** `pnpm verify:staging -- --check-media-http`
3. Confirm historical login with original passwords (hashes restored from source DB; never printed).
4. Confirm Initiative images + avatars in Web UI after API process has current hydrate (restart API if needed).

Do not bulk-import legacy Activity/Discussion/Proposal/Decision roots.

---

# Operator-observed / remaining product notes

- Pack 04 dry-run plans auth restore + engagement inserts; login readiness becomes true only after `--execute`.
- Platform **proposals** statistic remains 0 while Improvement Proposals stay `draft` (canonical counting rule).
- Authors / countries / regions zeros are often correct under canonical derivation rules (see assessment).

---

# Before Starting next Pack

1. Read `architecture/recovery/chat-agent/README.md`.
2. Label every Bash command with execution location.
3. Prefer `pnpm verify:staging` after any staging data operation.

---

# Engineering Reminder

One Pack = one engineering cycle.

Repository is source of truth. Chat history is supplemental.
