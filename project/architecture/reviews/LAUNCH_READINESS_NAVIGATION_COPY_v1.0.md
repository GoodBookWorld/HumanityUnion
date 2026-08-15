# Launch Readiness Pack 04 — Navigation & Copy Consistency

**Status:** Complete (presentation-only; no route/business-rule redesign)  
**Date:** 2026-08-11  
**Scope:** Web user-facing navigation labels, terminology, CTAs, empty/error/success copy  
**Non-goals:** Architecture redesign, layout redesign, new domains, PWA, Admin Console, Language Pack 03

---

## 1. Canonical terminology table

| Term | Meaning | Notes |
|---|---|---|
| Participant | Universal platform actor | Default human subject in UI copy |
| Member | Earned/honorary Membership status | Keep on Membership surfaces and Member badge only |
| Initiative | Civic initiative record / lifecycle host | Title Case product noun |
| Active Ally | Collaboration relationship | Proper name; do not shorten to “Ally” in nav titles when meaning Active Ally |
| Workspace | Authenticated personal civic area | Not “Member Workspace” |
| Discussion | Initiative-specific conversation surface | Do **not** use for Blog comments |
| Collaborative Analysis | Lifecycle stage | Registry label; do not shorten to “Analysis” on stage chrome |
| Improvement Proposals | Lifecycle stage | Prefer plural form of registry |
| Revision | Lifecycle stage | Not “Initiative Revision” on stage chrome |
| Petition | Lifecycle stage | |
| Decision Session | Lifecycle stage | |
| Collective Decision | Lifecycle stage | |
| Implementation Commitments | Lifecycle stage | Prefer plural registry form |
| Implementation Tracking | Lifecycle stage | |
| Official Responses | Lifecycle stage | Prefer plural registry form |
| Public Impact | Lifecycle stage | |
| Civic Archive | Lifecycle stage / archive surface | Not “Public Civic Archive” on stage chrome |
| Notifications | Platform/activity events | Distinct from Messages/Reminders |
| Messages | Conversations / direct communication | |
| Reminders | Next-step / time-related prompts | |
| Blog | Authored publications | Footer + Knowledge entry; not desktop capsule |
| Author / Trusted Author / Editor | Blog capability roles | Capability-gated Workspace labels |
| Humanity Union Assistant | Global Assistant product name | Stage helper may say “Ask Assistant” |
| Knowledge | Structured educational library | Distinct from Blog |
| Profile | Participant profile settings/public view | Not “Member Profile” unless Membership-specific |

**Discussion note:** Discussion is Initiative UX terminology, not a separate entry in `INITIATIVE_LIFECYCLE_STAGE_REGISTRY` (12 stages). Pack conceptual order listing Discussion between Initiative and Collaborative Analysis describes product language, not a 13th registry stage.

---

## 2. Canonical navigation map

| Surface | Visible label | Route | Audience | Active-state rule | Desktop | Mobile |
|---|---|---|---|---|---|---|
| Public Header capsule | Home | `/` | Public | exact `/` | Yes | Yes (primary list) |
| Public Header capsule | Institutions | `/institutions` | Public | prefix `/institutions` | Yes | Yes |
| Public Header capsule | Initiatives | `/initiatives` | Public | prefix `/initiatives` **or** nested public lifecycle prefixes | Yes | Yes |
| Public Header capsule | Knowledge | `/knowledge` | Public | prefix `/knowledge` (except `/knowledge/media` → Civic Media) | Yes | Yes |
| Public Header capsule | Search | `/search` | Public | prefix `/search` | Yes | Yes |
| Public Header utility | Log in / Workspace / Notifications | `/login`, `/workspace`, `/notifications` | Guest / Participant | Outside capsule; never Home | Yes | Auth block |
| Mobile primary (extra) | Civic Media | `/media` | Public | prefix `/media` or `/knowledge/media` | No (capsule) | Yes |
| Mobile primary (extra) | Membership | `/membership` | Public | prefix `/membership` | No (capsule) | Yes |
| Mobile auth | Create account | `/register` | Guest | — | No | Yes |
| Mobile auth | Profile | `/member` | Participant | — | No | Yes |
| Footer | Blog | `/blog` | Public | — | Yes | Yes |
| Footer | Support | `/support` | Public | — | Yes | Yes |
| Footer | Civic Media / Civic Archive / Membership / Search / Institutions / Initiatives | matching routes | Public | — | Yes | Yes |
| Workspace | Workspace Home | `/workspace` | Participant | exact `/workspace` | Sidebar | Sidebar |
| Workspace | Initiatives | `/workspace/initiatives` | Participant | prefix | Sidebar | Sidebar |
| Workspace | Messages | `/workspace/messages` | Participant | prefix | Sidebar | Sidebar |
| Workspace | Become an Author / Publishing | `/workspace/authoring` or publishing href | Capability-aware | prefix | Sidebar | Sidebar |
| Workspace | Editorial Review | editorial href | Editor/Admin only | prefix | Sidebar | Sidebar |
| Workspace | Profile | `/member` | Participant | prefix | Sidebar | Sidebar |
| Workspace | Preferences / Notifications / Membership / Account Security | matching | Participant | prefix | Sidebar | Sidebar |
| Knowledge | Blog entry card | `/blog` | Public | — | In page | In page |

**Duplicated/conflicting labels found (pre-fix):** Footer “Feedback” vs page H1 “Support”; Workspace “Settings Profile”; mobile “Member profile”; registration gateway “coming soon” vs live `/register`.

---

## 3. CTA / action vocabulary

| Action type | Canonical labels | Async |
|---|---|---|
| Persist draft/settings | Save / Save Draft | Saving… → Saved |
| Publish | Publish | Publishing… → Published |
| Editorial submit | Submit for Review | Submitting… → Submitted (where used) |
| Comment | Post Comment | Posting… → Posted |
| Auth primary | Log in | — |
| Auth create | Create account | Creating account… |
| Navigation open | View / Open / Read Article / View Public Profile | — |
| Assistant | Ask Assistant (stage) / Open Humanity Union Assistant (global) | — |
| Reactions | Helpful / Not Helpful | — |

Meaningful distinctions retained: Save Draft vs Save Preferences vs Save profile (context-specific idle labels).

---

## 4. Status vocabulary

| Concept | Canonical presentation |
|---|---|
| Lifecycle not started | Not Started (not “Upcoming” for lifecycle stages) |
| Draft | Draft / Draft Saved |
| Preview | Preview |
| Published | Published |
| Completed / superseded | Completed |
| Blog editorial queue tab | Under Review (tab category) |
| Comment moderation | “This comment is awaiting review.” |
| Authoring editor access | Editorial Review available message (not future Admin) |

Lifecycle stage chrome must derive from Lifecycle metadata / presentation status — not from `Initiative.status`.

---

## 5. Auth wording rule

| Context | Canonical |
|---|---|
| Primary header/button CTA | **Log in** |
| New account CTA / register page H1 / submit | **Create account** |
| Instructional gate copy already established | **Sign in** allowed (e.g. “Sign in to …”) when pairing with Log in link is clear |
| Avoid | Join (except product invitation titles), Sign in as primary header CTA |

---

## 6. Participant / Member rule

- **Participant** = ordinary platform actor in UI.
- **Member** = Membership status / Membership product surfaces only.
- Do not rename domain Member status fields, Membership pages, or Member badge semantics.
- Profile chrome uses **Profile** / **Public Profile** / **Participant profile**.

---

## 7. Notifications / Messages / Reminders

| Domain | Meaning | Empty example |
|---|---|---|
| Notifications | Platform/activity events | No active notifications. |
| Messages | Conversations | No unread messages. / Sign in to view your conversations. |
| Reminders | Next-step prompts | No reminders yet. |

Do not describe DM rows as generic “notifications” in the Messages section.

---

## 8. Capitalization / punctuation

- **Title Case:** page/section/product/stage names (Collaborative Analysis, Civic Archive, Humanity Union Assistant).
- **Sentence case:** descriptions, helper text, status banners, most buttons when not proper names.
- **Ellipsis:** prefer Unicode `…` in user-facing async/loading copy newly touched in this Pack.
- Do not mass-replace `...` inside logs, comments, or unrelated code.

---

## 9. Fixes applied

1. Wired `REGISTRATION_ROUTE = "/register"` and `WORKSPACE_ROUTE = "/workspace"`; removed registration “coming soon / future capabilities / Identity Capability” copy.
2. Registration gateway CTAs → **Create account**; About path → Knowledge (no coming-soon stub).
3. Register page + RegisterForm aligned to Create account / Creating account….
4. Footer Feedback → **Support**; Support contact uses live `CONTACT_EMAIL`.
5. Workspace nav Settings Profile → **Profile**; mobile Member profile → **Profile**.
6. Member Profile chrome → Profile / Participant profile / Public Profile.
7. Humanity Assistant → **Humanity Union Assistant** on implementation surfaces.
8. Authoring Editor/Admin banner points to live Editorial Review (no aspirational Admin Console).
9. Nested public Initiative lifecycle routes mark **Initiatives** active; `/blog` & `/workspace` still do not mark Home.
10. Global search entity labels aligned to registry plurals/names where they were stage names.
11. Empty/status copy tightened (Blog comments, Publishing empties, reminders, Blog comment awaiting-review banner).
12. Privacy visibility labels clarified (“Who can see my …”).
13. Async Save helper uses `Saving…`.
14. Lifecycle stage helper modal title → Ask Assistant (distinct from global product name).

---

## 10. Deferred issues

| ID | Severity | Issue |
|---|---|---|
| D-01 | MEDIUM | Home funnel / bootstrap pipeline still uses shortened stage names (“Analysis”, “Impact”) on some marketing/projection surfaces |
| D-02 | MEDIUM | Residual `Saving...` (three dots) on older editors not migrated in this Pack |
| D-03 | MEDIUM | Legacy `workspace-civic-assistant` “Civic Assistant” constants remain in unused/legacy module |
| D-04 | MEDIUM | Messenger Call/Video affordances still show “coming soon” disabled hints |
| D-05 | MEDIUM | Sign in vs Log in instructional mix remains on many gated features (allowed by auth rule; not mass-replaced) |
| D-06 | LOW | Public home “Coming soon: explore countries…” exploratory copy |
| D-07 | LOW | No Admin Console — correctly absent; do not invent `/admin` UI |
| D-08 | LOW | Discussion remains Initiative-only; ensure future Blog copy never reintroduces “discussion” for comments |
| D-09 | HIGH (out of Pack scope) | Auth tokens in `localStorage` (Pack 02 C-01) — not copy |
| D-10 | HIGH (out of Pack scope) | PWA not implemented (Pack 02 C-02) |

---

## 11. Tests

`apps/web/src/design-system/launch-readiness-navigation-copy-pack04.test.ts` covers the Pack 04 minimum checklist (header five-link capsule, active states, footer Blog, registration truthfulness, Participant/Member presentation, Assistant naming, Workspace/Editorial labels, lifecycle registry alignment, notifications/messages/reminders distinction, async wording, mobile required routes).

---

## 12. Confirmation

- No new product functionality introduced beyond truthful presentation of existing routes.
- No business-rule or authorization changes.
- Nothing staged or committed by this Pack.
