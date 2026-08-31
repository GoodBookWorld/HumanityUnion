# NEXT_SESSION

Humanity Union — Canonical Live Engineering Handoff

Version 2.0

---

## START HERE — NEW ENGINEERING AGENT

1. **This file** (`project/NEXT_SESSION.md`) is the **authoritative live handoff** for what to do next.
2. It describes the platform as of **Production Completion Pack 02E COMPLETE locally** (UI Key Extraction; **staging smoke PENDING**). Pack **02D COMPLETE + STAGING PASS**. Primary engineering branch: follow `git branch --show-current`; **repository evidence wins**.
3. **Do not reinterpret:** Initiative = sole canonical civic root; Participant-first identity; English = translation fallback; translations never overwrite canonical civic source; staging cleanup tools must not be weakened for production.
4. **Current Pack track:** Production Completion **Pack 02 — Multilingual Platform Architecture**.
5. **Exact next task:** **Pack 02E staging smoke** (minimal checklist below). After staging acceptance: **Production Completion Pack 02F — Canonical Terminology Glossary**.
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

### Production Completion Pack 02E — UI Key Extraction (COMPLETE locally; staging smoke PENDING)

Tasks **01–06 COMPLETE** locally. Presentation-only extraction on Pack 02D `next-intl`; Pack 02C sole locale authority.

| Task | Result |
|------|--------|
| 01 Scope audit | COMPLETE |
| 02 Public chrome nav/footer | COMPLETE (`navigation.*`) |
| 03 Shared common + a11y | COMPLETE (`common.*` / `a11y.*`) |
| 04 Auth chrome | COMPLETE (`auth.*`) |
| 05 Workspace/Account shell | COMPLETE (`workspace.*`) |
| 06 Acceptance + regression close-out | COMPLETE locally |

**Deferred boundaries (not Pack 02E):** Pack 02F glossary; lifecycle-stage translation; civic/content body; Notification Center empty-state body; Blog `navLabel` API union change; role/status enum presentation maps; provider translation; multilingual search; SEO/hreflang; locale-prefixed routes.

**Do NOT claim staging PASS yet.**

### Production Completion Pack 02D — UI i18n Foundation (COMPLETE + STAGING PASS)

Unchanged — Pack 02C locale authority; `next-intl` foundation; staging PASS recorded previously.

### Production Completion Pack 02B + 02C — Staging Acceptance PASS

- Pack **02B** / **02C** staging PASS (unchanged).

---

## Immediate Objective

**Pack 02E staging smoke (PENDING), then Pack 02F.**

Run the minimal staging smoke checklist below against deployed staging after the Pack 02E changes are deployed. On PASS, Documentation Gate for staging acceptance, then start **Pack 02F — Canonical Terminology Glossary**.

Do not invent a second locale-resolution path. Reuse Pack 02C + Pack 02D runtime.

### Pack 02E — minimal staging smoke checklist

1. Guest `hu_lang=en` → public header/footer chrome English; `html lang=en dir=ltr`.
2. Switch to **uk** → Civic Media / Knowledge / Membership / Search / Blog / footer Privacy·Terms·Contact localized; hrefs not locale-prefixed.
3. Switch to **zh-Hant** (or zh-TW alias) → same chrome localized; LTR; canonical tag `zh-Hant`.
4. Switch to **ar** → same chrome localized; `dir=rtl`; RTL chevron/layout OK.
5. Auth guest: Log in / Create account / forgot-password / register form labels follow locale; submit still hits same routes (`/login`, `/register`, `/password-reset`).
6. Authenticated: Workspace sidebar Profile / Messages / Notifications localized; hrefs `/member`, `/workspace/messages`, `/notifications` unchanged; header Workspace/Notifications icons keep accessible names.
7. Account shell: Account tile labels localized; **Role/Status values remain API enum tokens** (not translated).
8. Blog authoring nav: API `navLabel` still English `"Become an Author" | "Publishing"` in network/state; UI may show translated presentation.
9. Language Selector still Registry-driven; disabled locale write still 400; restore Registry to en-only when done.
10. Final guest state: `hu_lang=en`, `html lang=en dir=ltr`.

Deeper Pack 02 sequence (approved):

| Pack | Focus |
|------|--------|
| 02A | Architecture Audit — **COMPLETED** |
| 02B | Language Registry — **COMPLETED** + staging **PASS** |
| 02C | Locale preference / runtime — **COMPLETED** + staging **PASS** |
| 02D | UI i18n foundation — **COMPLETED** + staging **PASS** |
| 02E | UI key extraction — **COMPLETE locally**; staging smoke **PENDING** |
| 02F | Canonical terminology glossary — **NEXT after 02E staging PASS** |
| 02G | Civic/public translation expansion + async warming |
| 02H–02J | As sequenced in architecture roadmap |

---

## Standing rules (do not re-derive)

- Initiative = sole canonical civic root.
- Participant-first identity.
- English = translation fallback; translations never overwrite canonical civic source.
- Staging cleanup tools must not be weakened for production.
- Never commit `production-admin-source.json` or secrets.
