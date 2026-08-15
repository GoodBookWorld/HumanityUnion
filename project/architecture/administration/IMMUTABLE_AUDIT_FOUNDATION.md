# Immutable Audit Foundation

**Pack:** Admin Foundation Pack 02  
**Status:** Implemented (foundation)  
**Parent:** `ADMIN_ARCHITECTURE_v1.0.md`

---

## Purpose

Provide an append-only Administration Audit Log for privileged mutations.

Domains must not write audit documents through ad-hoc repositories.

```
Domain privileged action succeeds
        ↓
AuditService.record()  (or recordBestEffort)
        ↓
administration_audit_log (append-only)
        ↓
Outbox: AdministrationAuditRecorded (optional signal)
```

---

## Audit schema

```
auditId
actorParticipantId
action
targetType
targetId
scope { scopeType, scopeId? }
reason?
beforeSummary?
afterSummary?
createdAt
correlationId?
```

Type: `AdministrationAuditRecord` in `packages/types/src/domain/administration.ts`.

---

## Audit writer

```ts
import { AuditService } from "../administration/index.js";

await AuditService.record({ ... });
// or non-blocking for compatibility:
AuditService.recordBestEffort({ ... });
```

Forbidden:

- `AuditService.update` / `AuditService.delete` → throw `AdministrationAuditImmutableError`
- Direct collection `updateOne` / `deleteOne` from domain code

---

## Append-only guarantees

| Operation | Result |
|-----------|--------|
| Insert | Allowed |
| Update | Rejected |
| Delete | Rejected (ordinary path) |

Retention/legal deletion (if ever required) needs a separate controlled policy — not Admin UI.

---

## Sensitive data rules

`AuditService.record` rejects summaries/reasons that match credential-like patterns (password, SMTP, API key, bearer, Mongo URI, Authorization header).

Never store:

- passwords  
- SMTP credentials  
- API keys / JWT tokens  
- DM contents  
- private documents  
- full raw request bodies  

---

## High-impact actions (wired where practical)

| Action | Domain integration (Pack 02) |
|--------|------------------------------|
| Capability grant (Blog) | `grantBlogCapabilities`, Author approval grant |
| Author application decide | `decideBlogAuthorApplication` |
| Editorial publish | `publishBlogPostInternal` |
| Safety override publish | `publishBlogPostInternal` + `safety.override` |
| Archive Blog post | `archiveBlogPost` |
| Moderate Blog comment | `moderateRemoveBlogComment` |
| Platform grant / revoke | `grantPlatformCapability` / `revokePlatformCapability` |

Wiring uses **best-effort** recording so audit infrastructure failures do not change production Blog authorization behavior.

---

## Audit flow

```
Privileged mutation
  → persist domain state
  → emit domain events (existing)
  → AuditService.recordBestEffort / record
  → enqueue AdministrationAuditRecorded (outbox)
```

No second event infrastructure.

---

## Visibility (future Console)

Reading audit logs requires `platform.audit.read` (not automatic for Editor/Moderator).  
Pack 02 exposes service helpers for tests/foundation; no Admin UI.

---

## Migration strategy

1. Foundation store + writer (this pack)  
2. Expand wiring domain-by-domain  
3. Admin Console Pack later: audit browser with capability gate  
4. Never backfill secrets into historical rows  
