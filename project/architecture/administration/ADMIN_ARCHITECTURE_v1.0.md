# Humanity Union — Administration Architecture v1.0

**Pack:** Admin Architecture Pack 01  
**Status:** Canonical architecture (documentation only)  
**Date:** 2026-08-11  

**This pack does not implement an Admin Console UI.**  
**This pack does not change production authorization behavior.**

---

## 1. Purpose

Define one canonical Administration model for Humanity Union before UI implementation.

Administration is the platform’s way to grant, scope, audit, and revoke privileged authority over **Participants** — without creating a second identity system, without absorbing domain ownership, and without exposing private communications by default.

Related existing docs (do not replace):

- `project/architecture/publishing/BLOG_ARCHITECTURE_PACK01.md`
- `architecture/blueprint/LIFECYCLE_SAFETY_ARCHITECTURE_v1.0.md`
- `architecture/blueprint/AI_MEDIA_MODERATION_ARCHITECTURE_v1.0.md`
- `engineering/07_PERMISSION_MODEL.md` (normative ambition; this doc aligns implementation reality)

---

## 2. Canonical Principle

```
Participant  = canonical human actor identity
Administration = capabilities granted to a Participant
               + scoped permissions
               + immutable audit trail
```

**Forbidden parallel identities**

| Forbidden | Why |
|-----------|-----|
| `AdminUser` | Second login identity |
| `AdministratorAccount` | Parallel account type |
| `EditorUser` / `ModeratorUser` | Role-as-identity |
| Separate admin auth realm | Splits Participant continuity |

Preferred model:

```
Participant
  + Capability Grants
  + Scoped Permissions
  + Audit Trail
```

JWT / Auth account remains the authentication vehicle for that same Participant (`memberId` / participant id). Role strings on the auth user are compatibility inputs to capability resolution — not a second person model.

---

## 3. Administration Bounded Context

### Responsibility

- Capability grants and revocation
- Administrative authorization resolution
- Audit visibility for privileged mutations
- Platform operational administration surfaces
- Safe configuration access (non-secret)

### Non-responsibility

Administration does **not** own domain aggregates.

| Domain owns | Administration may |
|-------------|-------------------|
| `BlogPost` | Authorize Editor to review / publish |
| Initiative + Lifecycle | Never silently rewrite; exceptional ops only if separately designed |
| Membership records | Review / status ops when product-approved |
| Safety decisions | Surface review state; human decision with audit |
| Direct Messages | **No default access** |

Admin UI (future) calls Administration orchestration and/or authorized domain services — **never** direct database mutation from the UI.

---

## 4. Role vs Capability vs Permission

| Term | Meaning | Example |
|------|---------|---------|
| **Role (bundle)** | Human-friendly set of capabilities | Editor |
| **Capability** | Named authority area | `blog.review` |
| **Permission** | Atomic operation | `blog.post.request_changes` |
| **Scope** | Where authority applies | `global`, `blog`, institution id, initiative id |

**Rule:** Prefer permission checks (`can(permission, scope)`) over hard-coded `role === "admin"` for new work. Existing role short-circuits remain until migrated (Phase A–D below).

---

## 5. Distinctions That Must Not Be Merged

| Concept | What it is | What it is NOT |
|---------|------------|----------------|
| **Participant** | Foundational human identity | An admin role |
| **Member** | Earned/honorary participation status | Administrative privilege |
| **Initiative Author (steward)** | Ownership of one Initiative | Global administration |
| **Active Ally** | Collaboration status on an Initiative | Moderation power |
| **Blog Author / Trusted Author / Editor** | Publishing capabilities | Platform-wide admin |
| **AuthRole `admin`** | Current JWT privilege marker | License to read DMs or rewrite civic history |

---

## 6. Privileged-Capability Inventory (Repository Audit)

### 6.1 Authorization mechanisms in use today

| Mechanism | Storage / source | Used for |
|-----------|------------------|----------|
| JWT `AuthUserAccountRole` (`member` \| `admin`) | `auth_users.role` | Login privilege; Blog admin mapping; beta invites; civic nomination moderation |
| Typed `AuthRole` (`member` \| `moderator` \| `admin` \| `institution`) | Types + RequestIdentity | Broader than JWT persistence |
| Blog capability grants | Mongo `blog_capability_grants` | Author / Trusted Author / Editor / Administrator (Blog) |
| Initiative stewardship | Initiative `stewardId` | Owner/Author of that Initiative |
| Collaboration channel roles | Ally / Author context | Private Initiative chat access |
| Resource ownership | Comment author, media uploader, etc. | Self-service delete/edit |
| Automated Safety / media moderation | Providers | Machine gates — not human Admin roles |
| Operational health endpoints | Unauthenticated GET | Mail/outbox/mongo readiness (ops, not Admin Console) |

### 6.2 Role / capability surfaces discovered

| Surface | Who (today) | Check style | Notes |
|---------|-------------|-------------|-------|
| Blog draft create / own edit | Blog `author`+ | Capability | Workspace Publishing |
| Blog submit for review | Author | Capability + ownership | |
| Blog direct publish | Trusted Author / Editor / Admin | `canDirectPublish` | Safety still applies |
| Blog editorial review / publish / decline | Editor / Admin | `canEditorialPublish` | Workspace Editorial |
| Blog Safety `needs_review` override publish | Editor / Admin | Explicit route | Not silent |
| Blog Author applications decide | Editor / Admin | Capability | Existing APIs |
| Blog capability grants | Administrator (or JWT admin) | `canManageAuthorGrants` | High impact |
| Blog comment moderate (approve/remove pending) | Editor / Admin | Editorial capability | Pack 07 seam |
| Beta invites | JWT `admin` | Role string | `/api/v1/beta-invites` |
| Civic nomination publish/archive / vote session control | `admin` or `moderator` on RequestIdentity | Role string | Moderator rarely issuable via JWT today |
| Initiative Author actions | Steward | Ownership | Not global admin |
| Collaboration Channel / sessions | Steward or Active Ally | Context | Private — Admin NO |
| Direct Messaging | Conversation members only | Membership | Admin NO |
| Shared documents (private) | Context auth | Initiative/DM context | Admin NO by default |
| Notifications | Recipient self | Ownership | No admin broadcast |
| Preferences | Self | Auth | |
| Membership apply / activate | Self + payment | Not admin queue | |
| Media human moderation | **None implemented** | Automated provider | Future `media.review` |
| Institution manager | **None** | Typed `institution` role unused in JWT | Future scoped capability |
| Account disable | Status field + login block | **No admin API** | Future suspension pack |
| Profile suspended projection | Status hides public profile | **No admin API** | |
| Admin Console `/admin` | **Not implemented** | `apps/admin` empty stub | This architecture defines it |
| SITE_MAP `/admin/*` | Documented aspirational | Not live | Superseded by §37 routes |

### 6.3 Conflicts / duplication (must migrate carefully)

1. **AuthRole (4) vs AuthUserAccountRole (2)** — `moderator` / `institution` typed but not JWT-persisted.
2. **`moderator → Blog editor` mapping** exists in `blog-permissions.ts` but is mostly unreachable via real tokens.
3. **Member.roles** parallel Auth roles; API auth uses Auth/JWT, not Member.roles.
4. **JWT admin short-circuit** grants full Blog administrator capabilities without a grant row.
5. **Initiative stewardship** orthogonal to platform admin — correct; must stay that way.
6. **Normative Permission Model** vs string/capability hybrid in live code.
7. **Unauthenticated health endpoints** vs future privileged ops views.
8. **Member-badge fulfillment hooks** labeled future admin without current auth boundary.

---

## 7. Canonical Role Bundles (Target)

Human-facing bundles for Admin Console and docs. Each maps to capabilities — not separate user tables.

| Bundle | Nature | Primary scope |
|--------|--------|---------------|
| Participant | Baseline authenticated human | Self |
| Member | Honorary status | Self / public badge — **not Admin** |
| Author | Publishing | Own Blog drafts |
| Trusted Author | Publishing | Own Blog + direct publish (Safety permitting) |
| Editor | Publishing review | Blog editorial + Blog comment moderation |
| Moderator | Content moderation (future-first-class) | UGC / reports / comments — **not** grant management |
| Administrator | Platform operations | Capability grants, ops, exceptional workflows |

**Compatibility note (do not change production in Pack 01):**  
Today `AuthRole.moderator` maps to Blog Editor capabilities. Future architecture **separates** Moderator from Editor. Migration keeps the mapping as an explicit compatibility layer until Moderator capabilities exist and JWT/grant issuance supports them.

---

## 8. Administrator Boundaries

### May (when explicitly granted)

- Manage platform capabilities (with confirmation + reason + audit)
- Review Author applications (also Editor today — retain)
- Manage Editor / Moderator grants
- Access Admin Console tools
- Exceptional operational workflows that are product-approved and audited
- Read audit logs (`platform.audit.read`)
- View non-secret operational health

### Must NOT automatically

| Prohibited | Reason |
|------------|--------|
| Silently edit every civic record | Domain ownership + immutability |
| Rewrite published Lifecycle history | Historical integrity |
| Read ordinary private DMs / Initiative private chat / private shared docs | Privacy (§11) |
| Impersonate Participants | Trust (§12) |
| Bypass audit | Accountability |
| Alter votes / petition signatures invisibly | Civic integrity |
| Edit SMTP / API / DB secrets in UI | Secret management (§41) |
| Grant Administrator without confirmation + reason + audit | High impact (§60) |

---

## 9. Editor Boundaries

Scoped primarily to **Publishing**.

| Allowed | Not allowed |
|---------|-------------|
| Review Blog submissions | Manage capability grants (except Author applications as today) |
| Request changes / decline / editorial publish | Platform settings write |
| Moderate Blog comments | Account suspension |
| Explicit Safety needs_review publish where already product-approved | Global Moderator ≠ Editor forever (compat today) |
| Own drafts as Author-implied | Read private Messages |

Editor is **not** a global platform administrator.

---

## 10. Moderator Boundaries (Target)

| Allowed (target) | Not allowed |
|------------------|-------------|
| Content / comment / report moderation | Capability grant management |
| Queue pending UGC reviews | Blog editorial publish (unless also Editor) |
| Remove violating public UGC per policy | Account administration |
| | Lifecycle editing |
| | Administrator grant |

**Production Pack 01:** Do not change the current `moderator → editor` mapping. Document it as compatibility; separate in Foundation Pack 02+ migration.

---

## 11. Author / Trusted Author Boundaries

Preserve Blog model:

| Capability | Powers |
|------------|--------|
| Author | Own drafts; submit for review; own comment delete |
| Trusted Author | Direct publish when Safety accepts; still blocked on needs_review/rejected without editorial path |

No unrelated Admin powers (no grants, no membership admin, no DM access, no audit read).

---

## 12. Domain Ownership vs Administration Matrix

| Record / workflow | Domain Owner | Administrative Reviewer | Global Administrator |
|-------------------|--------------|-------------------------|----------------------|
| Initiative Lifecycle | Initiative Author (steward) | — (not global edit) | Ops exception only if separately designed; **no silent rewrite** |
| Blog draft | Blog Author | Editor (review) | Grant/ops; not default content rewrite |
| Blog published post | Blog Author (attribution) | Editor (archive / policy) | Same + restore archived |
| Blog comments | Comment author (own) | Editor / Moderator (policy) | Grant management only |
| Membership status | Participant (self) + payment | Future membership reviewer | Capability manage |
| Safety decision | System + human reviewer | Editor / Safety reviewer | Audit oversight |
| Direct Message | Conversation participants | **NO** | **NO** (default) |
| Initiative private chat | Author / Allies | **NO** | **NO** (default) |
| Civic Archive version | Derived / versioned domain | — | Additive correction only if exists |
| Petition signatures / votes | Participants (actions) | — | **NO invisible alteration** |

**Admin Console must not become a universal edit-everything interface.**

---

## 13. Private Communication Boundary (Mandatory)

Administration **must not** expose by default:

- Direct Messages
- Initiative Collaboration Channel (private chat)
- Private shared documents
- Private collaboration session notes beyond public projections

Any future exceptional legal/safety access requires:

1. Explicit product/legal policy  
2. Dedicated capability (e.g. `communications.exceptional_access`)  
3. Step-up authentication  
4. Immutable audit with reason  
5. Separate architecture pack  

**Not built in Pack 01. Not planned as ordinary Admin UI.**

---

## 14. Impersonation Policy

**No Participant impersonation.**

Admins cannot silently act as another Participant.

If ever reconsidered (out of scope):

- Explicit mode  
- Visible UI banner  
- Limited permissions  
- Full audit  
- No sensitive operations (messages, votes, grants)  

Current architecture: **no impersonation**.

---

## 15. Capability Grant Model (Target)

Generalize today’s `BlogCapabilityGrant` toward a platform grant:

```
grantId
participantId
capability          # e.g. blog.editor, platform.capability.manage
scopeType           # global | blog | institution | initiative | surface
scopeId?            # when not global
grantedByParticipantId
grantedAt
expiresAt?
revokedAt?
revokedByParticipantId?
reason?
source              # application | admin_console | bootstrap | migration | role_compat
```

### Migration path

| Phase | Action |
|-------|--------|
| A | Document + wrap existing checks (`resolveBlogCapabilities`, JWT admin, ownership) |
| B | Introduce canonical `CapabilityResolver` reading grants + compatibility adapters |
| C | Migrate domain-by-domain (Blog first — already closest) |
| D | Remove obsolete role short-circuits only after verified parity |

**Do not** big-bang rewrite authorization.

Existing `blog_capability_grants` remains authoritative for Blog until a generalized collection is introduced with dual-read.

---

## 16. Scoped Permission Catalog (Initial)

Use domain-aligned names. Not every capability is global.

| Capability / permission | Default scope | Notes |
|-------------------------|---------------|-------|
| `blog.author` | blog / self | Own drafts |
| `blog.trusted_author` | blog / self | Direct publish |
| `blog.editor` | blog | Editorial review |
| `blog.comment.moderate` | blog | Pack 07 seam |
| `blog.author_application.review` | blog | Applications |
| `blog.capability.manage` | blog | Author/Editor grants within Blog |
| `platform.capability.manage` | global | Cross-domain grants |
| `platform.admin` | global | Console access bundle (narrow) |
| `platform.audit.read` | global | Audit log read |
| `platform.settings.read` | global | Non-secret settings |
| `platform.settings.write` | global | Non-secret only; high impact |
| `platform.ops.health.read` | global | Mail/outbox readiness (authenticated) |
| `media.review` | media | Future human review |
| `safety.review` | safety surface | Human decision UI |
| `membership.review` | membership | Future |
| `participant.account.restrict` | participant | Future suspension |
| `beta.invite.manage` | platform | Maps today’s admin beta invites |
| `institution.moderate` | institution / global | Civic nomination ops today |

---

## 17. Least Privilege

Grant only the minimum authority required for the task.

Examples:

- Blog Editor does **not** receive `participant.account.restrict`, `platform.settings.write`, or `platform.capability.manage`.
- Moderator does **not** receive Blog publish or grant management.
- Administrator does **not** receive private message read by holding `platform.admin`.

---

## 18. Capability Dependencies (Explicit, Not Hidden)

| Capability | May imply | Must NOT imply |
|------------|-----------|----------------|
| `blog.trusted_author` | `blog.author` | `platform.admin` |
| `blog.editor` | `blog.author` (own drafts) | `platform.capability.manage` |
| `blog.administrator` (Blog) | editorial + authoring | Private DM access |
| `platform.capability.manage` | console access for grants | Safety silent override |
| JWT `admin` (compat) | Blog administrator set today | Permanent design — migrate to grants |

Avoid silent privilege escalation beyond documented implications.

---

## 19. Grant / Revocation Workflow

### Grant

```
Request or Admin decision
  → Authorization check (can manage this capability at this scope)
  → Persist grant
  → Emit audit event (append-only)
  → Notify recipient where appropriate
```

### Revocation

```
Authorized Admin
  → Reason (required for high impact)
  → Soft-revoke (revokedAt / revokedBy)
  → Audit
  → Notify where appropriate
```

**Do not** mutate roles/capabilities silently without audit.

---

## 20. Domain Integrations (Future Console → Existing Domains)

### 20.1 Author Applications

Reuse Author Access backend (`blog_author_applications`, decide APIs).  
Admin/Editor lists → open → approve / request changes / decline.  
**No second application system.**

### 20.2 Blog administration

Surfaces may include: Author Applications, Authors, Editorial Review, Published/Archived Posts, Comment Moderation.  
Data remains in Blog domain; UI calls Blog services.

### 20.3 Comment moderation

Reuse Blog Pack 07 seam: pending_review list, approve, remove.  
**Do not recreate comment persistence.**

### 20.4 Safety administration

Admin / Safety reviewer may see: content reference, surface, Safety state, review status, human decision, reason, timestamps.  

**Do not expose:** provider secrets, private model prompts, security-sensitive internals, raw provider payloads indiscriminately.

### 20.5 Media administration

Audit finding: human media moderator role **not implemented**; automated moderation exists for shared documents.  
Future: pending media queue using existing moderation architecture — **no new media domain**.

### 20.6 Membership administration

Self-service + payment activation today; no admin queue.  
Future Admin may support applications/status review **without** equating Membership to account access.  
Participant remains foundational identity.

### 20.7 Participant account administration

Allowed future ops (bounded projections): public/basic operational state, verification state, support-related flags, restriction/suspension when designed.  

**Not allowed:** unrestricted profile edit; browsing private fields without purpose; DM contents.

### 20.8 Suspension / restriction

`auth_users.status` includes `disabled` (login blocked); profile may be `suspended` for public projection.  
**No admin suspension API today — do not implement in Pack 01.**

Future requirements: reason, scope, start, expiry, issuer, appeal reference, audit. Prefer restriction over destructive deletion.

---

## 21. Delete / Archive Policy

| Mode | Use |
|------|-----|
| **Archive** | Preferred for publications and civic-facing records |
| **Soft delete** | Comments, removable UGC with structure retention |
| **Hard delete** | Rare; explicitly authorized; documented; audited |

Admin UI must not present generic destructive **Delete** everywhere.

---

## 22. Civic Record Immutability

Administrators must **not** silently rewrite:

- Published Lifecycle versions  
- Collective Decision results  
- Petition signatures / statistics  
- Civic Archive versions  
- Audit records  

Corrections use additive versioning / correction architecture where it exists — never hidden overwrite.

---

## 23. Audit Log Foundation

Every privileged mutation should answer: Who? What? When? Why? Target? Before? After? Correlation?

```
auditId
actorParticipantId
action
targetType
targetId
scope
reason?
beforeSummary?
afterSummary?
createdAt
correlationId?
sourceIpHash?     # only if justified
userAgent?       # only if justified
```

### Rules

- **Append-only** — ordinary UI cannot edit/delete audit history  
- **Minimize personal data** — no passwords, tokens, SMTP secrets, full private messages, full private documents, indiscriminate request bodies  
- **Visibility:** `platform.audit.read` (Administrator / dedicated Audit capability) — **not** automatic for Editor/Moderator  

---

## 24. High-Impact Confirmation

Future Admin Console distinguishes ordinary vs high-impact actions.

High-impact examples (require explicit confirmation + reason):

- Grant / revoke Administrator  
- Revoke Editor  
- Suspend / restrict account  
- Archive public content (policy cases)  
- Safety override publish  
- Platform settings write  

---

## 25. Notifications & Mail

| Event | Notify? |
|-------|---------|
| Author capability approved / revoked | Yes (in-app; email via preferences) |
| Application decision | Yes (existing) |
| Account restriction | Yes (when implemented) |
| Important editorial decision | Yes (existing Blog mail/notification) |
| Admin viewed a record | **No** |
| Queue sorting / search | **No** |

Reuse `MailDeliveryService` / notification pipeline.  
Admin Console must **not** send arbitrary SMTP mail.

---

## 26. Admin Session Security

| Topic | Requirement |
|-------|-------------|
| Authentication | Same Participant JWT/cookie model |
| Privileged session | Prefer shorter idle timeout for `/admin` (roadmap) |
| CSRF | Preserve existing cookie/CSRF protections |
| Re-auth / step-up | Recommended for high-impact actions (roadmap) |
| MFA | Do not invent in Pack 01; optional email two-step exists for users — future mandatory factors for admins documented in `docs/OPTIONAL_EMAIL_TWO_STEP_LOGIN.md` |
| Device revocation | Use existing session invalidation patterns when available |

### Step-up authentication (roadmap)

Evaluate for: grant administrator, suspend account, critical settings write.  
If unsupported today: document as security roadmap — **do not invent insecure pseudo-step-up**.

---

## 27. Future Admin Routes (Not Implemented)

Canonical UI root: **`/admin`**

```
/admin
/admin/authors                 # applications + grants (Blog)
/admin/editorial               # may deep-link or embed Editorial workflows
/admin/moderation              # comments / UGC / reports
/admin/media                   # pending media (when ready)
/admin/membership              # when review exists
/admin/participants            # operational account state (bounded)
/admin/audit
/admin/settings                # non-secret only
/admin/ops                     # read-only health
```

Keep the tree bounded. Do not implement pages in Pack 01.

Existing Workspace Editorial (`/workspace/editorial`) remains valid Authoring/Publishing UX; Admin Console is the platform ops home and may orchestrate the same domain APIs.

---

## 28. Admin API / Orchestration Boundary

Preferred:

```
Admin UI
  → Administration orchestration (thin, when needed)
  → Canonical domain services
```

Forbidden:

```
Admin UI → direct database mutation
```

Prefer reusing existing domain APIs with administrative authorization over duplicating business logic.

---

## 29. Dashboard Model

Operational, not vanity analytics.

Bounded cards (examples):

- Pending Author Applications  
- Pending Blog Reviews  
- Pending Comment Reviews  
- Pending Media Reviews (when exists)  
- Membership Reviews (when exists)  
- System Mail / Outbox health (non-secret)  

**No** engagement / popularity dashboards by default.

---

## 30. Platform Settings & Secrets

| Editable in Admin (future, carefully) | Never in Admin UI |
|---------------------------------------|-------------------|
| Public operational copy (if supported) | SMTP password |
| Safe feature flags (if architecture supports) | Gemini / AI API keys |
| Non-secret moderation thresholds (if safe) | Database URI |
| | JWT secrets / provider credentials |

Secrets remain deployment / server configuration.

---

## 31. Assistant in Admin

Assistant may explain queues, permissions, and workflows.  

Must **not**: grant/revoke, approve content, suspend accounts, Safety override, read private communications.

Use bounded authorized context only — no automatic dump of admin records into Gemini; no credentials; no DMs.

---

## 32. Translation & Search

- Admin UI may use Interface Language later.  
- Administrative records remain canonical.  
- Do not machine-translate audit facts into stored alternate truth.  
- Admin search is **scoped** (applications, posts, authorized operational Participant fields) — **not** Global Search plus hidden private data.

---

## 33. Privacy Matrix (Mandatory)

| Admin Surface | Data Needed | Data Not Allowed |
|---------------|-------------|------------------|
| Author Application | Application text, public identity, status, timestamps | DMs, private docs, unrelated profiles |
| Editorial Review | Submitted Blog post, Safety status, review history, Author public identity | Private chats, full auth secrets |
| Comment Moderation | Comment text, public author, post reference, Safety state | Reactor identity lists, DMs |
| Safety Review | Content reference, surface, outcome, human decision fields | Provider secrets, private prompts |
| Media Review | Media metadata, moderation state, uploader public id | Unrelated private files |
| Membership Review | Application/status fields needed for decision | Payment secrets, DMs |
| Participant Ops | Account status, verification flags, public uniqueName | Private messages, full profile dump |
| Audit | Action metadata, actor id, target refs, summaries | Passwords, tokens, message bodies |
| Settings | Non-secret config | All secrets (§30) |
| Ops Health | Provider readiness booleans, queue lag | Credentials, connection strings |

### Data minimization

Fetch only fields required for the current task. Use bounded projections — never return full Participant documents to every admin screen.

---

## 34. No Plugin Architecture

Humanity Union Admin should feel convenient, but architecture stays explicit.

**Do not build:** plugin loader, dynamic third-party admin widgets, runtime hook registry, WordPress-style extensions.

New administration capabilities are **first-party modules**.

---

## 35. Design System & Density

Reuse Design System Pack 01 (typography, buttons, forms, cards, banners, focus, colors).  

Admin may use denser lists/tables than public pages, but:

```
Clear queues + clear status + clear actions + clear audit
```

— not dozens of panels.

---

## 36. Bulk Actions, Errors, Concurrency, Events

| Topic | Rule |
|-------|------|
| Bulk destructive | **Not** by default (no bulk delete Participants, bulk grant Admin, bulk Safety approve) |
| Errors | unauthorized / forbidden / not found / stale conflict / validation / domain conflict / temporary — no stack traces/secrets |
| Concurrency | Reuse Editorial `expectedUpdatedAt` / version pattern for high-impact decisions |
| Events | Use existing domain events/outbox — **no separate Admin event bus** |

---

## 37. Operational Health Boundary

Read-only future surfaces: mail delivery health, outbox health, provider configuration **state** (not secrets), background processing state.  

Do not turn Admin Console into full infrastructure monitoring.

Today some health GETs are unauthenticated — migrate privileged views behind `platform.ops.health.read` in Foundation packs without breaking public readiness probes if product requires them.

---

## 38. Permission Matrix (Concrete)

Legend: **YES** = allowed when capability present; **OWN** = own resource only; **NO** = prohibited.

| Action | Participant | Author | Trusted Author | Editor | Moderator (target) | Administrator |
|--------|-------------|--------|----------------|--------|--------------------|---------------|
| Create own Blog draft | NO* | YES | YES | YES | NO | YES |
| Submit own Blog for review | NO | YES | YES | YES | NO | YES |
| Publish own Blog (direct) | NO | NO | YES† | YES† | NO | YES† |
| Review Blog / request changes / decline | NO | NO | NO | YES | NO | YES |
| Editorial publish reviewed Blog | NO | NO | NO | YES | NO | YES |
| Moderate Blog comments | NO | OWN delete | OWN delete | YES | YES | YES |
| Review Safety needs_review (Blog publish override) | NO | NO | NO | YES | NO | YES |
| Manage Author grants | NO | NO | NO | NO | NO | YES |
| Manage Editor grants | NO | NO | NO | NO | NO | YES |
| Manage Admin grants | NO | NO | NO | NO | NO | YES‡ |
| Review Author applications | NO | NO | NO | YES | NO | YES |
| Review Membership | NO | NO | NO | NO | NO | FUTURE |
| Moderate Media (human) | NO | NO | NO | NO | FUTURE | FUTURE |
| Read Audit | NO | NO | NO | NO | NO | YES |
| Manage Platform settings (non-secret) | NO | NO | NO | NO | NO | YES |
| View private DMs | **NO** | **NO** | **NO** | **NO** | **NO** | **NO** |
| View Initiative private chat | **NO** | OWN if steward/ally | same | **NO** | **NO** | **NO** |
| Edit published Lifecycle history | **NO** | Steward via Lifecycle rules only | — | **NO** | **NO** | **NO** silent rewrite |
| Impersonate Participant | **NO** | **NO** | **NO** | **NO** | **NO** | **NO** |
| Alter votes/signatures invisibly | **NO** | **NO** | **NO** | **NO** | **NO** | **NO** |

\* Participants may **apply** for authorship (not create drafts until Author).  
† Still subject to Safety (`needs_review` / `rejected` block silent publish).  
‡ Only existing Administrator + confirmation + reason + audit (§60).

---

## 39. Administrator Grant Rule

Granting Administrator is high risk:

1. Actor must already hold authorized Administrator (or controlled bootstrap)  
2. Explicit confirmation in UI  
3. Reason required  
4. Append-only audit  
5. Future step-up auth  

**Editor / Moderator cannot grant Administrator.**

---

## 40. Bootstrap Administrator Strategy

### Current reality

- No default `admin/admin` credentials  
- No automatic promotion of first registered user  
- JWT `admin` set via controlled insert (e2e/scripts) or operational DB change  
- Blog `grantBlogCapabilities` for Administrator requires existing administrator / JWT admin  
- Dev AuthIdentity bootstrap uses `member` — not admin  

### Preferred ongoing strategy

Controlled deployment / one-time bootstrap command or explicitly configured Participant ID with **one-time audited grant**.  

**Forbidden:** hardcoded passwords; silent first-user promotion; undocumented role flips.

---

## 41. Test Strategy (Future Packs)

Cover:

- Capability grants / revocation / scope  
- Authorization allow/deny  
- Privacy matrix (no DM leakage)  
- Audit append-only  
- No impersonation  
- No secret exposure in Admin APIs  
- High-impact confirmation required  
- Stale conflict (`expectedUpdatedAt`)  
- Compatibility: JWT admin ↔ grant dual-read during migration  

No production implementation required in Pack 01.

---

## 42. Implementation Roadmap

| Pack | Focus |
|------|--------|
| **Admin Foundation Pack 02** | Canonical Capability Resolver + immutable Audit foundation + wrap existing checks |
| **Admin Console Pack 03** | `/admin` shell + dashboard + Author Applications |
| **Admin Console Pack 04** | Blog Editorial / Comment Moderation (reuse Workspace + Pack 07 APIs) |
| **Admin Console Pack 05** | Membership / Media / Participant operational administration |
| **Admin Security Pack** | Step-up auth / high-impact controls / privileged session policy |
| **Moderator Separation Pack** | First-class Moderator capabilities; retire `moderator→editor` compat carefully |

Do not implement Pack 02 in this pack.

---

## 43. Compatibility

Admin Architecture must remain compatible with Blog, Lifecycle, Membership, Safety, Media, Notifications, Mail, Assistant, Translation, Community Intelligence, Workspace, Direct Messaging.

**No redesign of those domains is required** for Pack 01.

---

## 44. Explicit Non-Goals (Pack 01)

- No Admin Console UI pages  
- No production authorization behavior change  
- No second Participant identity  
- No private-message admin access  
- No impersonation  
- No plugin system  
- No suspension API implementation  
- No commit / staging  

---

## Document Control

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Pack | Admin Architecture Pack 01 |
| Next | Admin Foundation Pack 02 — Canonical Capability Resolver & Immutable Audit Foundation |
