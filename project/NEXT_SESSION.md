# NEXT_SESSION

Humanity Union

Next Engineering Session

Version 1.3

---

# Purpose

Canonical live engineering handoff.

AI recovery entry: `architecture/recovery/chat-agent/README.md`

---

# Last Completed

**STAGING FEATURE RECONCILIATION PACK 05** — Allies/collaboration portable bundle + reconcile/verify extensions; public Initiative 50/50 hero; mini-card/world-card navigation compactness; `/media` empty-state + RSS re-ingest strategy (tooling/dry-run only).

Prior: Pack 04 reconciliation tooling; Continuity Pack 01.

---

# Immediate Objective

**Operator staging execute sequence** (RENDER API WEB SHELL):

1. Pack 04 auth + engagement (if not done):
   `ALLOW_STAGING_RECONCILIATION=true pnpm reconcile:staging-historical-data -- --execute`
2. Same command also applies Pack 05 ally/collaboration inserts when bundle present (idempotent).
3. Ensure `NEWS_PROVIDER_ENABLED=true` on staging API, then refresh news:
   `pnpm dev:refresh-news` (or wait for scheduler).
4. `pnpm verify:staging -- --check-media-http`
5. Confirm Web: Allies widgets, public Initiative layout, mini-card clicks, `/media` articles.

---

# Engineering Reminder

- Active Allies = derived (`status === "active"`) + Author projection — not a second membership model.
- RSS: re-ingest configured sources; do not bulk-import expired historical articles.
- Label every Bash command with execution location.
