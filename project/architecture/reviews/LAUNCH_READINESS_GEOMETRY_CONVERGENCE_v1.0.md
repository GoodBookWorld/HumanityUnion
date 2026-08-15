# LAUNCH_READINESS_GEOMETRY_CONVERGENCE_v1.0

**Status:** Complete  
**Date:** 2026-08-11  
**Pack:** Launch Readiness Pack 03 — Geometry Convergence & Unified Page Layout  
**Depends on:** Design System UX Pack 01, Launch Readiness Audit Pack 02, Launch Readiness UX Fix Pack 01  

---

## 1. Geometry problems discovered

From Pack 02 audit and Pack 03 discovery:

| Problem | Examples |
|---|---|
| Civic Media used a **90rem** outer shell | Wider than header/footer (`72rem`) |
| Lifecycle public/member pages used **720px / 960px** shells, often **without `margin-inline: auto`** | Petition, collaborative analysis, collective decision, implementation, commitment, participation |
| Public Initiative Experience used **workspace** width (`75rem`) on a public surface | `.pie-page` |
| Authoring / Publishing / Editorial routes had **no** `.humanity-workspace-page` wrapper | `MemberWorkspace` alone → uncentered on wide viewports |
| Civic Activity / bare public record routes lacked outer containers | CAP, accountability, public-impact, responses, tracking |
| Support used a dead `.page-shell` class | No centering CSS |
| Hardcoded `72rem` / `1.5rem` duplicated across geo/home shells | Global/country/region/community experience |
| Search kept a stale `960px` fallback | `.global-search-page` |
| Membership unauth nested a second max-width inside workspace page | Double geometry |
| Reading / form / document measures mixed with outer page width | Auth, legal, blog prose |

---

## 2. Geometry fixes applied

### Canonical tokens (`tokens.css`)

| Layer | Token | Value |
|---|---|---|
| Outer public page | `--hu-page-max-width` | `72rem` (alias of `--hu-content-max-width`) |
| Workspace outer | `--hu-workspace-max-width` | `75rem` |
| Reading column | `--hu-reading-max-width` | `46rem` |
| Form column | `--hu-form-max-width` | `40rem` |
| Document column | `--hu-document-max-width` | `48rem` |
| Dialog | `--hu-dialog-max-width` | `28rem` |
| Sidebar | `--hu-sidebar-width` | `13.75rem` |
| Initiative sidebar | `--hu-initiative-sidebar-width` | `17.5rem` |
| Legacy alias | `--hu-layout-max-width` | → page max |

### Shared utilities (`layout.css`)

- `.hu-page-container` / `.hu-page-container--sectioned`
- `.humanity-workspace-page`
- `.hu-reading-column` / `.hu-form-column` / `.hu-document-column`
- Workspace shell grid uses `--hu-sidebar-width` + `--hu-content-gap`

### High-impact migrations

1. **Civic Media** → page max-width + standard padding  
2. **All 720/960/48rem lifecycle page CSS** → page max-width, centered, DS padding  
3. **Participation** → same  
4. **PIE** → page max-width (public, not workspace)  
5. **Authoring / Publishing / Editorial (+ nested routes)** → wrapped in `.humanity-workspace-page`  
6. **Civic Activity** → `.humanity-workspace-page`  
7. **Bare public mains** (CAP, accountability, impact, responses, tracking, initiative-implementation-commitments) → `.hu-page-container.hu-page-container--sectioned`  
8. **Support** → `.hu-page-container` + document-width content  
9. **Search / Knowledge / Home geo content / World Initiatives / Civic Archive / Institutions inners** → page tokens  
10. **MemberWorkspace** → `width: 100%` inside outer shell; sidebar tokenized  
11. **Blog** editorial body/comments/author → `--hu-reading-max-width`  
12. **Auth / Legal / Contact** → form/document tokens (justified exceptions)  
13. **ConfirmDialog** → `--hu-dialog-max-width` + `--hu-shadow-floating`  
14. **Membership page shell** → no longer double-constrains width inside workspace page  

---

## 3. Remaining justified exceptions

| Surface | Measure | Rationale |
|---|---|---|
| Auth pages | `--hu-form-max-width` (40rem) as outer | Compact credential forms; not a content catalogue |
| Legal / Contact / Support content | `--hu-document-max-width` (48rem) | Long-form reading comfort; Support sits inside page container |
| Blog article prose / reactions / author card | `--hu-reading-max-width` (46rem) | Editorial measure inside outer `.hu-page-container` (Pack 01) |
| Blog title/meta (48rem), cover (56rem) | Inner article chrome | Intentionally between reading and page width |
| Public Profile `.public-member-page` | Mirrors page-container tokens | Shared surface for `/member/{name}` and `/profile` preview |
| Notifications `.notifications-page` | Token-equivalent of page container | Standalone authenticated page (not workspace shell) — geometry aligned |
| Home / Institutions section intros | Local copy measures (≈36–52rem) | Section typography only; outer shells use page max |
| Assistant modal | Own modal geometry + safe-area | Product surface; not redesigned in this pack |
| Confirm dialog | `--hu-dialog-max-width` | Dedicated dialog layer |

No page should invent a new outer max-width outside these tokens.

---

## 4. Responsive validation

| Viewport | Check | Result |
|---|---|---|
| Desktop (~1440) | Outer shells centered; equal side margins | Intended by `margin-inline: auto` + page max |
| Laptop (~1280) | Same | Pass by construction |
| Tablet (~768) | Workspace sidebar collapse unchanged (`member-workspace` media queries) | Preserved |
| Mobile (390) | Page padding via `--hu-page-padding-inline`; no new overflow introduced | Pass by construction for migrated shells |

Hotspots deferred to Pack 07 Browser/Device QA: Publishing TipTap on phone, Editorial review, Messages composer, Civic Media rails at 390.

---

## 5. Design System token usage

**Required for new pages**

```tsx
// Public content
<main className="hu-page-container hu-page-container--sectioned">…</main>

// Workspace
<main className="humanity-workspace-page">
  <MemberWorkspace>…</MemberWorkspace>
</main>
```

**Inner columns (optional)**

```tsx
<div className="hu-reading-column">…</div>
<div className="hu-form-column">…</div>
<div className="hu-document-column">…</div>
```

**Do not** hardcode `720px`, `960px`, `72rem`, or `90rem` for outer shells.

---

## 6. Browser verification

| Surface | Status |
|---|---|
| Blog (page + reading) | Token-aligned; Pack 01 geometry retained |
| Civic Media | Migrated off 90rem |
| Lifecycle public shells | Migrated + centered |
| Workspace Authoring/Publishing/Editorial | Outer workspace page added |
| Support / Search / Knowledge / Archive | Token-aligned |
| Safari / Firefox / iOS / Android | **Not fully verified** in this pack (see Pack 02 matrix → Pack 07) |

---

## Validation

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
- Web regression (includes `launch-readiness-geometry-pack03.test.ts`)

Nothing staged. Nothing committed.

---

## Explicit status

**LAUNCH READINESS PACK 03 — GEOMETRY CONVERGENCE COMPLETE**

Ready for **Launch Readiness Pack 04 — Navigation & Copy Consistency**.
