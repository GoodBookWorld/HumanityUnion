# NEXT_SESSION

Humanity Union — Canonical Live Engineering Handoff

Version 2.0

---

## START HERE — NEW ENGINEERING AGENT

1. **This file** (`project/NEXT_SESSION.md`) is the **authoritative live handoff** for what to do next.
2. It describes the platform as of **Production Completion Pack 02A** (architecture audit complete), with **Pack 02B** as the next implementation task. Primary engineering branch for ongoing work: follow `git branch --show-current` (often `main` or `staging`); **repository evidence wins** over stale narrative docs.
3. **Do not reinterpret:** Initiative = sole canonical civic root; Participant-first identity; English = translation fallback; translations never overwrite canonical civic source; staging cleanup tools must not be weakened for production.
4. **Current Pack track:** Production Completion **Pack 02 — Multilingual Platform Architecture**.
5. **Exact next task:** **Pack 02B — Language Registry API / canonical registry foundation** (Mongo-backed, Admin-managed; seed verification locales `en`, `uk`, `zh-Hant`, `ar`).
6. **Deeper architecture:** ADR registry `architecture/ARCHITECTURE_DECISION_RECORDS.md`; Initiative-root ADR; Development Baseline; Language Architecture `project/architecture/core/LANGUAGE_TRANSLATION_ARCHITECTURE_v1.0.md`; Pack 02A summary `architecture/recovery/PRODUCTION_COMPLETION_PACK_02A_MULTILINGUAL_AUDIT_v1.0.md`; AI recovery kit `architecture/recovery/chat-agent/README.md`.
7. When docs conflict with code/git/operator-verified facts, **repository evidence wins** — then synchronize documentation.
8. **Never commit** secrets, credentials, connection strings, or private migration manifests (including `production-admin-source.json`).

AI recovery entry (read after this file’s “Immediate Objective”): `architecture/recovery/chat-agent/README.md`

---

## Purpose

Canonical live engineering handoff for Humanity Union.

Durable detailed state: `project/PROJECT_STATE.md`
Concise status: `project/PROJECT_DASHBOARD.md`
Chronology: `project/WORK_LOG.md`

---

## Last Completed

### Production Completion Pack 02A — Multilingual Architecture Audit (COMPLETED)

- READ-ONLY architecture audit of language/translation/search/SEO surfaces.
- Approved direction: Admin-managed Language Registry → UI i18n → cached civic translations → multilingual search → glossary → multilingual SEO.
- Summary: `architecture/recovery/PRODUCTION_COMPLETION_PACK_02A_MULTILINGUAL_AUDIT_v1.0.md`
- Normative language doc (pre-existing vertical slice): `project/architecture/core/LANGUAGE_TRANSLATION_ARCHITECTURE_v1.0.md`

### Production Completion Pack 01 / 01.1 (COMPLETED)

- Admin authenticated diagnostics health; Initiative integrity + Outbox + services healthy on staging after cleanup.
- Lifecycle reconciliation diagnostic: **Not available** (neutral / CLI-only — not a health failure).
- Support hero illustration display sizing; ACTUC mobile identity row; country hero + media max 6; Account five tiles; Editor `PUBLISHING_EDIT` dual-auth bridge; production config checklist.
- Staging bootstrap Initiative `initiative-bootstrap-001` cleaned; seed gate skips re-seed when `PLATFORM_MODE=staging|production`.
- Staging historical failed Outbox recovery operator path completed.
- Production checklist: `docs/operations/production-configuration-checklist-pack01.md`

### Prior production / staging foundation (COMPLETED — verified in repo)

- Platform **4.0** Initiative-centric architecture; production platform operational (auth, MongoDB, R2, email, Stripe — secrets not documented here).
- Production / staging separation; public registration enabled in **production** via env (`PLATFORM_MODE=production`, `ALLOW_PUBLIC_REGISTRATION=true`, Web `NEXT_PUBLIC_PLATFORM_MODE=production`).
- Production initiative migration, blog migration, canonical production participants / steward / admin identity bootstrap tracks completed in repo history.
- Member Number / Membership / Member Badge architecture present.
- Historical staging recovery Packs 01–05: **CLOSED** (approved scope).
- Initiative Lifecycle Finalization Phases (including Phase 05/05A certification work) landed in product history; not the current open Pack.

---

## Immediate Objective

**Implement Production Completion Pack 02B — Language Registry API / canonical registry foundation.**

Scope intent (implementation Pack; do not expand into 02C–02J in the same cycle):

1. Mongo-backed Language Registry (Admin-managed), replacing hardcoded TypeScript priority catalogs as the **source of truth** for enabled languages.
2. Seed / migrate verification locales: `en`, `uk`, `zh-Hant`, `ar` (architecture must remain open to arbitrary Admin-added languages).
3. Public list of enabled languages + Admin CRUD APIs **before** any new Admin Languages UI section (Admin sections require real APIs).
4. Preserve existing `content_translations`, `TranslationProvider`, and Participant language preference fields — do not invent a parallel translation stack.
5. Do **not** install a new translation provider, generate bulk translations, or rewrite search/SEO in 02B.

Deeper Pack 02 sequence (approved; later Packs):

| Pack | Focus |
|------|--------|
| 02B | Language Registry API / foundation ← **NEXT** |
| 02C | Locale preference / runtime (guest cookie, precedence, `lang`/`dir`) |
| 02D | UI i18n foundation |
| 02E | UI key extraction |
| 02F | Canonical terminology glossary |
| 02G | Civic/public translation expansion + async warming |
| 02H | Multilingual search |
| 02I | Multilingual SEO |
| 02J | RTL hardening + rollout verification |

Long-term invariant: **adding a supported language becomes an Admin operation**, not a software-development task per language.

---

## Open Items (not Pack 02B)

| ID | Item | Status / constraint |
|----|------|---------------------|
| O1 | **Production** bootstrap Initiative `initiative-bootstrap-001` deletion | OPEN — known historical test data. Staging cleanup **intentionally refuses production**. Requires a **separately authorized production-safe procedure**. Do not weaken staging guards. |
| O2 | Mobile PWA regression diagnosis | OPEN — architecture previously worked on staging; diagnose regression. **Not** a PWA redesign. |
| O3 | Search-engine favicon | OPEN — read-only production favicon/crawler/metadata audit first. Do not generate a replacement image without evidence. |
| O4 | Multilingual Packs 02C–02J | OPEN — sequenced after 02B. |
| O5 | AI translation provider keys | OPTIONAL — not a launch blocker for multilingual control-plane foundation. |

---

## Immutable Architectural Decisions (do not casually reverse)

1. Initiative = sole canonical civic root (`architecture/decisions/ADR-INITIATIVE-CANONICAL-CIVIC-ROOT-v1.0.md`).
2. Participant = universal actor identity; Member is earned/honorary eligibility.
3. One Lifecycle Engine; LifecycleProfile selects the route.
4. Original civic/public content is permanent; translations are side representations (`content_translations`).
5. English remains the canonical fallback language.
6. Language Registry must be Admin/Mongo-managed — not a deploy-bound TS catalog — once Pack 02B+ lands.
7. SEO/indexing readiness for a locale is **independent** of ordinary language enablement.
8. Only explicitly eligible public/civic content may be sent to external translation providers.
9. No commit/push/deploy unless the owner explicitly requests it.
10. Do not invent a second Mongo topology, second participation ledger, or parallel civic root.

---

## Pack 02A — Approved multilingual direction (summary)

```
Browser locale detection
→ explicit visitor / Participant preference
→ Admin-managed Language Registry
→ UI localization
→ cached civic/public translations
→ multilingual search
→ canonical terminology glossary
→ multilingual SEO
```

Reusable foundations: `content_translations`, `TranslationProvider`, Participant interface/reading/writing prefs, RTL helpers, Admin settings patterns, Outbox/events (future warm/reindex).

Traditional Chinese verification locale: **`zh-Hant`**. Initial matrix: `en`, `uk`, `zh-Hant`, `ar`.

---

## Documentation Gate (Pack closure)

A Pack/Epic is **not CLOSED** until the documentation gate is evaluated:

- `project/NEXT_SESSION.md` (always for live handoff changes)
- `project/PROJECT_STATE.md` (current-focus / last-completed)
- `project/PROJECT_DASHBOARD.md` (when Pack/capability status changed)
- `project/WORK_LOG.md` (chronology when useful)
- ADR / change register when architectural decisions changed

Completion reports must list which canonical docs were updated or why no update was required.

Rule also recorded in: `architecture/DEVELOPMENT_BASELINE.md`, `.cursor/rules.md`, `architecture/recovery/chat-agent/README.md`.

---

## Operator / env pointers (non-secret)

- Production registration / indexing checklist: `docs/operations/production-configuration-checklist-pack01.md`
- Do **not** set staging `PLATFORM_MODE=production` for experiments.
- Staging bootstrap cleanup: `pnpm cleanup:bootstrap-initiative` (staging DB only; refuses production).

---

## Architectural Rules (unchanged)

1. Initiative = sole canonical civic root.
2. Participant = universal actor identity.
3. One Lifecycle Engine; LifecycleProfile selects the route.
4. No commit/push/deploy unless the owner explicitly requests it.
5. Do not invent a second Mongo topology or second participation ledger.
