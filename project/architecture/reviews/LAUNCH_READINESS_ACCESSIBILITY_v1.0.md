# Launch Readiness Pack 05 — Accessibility & Interaction Quality

**Status:** Complete (interaction quality; no product/PWA/auth redesign)  
**Date:** 2026-08-11  
**Scope:** Web keyboard, focus, semantics, dialogs, forms, status announcements, reduced motion, touch targets  
**Non-goals:** New features, PWA, Auth Hardening, geometry redesign, formal WCAG certification

This Pack does **not** claim WCAG 2.x conformance certification. It improves launch readiness against WCAG-oriented practices ( Perceivable / Operable / Understandable / Robust ) where the Design System already provides foundations.

---

## 1. Surfaces audited

| Surface | Keyboard | Focus | ARIA | Forms | Status | Mobile/touch | Reduced motion | Issues |
|---|---|---|---|---|---|---|---|---|
| Public Header | OK | OK | aria-current | n/a | n/a | Menu 44px | Capsule motion gated | Fixed: menu focus trap |
| Mobile navigation | OK | Trap + restore | dialog/expanded | n/a | n/a | Link hit area | n/a | Fixed |
| Footer | OK | OK | nav landmarks | n/a | n/a | OK | n/a | None material |
| Home | OK | Skip → main | regions | n/a | Loading status | OK | Globe/typewriter reduce | Nested `<main>` MEDIUM |
| Registration/Login | OK | OK | labels/required/alert | labelled | AuthFeedback alert | OK | n/a | Required markers added |
| Workspace | OK | OK | nav/current | n/a | n/a | OK | n/a | Collapsible aria-controls fixed |
| Initiatives | OK | OK | cards/links | create forms exist | save aria-live | OK | n/a | Residual editor ellipsis LOW |
| Public Initiative | OK | OK | lifecycle text states | discussion | feedback | OK | n/a | None material |
| Lifecycle | OK | Improved Ask Assistant dialog | stage labels | editors | banners | OK | n/a | Sibling modals deferred MEDIUM |
| Messages | OK | OK | composer/toolbar | labelled | Sending… | Icon buttons | n/a | Call/video disabled (intentional) |
| Notifications | OK | OK | unread text | actions | polite empties | OK | n/a | OK |
| Preferences | OK | OK | labelled fields | Save aria-live | OK | OK | Account pref unused MEDIUM |
| Public Profile | OK | OK | badge alt | n/a | n/a | Message CTA | n/a | OK |
| Knowledge | OK | OK | headings | search | loading | OK | n/a | OK |
| Blog | OK | OK | reactions pressed | comments described | Posted live | OK | n/a | OK |
| Publishing | OK | Editor focus-within | toolbar pressed | labelled | Save live | Toolbar compact | n/a | TipTap surface fixed |
| Editorial Review | OK | OK | sections/tools | confirmations | polite | OK | n/a | OK |
| Assistant modal | Strong | Trap/restore | dialog labelled | composer | polite conversation | FAB large | reduce | Duplicate SR text removed |
| Confirm dialogs | Strong | Trap + **restore** | alertdialog | n/a | confirm live | OK | reduce | Focus restore fixed |
| Search | OK | Results programmatic | labels | filters | n/a | OK | n/a | outline:none on results region LOW |
| Authoring | OK | OK | status banners | application | OK | OK | n/a | OK |

---

## 2. Interaction patterns (canonical)

| Pattern | Rule |
|---|---|
| Skip link | `#main-content` with `tabIndex={-1}`; visible on `:focus-visible` |
| Focus ring | `--hu-focus-ring` / `--hu-focus-offset` via `.humanity-app …:focus-visible` |
| Visually hidden | `.hu-visually-hidden` (alias `.visually-hidden`) |
| Dialogs | `role="dialog|alertdialog"`, `aria-modal`, labelled title, Escape, Tab trap, focus restore |
| Icon-only | Accessible name via `aria-label` (no filename reliance) |
| Async buttons | `Button ariaLive="polite"` + Saving…/Saved |
| Errors | `role="alert"` / assertive for auth failures |
| Touch | `--hu-touch-target: 2.75rem` for major mobile chrome controls |
| Reduced motion | OS `prefers-reduced-motion: reduce` for Home/Assistant/dialogs |

---

## 3. Issues fixed in this Pack

1. **ConfirmDialog** restores focus to opener; shares `trapTabKey`.
2. **Mobile menu** focus trap + initial focus into panel; Escape still restores to launcher.
3. Canonical **`.hu-visually-hidden`** (+ `.visually-hidden` alias); MemberSkillsEditor migrated.
4. Skip target accepts keyboard focus (`tabIndex={-1}`).
5. **WorkspaceNavigation** initializes collapsed state from client storage; keeps `aria-controls` target mounted (`hidden`).
6. **Lifecycle Ask Assistant** modal: Tab trap + focus restore.
7. Blog TipTap shell **`:focus-within`** focus ring (ProseMirror keeps `outline: none` internally).
8. Comment helper wired with **`aria-describedby`**.
9. Login/Register required fields: visual `*` + visually-hidden “(required)” + `aria-required` where applicable.
10. Assistant FAB: remove duplicate screen-reader text (keep `aria-label`).
11. Mobile menu button / nav links use **`--hu-touch-target`**.
12. Shared **`design-system/focus-trap.ts`** helper.

---

## 4. Remaining issues

| ID | Severity | Issue |
|---|---|---|
| A-01 | MEDIUM | Layout skip target is a `div`; many pages also render inner `<main>` (nested landmark smell). Consolidation deferred. |
| A-02 | MEDIUM | Preferences `reducedMotion` preference is stored but not applied to CSS/JS (OS media query still works). |
| A-03 | MEDIUM | Some sibling modals (e.g. AllNominationsModal, AvatarCropEditor) still lack full trap/restore. |
| A-04 | MEDIUM | Default button min-height remains 40px; only major mobile chrome bumped to ~44px. |
| A-05 | MEDIUM | Home marketing funnel still uses shortened stage names (copy Pack 04 deferred). |
| A-06 | LOW | Global search results region uses `outline: none` for programmatic focus. |
| A-07 | LOW | Fragmented feature-local `*-visually-hidden` classes remain; migrate opportunistically. |
| A-08 | LOW | Account-level reduced motion vs OS preference not unified. |
| A-09 | HIGH (out of Pack) | Auth tokens in `localStorage` — Auth Hardening Pack. |
| A-10 | HIGH (out of Pack) | PWA / safe-area system — future Pack. |

No Pack-05 **BLOCKER** remaining for core keyboard paths on audited chrome.

---

## 5. Automated tooling decision

| Tool | Decision |
|---|---|
| `eslint-plugin-jsx-a11y` | **Not added** — would surface large historical debt outside Pack scope and risk noisy false CI failure. |
| axe / Playwright axe | **Not added** — no existing Playwright a11y gate; introducing a large browser stack is out of Pack scope. |
| Validation used | Focused static node:test suite + existing Design System / header / blog tests + full Web regression. |

Future: add jsx-a11y in a dedicated lint-debt Pack with baseline suppressions if desired.

---

## 6. Browser keyboard spot-check (automation)

Performed in Cursor browser against local web:

- Skip link is the first interactive control on Home/Register.
- Assistant modal opens with focus on **Close**; Escape closes (focus restore to FAB was unreliable under automation — keep as manual QA).
- Mobile menu opens with focus on first nav link; Escape restores focus to **Open navigation menu**.
- Register fields expose “(required)” in accessible names.

## 7. Manual device / screen-reader checks still required

These were **not** executed in this Pack and must not be reported as passed:

- VoiceOver on macOS Safari / iPhone
- NVDA or JAWS on Windows
- Real mobile virtual keyboard covering Assistant / Messages / Comments composers
- Real-device touch comfort for Lifecycle icon rows and TipTap toolbar
- Safari-specific focus ring quirks
- Assistant FAB focus restore after Escape in Safari/Chrome desktop

---

## 8. RTL readiness

Touched CSS prefers logical where already present (Assistant FAB uses `env(safe-area-…)`). No full RTL pass. Documented for Language Architecture follow-up: dialog close placement, icon mirroring, form label order under `dir=rtl`.

---

## 9. Confirmation

- No new product functionality.
- PWA not implemented.
- Auth Hardening not started.
- Nothing staged or committed by this Pack.
