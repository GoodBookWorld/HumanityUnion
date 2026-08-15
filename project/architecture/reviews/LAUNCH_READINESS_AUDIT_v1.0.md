# LAUNCH_READINESS_AUDIT_v1.0

**Status:** Active audit baseline  
**Date:** 2026-08-11  
**Pack:** Launch Readiness Pack 02 — Full UX & Functional Audit  
**Scope:** Platform-wide discovery (Web primary; API only where public contracts affect UX)  
**Mode:** Audit-first. No new features. Isolated low-risk fixes only (documented below).

---

## Executive Summary

Humanity Union is close to a coherent public launch surface: Design System Pack 01, Public Header Pack 01, Blog Packs 03–07, Profile Packs 02–03, Communication Packs, and Launch Readiness UX Fix Pack 01 established strong foundations for Blog geometry, Public Profile permitted fields, and guest Login iconography.

This audit finds the remaining launch risk is **not one catastrophic defect**, but a **long tail of consistency gaps**:

1. **Navigation & wayfinding** — desktop capsule vs mobile vs footer label splits; wrong primary-nav active state on non-primary routes (fixed in this pack); workspace label confusion (`Settings Profile` vs `View Public Profile`).
2. **Page geometry fragmentation** — many public/lifecycle pages still use one-off `720px` / `960px` / `90rem` shells instead of `.hu-page-container` / `.humanity-workspace-page`.
3. **PWA readiness is effectively absent** — brand icons exist; no web manifest, service worker, theme-color, or installability story.
4. **Auth token storage** — refresh tokens remain in `localStorage` (open TASK-052); launch-sensitive security debt.
5. **Deferred product surfaces still visible as “coming soon”** — registration gateway copy, lifecycle workspace actions, Blog SEO / prev-next, About placeholder.
6. **Performance weight** — widespread raw `<img>`, oversized flag SVGs (~6MB tree), authoring-access refetch on every workspace nav mount.
7. **Accessibility** — skip link and many labeled controls are good; dialog focus-trap coverage and landmark structure are uneven outside Blog/Workspace shells.
8. **Browser / device matrix** — Chrome desktop (local) verified for key public surfaces; Safari/Firefox/Edge/iOS/Android largely **not verified** in this pack.

**Recommended posture:** freeze new domain features; execute a short sequence of Launch Readiness Fix Packs (geometry → nav/copy → a11y → performance → PWA → auth cookie migration).

---

## Critical Issues

| ID | Issue | Evidence | Impact | Suggested Fix Pack |
|---|---|---|---|---|
| C-01 | Refresh + access tokens stored in JS `localStorage` | `apps/web/src/features/auth/auth-token-store.ts` (`TODO(TASK-052)`) | XSS can steal sessions; blocks hardened launch posture | **Auth Session Hardening Pack** |
| C-02 | No PWA install/offline contract despite public launch intent | No `manifest`, SW, `theme-color`; icons only in `public/brand/` + `layout.tsx` metadata | Cannot offer Home Screen / standalone / offline guidance honestly | **PWA Experience Pack** (implement later; this audit is discovery only) |
| C-03 | Stale public marketing copy contradicts live `/register` | `public-experience/content.ts` still “Registration entry coming soon…”; `REGISTRATION_ROUTE = null`; `/register` exists | Trust / confusion at first contact | **Public Copy Consistency Pack** |

---

## Medium Issues

### Navigation & IA

| ID | Issue | Evidence |
|---|---|---|
| M-01 | Desktop capsule omits Civic Media + Membership (mobile retains them) | `DESKTOP_CAPSULE_NAVIGATION` filter in `constants.ts` |
| M-02 | Header “Knowledge” (`/knowledge`) vs footer “Blog” (`/blog`) — intentional but cognitively split | Footer Pack 03 decision; still a launch discoverability gap |
| M-03 | Footer label “Feedback” → `/support` | `footer-links.ts` |
| M-04 | Workspace “Settings Profile” → `/member` vs “View Public Profile” → `/profile` | `WorkspaceNavigation.tsx` |
| M-05 | ~~Primary nav defaulted unmatched routes to Home (`/blog`, `/workspace`, …)~~ | **Fixed in Pack 02** — `resolveCurrentDestination` now returns `null` when unmatched |
| M-06 | ~~Footer LinkedIn pointed at company admin dashboard~~ | **Fixed in Pack 02** — public company URL |
| M-07 | `/participation/[uniqueName]` coexists with modern `/member/[uniqueName]` Public Profile | Separate older participation interests page — clarify or redirect strategy needed |
| M-08 | Parallel similarly named public commitment routes | `/implementation-commitments/public/...` vs `/initiative-implementation-commitments/public/...` |

### Design System / layout

| ID | Issue | Evidence |
|---|---|---|
| M-09 | Undeclared `--hu-layout-max-width` used by Knowledge / Institutions / nominations / beta | **Mitigated in Pack 02** — alias to `--hu-page-max-width` in `tokens.css` |
| M-10 | Civic Media outer container `90rem` vs platform `72rem` page max | `civic-media-center.css` |
| M-11 | Many lifecycle public pages hardcode `720px` / `960px` shells | petition, collaborative-analysis, collective-decision, implementation*, participation pages |
| M-12 | ~majority of route files omit shared `.hu-page-container` / `.humanity-workspace-page` | Prefer feature CSS one-offs |
| M-13 | Authoring / Publishing / Editorial pages lack outer workspace page container class | Rely on `MemberWorkspace` width alone |
| M-14 | Notifications page is standalone (not workspace shell) while Messages is workspace-shell | Consistency gap for authenticated tools |

### Functional UX

| ID | Issue | Evidence |
|---|---|---|
| M-15 | Blog SEO title/description controls deferred | `BlogPostEditor.tsx` + Pack 05 tests |
| M-16 | Blog Previous/Next neighbour navigation deferred | `BlogArticlePageContent.tsx` |
| M-17 | Execution-pipeline workspace actions still “Coming soon — Workspace API pending” | `initiative-workspace-ux/constants.ts` + Impact/Archive/Tracking workspaces |
| M-18 | Registration gateway / About placeholders still “coming soon” | `RegistrationGatewayEvidence.tsx`, `LatestInitiativeCard.tsx` |
| M-19 | No dedicated `/about` route; About shown as coming soon in evidence UI | `app/about` missing |
| M-20 | `/profile` owner preview has no page-level `WorkspaceAuthGate` (unlike `/member`) | Guest landing UX unclear if unauthenticated |
| M-21 | Workspace nav refetches blog authoring access on every mount (no shared cache) | `WorkspaceNavigation.tsx` → duplicate network + flicker risk |
| M-22 | Blog index/article remain client-fetch heavy (SSR opportunity unused) | `BlogIndexPageContent`, `BlogArticlePageContent` |
| M-23 | Stale “View public initiative (coming soon)” in some public-experience cards | `LatestInitiativeCard.tsx` |

### Accessibility

| ID | Issue | Evidence |
|---|---|---|
| M-24 | Landmark / heading structure uneven on thin lifecycle public pages | Many `app/*/public/*` pages are thin wrappers |
| M-25 | Mobile nav dialog: Escape closes, but full focus trap / restore patterns vary vs Assistant modal | `HumanityHeaderMobileMenu.tsx` vs `HumanityUnionAssistantModal.tsx` |
| M-26 | Touch targets / dense pin clusters on geographic/home rails need device verification | Horizontal rails + map UIs |
| M-27 | Contrast of muted text on `#f4f7fa` not formally audited | Design System muted tokens |

### Performance

| ID | Issue | Evidence |
|---|---|---|
| M-28 | ~52 raw `<img>` usages; few `next/image` on LCP surfaces (blog covers, initiative cards, home) | Feature components across web |
| M-29 | `public/images/flags/` ≈ 6MB; individual SVGs up to ~380KB | Asset tree |
| M-30 | Member badge WebP ≈ 245KB for 48px UI usage | `public/illustrations/membership/member-badge.webp` |
| M-31 | Possible layout shift from client-only Knowledge / Blog / stats loading | Home stats skeleton exists; Knowledge listing client-only |

### Responsive

| ID | Issue | Evidence |
|---|---|---|
| M-32 | Publishing TipTap editor + Editorial review need systematic tablet/phone verification | Not fully exercised in this pack |
| M-33 | Workspace two-column shell collapses; verify sticky sidebar + Message composer on 390–768 | `humanity-workspace-shell` |
| M-34 | Civic Media 90rem width may feel wider than header/footer alignment on large desktops | Visual mismatch vs capsule header `72rem` |

---

## Minor Issues

| ID | Issue | Notes |
|---|---|---|
| m-01 | ~~Footer copyright year `© 2024`~~ | **Fixed in Pack 02** → `© 2026` |
| m-02 | Legacy redirects still live: `/country/[slug]`, `/knowledge/media`, `/initiative-analyses/public/...` | Harmless but add maintenance surface |
| m-03 | Breakpoint tokens commented-only (`--hu-bp-*`); media queries use literals | DS debt |
| m-04 | Assistant conversation memory session-only | Documented temporary |
| m-05 | Institutions nomination pathways still include deferred copy | Product state |
| m-06 | Duplicate favicon sources (`app/favicon.ico` + `public/brand/favicon.ico`) | Harmless redundancy |
| m-07 | No `robots.txt` / sitemap under `public/` or `app/` | SEO readiness |
| m-08 | Footer social “X” label vs brand “Twitter” familiarity | Acceptable if intentional |
| m-09 | Blog not in primary/capsule nav (by design) | Keep documenting for onboarding |
| m-10 | `FOOTER_PLATFORM_LINKS` deprecated alias still exported | Cleanup later |

---

## Architecture Observations

1. **Capability independence is holding** — Blog, Profile, Messaging, Lifecycle, Knowledge remain modular; audit found no need for new modules.
2. **Public projection privacy boundary remains correct pattern** — Launch Readiness UX Fix Pack 01 reinforced that Web must not re-decide privacy (keep this as a launch invariant).
3. **Dual page-geometry systems** — DS Pack 01 introduced `.hu-page-container` / `.humanity-workspace-page`, but older 720/960 shells and Civic Media 90rem still coexist. Convergence is a launch hygiene task, not a redesign.
4. **Workspace nav is capability-aware** (Authoring→Publishing, Editorial grant) — good; needs caching to avoid refetch churn.
5. **Admin Console is intentionally absent** — Admin Architecture Packs document capability grants; do not block public launch, but staff workflows remain out of band.
6. **Translation architecture exists** (`LANGUAGE_TRANSLATION_ARCHITECTURE_v1.0.md`) — public i18n UX completeness was not fully exercised here; treat as a separate readiness pack if multi-language launch is required.

---

## UX Findings

### Authentication & account

- Login / register / password-reset / email verification routes exist and use shared auth page chrome.
- Guest header Login icon+label shipped in Pack 01; accessible name preserved.
- Token storage in `localStorage` remains the top security/UX-risk for launch (C-01).
- Registration marketing still says “coming soon” while `/register` is live (C-03).

### Notifications & Messages

- Notifications: standalone page + header bell for authenticated users.
- Messages: workspace page under `/workspace/messages` (geometry fixed in prior Communication pack).
- Notification Center is the universal communication entry (Messages icon removed from header by design).

### Blog / Publishing / Editorial

- Public Blog index/article + comments/reactions present.
- Authoring → Publishing → Editorial capability path present in workspace nav.
- Deferred: SEO fields, previous/next article navigation.
- Editor/preview/submit flows exist; need device QA (M-32).

### Profile & Preferences

- Public `/member/[uniqueName]`, owner settings `/member`, preview `/profile`.
- Pack 01 restored Participation Area / Skills / Professional Links / Biography / Organization / Member badge presentation under privacy projection.
- Preferences + Account Security reachable from workspace nav.

### Initiatives & Lifecycle

- Public initiative experience + many public lifecycle projections exist.
- Several workspace lifecycle action rows still show “Coming soon” (M-17).
- Community Intelligence overlap UX exists at creation; do not redesign — verify empty/strong-overlap states in Fix Pack QA.

### Knowledge / Media / Search

- Knowledge library + Blog entry card.
- Civic Media at `/media` (also redirected from `/knowledge/media`).
- Global Search at `/search` with its own page shell.

### Assistant

- Floating Assistant + surface-resolved copy; modal focus/safe-area/`prefers-reduced-motion` partially handled.
- Do not redesign; verify Escape, focus trap, and mobile safe-area in a11y pack.

---

## Design Findings

| Area | Finding |
|---|---|
| Typography | DS Pack 01 hierarchy (`.hu-heading-*`, `.hu-body`, `.hu-widget-title`) is canonical; some legacy pages still use local type sizes |
| Spacing / margins | Shared tokens exist; feature CSS often re-declares gaps |
| Cards / radius / shadow | `.hu-card` / `--hu-radius-*` / `--hu-shadow-*` exist; lifecycle pages vary |
| Buttons | Primary/secondary families shared; hover should stay primary-blue (Pack 01 fixed amber hover regression) |
| Page width | Canonical 72rem page / 75rem workspace; Civic Media 90rem outlier; many 720/960 shells |
| Sticky | Header sticky OK; Assistant FAB uses safe-area |
| Loading / empty / error | Stronger on Blog/Workspace/Profile; thinner on some public lifecycle pages |
| Icons | Workspace PNG/SVG mix; Login icon added Pack 01 |

---

## Performance Findings

1. Prefer `next/image` (or shared media component) for Blog covers, initiative cards, home hero-adjacent media.
2. Compress / subset flag SVGs; avoid shipping unused country flags on pages that only need a few.
3. Cache `fetchBlogAuthoringAccessState` at session/workspace level.
4. Consider SSR or RSC data load for Blog article and Knowledge listing.
5. Audit `public/wdcr-js-map` and media trees for route-level code splitting.
6. Measure CLS on Home stats + Blog index when API is slow/unavailable.

---

## Accessibility Findings

**Strengths**

- Global skip link to `#main-content`.
- Header primary nav labeled; blog filters/pagination/reactions generally labeled.
- Confirm dialog and Assistant modal implement Escape + some focus management.
- `prefers-reduced-motion` honored on Home, rails, Assistant, several carousels.

**Gaps**

- Unmatched routes no longer falsely announce Home as current (**fixed**).
- Mobile menu dialog should get the same focus-trap rigor as Assistant.
- Lifecycle public pages need landmark/H1 audits.
- Formal contrast audit not run (tools + sample pages).
- Touch target audit on map/rail controls pending real devices.
- Screen-reader pass on Direct Messaging + Notifications not completed in this pack.

---

## Responsive Findings

| Viewport | Verified in Pack 02 | Notes |
|---|---|---|
| 1440 desktop | Partial (Blog/Home via local Chrome) | Blog outer geometry OK after Pack 01 |
| 1280 laptop | Partial | Header capsule + login OK |
| 1024 tablet | Not fully verified | Workspace shell collapse needs QA |
| 768 | Partial CSS review | Header switches to mobile menu |
| 390 mobile | Partial (Blog geometry) | Equal padding; no overflow on Blog index |

**Hotspots for Fix Pack QA:** Publishing editor, Editorial review, Messages composer, Initiative public discussion, Civic Media rails, Institutions map/list, Notifications filters.

---

## PWA Readiness Findings

| Capability | Current state | Notes |
|---|---|---|
| Web app manifest | **Missing** | No `manifest.webmanifest` / `app/manifest.ts` |
| Service worker | **Missing** | No Workbox / custom SW |
| Installability | **Not ready** | Manifest + SW + HTTPS required |
| `display` / `standalone` | **Absent** | Next `output: "standalone"` is **server deploy**, not PWA display |
| Offline behavior | **None** | Online-only SPA/SSR |
| App icons | **Partial** | `icon.png` 512, `logo-512.png`, favicon, apple-touch-icon present |
| Maskable icons | **Missing** | No maskable purpose assets declared |
| Apple touch icon | **Present** | `metadata.icons.apple` → `/brand/apple-touch-icon.png` |
| Splash readiness | **Missing** | No iOS splash set |
| Safe-area support | **Partial** | Assistant FAB/modal uses `env(safe-area-inset-*)` |
| `theme-color` | **Missing** | Not in root metadata |
| `background-color` | **Missing** (manifest) | Body uses `--hu-color-bg-muted` only in CSS |
| Orientation | **Unspecified** | |
| Status bar / apple-mobile-web-app | **Missing** | |
| Push notification readiness | **Not PWA-wired** | In-app Notification Center exists; no web-push subscription layer found |
| Deep links | **URL routes exist** | Not validated as installed-PWA deep links |
| Home Screen readiness | **Not ready** | Blocked on manifest/SW/icons policy |

**Input for future PWA Experience Pack:** start from existing `public/brand/*` icons; add maskable derivatives; add manifest + theme-color; decide offline cache policy (likely network-first for API, cache-first for brand/static); do **not** invent offline civic writes.

---

## Browser Matrix

| Browser / device | Status | Notes |
|---|---|---|
| Chrome desktop (local) | **Verified (partial)** | Home, Blog, header Login, sticky header; Pack 01 geometry checks |
| Safari desktop | **Not verified** | Environment limitation in this pack |
| Firefox desktop | **Not verified** | |
| Edge desktop | **Not verified** | |
| Chrome Android | **Not verified** | |
| Safari iPhone | **Not verified** | |
| Safari iPad | **Not verified** | |
| WebKit mobile emulation (CDP 390) | **Partial** | Blog geometry only |

Legend: **Verified** = exercised against running local app · **Not verified** = not run · **Blocked** = could not run · **Environment limitation** = agent/browser matrix incomplete.

---

## Isolated Fixes Completed in Pack 02

These were judged isolated and low-risk during the audit:

1. **Header active state** — unmatched routes no longer mark Home current (`HumanityHeader.resolveCurrentDestination`).
2. **Footer LinkedIn URL** — removed `/admin/dashboard/` suffix.
3. **Footer copyright year** — `2024` → `2026`.
4. **`--hu-layout-max-width`** — defined as alias of `--hu-page-max-width` so Knowledge/Institutions/etc. resolve correctly.
5. **Regression test** — active-state cases added to `public-header-ux-pack01.test.ts`.

No new features, no API contract changes, no PWA implementation, no Admin Console, no Blog/Assistant/CI/Translation redesigns.

---

## Recommended Fix Packs

Ordered for launch impact vs risk:

| Order | Pack | Addresses | Scope guardrails |
|---|---|---|---|
| 1 | **Launch Geometry Convergence Pack** | M-10–M-14, M-34 | Migrate shells to `.hu-page-container` / workspace page; keep editorial reading measures |
| 2 | **Launch Navigation & Copy Pack** | C-03, M-01–M-04, M-07–M-08, M-18–M-20, M-23 | Labels, About decision, registration gateway truthfulness; no IA redesign |
| 3 | **Launch Accessibility Pack** | M-24–M-27 + matrix gaps | Focus traps, landmarks, contrast sample, keyboard passes |
| 4 | **Launch Performance Pack** | M-21–M-22, M-28–M-31 | Image pipeline, flag assets, authoring-access cache, SSR hotspots |
| 5 | **Auth Session Hardening Pack** | C-01 | httpOnly refresh cookies; keep public UX stable |
| 6 | **PWA Experience Pack** | C-02 + PWA table | Manifest, icons/maskable, theme-color, SW policy — **implement only after this audit** |
| 7 | **Browser / Device QA Pack** | Browser matrix | Safari/Firefox/Edge + iOS/Android checklist against packs 1–6 |
| 8 | **Lifecycle Workspace Completion Pack** (optional for launch) | M-17 | Only if those actions must be live at launch; else hide CTAs |

---

## Validation (Pack 02)

Run after isolated fixes:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
- Focused Web header tests (active-state cases)
- Full Web regression if Web files changed

API full regression: not required (no API/contract changes in Pack 02).

---

## Explicit Pack Status

**LAUNCH READINESS PACK 02 — AUDIT COMPLETE**

Deliverable: this document (`project/architecture/reviews/LAUNCH_READINESS_AUDIT_v1.0.md`).  
Implementation of recommended Fix Packs is **out of scope** for Pack 02 except the isolated fixes listed above.
