# PWA Mobile Experience v1.0

**Pack:** PWA Experience Pack 01  
**Status:** Implemented (presentation mode of the existing Humanity Union Web app)  
**Non-goals:** Web Push, App Store / Play packaging, TWA, Capacitor, second mobile app, offline mutation queues

---

## 1. Install architecture

Humanity Union remains **one platform and one Web application**. The PWA is an **installed presentation mode** of the same routes, APIs, authentication, Participant model, domains, and Assistant.

```
Website (browser)
   + same routes / API / auth / Assistant
        ↓
Installed PWA presentation (display-mode: standalone)
        ↓
Standalone Mobile App Shell (App Header + Bottom Nav)
```

No `/mobile` duplicate platform. No second Workspace or Initiative feed backend.

---

## 2. Manifest

Canonical Next.js manifest: `apps/web/src/app/manifest.ts`

| Field | Value |
|---|---|
| name | Humanity Union |
| short_name | Humanity |
| start_url | `/workspace` |
| scope | `/` |
| display | `standalone` |
| theme_color | `#0174b0` |
| background_color | `#f4f7fa` |
| orientation | unset (no forced portrait) |

---

## 3. Icons

Canonical brand sources:

- `public/brand/app-192.png` (any)
- `public/brand/app-512.png` (any)
- `public/brand/favicon.ico`
- Apple Home Screen: `public/brand/apple-touch-icon.png`

### Maskable decision

The current 512×512 artwork approaches unsafe edges under circular/squircle masks. It is registered with `purpose: "any"` only. **Do not claim `maskable` until a dedicated safe-zone derivative exists.**

---

## 4. start_url & auth-only app rule

Installed launches open `/workspace`.

- Authenticated Participant → Workspace / App Home
- Guest / expired session → existing Login / Create account via `WorkspaceAuthGate` with `returnTo`
- After successful authentication → return to `/workspace` (or the gated returnTo path)

Guests do not receive private Workspace data before session resolution. No `/app` route was created for PWA.

---

## 5. Session behavior (remembered, not immortal)

Pack 07 model preserved:

- HttpOnly `hu_access_token` (~15m)
- HttpOnly `hu_refresh_token` (rotating)
- Secure in production, SameSite=Lax, Path=`/`
- No auth tokens in `localStorage`

**Pack 01 decision:** default refresh lifetime **`30d`** (was `7d`).

| Why 30d | Why not longer / immortal |
|---|---|
| Fits “sign in once on phone; normal launches restore Workspace” | Still rotating + revocable |
| Aligns with common mobile remembered-session expectations | Logout / password reset / security events still clear session |
| Access JWT stays short-lived | No silent immortal credential |

Automatic restoration continues via existing refresh + `credentials: "include"`. Service worker must not cache private session responses.

---

## 6. Standalone shell

Reusable helper: `apps/web/src/features/pwa/presentation-mode.ts`

Uses `(display-mode: standalone)` and iOS `navigator.standalone`. Body class: `humanity-app--pwa-standalone`.

| Surface | Browser | Standalone |
|---|---|---|
| Website Header / Footer | shown | hidden |
| PWA App Header | hidden | shown |
| Bottom App Navigation | hidden | shown |
| Assistant FAB | shown (existing rules) | hidden |
| Workspace sidebar nav | shown | hidden (drawer owns it) |

---

## 7. App Header

`[Avatar] [ Search Humanity Union ] [Menu]`

- Avatar → Workspace Drawer (`Open Workspace menu`)
- Search → `/search?q=...` (canonical Global Search)
- Menu → public Global Menu (Home, Institutions, Knowledge, Blog, Civic Media, Support, Search)

---

## 8. Workspace Drawer

Presentation of existing capability-aware `WorkspaceNavigation`. Focus trap, Escape, focus return, safe-area, scroll overflow.

---

## 9. Initiative Feed

Presentation/projection only (`PwaInitiativeFeed`):

1. If Community Intelligence workspace opportunities include `priority_match` items → show those with server `reasons[0].message` when present
2. Else → newest public Initiatives via `fetchWorldInitiativesProjection`

Canonical Initiative IDs/routes. No `PwaInitiative` / popularity ranking. Surfaced prominently on Workspace in standalone mode.

**Initiatives bottom-nav decision:** `/initiatives` (existing World Initiatives route) — smallest consistent destination; Create uses `/initiatives/create`.

---

## 10. Bottom Navigation

Icons under `/icons/messenger/*-mob.svg`:

| Item | Behavior |
|---|---|
| Workspace | `/workspace` (not drawer) |
| Initiatives | `/initiatives` |
| Create | `/initiatives/create` (`Create Initiative`) |
| Notifications | `/notifications` + existing unread badge (`99+`) |
| Assistant | opens canonical `HumanityUnionAssistantModal` |

Create / Assistant are actions (not persistent selected destinations). No Web Push in this Pack.

---

## 11. Assistant reuse

One modal, one provider, one `/api/v1/assistant`. Standalone may use near-fullscreen presentation CSS only. FAB hidden when bottom nav owns Assistant.

---

## 12. Safe areas

Tokens in `pwa-safe-area.css`:

- `--hu-safe-area-*` from `env(safe-area-inset-*)`
- `--hu-pwa-bottom-nav-height` / `--hu-pwa-app-header-height`

OS owns the iOS Home Indicator — we do not draw one. Composers (Messages, ICC, comments) clear bottom nav height. Assistant modal covers nav and uses safe-area padding.

---

## 13. Caching / privacy

Service worker: `public/sw.js`

**Allow:** static `/_next/static`, `/brand`, `/icons`, illustrations/images, offline document.

**Deny (mandatory):** authenticated/private API prefixes including DMs, notifications, preferences, workspace, assistant, shared documents, blog, initiatives (drafts), member profile/media; any API request carrying auth cookies or `Authorization`.

No offline mutation queue for messages, votes, comments, drafts, Assistant prompts, etc.

---

## 14. Offline behavior

`public/offline.html` — truthful “You're offline” + Try Again. Does not pretend private workflows work offline.

---

## 15. SW update policy

Install does **not** call `skipWaiting()`. New workers activate after the previous controller is released (typical next navigation / relaunch). Avoids forced reload loops. No complex update UI in Pack 01.

Current cache version label: `hu-pwa-v2`. Service Worker cache is **never** the source of truth for install status. DevTools “Update on reload” can force SW updates during development and is not a product defect.

---

## 16. Home install promotion

Ecosystem section is one `.public-home-v2__ecosystem` with internal 50/50 split:

- Left: existing ecosystem copy/actions
- Right: **Humanity Union App** install guidance

The promotional block remains available on Website Home. It must not disappear permanently because the app was installed once historically.

Install UX states: `install_available` | `ios_add_to_home` | `already_installed` | `unsupported` | `browser_mode`

- Chromium + captured `beforeinstallprompt`: `Install Humanity` + secondary `Later`
- iOS: `Add Humanity to Home Screen` + `Later` (instructional dialog)
- Standalone (running inside the installed app): compact **Installed** status; no redundant Install action
- Unsupported / no prompt: primary **How to install** (truthful browser/device guidance) + `Later` — never a fake Install button; never an actionless dead end
- Temporary dismissal: show **Show install options** recovery; section must not go blank
- **Dismissal ≠ installation.** `sessionStorage` key `hu_pwa_install_dismissed_at` (~6h) only suppresses CTAs temporarily. Never use a permanent `pwaInstalled=true` local boolean as OS truth.
- A registered Service Worker, manifest presence, or historical `appinstalled` event is **not** proof the OS still has a launcher icon. Use current presentation/install capability only.

### Browser / OS icon placement limitation

Humanity Union can provide the manifest, icons, name/short_name, and install action/guidance. **The browser and OS control final placement of the launcher / Home Screen icon.** The Web app cannot force an icon onto a user’s desktop or Home Screen after uninstall or shortcut loss. When the site is not running standalone, Website Home must keep a discoverable install/guidance path so Participants can reinstall or recover the shortcut.

---

## 17. Logout / expiry / deep links

- Logout clears Pack 07 session; app remains installed; next launch hits `/workspace` → auth gate
- Session expiry uses normal login recovery (gate shows status, not infinite blank)
- Same-origin deep links use existing Next routing
- External links keep normal browser behavior (not forced into the shell)

---

## 18. Browser differences

| Environment | Install | Shell |
|---|---|---|
| Chromium desktop/Android | `beforeinstallprompt` when eligible | standalone shell after install |
| iOS / iPadOS Safari | Add to Home Screen guidance | `navigator.standalone` |
| Ordinary mobile browser | Website chrome + FAB | **no** bottom App Nav in Pack 01 |

---

## 19. Future Push boundary

Web Push requires a separate architecture: permissions, subscription lifecycle, server delivery, privacy, preference controls. Pack 01 uses in-app unread state only and must not request notification permission.

---

## 20. Performance notes

- SW cache growth limited to static allowlist
- TipTap / Three.js marketing globe must not load as part of `/workspace` start (Pack 06)
- Assistant remains lazy-hosted
- Install code is lightweight client helpers
