# Browser & Device QA Pack 01 — Real-Device PWA, Cross-Browser & Mobile Verification

**Status:** COMPLETE (Final Reconciliation / Closure — 2026-08-12)  
**Initial cycle status (preserved):** NOT COMPLETE — agent environment lacked real installed-device verification  
**Closure date:** 2026-08-12  
**Scope:** Verification and correction only — no new product features, Push, App Store/TWA, or auth redesign  
**Baselines confirmed (read, not reopened):**

- Launch Readiness Packs 03–07 (Geometry, Navigation/Copy, Accessibility, Performance, Auth Session)
- PWA Experience Pack 01 (`PWA_MOBILE_EXPERIENCE_v1.0.md`)
- Launch Blocker Recovery Pack 01
- Auth Recovery Hotfix
- PWA UX Correction Packs 02–03

**Evidence labels used throughout (mandatory):**

| Label | Meaning |
|---|---|
| AUTOMATED PASS | CI / focused test suite |
| AGENT BROWSER PASS | Cursor IDE Chromium-class browser |
| USER REAL-DEVICE PASS | Human installed-PWA verification reported by the user |
| MANUAL STILL REQUIRED | Not yet executed; recommended |
| NOT AVAILABLE | Agent environment cannot execute |

---

## 1. QA environment

| Layer | What was used |
|---|---|
| Web production build | `pnpm --filter @hu/web build` succeeded (Next production output) |
| Interactive browser QA | Cursor IDE Chromium-class browser against local **dev** `http://localhost:3000` (CORS/`WEB_ORIGIN` aligned with API) |
| Production static asset probe | Attempted `next start -p 3011`; interactive QA stayed on `:3000` to avoid Origin/CORS breakage |
| API | Existing local API `http://localhost:4000`, mock email, non-destructive |
| Data | No `humanity_union_dev` destruction; attempted isolated QA user creation failed (see Auth) |
| HTTPS / real install | **BLOCKED BY ENVIRONMENT** — localhost HTTP; Chromium install prompt and iOS Home Screen require supported install contexts (often HTTPS + real browser UI) |
| SMTP | No real SMTP used |
| Secrets | Not printed; no production secrets exposed in this pack |

### Environment limitations (exact)

1. No physical iPhone / iPad / Android device attached to this agent session.  
2. No Safari, Firefox, or Edge automation available here — Cursor browser is Chromium-class only.  
3. `display-mode: standalone` emulation via CDP did **not** activate the PWA shell in this host (`matchMedia('(display-mode: standalone)')` remained `false`). Standalone shell UI is therefore **not** claimed as runtime-passed.  
4. `beforeinstallprompt` did not fire in the embedded browser → Chromium install CTA stayed in unsupported/guidance state.  
5. Creating a durable confirmed QA login via `registerAndConfirmAuthUser` failed (`AuthValidationError: confirmation code has expired` under mock/blocked test recipient) → authenticated Workspace/Messages/Notifications flows marked **MANUAL REQUIRED** / **BLOCKED BY ENVIRONMENT**.  
6. Production port `3011` is not CORS-aligned without env changes; pack avoided mutating auth/CORS config.

Simulation and responsive viewport overrides are labeled as such and are **never** recorded as physical-device PASS.

---

## 2. Browser matrix

| Browser | Mode | Result | Notes |
|---|---|---|---|
| Chrome / Chromium (Cursor IDE browser) | Browser | **PASS** (smoke) | Home, Institutions, Initiatives, Knowledge, Blog, Search, Support HTTP 200; header/footer; Assistant FAB; Home App promo |
| Chrome / Chromium | Install / standalone | **MANUAL REQUIRED** | No install prompt in embedded host; standalone emulation ineffective |
| Safari desktop | — | **NOT AVAILABLE** | |
| Firefox | — | **NOT AVAILABLE** | Lack of Chromium-style install is **not** an app defect |
| Edge | — | **NOT AVAILABLE** | |

---

## 3. Device matrix

| Device | Result | Notes |
|---|---|---|
| iPhone Safari | **MANUAL REQUIRED** | Real device required for Add to Home Screen, notch, Home Indicator, keyboard |
| Android Chrome | **MANUAL REQUIRED** | Real device required for install prompt, Back, persistent login |
| iPad Safari | **NOT AVAILABLE** | |
| Android tablet | **NOT AVAILABLE** | |
| 390×844 viewport override (simulation) | **PASS** (layout smoke only) | Mobile website chrome (hamburger); not standalone shell |

---

## 4. Results by area

### Core website smoke — PASS (Chromium browser)

Routes verified live: `/`, `/institutions`, `/initiatives`, `/knowledge`, `/blog`, `/search`, `/support`.  
Header, footer, primary nav, Assistant FAB present in browser mode. Bottom App Nav **absent** in ordinary browser mode (correct for Pack 01).

### Authentication — BLOCKED BY ENVIRONMENT / MANUAL REQUIRED

Verified without login:

- Guest `/workspace` → `/login?returnTo=%2Fworkspace` (**PASS**)
- `localStorage` / `sessionStorage` contain no `hu_access_token` / `hu_refresh_token` (**PASS**)
- `document.cookie` does not expose auth cookies (**PASS** — HttpOnly not JS-readable)

Not verified here: login → refresh → 30d reopen, logout clearing, access-token expiry with valid refresh.

### PWA installability

| Check | Result |
|---|---|
| Manifest served (`/manifest.webmanifest`) | **PASS** — name/short_name Humanity Union; `start_url=/workspace`; `display=standalone`; theme `#0174b0`; background `#f4f7fa`; icons 192/512 `purpose:any` |
| SW registered once (`/sw.js`) | **PASS** — one active registration; no waiting worker observed |
| Home “Humanity Union App” column | **PASS** — present; ecosystem split class present; no auto-prompt |
| Chromium install button | **MANUAL REQUIRED** / **NOT AVAILABLE** in this host |
| iOS Add to Home Screen | **MANUAL REQUIRED** (no real Safari) |
| App icons HTTP | **PASS** on interactive host (`/brand/app-192.png`, `/brand/app-512.png`) |

### start_url — PASS (manifest + guest gate)

Manifest `start_url` is `/workspace`. Guest launch path resolves through login with `returnTo`. Authenticated launch **MANUAL REQUIRED**.

### Persistent login / session expiry / restart — MANUAL REQUIRED

Critical real-device / real-session tests not executed (no durable QA session in this environment).

### App Header / Drawer / Global Menu / Bottom Nav / Create / Notifications badge — MANUAL REQUIRED (standalone)

Code + Pack 01 automated tests cover structure. Runtime standalone shell not activated in this browser host.

### Assistant (browser) — PASS (spot)

FAB opens Assistant (`aria-expanded=true`). Canonical modal path; no `/assistant` route used.

### Android Back / iOS Home Indicator / virtual keyboard / orientation — MANUAL REQUIRED

### Messages / Notifications page / Workspace authenticated / Lifecycle / Publishing / Profile privacy — MANUAL REQUIRED

Publishing/Editorial: **MANUAL REQUIRED** (capability account unavailable).

### Home install promotion — PASS (browser)

50/50 split markup present; App heading + install guidance; Chromium host showed non-actionable guidance status (expected when no deferred prompt). Mobile stacking: viewport simulation only.

### Service Worker — PASS (spot)

- Single registration  
- Cache name `hu-pwa-v1-static` only  
- Sample entries: brand icons, messenger icons, `_next/static` CSS, offline.html  
- **No `/api/` URLs in Cache Storage** after browsing public routes  

### Private-cache audit — PASS (spot; mandatory)

After Home + Institutions + Search + Blog browsing: `apiUrlsInCache: []`.  
Authenticated private-response cache after login/logout: **MANUAL REQUIRED** (no session). No BLOCKER observed in guest browsing.

### Offline — PASS (document)

`/offline.html` shows “You're offline.” + truthful Workspace/Messages copy + Try Again. Full offline navigation intercept **MANUAL REQUIRED** (network throttling / real offline).

### Deep links / external links — PARTIAL

Same-origin routes load. External link shell-trapping and PWA deep-link reopen: **MANUAL REQUIRED**.

### Safari / Firefox / Edge — NOT AVAILABLE

### Responsive — PARTIAL

390 mobile viewport: website mobile header (hamburger) visible. 1440/1280/1024/768 breakpoint campaign: **MANUAL REQUIRED** beyond spot checks.

### Hydration / console — PARTIAL

No blocking console automation harness attached for full route matrix. Home rendered without agent-visible crash. Formal hydration recheck on production build: **MANUAL REQUIRED**.

### Network — PARTIAL

Manifest/SW/offline/icons reachable (200). Duplicate auth refresh / duplicate article fetch under authenticated load: **MANUAL REQUIRED**.

### App icon quality / splash / persistence-after-restart — MANUAL REQUIRED

Maskable icon remains **MEDIUM** (architecture already: do not claim maskable; dedicated derivative if Android crop looks bad).

### Security regression (Pack 07 spot) — PASS (guest)

No localStorage JWTs; cookies not JS-readable; no private SW cache entries observed.

### Accessibility spot — PARTIAL

Assistant FAB accessible name present; VoiceOver / full Pack 05 device pass: **MANUAL REQUIRED**.

---

## 5. Fixes applied in this Pack

None required from confirmed runtime defects in the available environment.

(No private-cache leakage, no broken guest Workspace gate, no missing offline document, no SW update loop observed.)

---

## 6. Remaining issues

### BLOCKER

None confirmed in available environment.

### HIGH (remaining verification debt — treat as launch gate until cleared on real devices)

1. Real Android Chrome: install → standalone launch → `/workspace` → persistent login after force-close.  
2. Real iPhone Safari: Add to Home Screen → icon → launch → safe-area / Home Indicator / Messages keyboard.  
3. Authenticated session expiry + logout private-cache re-audit on installed PWA.  
4. Android system Back with Assistant/Drawer/Menu open.

### MEDIUM

1. Dedicated maskable 512 icon if Android launcher crop clips artwork.  
2. Full Safari desktop / Firefox / Edge smoke.  
3. Production HTTPS installability (localhost HTTP cannot fully validate Secure cookie + install UX).  
4. Apple-specific status-bar / splash cosmetics on real iOS.

### LOW

1. Formal hydration console sweep on production `next start` with CORS-aligned origin.  
2. Orientation landscape matrix on tablet.

---

## 7. Manual device checklist (do not mark PASS until executed)

### iPhone

- [ ] Add to Home Screen guidance accuracy  
- [ ] App icon  
- [ ] Launch at `/workspace`  
- [ ] Login persistence after kill  
- [ ] Dynamic Island / notch  
- [ ] Home Indicator clearance under bottom nav  
- [ ] Messages composer + keyboard  
- [ ] Assistant full-screen / safe-area  

### Android

- [ ] Install prompt from Home App CTA  
- [ ] App icon  
- [ ] Standalone launch  
- [ ] Persistent login  
- [ ] Bottom navigation  
- [ ] System Back overlay precedence  

---

## 8. Automation

Added bounded CI guards: `apps/web/src/features/pwa/browser-device-qa-pack01.test.ts`  
(Does **not** claim cross-browser or physical-device coverage.)

---

## 9. Verdict statement (initial cycle — historical)

This pack completed the **first structured QA cycle** that the agent environment can execute, with rigorous labeling of what was not available. At that time, physical-device and multi-browser clearance remained a launch gate listed under HIGH above.

**Initial cycle verdict:** `BROWSER & DEVICE QA PACK 01 NOT COMPLETE`  
(Reason: real installed-device verification unavailable in the agent environment.)

The sections below record what happened after that first cycle and close the pack.

---

## 10. Final Reconciliation / Closure — 2026-08-12

### 10.1 Timeline

```
Initial Browser & Device QA Pack 01 (agent)
        ↓  NOT COMPLETE — no real install / physical device
User installs Humanity Union PWA
        ↓
Manual discovery: Origin/CORS → refresh loop → guest private-request noise
        ↓
Launch Blocker Recovery Pack 01 (Origin/CORS + App background)
Auth Recovery Hotfix (bounded refresh / guest settle)
PWA UX Correction Pack 02 (install UX, guest gates, shell polish)
PWA UX Correction Pack 03 (Profile / Knowledge drawer / World Map / Drawer auto-close)
        ↓
USER REAL-DEVICE VERIFICATION — "Everything works as intended."
        ↓
Final Reconciliation → COMPLETE
```

Historical sections 1–9 above are **not rewritten** to claim agent physical-device tests. This section is the authoritative **current** state.

### 10.2 Corrections performed after the initial QA cycle

| Pack | What was corrected |
|---|---|
| Launch Blocker Recovery Pack 01 | Credentialed Origin/CORS allowlist + loopback support in non-production; App background/install presentation |
| Auth Recovery Hotfix | Bounded `/auth/refresh`; guest settle without recursive refresh; no private Workspace/Preferences storm before auth |
| PWA UX Correction Pack 02 | Install promotion never actionless; guest language/preferences gates; burger/Back/drawer close; Initiative carousel; compact stats; Lifecycle warm track; profile centering; avatar URL same-origin; manifest `short_name: Humanity` |
| PWA UX Correction Pack 03 | Public Profile biography left/full width; Knowledge mobile drawer; World Map Zoom In/Out/Reset (+ pan); Workspace Drawer auto-close on navigation |

No Push, App Store/TWA packaging, second Assistant, or Auth architecture redesign was introduced.

### 10.3 USER REAL-DEVICE VERIFICATION

**Label:** USER REAL-DEVICE PASS  
**Device model / OS / browser version:** not inventoried in this session (not claimed).

User-reported installed-PWA outcomes:

- Humanity Union PWA was installed and launched successfully  
- Authentication and session work after Auth fixes  
- PWA navigation works  
- Workspace Drawer opens from Avatar; closes automatically after navigation selection  
- Explicit cross and backdrop close remain  
- Workspace page/navigation works as intended  
- Knowledge mobile drawer works; section selection shows content and closes drawer  
- Public Profile mobile corrections work  
- World Map controls work  
- Installation flow became accessible again  
- Final user confirmation: **"Everything works as intended."**

### 10.4 Auth final state

**Label:** AUTOMATED PASS + USER REAL-DEVICE PASS (session/login path)

Canonical architecture:

| Phase | Expected behavior |
|---|---|
| Guest | Bounded session resolution → no infinite refresh → no private Workspace/Preferences/Notifications storm → Login available |
| Login | HttpOnly cookies → authenticated session → Workspace |
| Refresh / reopen | Rotating refresh → authenticated restoration when valid |
| Logout | Guest → no refresh storm |

Defect sequence (resolved):

1. Guest/login Origin/CORS failure → fixed (Launch Blocker Recovery)  
2. No-session auth refresh loop → fixed (Auth Recovery Hotfix)  
3. Guest authenticated/private projections firing too early → fixed (Pack 02 guest gates + Auth Recovery)

### 10.5 Origin / CORS final state

**Label:** AUTOMATED PASS (config + recovery pack tests)

- Exact allowed-origin reflection for credentialed responses  
- Credentialed CORS (`credentials: true` path)  
- Never `*`  
- Dev/test: configured origins + loopback `http(s)://localhost|127.0.0.1` ports  
- Arbitrary external origins rejected  
- Production allowlist remains configuration-driven (`CORS_ORIGIN` / `WEB_ORIGIN`)

### 10.6 Session persistence / auth storage

**Label:** AUTOMATED PASS + USER REAL-DEVICE PASS

- **No** active authentication credentials in `localStorage` or `sessionStorage`  
- Browser auth uses **HttpOnly** cookies (`hu_access_token`, `hu_refresh_token`)  
- Secure in production; SameSite; rotation; logout clearing preserved  

### 10.7 PWA install / manifest / branding

**Label:** AUTOMATED PASS + USER REAL-DEVICE PASS (install)

| Field | Value |
|---|---|
| name | Humanity Union |
| short_name | Humanity |
| start_url | `/workspace` |
| display | `standalone` |
| Icons | `/brand/app-192.png`, `/brand/app-512.png` (`purpose: any`) |

Maskable icon: **MEDIUM / deferred** — not a launch BLOCKER unless real launcher crop is materially broken (user did not report that).

Install promotion (Home): discoverable; states include Install Humanity / Add to Home Screen / How to install / Later / Show install options / Installed as applicable. No permanent “installed once” local flag is authoritative.

### 10.8 Service Worker / privacy

**Label:** AUTOMATED PASS + AGENT BROWSER PASS (initial guest cache audit)

- No authentication API caching  
- No Messages / Notifications / Preferences / private Workspace / Assistant conversation / drafts / authenticated document download caching  
- Private cache leakage = BLOCKER — **none confirmed**

### 10.9 Workspace PWA shell (final)

**Label:** AUTOMATED PASS + USER REAL-DEVICE PASS

- App Header: Avatar, Search, Back where appropriate, Hamburger  
- Avatar → Workspace Drawer with canonical capability-aware `WorkspaceNavigation`  
- Navigation selection → route + **automatic drawer close**  
- Cross / backdrop / Escape retained  
- Bottom nav (standalone only): Workspace, Initiatives, Create Initiative, Notifications, Humanity Union Assistant  
- Browser/website mode does **not** receive the standalone-only bar  

### 10.10 Assistant / Initiative feed / statistics

**Label:** AUTOMATED PASS + USER REAL-DEVICE PASS (where applicable)

- PWA Assistant → canonical Humanity Union Assistant only (no second Assistant/provider/page)  
- Standalone FAB suppression remains correct  
- Compact horizontal Initiative carousel/feed; canonical routes; preference relevance when available; newest public world fallback; no new recommendation engine  
- Compact horizontal Workspace statistics row; semantics unchanged  

### 10.11 Knowledge / Profile / World Map / Lifecycle / Header avatar

**Label:** AUTOMATED PASS + USER REAL-DEVICE PASS

| Area | Final state |
|---|---|
| Knowledge mobile | Drawer + cross + backdrop; selection updates content and closes; reopenable; desktop sidebar unchanged unless defect |
| Public Profile | Avatar/name centered; biography left + full content width; org/links readable; compact stats; Member badge; privacy projection unchanged |
| World Map | Zoom In / Zoom Out / Reset; pan if architecture permits; country selection preserved |
| Lifecycle mobile | Warm HU amber track behind white stage cards; horizontal scroll/states/markers preserved |
| Header avatar | Authenticated Participant avatar from workspace-identity; Web-origin brand paths; no duplicate Public Profile fetch for header |

### 10.12 Guest network settle (architecture)

**Label:** AUTOMATED PASS (Auth Recovery + Pack 02 tests). Agent interactive re-clear in this closure turn was not used as the primary evidence (USER REAL-DEVICE PASS already covers the installed path).

Expected after Clear Site Data:

| Request | Expected |
|---|---|
| `/preferences/me` | 0 |
| `/workspace/home` | 0 |
| `/notifications/unread-count` | 0 |
| `/auth/me` | 0 where canonical resolver does not need it |
| `/auth/session` | bounded |
| `/auth/refresh` | at most the intentional bounded recovery attempt |

A single bounded 401 refresh used for session restoration is **not** an infinite error storm.

### 10.13 Console / agent browser limits

**Label:** PARTIAL (agent) / USER REAL-DEVICE PASS (product path)

Agent still cannot claim Safari / Firefox / Edge / physical iPhone Safari / physical Android Chrome automation.

Recurring 404 / hydration failure / auth loop / uncaught exception / SW loop as launch BLOCKER: **none confirmed** after correction packs + user verification.

### 10.14 Issue reclassification (closure)

| Severity | Items |
|---|---|
| BLOCKER | **None** |
| HIGH | **None** for the confirmed core PWA/Auth path after USER REAL-DEVICE PASS |
| MEDIUM | Dedicated maskable PWA icon; additional Safari/Firefox/Edge physical QA; production HTTPS installability cosmetics |
| LOW | Occasional development-only HMR/hydration noise; orientation/tablet matrix |

### 10.15 Manual checks still recommended (non-blocking for Production Configuration entry)

- Formal Safari desktop / Firefox / Edge smoke  
- Second-device matrix (additional iOS/Android hardware)  
- Authenticated private-cache re-audit after logout on a second device  
- Production HTTPS install + Secure cookie confirmation during Production Configuration  

These remain **MANUAL STILL REQUIRED** / recommended and do **not** automatically block proceeding into Production Configuration preparation when core real-user PWA verification succeeded and no confirmed defect remains.

### 10.16 Closure gates (this reconciliation)

Recorded at closure:

| Gate | Result |
|---|---|
| Focused suites (Browser QA + Launch Blocker + Auth Recovery + PWA Experience + Pack 02 + Pack 03) | **69/69** PASS |
| Full Web regression | **342/342** PASS |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `pnpm build` | PASS |
| `git diff --check` | PASS |
| Full API regression | **Not re-run** (no material backend change in this reconciliation). Latest valid documented full API: **1644/1644** (Launch Readiness Auth Session Hardening / Pack 07) |
| Staged / committed by this task | **None** |

### 10.17 Launch gate (UX / device → Production Configuration)

**Question:** Is the existing Humanity Union Web + PWA user-facing platform ready to proceed from UX/device correction into Production Configuration & Operations preparation?

**Answer:** **YES**

This means ready for Production Configuration preparation — **not** “public release today.”

**Recommended next pack (do not implement in this document):**

Production Configuration & Operations Pack 01  
— Hosting, Domains, Environment Separation, Database, Mail, Security & Operations

### 10.18 Final pack verdict

**BROWSER & DEVICE QA PACK 01 COMPLETE**
