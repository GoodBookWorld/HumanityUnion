# Blog Architecture Pack 01 — Publishing Domain & Migration Compatibility

**Status:** Architecture blueprint (Pack 01). Backend foundation implemented in Blog Implementation Pack 02.  
**Date:** 2026-08-11  
**Scope:** Independent Publishing Domain for Humanity Union Blog; HUWS migration-compatible; reuses existing platform capabilities.

### Pack 02 status vocabulary refinement

Pack 01 listed `preview` and `updated` alongside workflow states. Pack 02 persists only:

`draft` → `submitted_for_review` → `published` → `archived`

- **Preview** is an authorized read/API presentation mode (not a persisted status).
- **Updated** is expressed via `publishedVersion` increment + `updatedAt` while status remains `published`.

---

## 1. Architecture Discovery Inventory

| Capability | Status | Evidence (representative paths) | Reuse decision |
|---|---|---|---|
| Media domain (Civic Media / registry) | **EXISTS** | `apps/api/src/modules/civic-media-center/`, `packages/media-registry/`, `apps/web/src/app/media/` | Reuse as-is for external trusted news. **Do not** fold Blog into Civic Media Center. |
| Knowledge domain | **EXISTS** (static; no CMS) | `apps/api/src/modules/knowledge-center/`, `docs/KNOWLEDGE_CENTER_ARCHITECTURE.md` (explicitly excludes blog/CMS) | Reference patterns only. **New Blog domain** for publishing. |
| Comment system | **EXISTS** (Initiative-scoped) | `apps/api/src/modules/initiative-comments/`, `packages/types/src/domain/initiative-comment.ts` | **Adapt** patterns (safety, author projection, status). **New** `BlogComment` storage — not Initiative Discussion. |
| Reaction system | **EXISTS** (like/dislike, support) | `initiative-comment-reactions`, `initiative-analysis-reactions`, etc. | **Adapt** upsert pattern. Introduce Blog kinds `helpful` / `not_helpful`. |
| Rich text / editor | **MISSING** | No TipTap/Quill/ProseMirror/DOMPurify in repo; Lifecycle uses plain `<textarea>` | **New** minimal editor + sanitizer (see §11). |
| Upload infrastructure | **EXISTS** (local; S3 seam) | `apps/api/src/modules/media-upload/` (`multer`, `MediaStorageProvider`), purposes: `avatar` \| `initiative-image` | **Adapt** — add purpose `blog-image` (cover + inline). |
| Image handling / moderation | **EXISTS** | `shared-documents-moderation.ts` (`approved` \| `review_required` \| `rejected`) | **Adapt** for Blog cover/inline images. |
| Safety moderation (text) | **EXISTS** | `lifecycle-safety` outcomes: `accepted` \| `needs_review` \| `rejected` | **Adapt** — add Blog surfaces (`blog_post`, `blog_comment`). Map product language “review_required” → platform `needs_review`. |
| Assistant integration | **EXISTS** | `HumanityUnionAssistantSurfaceId`, `assistant-specialization.ts`, web host | **Adapt** — add surface `blog` (+ optional `blog_workspace`). |
| Translation | **EXISTS** | `content-translation.ts`, `apps/api/src/modules/language/` | **Adapt** — new source kind `blog_post`. Original remains canonical. |
| Search | **EXISTS** | `apps/api/src/modules/global-search/`, `CivicEntityType` | **Adapt** — new entity type `blog_post`; index on publish; invalidate on update/archive. |
| Public profile author links | **EXISTS** | `public-author-identity.projection.ts` → `/member/{publicName}` | **Reuse as-is**. |
| Permission / AuthRole | **PARTIAL** | `AuthRole`: `member` \| `moderator` \| `admin` \| `institution` | Reuse identity. **New** Blog capabilities (not new user identities). |
| Outbox / catalogue events | **EXISTS** | `catalogue-events.ts`, outbox dispatcher | **Adapt** — Blog domain events. |
| Existing Blog / CMS | **MISSING** | No blog module; KC and CMC explicitly non-CMS | **New bounded context**. |
| Design System Pack 01 | **EXISTS** | `apps/web/src/design-system/tokens.css`, typography, buttons, cards | **Reuse as-is** for all Blog UI packs. |
| Community Intelligence | **EXISTS** | Initiative-focused | **Out of scope** for Blog Pack 01; do not couple. |

### Reusable components (summary)

- Participant / AuthIdentity (no second user model)
- `resolvePublicAuthorIdentity` / `PublicCommentAuthor` pattern
- `media-upload` + `MediaStorageProvider`
- Shared image moderation seam
- Lifecycle Safety Pipeline (extend surfaces)
- Global Search index builder pattern
- Language / content-translation stack
- Humanity Union Assistant surface registration pattern
- Outbox / catalogue events
- Design System tokens & primitives
- Reaction upsert service pattern
- Comment status + moderationState pattern

### Missing infrastructure (must be built in later packs)

1. Blog domain module + persistence (Mongo collections + memory/file for tests)
2. Blog capabilities / permission grants on Participant
3. Publishing workflow state machine + Editor review queue
4. Rich-text editor + HTML sanitizer
5. Blog-specific routes (`/blog`, `/blog/{slug}`, Author/Editor/Admin workspaces)
6. Blog comment + reaction modules
7. Migration importer from HUWS (legacy field mapping)
8. Search entity type + Assistant surface + Safety surface wiring
9. Translation source kind for posts

---

## 2. Canonical Blog Domain (Bounded Context)

Blog is an **independent Publishing Domain**. It is **not** part of the Initiative Lifecycle, Knowledge Center, or Civic Media Center.

### Core entities

| Entity | Responsibility |
|---|---|
| **BlogPost** | Canonical publication: slug, title, excerpt, body (sanitized rich text), cover media, category, tags, workflow status, author ParticipantId, timestamps, optional legacy import fields (internal) |
| **BlogCategory** | Closed set: Conscious Existence, Human Security, Our Life |
| **BlogComment** | Post-scoped comment; optional one-level parent reply; moderation status |
| **BlogReaction** | Per Participant × Post: `helpful` \| `not_helpful` \| none (evaluates publication, not author) |

### Non-entities (reuse)

- **Participant / AuthIdentity** — author is always an existing Participant with Blog capabilities.
- **MediaUpload** — cover and inline images via extended media-upload purposes.
- No second Member/User/Author identity table.

### Suggested module layout (future)

```
apps/api/src/modules/blog/
  blog-post.*
  blog-category.*
  blog-comment.*
  blog-reaction.*
  blog-permissions.*
  blog-review.*
  blog-migration.*
  public-blog.projection.*
packages/types/src/domain/blog.ts
apps/web/src/features/blog/
apps/web/src/app/blog/
```

---

## 3. Publishing Workflow

```
Draft
  → Preview
  → Submitted for Review   (Standard Author)
  → Published              (Trusted Author may skip review; Editor/Admin approve)
  → Updated                (edit published → new revision or in-place update with audit)
  → Archived
```

| Status | Public visibility | Who can transition |
|---|---|---|
| `draft` | Private to author (+ admin) | Author |
| `preview` | Author-only preview URL / Author Workspace | Author |
| `submitted_for_review` | Editors/Admins queue | Standard Author → submit; Author may withdraw to draft |
| `published` | Public `/blog/{slug}` | Trusted Author (direct); Editor/Admin (approve); Admin override |
| `updated` | Public (same slug); retain `publishedAt`, set `updatedAt` | Author (Trusted) or Editor after review policy |
| `archived` | Not listed; optional soft URL redirect | Author (own) / Editor / Admin |

**Rules**

- Safety evaluation runs before `submitted_for_review` and before `published`.
- `rejected` (safety) never becomes public; returns to draft with reason for author.
- `needs_review` (safety) forces editorial queue even for Trusted Authors.
- AI Assistant never publishes.

---

## 4. Roles / Capability Model

Do **not** introduce new user identities. Grant **Blog capabilities** on the existing Participant / AuthIdentity.

Capability progression:

```
Participant
  → Author Applicant
  → Author
  → Trusted Author
  → Editor
  → Administrator   (platform AuthRole admin / Blog admin capability)
```

### Permissions matrix

| Capability | Apply for authorship | Create/edit own drafts | Submit for review | Publish directly | Edit others’ drafts | Approve/reject submissions | Moderate comments | Manage categories/settings | Manage author grants | Archive any post |
|---|---|---|---|---|---|---|---|---|---|---|
| Participant | ✓ (apply) | — | — | — | — | — | — | — | — | — |
| Author Applicant | pending | — | — | — | — | — | — | — | — | — |
| Author | — | ✓ | ✓ | — | — | — | own delete (soft) | — | — | own |
| Trusted Author | — | ✓ | optional | ✓* | — | — | own | — | — | own |
| Editor | — | ✓ (own) | ✓ | ✓ | ✓ (review) | ✓ | ✓ | read categories | — | ✓ |
| Administrator | — | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

\* Trusted Author direct publish still blocked if Safety returns `needs_review` or `rejected`.

**Platform AuthRole mapping (reuse)**

- `AuthRole.admin` ⇒ Blog Administrator capability (or explicit grant).
- `AuthRole.moderator` ⇒ may map to Editor for comment moderation (product decision in Pack 02).
- `AuthRole.member` ⇒ Participant baseline; Blog capabilities are additive grants.

---

## 5. Migration Compatibility (HUWS → Humanity Union)

Internal-only legacy fields on `BlogPost` (never in public projection):

| Field | Purpose |
|---|---|
| `legacySourceUrl` | Original HUWS URL |
| `legacyPublishedAt` | Original publication timestamp (preserve chronology) |
| `legacyAuthorName` | Display fallback when Participant mapping incomplete |
| `legacyImportedAt` | Import run timestamp |

### Migration must preserve

- Publication date (`publishedAt` ← `legacyPublishedAt` when importing published posts)
- Author (map to Participant when possible; else store legacy name for Admin reconciliation)
- Cover image (re-upload or copy into media-upload store)
- Category (map to one of three canonical categories)
- Content (HTML/Markdown → sanitized Blog body)
- Comments when available → `BlogComment` with legacy timestamps

### Public projection

Expose only: title, slug, excerpt, body, cover, category, tags, author (public profile link), `publishedAt`, `updatedAt`.  
Never expose `legacy*` fields on `/blog` APIs.

---

## 6. Categories

**Canonical primary categories (exactly three):**

1. Conscious Existence  
2. Human Security  
3. Our Life  

- Exactly **one** primary category per post.  
- Optional **tags** (freeform or curated list) for filtering — not a second category tree.  
- Do not recreate dozens of WordPress categories.

---

## 7. Public Blog — `/blog`

**Purpose:** Discovery index.

**Contents**

- Search (query string; backed by Global Search filter `entityType=blog_post` and/or Blog list API)
- Category filter (three categories + All)
- Responsive cards: featured image, title, author, date, category, excerpt, Read More
- Pagination

**Responsive:** Desktop / Tablet / Mobile using Design System Pack 01 tokens (page container, cards, buttons, spacing, typography).  
No local shadows, fonts, or button styles.

---

## 8. Blog Article — `/blog/{slug}`

Structure (top → bottom):

1. Cover Image  
2. Title  
3. Author (link to `/member/{publicName}` when public)  
4. Publication Date (`updatedAt` note if revised)  
5. Category (+ tags)  
6. Article body  
7. Reactions (Helpful / Not Helpful)  
8. Comments (+ one-level replies)  
9. Previous / Next Article (same category or chronological)  
10. Related Articles  

Layout: clean, minimal; avoid WordPress chrome clutter. DS Pack 01 only.

---

## 9. Comments

- **Separate** from Initiative Discussion / Collaboration Channel / DMs.
- Entity: `BlogComment` on `BlogPost`.
- Support: top-level comments + **one-level** replies.
- Moderation: reuse Safety Pipeline + Editorial/Admin tools; statuses aligned with initiative comments (`approved` / `pending` / `removed` / `rejected` + moderationState).
- No Initiative Ally / Proposal Candidate semantics.

---

## 10. Reactions

- Simple, publication-scoped only: **Helpful** / **Not Helpful**.
- One reaction per Participant per post (changeable; clear → none).
- Aggregate counts for display; **no reputation score**, no author ranking.

---

## 11. Rich Text

**Finding:** No in-repo WYSIWYG. Lifecycle uses plain textareas.

**Recommendation (smallest suitable stack):**

| Layer | Choice | Rationale |
|---|---|---|
| Editor | **TipTap** (ProseMirror) | Modular, React-friendly, heading/list/link/image/quote/divider extensions; smaller surface than full WordPress |
| Storage | Sanitized HTML (or TipTap JSON + HTML render) | Portable for migration |
| Sanitize | **DOMPurify** (web) + isomorphic sanitize on API write | Required; not present today |
| Images | Upload via `media-upload` purpose `blog-image`; insert URL into body | Reuse storage seam |

Supported marks/blocks: headings, paragraphs, lists, links, quotes, images, dividers.  
Avoid plugins that recreate WordPress complexity (galleries, shortcodes, embeds zoo).

---

## 12. Author / Editor / Admin Workspaces (plan only)

| Surface | Route concept (future) | Contents |
|---|---|---|
| Author Dashboard | `/workspace/blog` or `/workspace/publishing` | Drafts, Submitted, Published, Archived |
| Editor Dashboard | `/workspace/blog/review` | Pending Review, Published, Archive |
| Administrator | `/workspace/blog/admin` | Authors, Reviews, Categories, Blog Settings |

Do not implement in Pack 01. Reuse Workspace shell + Design System layout tokens.

---

## 13. Safety

Reuse **Lifecycle Safety** + **media moderation** — no duplicate moderation product.

```
BlogPost / BlogComment / Blog image
  → Safety evaluation
  → accepted | needs_review | rejected
```

- Extend `LifecycleSafetySurfaceId` (or introduce a shared Safety surface registry that Blog and Lifecycle both call) with `blog_post` and `blog_comment`.
- Images: shared-documents-style pipeline → `approved` | `review_required` | `rejected`.
- Rejected content never published; needs_review enters Editor queue.

---

## 14. AI Assistant

Register surface **`blog`** (and optionally **`blog_workspace`**).

Educational questions only, e.g.:

- How do I publish?  
- Why is my article under review?  
- How do comments work?  
- Which category should I choose?  

Assistant **never** publishes, approves, or posts comments. Reuse existing host/modal; add specialization + knowledge modules in a later pack.

---

## 15. Translation

- Reuse Language Architecture: original BlogPost is canonical.
- Translations are side-car representations (`ContentTranslationSourceKind: blog_post`).
- Comments remain **untranslated** unless a future pack adds support.
- Public UI: language preference selects display translation when available; otherwise original.

---

## 16. Search

- Add `blog_post` to `CivicEntityType` / Global Search labels.
- Index published (and updated) posts: title, excerpt, category, tags, author display name, body text excerpt.
- Invalidate index on publish / update / archive.
- Avoid a second search engine; Blog is another source in Global Search.
- `/blog` listing may use Blog list API for category pagination; Search box may deep-link to Global Search with type filter.

---

## 17. Design System

All future Blog UI packs **must** use Design System Pack 01:

- Tokens: color, spacing, radius, shadow, typography, buttons, cards, page container  
- No local competing design systems  
- Floating header / Home Hero rules remain untouched by Blog packs  

---

## 18. Integration Map

```
Participant (Auth)
    │
    ├─ Blog capabilities (Author / Trusted / Editor / Admin)
    │
    ▼
Blog Domain ──── media-upload (blog-image)
    │         ──── Safety (text + image)
    │         ──── Outbox events → Search invalidate, Notifications
    │         ──── Translation side-cars
    │         ──── Assistant surface "blog"
    │         ──── Public author → /member/{publicName}
    │
    ▼
Public /blog + /blog/{slug}
Author / Editor / Admin Workspaces (future)
HUWS Migration Importer (future)
```

**Explicit non-integrations (Pack 01)**

- Initiative Lifecycle stages  
- Community Intelligence overlap  
- Civic Media Center publishing  
- Knowledge Center CMS  

---

## 19. Future Implementation Roadmap

| Pack | Focus |
|---|---|
| **Pack 01** (this) | Architecture blueprint, reuse map, migration contract |
| **Pack 02** | Types + API domain skeleton: BlogPost CRUD, workflow transitions, permissions, Mongo indexes, events |
| **Pack 03** | Media purpose `blog-image`, Safety surfaces, public projections |
| **Pack 04** | Public `/blog` + `/blog/{slug}` (read-only published) |
| **Pack 05** | TipTap editor + Author Workspace drafts/preview/submit |
| **Pack 06** | Editor review queue + Trusted Author direct publish |
| **Pack 07** | Comments + Reactions + Safety hooks |
| **Pack 08** | Search + Assistant surface + Translation source kind |
| **Pack 09** | HUWS migration importer + Admin author grants / settings |
| **Pack 10** | Polish, a11y, Design System sweep, e2e |

---

## 20. Validation Note (Pack 01)

This pack produces documentation only. Repository validation (typecheck / lint / build) confirms no accidental code changes were required for the blueprint.
