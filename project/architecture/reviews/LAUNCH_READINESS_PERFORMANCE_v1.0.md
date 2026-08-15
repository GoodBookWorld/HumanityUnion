# Launch Readiness Pack 06 — Performance & Runtime Efficiency

**Status:** Complete (launch-relevant efficiency; no product/PWA/auth redesign)  
**Date:** 2026-08-12  
**Scope:** Client bundles, request duplication, Mongo connection hygiene, message/blog bounds, Three.js/Assistant lazy load, caching boundaries  
**Non-goals:** Redis/CDN/workers, semantic search, Auth Hardening, PWA, architecture rewrite, speculative indexes

---

## 1. Baseline methodology

Measurements used where tooling was practical; invented lab numbers are avoided.

| Method | What it covers |
|---|---|
| Static import / `"use client"` audit | Bundle ownership (Three.js, TipTap, Assistant modal, quarantined UI) |
| Source review of API services | Bounds, N+1, connection reuse, outbox/mail |
| Existing unit/regression tests | Caps, pagination, translation cache keys, Assistant history bounds |
| Production `pnpm build` | Actionable Next build warnings; route compile success |
| Asset filesystem sizes | `unity-globe.webp` (~56 KB), local SVG flags (~6 MB catalog, per-flag load) |
| Controlled code paths | Abortable search/blog, SSR→client Blog article seed |

**Not claimed as RUM:** Lighthouse scores were not treated as production Web Vitals. Dev StrictMode double-invoke is separated from production runtime.

### Representative routes reviewed

**Public:** `/`, `/initiatives`, public Initiative, Lifecycle stage, `/knowledge`, `/blog`, `/blog/[slug]`, Public Profile  

**Authenticated:** `/workspace`, `/workspace/initiatives`, `/workspace/messages`, `/notifications`, `/preferences`, `/workspace/publishing`, `/workspace/editorial`

---

## 2. Findings classification (pre-fix → post-fix)

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| P-01 | HIGH | Assistant modal eagerly imported via Host on every layout | **Fixed** — `next/dynamic` after first open |
| P-02 | HIGH | Global Search / Blog list stale fetches on rapid navigation | **Fixed** — `AbortSignal` |
| P-03 | MEDIUM | Blog article SSR + client double-fetched detail | **Fixed** — `initialPost` seed |
| P-04 | MEDIUM | DM pagination anchor scanned up to 500 messages | **Fixed** — `findDirectMessageById` |
| P-05 | MEDIUM | Mongo `connectPromise` sticky after failed connect | **Fixed** — reset on reject |
| P-06 | MEDIUM | Globe RAF kept scheduling while `document.hidden` | **Fixed** — pause + `visibilitychange` resume |
| P-07 | MEDIUM | Blog date `Intl` locale could hydrate-mismatch | **Fixed** — fixed `"en"` locale |
| P-08 | MEDIUM | Nested `<main>` / residual Home landmark smell | **Documented** — geometry/a11y follow-up |
| P-09 | MEDIUM | Workspace membership stats may refetch outside projection | **Documented** — needs contract alignment |
| P-10 | MEDIUM | Blog covers / avatars often `<img>` not `next/image` | **Documented** — needs `remotePatterns` decision |
| P-11 | LOW | TipTap / Three already route-scoped | **Validated** — no change |
| P-12 | LOW | Community Intelligence already capped + TTL | **Validated** — no change |
| P-13 | LOW | Message history already page size 30 | **Validated** — no change |

**No BLOCKER** (crash / unbounded resource exhaustion) confirmed in audited production paths after fixes.

---

## 3. Bundle observations

| Library | Ownership | Launch note |
|---|---|---|
| **Three.js** | Home `HumanityGlobe` via `dynamic(..., { ssr: false })`; mount only ≥769px | Not on Blog / Workspace / Initiative |
| **TipTap** | `BlogRichTextEditor` ← Publishing editor only | Public Blog body is sanitized HTML renderer |
| **Assistant modal** | Lazy via Host `next/dynamic` | FAB/provider remain light; one canonical path |
| **Quarantined Lifecycle modal** | Not barrel-exported | Tree-shaken from active imports |
| **Charts** | No platform-wide chart lib in Web deps | n/a |

---

## 4. Three.js Home Hero

- Dynamic client load; CSS hides visual ≤768px; JS `matchMedia(min-width: 769px)` skips mount.
- DPR capped at `1.75`.
- RAF stops while tab hidden; resumes on `visibilitychange`.
- Dispose geometries/materials/renderer; remove canvas on unmount.
- Design unchanged.

---

## 5. Home image cost

| Asset | Size / notes | Opportunity |
|---|---|---|
| `unity-globe.webp` | ~56 KB | Acceptable for hero atmosphere; CSS background |
| Institution / media webps | Local static | Prefer lazy below-fold where not already |
| Flags | Local SVG under `/images/flags/4x3/` | Per-country load only; do not preload catalog |

Do **not** blindly recompress brand assets.

---

## 6. TipTap lazy loading

Publishing-only import graph confirmed. Public Blog / Workspace Home / Public Initiative do not import TipTap.

---

## 7. Assistant bundle

`HumanityUnionAssistantHost` dynamically imports `HumanityUnionAssistantModal` (`ssr: false`). Chunk loads on first open; subsequent open/close keeps modal mounted for `isOpen={false}` cleanup. No second Assistant product path.

---

## 8. Client/server boundaries

High-value change: Blog article page remains a Server Component that fetches once and seeds the client content tree. Broader `"use client"` parent splits deferred where risky.

---

## 9–12. React / effects / duplicates / waterfalls

| Area | Result |
|---|---|
| Rerenders | No blanket `memo`; Messages/Notifications left alone without proven hotspots |
| Effects | AbortController on Search/Blog list; Assistant modal aborts on close |
| Duplicates | Blog article client refetch removed when SSR seeds; metadata may still fetch separately (Next) |
| Waterfalls | Documented: independent Workspace widgets may still sequence — no unsafe parallel rewrite |

---

## 13–15. API payloads / Public Initiative / Lifecycle

Public projections already shaped for client use. No field removals (risk of breaking clients). Lifecycle Stage Intelligence rebuild semantics unchanged — no cache redesign. Residual MEDIUM: ensure stage metadata widgets do not refetch identical projections in a loop (monitor in Browser QA Pack).

---

## 16. Community Intelligence

| Cap | Value |
|---|---|
| Candidate pool | ≤ 80 |
| Related / workspace / participants | 5 |
| TTL | 60s ephemeral |
| Provider | Deterministic only |

No semantic provider; no persistent edges.

---

## 17. Assistant context cost

`boundConversationHistory`, prompt budget truncation, and privacy guards remain. Draft excerpts stay bounded. Private messages/documents are not sent.

---

## 18. Translation performance

`buildTranslationCacheKey(sourceRecordId, sourceVersion, targetLanguage)` keeps version-aware reuse. No Language Architecture redesign.

---

## 19–20. Blog list / article

- List: `BLOG_PAGE_SIZE = 12`, abortable refetch, server list limits ≤100.
- Article: SSR `initialPost`; comments remain section-scoped/paginated; TipTap not loaded.
- Related/author cards stay separate bounded fetches (acceptable).

---

## 21–22. Messages / history bounds

| Concern | Status |
|---|---|
| Recent page | 30 |
| Older page | 30 |
| Anchor resolve | O(1) by `messageId` |
| Unlimited history | **Not present** |

Privacy/semantics unchanged.

---

## 23–25. Notifications / Workspace / Profile

Notifications keep separate conceptual tabs (no merge). Workspace: avoid assuming stats live inside workspace projection without contract change (P-09). Public Profile should use public identity endpoints only — no new private fetch introduced.

---

## 26–30. Mongo / N+1 / connections / test hygiene

- Connection: singleton client + resettable `connectPromise` on failure.
- Indexes: no speculative additions this Pack.
- DM anchor N+1/scan removed.
- Remaining identity batching opportunities documented (Allies cards, some notification actors) as MEDIUM/LOW follow-ups.
- Tests must use isolated `hu_test_*` / `hu_verify_*`; never destroy `humanity_union_dev`.
- Atlas 500-collection pressure / DNS flakiness is **infra**, not app query defects.

---

## 31–32. Outbox / Mail

- Outbox default batch size 50; existing dispatcher guards retained.
- SMTP: pooled transporter, bounded retry classifier, mock in tests — product SMTP behavior unchanged.

---

## 33–34. Images / flags

Local SVG flags; placeholder fallback. No third-party flag CDN. Cover/avatar `next/image` migration deferred pending remote pattern policy.

---

## 35–37. Fonts / CSS / quarantine

- No Google Fonts / `next/font` duplicate stacks found in Web app sources; Design System stack remains.
- No blind deletion of quarantined CSS modules.
- Quarantined Assistant modal not actively imported via barrel.

---

## 38–40. Hydration / CLS / loading

- Blog dates deterministic (`en`).
- Globe client-only (no SSR HTML mismatch for WebGL).
- Nested `<main>` remains MEDIUM landmark/CLS-adjacent smell.
- Prefer existing loading copy over new skeleton system.

---

## 41–42. Caching policy & public-cache safety

| Layer | Policy |
|---|---|
| Browser / `api-client` | `cache: "no-store"` for API fetches |
| Next route cache | Authenticated surfaces must not share personalized RSC as public static |
| Domain in-memory | Community Intelligence TTL; translation version keys |
| Mongo | Source of truth |
| Provider | Translation reuse by versioned key |

**Rule:** never cache Workspace / Messages / Notifications / Assistant / Preferences projections as shared public responses. Pack did not introduce shared public caching of private data.

---

## 43–46. Rate limit / memory / abort / search

- Rate limiting: no product-policy change; no evidence limiter itself is the hotspot.
- Memory: Globe + Assistant abort/cleanup audited.
- Abort: Search + Blog list (+ Assistant modal existing abort).
- Global Search: keep result limits; no semantic redesign.

---

## 47–48. Build warnings / prod vs dev

Actionable Pack-scoped warnings fixed via code changes above. Do not judge production solely from `next dev` StrictMode double effects.

---

## 49. Performance budgets (pragmatic)

1. No unlimited list fetches on Messages / Blog comments / Search.
2. TipTap and Three.js must not appear on unrelated public routes.
3. Assistant conversational UI chunk loads only after first open.
4. Public Blog article must not client-refetch when SSR seeded.
5. Community Intelligence candidate pool ≤ configured cap.
6. No sticky failed Mongo connectPromise.
7. No persistent WebGL leak (dispose + RAF cancel + visibility pause).
8. No core hydration warning from Blog date locale.

---

## 50–51. Lighthouse / server timing

Lighthouse not run as a gate (environment variance). No pervasive production profiling added. Prefer controlled local timings in Browser/Device QA Pack.

---

## 52. Fixes shipped in this Pack

1. Assistant Host dynamic import + first-open gate.
2. Abortable Global Search + Blog index fetches.
3. Blog article `initialPost` SSR seed.
4. Deterministic Blog date formatting.
5. DM `findDirectMessageById` for pagination anchors.
6. Mongo connectPromise reset on failure.
7. Globe RAF pause while document hidden.

---

## 53. Unresolved risks (remaining)

| ID | Severity | Issue |
|---|---|---|
| R-01 | MEDIUM | Nested `<main>` / skip-target geometry |
| R-02 | MEDIUM | `next/image` for remote covers/avatars needs config |
| R-03 | MEDIUM | Workspace widget duplicate stats fetch (contract) |
| R-04 | MEDIUM | Some identity resolutions may still N+1 on dense lists |
| R-05 | LOW | Next `generateMetadata` may duplicate Blog detail fetch |
| R-06 | HIGH (out of Pack) | Auth token storage — Pack 07 |
| R-07 | HIGH (out of Pack) | PWA — future Pack |

---

## 54. Production measurement recommendations

1. Run `pnpm build && pnpm --filter @hu/web start` for network traces on Home / Blog / Public Initiative / Profile at 1440 and 390.
2. Confirm single WebGL canvas on Home desktop; none on mobile.
3. Confirm Assistant network/context only after open.
4. Confirm Messages older-page uses cursor, not full scan.
5. Watch Atlas separately from app timings when DNS is flaky.

---

## 55. Validation (Pack gate)

| Gate | Result |
|---|---|
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS |
| Pack 06 focused tests | **15/15** PASS |
| Full Web regression | **268/268** PASS |
| Full API regression (isolated `hu_test_*`) | **1629/1629** PASS |
| `git diff --check` | PASS |
| Isolated DB cleanup | **0** remaining `hu_test_*` / `hu_verify_*` |
| Staged / committed | **None** |
| Production browser smoke (`next start` :3010) | Home @390: **0** canvas; Home @1440: **1** canvas; Assistant dialog closed; Blog route renders |

Lighthouse lab scores not used as a gate.
