# EPIC 02 REMEDIATION REPORT

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 02 — Global Experience

Version: 1.0

Status: Draft

---

# 1. Purpose

Record the **remediation work required** after the Epic 02 Implementation Review.

The Epic 02 Global Experience implementation is **architecturally approved** under conditional status.

Remaining work concerns **repository readiness** and **implementation completeness** — not architectural redesign.

The implemented World-level Global Experience conforms to `EPIC_02_ARCHITECTURE_FREEZE.md`.

Remediation closes the gap between conditional approval and full Epic closure.

Reference:

- `EPIC_02_IMPLEMENTATION_REVIEW.md`
- `EPIC_02_ARCHITECTURE_FREEZE.md`

---

# 2. Review Summary

## Implementation Status

**CONDITIONALLY APPROVED**

The final implementation review recorded:

- **No architectural drift** was identified.
- **Version 1 architecture remains fully preserved** — canonical block sequence, Context Before Evidence, projection boundary, narrative order, calm interaction model, and Sprint 6 accessibility/responsive fixes all conform to frozen documents.
- All seven canonical Experience Blocks and required global chrome are implemented at World scope on route `/`.
- Typecheck and route build verification **passed** at review time.
- Repository cleanliness and demo initiative navigation honesty remain open before full approval.

Architecture is sound.

Engineering closure is incomplete.

---

# 3. Remediation Items

## R1 — Repository Cleanliness

### Reason

The current repository contains **modified and untracked files** from the Epic 02 implementation slice.

At review time, uncommitted work included:

- `apps/web/src/features/global-experience/` (implementation)
- `capabilities/03_public_experience/` (architecture and plan documents)
- `packages/types/src/domain/public-participation-statistics.ts`
- `packages/types/src/domain/public-participation-pipeline.ts`
- `packages/types/src/domain/public-latest-initiatives.ts`
- Modified application entry files and type exports

Epic closure per `IMPLEMENTATION_PLAN.md` requires a committed, verifiable vertical slice.

### Required Action

Stage, commit, and verify:

```bash
git status
```

returns:

```
nothing to commit, working tree clean
```

Commit must include Epic 02 implementation, projection contract types, and Epic 02 documentation set referenced by the implementation review.

### Blocking

**YES**

---

## R2 — Demo Initiative Navigation Honesty

### Reason

Public initiative cards in **Latest Global Initiatives** must not imply destinations that do not yet exist.

At review time:

- Bootstrap card **`initiative-bootstrap-001`** resolves to a public initiative route when Capability 02 API is running.
- Demo cards **`initiative-bootstrap-demo-002`** and **`initiative-bootstrap-demo-003`** link to public initiative routes with **no matching Capability 02 bootstrap records** — producing HTTP 404 when clicked.

This violates explainable honesty for visible navigation targets even when bootstrap data is labeled.

Public initiative cards should never present resolvable-looking links to non-existent public records.

### Required Action

Ensure every visible navigation target either:

- **exists** — public route returns correct public projection content, or
- is **explicitly presented as future functionality** — not styled or linked as an active public destination.

Acceptable remediation paths (engineering choice — architecture unchanged):

- Limit Latest Initiatives list to initiatives with resolvable public records only, or
- Add matching Capability 02 bootstrap public initiative records for demo cards, or
- Present non-resolving cards without primary public detail links — clearly marked as demonstration-only.

### Blocking

**YES**

---

## R3 — Bootstrap Projection Integration

### Reason

Bootstrap public projections remain **temporary**.

At review time, Global Experience loaders for:

- Participation Public Statistics Projection
- Participation Pipeline Public Projection
- Latest Initiatives Public Projection

return static bootstrap data with honest `source: "bootstrap"` labeling.

Architectural projection contract types exist in `@hu/types`.

Capability 02 public projection API endpoints for aggregate World-scope blocks are not yet consumed.

### Required Action

Replace bootstrap loaders with **Capability 02 public projection APIs** when available.

Loader entry points in `apps/web/src/features/global-experience/projections/` shall swap data source without changing Experience Block composition or architectural contracts.

No block sequence, narrative, or presentation architecture changes are authorized by this remediation.

### Blocking

**NO**

Future engineering work only.

Does not block advancement to **APPROVED** after R1 and R2 are satisfied.

---

# 4. Verification Required

Before Epic 02 remediation is closed, verify:

| Check                      | Requirement                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| **Repository clean**       | `git status` — nothing to commit, working tree clean                                             |
| **Route `/` renders**      | Global Experience full block composition serves HTTP 200                                         |
| **Typecheck passes**       | `cd apps/web && npm run typecheck` — exit 0                                                      |
| **Navigation verified**    | Resolvable links work; non-existent targets explicitly marked or removed                         |
| **Architecture unchanged** | No block reordering, new blocks, or projection boundary violations introduced during remediation |

Remediation verification must not introduce architectural drift.

---

# 5. Expected Final State

After **R1** and **R2** are complete:

## Implementation Status

**APPROVED**

Epic 02 becomes the **canonical Version 1 Global Experience implementation** — Humanity Union's World-level public civic square at route `/`.

R3 may proceed as subsequent Capability 02 integration work without blocking Epic approval.

Update `EPIC_02_IMPLEMENTATION_REVIEW.md` status from **Review** / **CONDITIONALLY APPROVED** to **APPROVED** upon remediation closure.

---

# 6. Final Statement

The remaining work concerns **engineering completion** rather than **architectural correctness**.

No redesign is required.

Version 1 frozen architecture — block sequence, Context Before Evidence, observation-before-participation ethics, projection-only public data, and calm public interaction — is preserved in the implemented Global Experience.

Remediation closes repository and navigation honesty gaps.

It does not reopen architecture.

---

# Document Status

**Draft**

Epic 02 Remediation Report — Global Experience Version 1.0

Blocking items: **R1**, **R2**

Non-blocking follow-up: **R3**
