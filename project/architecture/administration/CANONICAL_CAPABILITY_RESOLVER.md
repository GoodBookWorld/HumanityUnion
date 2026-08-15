# Canonical Capability Resolver

**Pack:** Admin Foundation Pack 02  
**Status:** Implemented (foundation)  
**Parent:** `ADMIN_ARCHITECTURE_v1.0.md`

---

## Purpose

Provide one authorization resolution path for privileged actions:

```
Administration / Domain call
        ↓
Capability Resolver
        ↓
Domain Authorization helpers (incremental adoption)
```

Pack 02 does **not** replace every existing Blog / Initiative ownership check.

---

## Capability flow

```
resolveParticipantCapabilities({ participantId, role? })
  1. Blog grants via resolveBlogCapabilities (unchanged Blog path)
       → map BlogCapability → PlatformCapabilityId
  2. Dual-read active platform_capability_grants
  3. JWT role compatibility (admin / moderator)
  4. Optional request-scoped cache (AsyncLocalStorage)
```

API:

| Function | Role |
|----------|------|
| `resolveParticipantCapabilities` | Full set |
| `hasCapability` / `hasAnyCapability` / `hasAllCapabilities` | Boolean checks |
| `assertCapability` / `assertAnyCapability` | Throw calm errors |
| `runWithCapabilityResolutionContext` | Request-scoped cache |

Module: `apps/api/src/modules/administration/`

---

## Capability catalog (Pack 02)

See `PLATFORM_CAPABILITY_IDS` in `packages/types/src/domain/administration.ts`.

Includes: `blog.*`, `media.review`, `membership.review`, `safety.review`, `platform.*`, `beta.invite.manage`, `institution.moderate`.

---

## Scope model

`CapabilityScopeType`: `global` | `blog` | `initiative` | `institution` | `surface`

- Existing behavior remains **global** when no scope is supplied.
- `initiative` / `institution` / `surface` require `scopeId` when a scope object is provided.
- Grant-level scope filtering will tighten in later packs; dual-read grants default to `global`.

---

## Ownership integration

Ownership remains **separate**:

- Initiative steward
- Blog post author
- Self profile / self resource

Helpers: `isOwner`, `assertOwnership`, `ownershipOf` in `ownership.ts`.

The resolver never treats ownership as an administrative capability.

---

## Grant abstraction (dual-read)

| Store | Status |
|-------|--------|
| `blog_capability_grants` | Authoritative for Blog (unchanged writes) |
| `platform_capability_grants` | New generalized grants; read merged into resolver |

Write path: `grantPlatformCapability` / `revokePlatformCapability` (requires `platform.capability.manage`).

No migration of Blog rows in Pack 02.

---

## Grant flow

```
Authorized actor
  → assertCapability(platform.capability.manage)
  → persist platform grant
  → AuditService.record(capability.grant)
```

Administrator grant additionally requires `platform.admin` + reason.

---

## Compatibility layer

| Source | Behavior |
|--------|----------|
| JWT `admin` | Blog administrator mapping (existing) + platform.* capabilities |
| JWT `moderator` | Blog editor mapping (existing) + `institution.moderate` |
| Blog grants | Mapped via `blog-capability-bridge.ts` |
| Blog helpers (`canEditorialPublish`, …) | **Unchanged** production Blog path |
| Ownership asserts | Unchanged |

No privilege escalation beyond existing JWT admin / Blog administrator semantics.

---

## Error model

| Error | Code |
|-------|------|
| `AdministrationUnauthorizedError` | `administration_unauthorized` |
| `AdministrationForbiddenError` | `administration_forbidden` |
| `AdministrationInsufficientCapabilityError` | `administration_insufficient_capability` |
| `AdministrationScopeMismatchError` | `administration_scope_mismatch` |

No stack traces in messages.

---

## Migration strategy

| Phase | Work |
|-------|------|
| A (done conceptually) | Document + wrap via resolver |
| B (this pack) | Resolver + dual-read grants + cache |
| C | Domain-by-domain adopt `assertCapability` |
| D | Remove obsolete role short-circuits after verified parity |

---

## Security guarantees

- No impersonation
- No automatic Administrator grants
- No second Participant identity
- Editor/Moderator cannot grant `platform.admin` without holding it
- Private communications are not capability-granted by this resolver
