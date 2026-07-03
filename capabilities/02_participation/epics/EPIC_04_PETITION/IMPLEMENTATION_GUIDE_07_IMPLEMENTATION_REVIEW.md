# IMPLEMENTATION_GUIDE_07_IMPLEMENTATION_REVIEW

## Capability 02 — Participation

### Epic 04 — Petition

Guide 07 of 7

Version: 1.0

Status: Draft

Review Type: Final Implementation Review

---

# Purpose

Perform the final implementation review of Epic 04 — Petition.

This guide verifies that the implemented Petition vertical slice complies with:

- approved Epic 04 architecture;
- Guides 01 through 06;
- Humanity Union Engineering Methodology;
- Architecture Library standards;
- Participation Pipeline and Experience Architecture.

This document defines review criteria and records review outcomes.

It does not generate implementation.

---

# Review Scope

Review the complete vertical slice:

```
Domain (@hu/types)

↓

Behavior

↓

Store

↓

API

↓

Workspace

↓

Public Projection

↓

Platform Integration
```

Reference documents:

- `DOMAIN_MODEL.md`
- `DOMAIN_DECISIONS.md`
- `STATE_MACHINE.md`
- `WORKSPACE_SPECIFICATION.md`
- `PUBLIC_PROJECTION.md`
- `IMPLEMENTATION_GUIDE_01_DOMAIN.md`
- `IMPLEMENTATION_GUIDE_02_BEHAVIOR.md`
- `IMPLEMENTATION_GUIDE_03_STORE.md`
- `IMPLEMENTATION_GUIDE_04_API.md`
- `IMPLEMENTATION_GUIDE_05_WORKSPACE.md`
- `IMPLEMENTATION_GUIDE_06_PUBLIC_PROJECTION.md`
- `capabilities/02_participation/PARTICIPATION_PIPELINE.md`
- `project/architecture/experience/EXPERIENCE_ARCHITECTURE.md`
- `project/architecture/core/ENGINEERING_METHODOLOGY.md`
- `project/architecture/core/API_DESIGN_GUIDELINES.md`
- `project/architecture/core/PLATFORM_PATTERNS.md`

---

# Review Method

For each section evaluate:

- **Findings** — observed implementation state against approved guides
- **Strengths** — conforming areas
- **Risks** — gaps, drift or future regression points
- **Required Remediation** — mandatory fixes before approval
- **Verdict** — PASS, CONDITIONAL, or FAIL

Review is evidence-based.

No section may pass without verifying its guide criteria.

---

# 1. Domain

## Review Criteria

Verify:

- `Petition` aggregate root type exists in `@hu/types`
- `Signature`, `PetitionSubject`, `PetitionPolicy`, `ShareLink`, `SupportMetrics`, `PetitionOutcome`, lifecycle types exist
- `PublicPetitionProjection` type exists separately from operational types
- exports resolve through `packages/types/src/domain/index.ts`
- types contain no business logic, methods or runtime behavior
- terminology matches `DOMAIN_LANGUAGE.md`
- forbidden vote/ballot terminology absent
- `RegistrationGateway`, `ContributionRecognition`, `Next Meaningful Action` are not modeled as aggregate domain types

## Findings

- Architecture and Guide 01 define the expected domain structure completely.
- Implementation modules for Petition domain types are not present in the repository at review time.
- Pre-implementation architecture review identified terminology harmonization items still relevant during domain implementation.

## Strengths

- Clear aggregate model with explicit Signature and PetitionSubject entities.
- Derived SupportMetrics and PetitionOutcome separated from lifecycle states.
- Guide 01 explicitly excludes experience-boundary concepts from domain types.

## Risks

- Petition Result vs Petition Outcome naming may reappear in type or export names.
- SupportMetrics scope may expand beyond endorsement-relevant fields during implementation.
- PetitionSubject may be modeled as live Initiative mirror instead of published snapshot.

## Required Remediation

- Implement Guide 01 domain types before review pass.
- Resolve naming drift during domain implementation.
- Confirm PI-001 through PI-012 are representable in types without encoding behavior.

## Verdict

FAIL

---

# 2. Behavior

## Review Criteria

Verify command behavior matches `IMPLEMENTATION_GUIDE_02_BEHAVIOR.md`:

- `CreatePetition`, `PreparePetition`, `PublishPetition`, `OpenPetition`, `SignPetition`, `ClosePetition`, `ArchivePetition`
- lifecycle transitions match `STATE_MACHINE.md` only
- Signatures recorded only in `Open`
- one Signature per Participant per Petition
- Signature immutability preserved
- SupportMetrics and PetitionOutcome derived only
- domain events align with behavior guide where implemented
- external aggregates never mutated

## Findings

- Behavior guide is complete and Ready.
- No Petition behavior execution layer is present in the repository at review time.

## Strengths

- Explicit command catalog and validation flow.
- Business rules BR-001 through BR-008 map cleanly to architecture decisions.
- Idempotency expectations for duplicate signing are explicit.

## Risks

- Behavior logic may be accidentally placed in API controllers instead of aggregate execution layer.
- Published-state signing exceptions could drift from Version 1 rule unless guarded centrally.
- Conditional idempotency on lifecycle commands may be implemented inconsistently.

## Required Remediation

- Implement behavior-backed command execution before review pass.
- Add behavior verification cases for invalid transitions and duplicate signatures.

## Verdict

FAIL

---

# 3. Store

## Review Criteria

Verify against `IMPLEMENTATION_GUIDE_03_STORE.md`:

- bootstrap Petition linked to approved decision path
- CRUD: create, load, update, archive; no delete
- Signature append-only storage
- immutable Signature records
- derived SupportMetrics calculation
- derived PetitionOutcome derivation
- `structuredClone()` protection on all public reads
- repository operates on complete aggregates
- no business-rule duplication conflicting with behavior guide unless architecture explicitly assigns execution location

## Findings

- Store guide defines persistence responsibilities and repository expectations.
- No `apps/api/src/modules/petition/` store module exists at review time.

## Strengths

- Store guide clearly separates persistence from API and workspace concerns.
- Immutable record rules and derived value expectations are explicit.
- Bootstrap shape aligns with participation pipeline bootstrap ids.

## Risks

- Store may expose mutable internal references if clone discipline is skipped.
- Manual writes to derived fields could bypass derivation rules.
- Duplicate Signature persistence may occur if store-level uniqueness guard is omitted.

## Required Remediation

- Implement Guide 03 store module with bootstrap `petition-bootstrap-001`.
- Verify all reads return cloned aggregates.

## Verdict

FAIL

---

# 4. API

## Review Criteria

Verify against `IMPLEMENTATION_GUIDE_04_API.md` and `API_DESIGN_GUIDELINES.md`:

- operational routes under `/api/v1/petitions`
- public routes under `/api/v1/public/petitions`
- standard GET list/detail and PATCH preparatory update
- lifecycle POST commands: prepare, publish, open, close, archive
- signature POST command
- integration lookups by collective decision and initiative
- Thin API: validate, invoke store/behavior, map response
- standard response envelope
- operational and public DTO separation
- no external aggregate mutation through Petition routes

## Findings

- API guide defines operational and public separation completely.
- No Petition API routes, controllers, mappers or validators exist at review time.

## Strengths

- Command-oriented endpoints match behavior guide exactly.
- Public route read-only expectations are explicit.
- Error philosophy and HTTP expectations align with platform standards.

## Risks

- Operational aggregate serialization may be exposed directly without mapper filtering.
- Public endpoint may leak participant signed state or Signature arrays.
- Draft and Ready petitions may become publicly accessible if lifecycle guard is omitted.

## Required Remediation

- Implement Guide 04 API layer.
- Confirm public endpoint uses projection builder only.

## Verdict

FAIL

---

# 5. Workspace

## Review Criteria

Verify against `IMPLEMENTATION_GUIDE_05_WORKSPACE.md` and `WORKSPACE_SPECIFICATION.md`:

- workspace route resolves by `petitionId`
- information hierarchy matches specification
- Endorsement Panel is canonical sign surface
- five workspace questions always answerable
- Decision Context precedes signing pressure
- Contribution Recognition after successful sign
- one Next Meaningful Action only
- secondary actions subordinate
- community and public entry paths use one workspace model
- empty, loading and completion states behave as specified
- workspace consumes operational API only

## Findings

- Workspace implementation guide and architecture specification are complete.
- No Petition workspace route or feature module exists at review time.

## Strengths

- Strong alignment with Experience Architecture workspace standard.
- Explicit anti-engagement prohibitions preserved in guide criteria.
- Contextual participation behavior documented without workspace fork.

## Risks

- Multiple signing surfaces may appear outside Endorsement Panel.
- Next Meaningful Action may degrade into generic action menus.
- Decision Context may be omitted, weakening Understanding Before Action.
- Loading state may flash incorrect sign eligibility.

## Required Remediation

- Implement Guide 05 workspace.
- Verify workspace uses operational API command for signing only.

## Verdict

FAIL

---

# 6. Public Projection

## Review Criteria

Verify against `IMPLEMENTATION_GUIDE_06_PUBLIC_PROJECTION.md` and `PUBLIC_PROJECTION.md`:

- `PublicPetitionProjection` type and builder exist
- `GET /api/v1/public/petitions/:petitionId` returns projection DTO only
- public information model fields present
- approved decision context visible
- Share Link exposed from Published onward
- aggregate public statistics only in Version 1
- no individual signer identity exposure
- participation entry guidance distinguishes view, share, register and sign
- Draft and Ready not public in Version 1 default
- public route read-only

## Findings

- Public projection guide and architecture spec are complete.
- No public Petition projection builder or public route exists at review time.

## Strengths

- Privacy boundaries and transparency principles are explicit.
- Cross-projection relationship rules prevent operational leakage.
- Share Link and Registration Gateway behavior clearly separated from projection data model.

## Risks

- Public endpoint may serialize operational DTO directly.
- SupportMetrics may expose non-public operational counters.
- Missing decision context may weaken Decision Before Support on public surface.

## Required Remediation

- Implement Guide 06 projection type, builder and public route.
- Verify public privacy defaults before approval.

## Verdict

FAIL

---

# 7. Aggregate Boundaries

## Review Criteria

Verify:

- Petition owns Signatures, policy, lifecycle, derived metrics and outcome only
- Petition references Collective Decision and Initiative by id and snapshot only
- Petition never modifies Initiative, Collaborative Analysis or Collective Decision
- Collective Decision does not auto-create Petition
- Implementation Commitment is not absorbed into Petition
- Community and Public participation share one aggregate and one Signature model

## Findings

- Aggregate boundaries are clearly defined across architecture and guides.
- Implementation required to prove boundaries at runtime is not present at review time.

## Strengths

- Domain Decisions 01, 03, 07 and 08 provide strong boundary protection.
- API and workspace guides repeat boundary constraints consistently.

## Risks

- Integration shortcuts may mutate or fetch-write external aggregates.
- Workspace or public projection may embed operational external aggregate graphs.
- Eligibility logic may create hidden coupling that erodes independence.

## Required Remediation

- Verify no Petition command or store path writes external modules.
- Verify referenced context uses read-only fetches only.

## Verdict

FAIL

---

# 8. Participation Pipeline Integration

## Review Criteria

Verify:

- Petition begins only after Approved Collective Decision eligibility
- pipeline stage presentation shows Petition within Collective Participation Journey
- Petition follows Decision stage and precedes Implementation Commitment conceptually
- bootstrap vertical slice links Initiative → Analysis → Decision → Petition ids
- integration lookups connect stages without merging aggregates

## Findings

- `PARTICIPATION_PIPELINE.md` and Epic architecture define stage position clearly.
- Pipeline integration implementation is not present at review time.
- Bootstrap decision in repository may still require Approved Outcome path for Petition creation verification.

## Strengths

- Pipeline vocabulary consistent across architecture, workspace and public projection guides.
- Decision Before Support enforced architecturally and in behavior guide.

## Risks

- Petition bootstrap may exist without verified Approved Outcome gate.
- Journey UI may show future stages inaccurately relative to actual eligibility.
- Implementation Commitment language may leak into Petition outcome presentation.

## Required Remediation

- Implement platform integration bootstrap path for Petition.
- Verify eligibility gate against Collective Decision Approved Outcome.

## Verdict

FAIL

---

# 9. Experience Architecture Compliance

## Review Criteria

Verify against `EXPERIENCE_ARCHITECTURE.md`:

- workspace answers five standard questions
- Collective Participation Journey presented
- one Next Meaningful Action only
- Contribution Recognition confirms action not personal worth
- Contextual Participation uses one workspace for community and public entry
- calm participation; no engagement manipulation
- Registration Gateway presented as entry boundary, not domain state
- Participation Navigator logic not owned by Petition aggregate

## Findings

- Experience Architecture and Guide 05/06 encode required experience behaviors.
- Implemented experience surfaces do not exist at review time.

## Strengths

- Experience standards extracted from Epic 04 are documented and reviewable.
- Recognition and Next Meaningful Action rules are explicit and testable.

## Risks

- UI copy may introduce moral praise, urgency or ranking despite guides.
- Public and operational experiences may converge accidentally.
- Local navigator fallback may diverge once platform navigator arrives.

## Required Remediation

- Review workspace and public copy against approved recognition examples.
- Verify one primary recommendation in workspace at all stable states.

## Verdict

FAIL

---

# 10. Platform Standards Compliance

## Review Criteria

Verify compliance with:

- Platform Aggregate Pattern
- Thin API
- Explicit Publicity
- Derived State
- Progressive Bootstrap
- Historical Integrity
- Human Leadership
- Command-Oriented API
- Operational vs Public View separation
- Engineering Methodology guide sequence 01 through 07

## Findings

- Epic 04 guides follow established Epic 01–03 vertical slice pattern.
- Implementation evidence for platform standard compliance is not present at review time.

## Strengths

- Guide sequence mirrors Engineering Methodology.
- Architecture library references are explicit in every implementation guide.
- Public Endorsement pattern aligns with Capability Pipeline extension without aggregate duplication.

## Risks

- Skipped guides or partial slice delivery may weaken standard compliance.
- Derived values may be edited manually in store or API layers.
- Bootstrap pattern may be bypassed by ad hoc seed logic.

## Required Remediation

- Complete Guides 01 through 06 in order before final review.
- Confirm standard response envelope and versioning on all new endpoints.

## Verdict

FAIL

---

# 11. Repository Cleanliness

## Review Criteria

Verify:

- Epic 04 implementation changes are committed or intentionally staged as one engineering cycle
- no unrelated modifications mixed into Epic 04 slice without justification
- documentation updates synchronized with implementation completion
- git status clean or clearly documented pending commit at review closure

## Findings

- Epic 04 architecture documents and implementation guides exist.
- Petition implementation code is absent.
- Repository contains broader uncommitted platform work from prior epics per project state.

## Strengths

- Epic 04 documentation set is substantially complete before implementation begins.
- Separate architecture review and implementation review documents preserve review discipline.

## Risks

- Mixed uncommitted changes across epics may obscure Epic 04 review scope.
- Documentation may claim completion before implementation review passes.
- Missing command center updates after implementation may desynchronize project status.

## Required Remediation

- Complete implementation first.
- Commit Epic 04 vertical slice as one engineering cycle after review pass.
- Synchronize capability documentation when implementation is approved.

## Verdict

FAIL

---

# 12. Verification

## Review Criteria

Run and record:

### Typecheck

```
pnpm typecheck
```

Equivalent:

```
tsc --noEmit
```

Expected:

PASS

### Repository State

```
git status
```

Expected at approval:

```
working tree clean
```

or documented intentional pending commit with user approval.

### HTTP Verification

Expected HTTP 200 for bootstrap vertical slice:

| Surface | Expected Route | Expected |
|---------|----------------|----------|
| Petition Workspace | `/petitions/petition-bootstrap-001` | 200 |
| Public Petition | `/petitions/public/petition-bootstrap-001` | 200 |

Adjust route prefixes only if app routing differs, but both surfaces must resolve successfully.

Optional API verification:

| Endpoint | Expected |
|----------|----------|
| `GET /api/v1/petitions/petition-bootstrap-001` | 200 |
| `GET /api/v1/public/petitions/petition-bootstrap-001` | 200 |

### Aggregate Invariants

Verify PI-001 through PI-012 from `STATE_MACHINE.md`.

### Signature Immutability

Verify:

- append-only Signatures;
- no edit/delete path;
- duplicate sign rejected.

### Registration Gateway Behavior

Verify:

- public projection exposes registration guidance;
- signing requires registered participation path;
- public visitor may read and share without registration;
- post-registration continuity into Petition workspace preserved.

### Public / Operational Separation

Verify:

- distinct endpoints;
- distinct DTOs;
- public surface hides participant-private data;
- workspace uses operational API as authority.

### Contribution Recognition Messages

Verify approved examples only:

- "Your signature has been recorded."
- "Your participation contributes to public support."
- "Thank you for supporting this Petition."

Verify prohibited moral ranking language absent.

### Next Meaningful Action Presentation

Verify:

- one primary recommendation only;
- state-aware recommendation;
- secondary actions subordinate;
- no urgency or gamification framing.

## Findings

- Verification protocol is defined.
- Verification results cannot pass until implementation exists.

## Strengths

- Verification covers type safety, runtime pages, invariants and experience rules.
- Bootstrap ids align with participation pipeline continuity.

## Risks

- HTTP verification may pass while API boundary or privacy rules fail if pages use stale mock data.
- Typecheck pass alone is insufficient for approval.

## Required Remediation

- Execute full verification block after Guides 01–06 implementation.
- Record results in this document before changing Status to APPROVED.

## Verdict

FAIL

---

# Review Summary

| Area | Verdict |
|------|---------|
| Domain | FAIL |
| Behavior | FAIL |
| Store | FAIL |
| API | FAIL |
| Workspace | FAIL |
| Public Projection | FAIL |
| Aggregate Boundaries | FAIL |
| Participation Pipeline Integration | FAIL |
| Experience Architecture Compliance | FAIL |
| Platform Standards Compliance | FAIL |
| Repository Cleanliness | FAIL |
| Verification | FAIL |

---

# Cross-Cutting Remediation

Before Epic 04 may be approved:

1. Implement Guides 01 through 06 in order.
2. Resolve pre-implementation architecture terminology items during domain and public copy implementation.
3. Wire bootstrap Petition to approved Collective Decision eligibility path.
4. Execute verification block and update this document with evidence.
5. Commit Epic 04 vertical slice upon approval.

---

# Approval Criteria

Epic 04 implementation may move to APPROVED only when:

- all section verdicts are PASS or justified CONDITIONAL with remediation complete;
- `pnpm typecheck` passes;
- Petition Workspace and Public Petition bootstrap pages return HTTP 200;
- aggregate invariants and Signature immutability verified;
- public and operational separation verified;
- Contribution Recognition and Next Meaningful Action rules verified;
- repository cleanliness criterion satisfied;
- documentation synchronized with implemented state.

---

# Implementation Status

Epic 04 implementation guides and architecture are in place.

The Petition vertical slice implementation has not been completed.

Verification has not been executed against running implementation.

## Status

REMEDIATION REQUIRED

---

# Final Principle

Epic 04 succeeds when Public Endorsement is implemented as a complete vertical slice that preserves aggregate independence, public transparency, participant accountability and civic continuity across the Participation Pipeline.

Implementation review exists to confirm the slice is real, verifiable and architecturally faithful—not merely documented.
