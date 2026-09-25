# Production Completion Pack 02A — Multilingual Architecture Audit

Version: 1.0
Status: COMPLETED (READ-ONLY audit)
Date: 2026-08-30

---

## Purpose

Capture approved architectural findings from Pack 02A so Pack 02B+ implementation can proceed without reconstructing chat history.

Normative companion (existing vertical slice): `project/architecture/core/LANGUAGE_TRANSLATION_ARCHITECTURE_v1.0.md`
Live handoff: `project/NEXT_SESSION.md`

---

## Reusable foundations (do not replace)

- `content_translations` — side-store; identity includes source version + target language; stale/freshness
- `TranslationProvider` — provider-independent seam (`deterministic` / `gemini`); secrets server-side
- Participant preferences — `interfaceLanguage`, `readingLanguages`, `writingLanguages`, `translationPreference`
- RTL helpers — `ar` / `he`; logical CSS migration incomplete
- Admin settings patterns — platform social / support links / SEO overrides as control-plane templates
- Outbox / domain events — suitable for future translation warm + search reindex (`TranslationPublished` / `TranslationCorrected` in normative catalogue)

---

## Canonical direction

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

**Invariants**

- English remains the canonical fallback language.
- Canonical civic/public source records must **never** be overwritten by machine translation.
- Language Registry must be Mongo-backed / Admin-managed (not a hardcoded TypeScript catalog as source of truth).
- Adding a supported language must become an **Admin operation** once the control plane and runtime are complete.
- Traditional Chinese verification locale: **`zh-Hant`** (aliases such as `zh-TW` may map to it).
- SEO/indexing readiness is **independent** of ordinary language enablement for users.
- Only explicitly eligible public/civic content may be sent to external translation providers.

---

## Initial verification locales

| Locale | Role |
|--------|------|
| `en` | Canonical fallback (Latin) |
| `uk` | Cyrillic |
| `zh-Hant` | CJK / Traditional Chinese |
| `ar` | RTL |

Architecture must remain open to arbitrary Admin-added languages (including future RTL: `fa`, `ur`, `he`, etc.).

---

## Approved implementation sequence

| Pack | Focus |
|------|--------|
| **02B** | Language Registry API / canonical registry foundation ← next |
| 02C | Locale preference / runtime |
| 02D | UI i18n foundation |
| 02E | UI key extraction |
| 02F | Canonical terminology glossary |
| 02G | Civic/public translation expansion + async warming |
| 02H | Multilingual search |
| 02I | Multilingual SEO |
| 02J | RTL hardening + rollout verification |

---

## Gaps confirmed (honest)

- No Admin Language Registry yet (hardcoded priority catalog today)
- No UI chrome i18n library / message catalogs
- No guest language cookie / full precedence runtime
- Global search indexes canonical text only (no translations)
- No hreflang / locale SEO readiness flag
- Glossary is prompt terminology string, not Admin-managed resource

---

## Documentation

Pack 02A did not change application code. Live-state docs updated in the Documentation Recovery task of 2026-08-30.
