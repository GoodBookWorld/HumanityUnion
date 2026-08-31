# PROJECT_DASHBOARD

Humanity Union

Engineering Command Center

Version 2.0

---

# Engineering Motto

Design for decades.

Implement in iterations.

Recover in minutes.

---

# AI Recovery Entry

New AI / engineering sessions:

1. **Primary handoff:** `project/NEXT_SESSION.md` ← start here
2. Recovery kit: `architecture/recovery/chat-agent/README.md`
3. Paste prompt: `architecture/recovery/chat-agent/NEW_CHAT_RECOVERY_PROMPT.md`
4. Durable state: `project/PROJECT_STATE.md`

---

# Current Development Status

Platform Version: **4.0**

Architecture Status: Stable (Initiative-root ADR accepted)

Engineering Status: **Production operational** + staging verification environment

Project Health: **Healthy** (Pack 02B staging PASS; Pack 02C Hotfix 02 local — staging re-smoke pending; Pack 02D next after re-smoke)

---

# Current Focus

**Production Completion Pack 02 — Multilingual Platform Architecture**

| Step | Status |
|------|--------|
| 02A Architecture Audit | COMPLETED |
| **02B Language Registry** | **COMPLETED** |
| **02C Locale Preference & Runtime** | **COMPLETED** locally; Hotfix 02 local; **staging re-smoke pending** |
| **02D UI i18n Foundation** | **NEXT** (after 02C staging re-smoke) |
| 02E–02J | Queued |

Live next task: **Pack 02D — UI i18n Foundation** — see `project/NEXT_SESSION.md`.

Last closed product Pack track: Production Completion **Pack 02C** (local acceptance).

---

# Completed Milestones (high level)

- Capability 01 — Authentication, Member Profile, Member Preferences
- Capability 02 — Initiative foundation + collaborative decision stack (and subsequent lifecycle stages in repo)
- Historical staging recovery Packs 01–05 — CLOSED
- Production identity / blog / initiative migration tracks — COMPLETED
- Production Completion Pack 01 / 01.1 — COMPLETED
- Production Completion Pack 02A — COMPLETED
- Production Completion Pack 02B — COMPLETED

---

# Architecture protections (pointers)

- `architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md`
- `architecture/DEVELOPMENT_BASELINE.md` (includes **Documentation Gate**)
- `architecture/lifecycle/LIFECYCLE_STAGE_INTELLIGENCE_MODEL_v1.0.md`
- `project/architecture/core/LANGUAGE_TRANSLATION_ARCHITECTURE_v1.0.md`

Do not present superseded Activity-root ADR-002 as current architecture.

---

# Open Issues (summary)

- Pack 02D UI i18n foundation (after Pack 02C staging re-smoke)
- Pack 02C staging re-smoke after Hotfix 02 promote (do not claim 02C staging PASS yet)
- Pack 02B staging acceptance PASS
- Production bootstrap Initiative deletion (separate production-safe procedure; staging cleanup refuses production)
- Mobile PWA regression diagnosis (not redesign)
- Favicon / crawler metadata read-only audit

---

# Repository

Live state must match git/operator-verified facts. Prefer `NEXT_SESSION.md` for the immediate objective.

Never commit `production-admin-source.json` or other secret/private manifests.

---

# Engineering Standards

- Blueprint / ADRs / Engineering Methodology
- Domain First; Stable Domains; Progressive Bootstrap
- **Documentation Gate** before Pack CLOSED
- Chat Agent Continuity (`.cursor/rules.md`, chat-agent README)

---

# Recovery

Entry: `architecture/recovery/chat-agent/README.md`
Protocol: `project/PROJECT_RECOVERY_PROTOCOL.md`
Historical staging recovery (Packs 01–05): **CLOSED** — see `PROJECT_STATE.md`.

---

# Next Session

Open: `project/NEXT_SESSION.md`

---

# Dashboard Rule

This document must always answer: **"Where is the project right now?"**

Update after Packs when capability/Pack status actually changed. Always keep `NEXT_SESSION.md` current before reporting COMPLETE.
