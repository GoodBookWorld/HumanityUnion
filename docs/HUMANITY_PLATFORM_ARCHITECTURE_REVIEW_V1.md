# Humanity Platform Architecture Review v1.0

**Review date:** 2026-07-06  
**Scope:** Humanity Union Platform Version 1.0 — Capability 02 civic ecosystem baseline  
**Review type:** Engineering and architectural audit (TASK-048)  
**Production code changes:** None

---

## Executive Summary

Humanity Union Platform v1.0 has reached a **coherent civic ecosystem baseline**. The initiative-centric Capability 02 pipeline is implemented end-to-end — from initiative creation through collaborative analysis, collective decision, civic action package issuance, delivery, official response, accountability, implementation tracking, public impact, and public civic archive. The workspace, public experience, Capability02 integration layer, civic assistant shell, and Humanity Design System form a unified platform surface.

The architecture is **sound for continued Capability development**, with clear module boundaries, consistent public/private separation, reference-only integration, and strong privacy discipline on sensitive projections. Three manageable import cycles exist between tightly coupled lifecycle stages. Legacy parallel modules (petition, generic collective-decision, legacy implementation) coexist with the initiative-scoped pipeline but do not block forward progress.

**Primary gaps** are documentation drift, workspace section ordering inconsistencies, Civic Delivery and Civic Compatibility Review not fully integrated into the Capability02 integration layer entity model, generational UI duplication from legacy standalone workspaces, and boilerplate duplication across route and service layers.

**Architecture Decision: APPROVED WITH RECOMMENDATIONS**

Future Capability development may proceed. Recommended follow-up tasks address integration completeness, documentation synchronization, workspace ordering, and legacy module consolidation — none of which block the current baseline.

---

## Architecture Score

| Dimension                 | Score      | Notes                                                                    |
| ------------------------- | ---------- | ------------------------------------------------------------------------ |
| Module integrity          | 82/100     | Clear ownership; 3 import cycles; legacy parallel modules                |
| Pipeline completeness     | 78/100     | Full lifecycle implemented; integration layer omits Civic Delivery stage |
| Public/private separation | 90/100     | Consistent route prefixes and projection gates                           |
| Privacy                   | 88/100     | Strong type contracts; runtime asserts on sensitive modules              |
| Workspace readiness       | 85/100     | Unified UX; section order quirk; legacy workspace coexistence            |
| Public experience         | 87/100     | Well-tiered; read-oriented; minimal workspace coupling                   |
| Integration layer         | 80/100     | Reference-only; search metadata ready; delivery gap                      |
| Design system             | 83/100     | Foundation complete; features still use workspace-ux primarily           |
| Documentation             | 55/100     | Governance arch current; root docs significantly stale                   |
| Future readiness          | 75/100     | Good contracts; persistence and auth not production-grade                |
| **Overall**               | **79/100** | Stable baseline with documented improvement path                         |

---

## Strengths

### 1. Initiative-centric civic pipeline

The platform implements a complete civic lifecycle anchored on `Initiative`. Each stage has dedicated domain types, store, service, eligibility rules, public projection, and workspace section. Transition integrity is enforced through status guards and eligibility assessors.

### 2. Reference-only integration layer

`capability02-integration` aggregates read-only views — pipeline status, breadcrumbs, related records, search metadata — without duplicating business logic or data storage. This is the correct architectural pattern for cross-entity navigation.

### 3. Public/private separation

Private routes (`/api/v1/*`) require authentication. Public routes (`/api/v1/public/*`) return sanitized projections only. `canExposePublicInitiativeProjection()` gates public access uniformly with 404 (not 403) to avoid information leakage.

### 4. Privacy discipline

Public projections resolve internal IDs to display names. Individual vote records remain in the private `initiative-decision-vote` store. Runtime privacy assertions exist on collective decision results, civic action packages, civic delivery, official response, and civic accountability projections.

### 5. Workspace UX consistency

`initiative-workspace-ux` provides standardized section shells, empty states, loading/error states, deferred actions, badges, and public links. All major pipeline workspace sections adopt `WorkspaceSectionShell`.

### 6. Design system foundation

TASK-047 established official tokens (`#0174B0` primary), global sticky header/footer, workspace sticky navigation and assistant alignment, and shared component exports. Verified by `npm run verify:design-system`.

### 7. Verification culture

20+ domain-specific verify scripts plus design system and workspace UX verification provide repeatable architectural checks. This supports safe incremental development.

### 8. Notification registry contract

16 pipeline events are registered in `CIVIC_NOTIFICATION_EVENT_REGISTRY` with entity type bindings, ready for future notification delivery without schema redesign.

### 9. Search readiness

`CivicSearchMetadata` is defined and built by the integration service for all public entity types, providing title, summary, geo facets, status, and public URL — sufficient for future global search indexing.

### 10. Assistant safety architecture

The workspace assistant uses a provider abstraction, mock engine, safety guard, confidence levels, and safety notices. The assistant is explicitly advisory — it suggests but never executes consequential actions.

---

## Weaknesses

### 1. Civic Delivery not in integration entity model

`civic-delivery` is a fully implemented module with API routes, persistence, workspace section, and public projection — but it is **not** a `CivicEntityType`, **not** in `PIPELINE_STAGE_ORDER`, and **not** in the notification registry. The integration layer jumps from Civic Action Package to Official Response, skipping delivery as a pipeline stage.

### 2. Civic Compatibility Review outside integration pipeline

The compatibility review module exists with workspace section and API routes but is not represented in the Capability02 integration entity model or pipeline status widget.

### 3. Workspace section ordering mismatch

`INITIATIVE_WORKSPACE_SECTIONS` places **Decision Session** (section 17) after the full execution pipeline and Civic Integration, despite logically preceding Decision Result (section 8). This creates cognitive dissonance for stewards navigating the civic lifecycle.

### 4. Legacy parallel modules

Six legacy modules (`petition`, `collaborative-analysis`, `collective-decision`, `implementation-commitment`, `implementation`, plus generic variants) coexist with initiative-scoped equivalents. Legacy standalone workspaces remain in the web app, bridged by `View*Link` components.

### 5. Generational UI duplication

Two workspace generations coexist: legacy standalone pages (`/petitions/[id]`, `/collective-decisions/[id]`) and initiative-embedded sections. Duplicate patterns include pipeline stage status helpers, assistant panels, initiative context sections, and geographic navigators.

### 6. Design system thin adoption in features

`initiative-workspace-ux` remains the de facto component layer. Design system primitives (`Card`, `ContextPanel`, `PipelineStage`, etc.) are exported but largely unused in feature code. Design system re-exports workspace-ux rather than being the single source of truth.

### 7. Documentation drift

Root `docs/` files (`SITE_MAP.md`, `TECH_STACK_DECISION.md`, `DOMAIN_MODEL.md`) describe a pre-v1 product vision. `PARTICIPATION_ARCHITECTURE_FREEZE.md` still claims Public Impact is unimplemented. No Phase 02 engineering guides exist for completed capabilities.

### 8. Route and service boilerplate duplication

40+ route files duplicate error handling, param normalization, and status resolution. Service layers repeat ownership checks, transition guards, and draft-editability assertions across all pipeline modules.

---

## Risks

| Risk                                               | Severity          | Impact                                                                  | Mitigation path                                                               |
| -------------------------------------------------- | ----------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Civic Delivery invisible in pipeline status        | Medium            | Stewards cannot see delivery as a pipeline stage in integration widgets | Add `civic_delivery` to entity types and pipeline order (future task)         |
| Import cycles between lifecycle modules            | Low–Medium        | Complicates testing and module extraction                               | Introduce event/outbox pattern or shared orchestrator (future refactor)       |
| Legacy modules confuse new contributors            | Medium            | Developers may use wrong module for new features                        | Document canonical vs legacy; deprecate legacy routes (future task)           |
| Memory-only persistence                            | High (production) | No durability, no horizontal scaling                                    | MongoDB migration per TECH_STACK_DECISION (planned, not blocking v1 baseline) |
| Bootstrap auth                                     | High (production) | No real JWT, no session security                                        | Auth implementation per Phase 01 Guide 16 follow-up                           |
| Documentation staleness                            | Medium            | Incorrect onboarding and architectural decisions                        | Sync docs task series (TASK-049+)                                             |
| Workspace section order                            | Low               | Navigation confusion for stewards                                       | Reorder sections to match pipeline (UX task)                                  |
| Missing runtime privacy asserts on all projections | Low               | Mapper discipline only on some modules                                  | Extend assert pattern to all public projections                               |

No **critical** architectural defects were found that require immediate production code changes.

---

## Technical Debt

### Critical

None identified that block the v1.0 baseline. Production deployment concerns (persistence, auth) are known planned work, not architectural defects.

### High

| Item                           | Why                                                         | Impact                     | Recommended future task     |
| ------------------------------ | ----------------------------------------------------------- | -------------------------- | --------------------------- |
| Memory-only persistence        | All 17 domain modules use file/memory adapters, not MongoDB | No production durability   | Database migration epic     |
| Bootstrap authentication       | Temporary identity model, no JWT                            | No production security     | Real auth implementation    |
| Civic Delivery integration gap | Module exists but not in integration entity model           | Pipeline status incomplete | Integration layer extension |

### Medium

| Item                       | Why                                                     | Impact                                          | Recommended future task         |
| -------------------------- | ------------------------------------------------------- | ----------------------------------------------- | ------------------------------- |
| Legacy module coexistence  | Two parallel domain stacks                              | Developer confusion, duplicate maintenance      | Legacy deprecation plan         |
| Route/service boilerplate  | Copy-paste across 40+ files                             | Maintenance burden, inconsistent error handling | Shared route helpers middleware |
| Workspace section ordering | Decision Session after execution pipeline               | UX confusion                                    | Workspace reorder task          |
| Documentation drift        | Root docs describe pre-v1 vision                        | Onboarding errors                               | Documentation sync sprint       |
| Import cycles (3)          | Tight coupling between lifecycle stages                 | Testing complexity                              | Orchestrator extraction         |
| Design system adoption gap | Features use workspace-ux, not design-system primitives | Two component layers                            | Incremental migration           |

### Low

| Item                                       | Why                                        | Impact                 | Recommended future task           |
| ------------------------------------------ | ------------------------------------------ | ---------------------- | --------------------------------- |
| Duplicate geographic navigators            | 4 near-identical components                | CSS/markup maintenance | Shared navigator component        |
| `/member` page inconsistency               | No workspace shell                         | Visual inconsistency   | Migrate to MemberWorkspace        |
| Mobile drawer navigation                   | Planned but not implemented                | Mobile UX incomplete   | Responsive drawer task            |
| `publicUrlForEntity` vs local URL builders | Duplicated URL logic in 2 projection files | Minor inconsistency    | Centralize in integration service |
| Notification registry delivery             | Contract only, no delivery                 | No notifications yet   | Notification engine capability    |

---

## Scalability Assessment

### Current state

The platform uses in-memory/file persistence with per-module JSON snapshots in `apps/api/.runtime/`. Integration views perform multiple store scans per request — acceptable at current scale but will not scale to large initiative volumes without indexing.

### Performance observations (report only — no optimization performed)

| Area                                  | Observation                                                       |
| ------------------------------------- | ----------------------------------------------------------------- |
| `buildIntegrationView()`              | Scans 12+ stores per entity; repeated initiative artifact listing |
| `buildInitiativePipelineCompletion()` | Lists all stage artifacts for an initiative on each call          |
| Decision session packaging            | Duplicates artifact aggregation logic from integration service    |
| CAP content building                  | Re-counts analyses, proposals, revisions independently            |
| Public projection mappers             | `getMemberById()` called per record for display name resolution   |
| File persistence                      | Atomic writes via `.tmp` rename — safe but single-process         |

### Scalability readiness

| Concern                | Readiness        | Notes                                        |
| ---------------------- | ---------------- | -------------------------------------------- |
| Horizontal API scaling | Not ready        | File persistence is process-local            |
| Database indexing      | Not ready        | No database layer                            |
| Search indexing        | Ready (contract) | `CivicSearchMetadata` defined; no engine yet |
| CDN/static assets      | Ready            | Next.js static generation for public pages   |
| Multi-region           | Not ready        | No geo-distributed persistence               |
| Caching                | Not implemented  | Integration views rebuild on every request   |

---

## Capability02 Completeness

### Implemented and verified

| Capability                 | API | Public projection | Workspace | Verify script                               |
| -------------------------- | --- | ----------------- | --------- | ------------------------------------------- |
| Initiative lifecycle       | ✓   | ✓                 | ✓         | (multiple)                                  |
| Collaborative Analysis     | ✓   | ✓                 | ✓         | verify:collective-intelligence              |
| Improvement Proposal       | ✓   | ✓                 | ✓         | verify:collective-intelligence              |
| Initiative Revision        | ✓   | ✓                 | ✓         | verify:collective-intelligence              |
| Civic Compatibility Review | ✓   | ✓                 | ✓         | verify:civic-compatibility-review           |
| Decision Session           | ✓   | ✓                 | ✓         | verify:decision-session                     |
| Collective Decision        | ✓   | ✓                 | ✓         | verify:collective-decision                  |
| Participation Eligibility  | ✓   | —                 | —         | verify:participation-eligibility            |
| Vote Engine                | ✓   | aggregates only   | —         | verify:vote-casting                         |
| Transparent Results        | ✓   | ✓                 | ✓         | verify:transparent-decision-results         |
| Civic Action Package       | ✓   | ✓                 | —         | verify:civic-action-package                 |
| Civic Delivery             | ✓   | ✓                 | ✓         | verify:civic-delivery                       |
| Official Response          | ✓   | ✓                 | ✓         | verify:official-response                    |
| Civic Accountability       | ✓   | ✓                 | ✓         | verify:civic-accountability                 |
| Implementation Commitment  | ✓   | ✓                 | ✓         | verify:initiative-implementation-commitment |
| Implementation Tracking    | ✓   | ✓                 | ✓         | verify:initiative-implementation-tracking   |
| Public Impact              | ✓   | ✓                 | ✓         | verify:public-impact                        |
| Public Civic Archive       | ✓   | ✓                 | ✓         | verify:civic-archive                        |
| Capability02 Integration   | ✓   | ✓                 | ✓         | verify:capability02-integration             |
| Workspace Civic Assistant  | ✓   | —                 | ✓         | verify:workspace-civic-assistant            |
| Assistant Engine           | ✓   | —                 | ✓         | verify:workspace-assistant-engine           |

### Integration layer entity coverage

| Entity                         | In `CivicEntityType` | In pipeline stages | In notification registry |
| ------------------------------ | -------------------- | ------------------ | ------------------------ |
| Initiative                     | ✓                    | ✓                  | ✓                        |
| Analysis                       | ✓                    | ✓                  | ✓                        |
| Improvement Proposal           | ✓                    | ✓                  | ✓                        |
| Initiative Revision            | ✓                    | ✓                  | ✓                        |
| Decision Session               | ✓                    | ✓                  | —                        |
| Collective Decision            | ✓                    | ✓                  | ✓                        |
| Civic Action Package           | ✓                    | ✓                  | ✓                        |
| **Civic Delivery**             | **✗**                | **✗**              | **✗**                    |
| Official Response              | ✓                    | ✓                  | ✓                        |
| Civic Accountability           | ✓                    | ✓                  | ✓                        |
| Implementation Commitment      | ✓                    | ✓                  | ✓                        |
| Implementation Tracking        | ✓                    | ✓                  | ✓                        |
| Public Impact                  | ✓                    | ✓                  | ✓                        |
| Civic Archive                  | ✓                    | ✓                  | ✓                        |
| **Civic Compatibility Review** | **✗**                | **✗**              | **✗**                    |

---

## Workspace Readiness

### Navigation

- **Global header:** Sticky `HumanityHeader` with Home and Initiatives links
- **Workspace sidebar:** `WorkspaceNavigation` (Profile, Preferences, Civic Activity, Initiatives)
- **Section anchors:** Hash navigation via `INITIATIVE_WORKSPACE_SECTIONS` (18 sections)
- **No duplicate headers:** Public experience pages delegate to global layout

### Sticky behavior

- Global header: `position: sticky; top: 0`
- Left workspace nav: sticky below header (`--hu-header-height`)
- Civic assistant: sticky below header on desktop

### Section completeness

All pipeline stages have workspace sections. Civic Integration panel consumes the same integration API as public entity pages.

### UX consistency

- `WorkspaceSectionShell` adopted across all major sections
- Standardized empty states, loading/error states, deferred actions
- Standardized public links with arrow suffix
- `ApiUnavailableState` replaces raw API error messages

### Issues

- Decision Session section order (position 17) does not match logical pipeline position
- Legacy standalone workspaces remain accessible outside initiative context
- `/member` page does not use workspace shell

**Workspace readiness: APPROVED WITH RECOMMENDATIONS**

---

## Public Experience Readiness

### Tier structure

| Tier      | Route               | Projection source                   |
| --------- | ------------------- | ----------------------------------- |
| World     | `/`                 | `loadGlobalExperienceProjections()` |
| Country   | `/country/[slug]`   | `loadCountryExperiencePageData()`   |
| Region    | `/region/[slug]`    | `loadRegionExperiencePageData()`    |
| Community | `/community/[slug]` | `loadCommunityExperiencePageData()` |

### Read-oriented design

Public experience uses `ExperienceBlockShell`, projection engine, and public entity pages. No workspace business logic is embedded. Registration and workspace handoff routes are placeholder (`null` constants) — intentional boundary markers.

### Coupling assessment

| Coupling point                         | Assessment                   |
| -------------------------------------- | ---------------------------- |
| Header nav to `/initiatives`           | Acceptable bridge            |
| Footer links                           | Acceptable bridge            |
| Latest initiative cards → public pages | Correct (not workspace)      |
| Registration gateway                   | Placeholder — no coupling    |
| Public projection engine               | Independent of workspace API |

**Public experience readiness: APPROVED**

---

## Assistant Readiness

### Current capabilities

- Section-aware context via IntersectionObserver
- Integration view consumption (pipeline status, related records)
- Mock assistant engine with safety guard
- Confidence level and safety notices displayed
- Suggested actions per workspace section
- Mobile toggle with `aria-expanded`

### Architectural constraints (correctly enforced)

The assistant **never** publishes, votes, verifies, sends, or archives. It only suggests next steps.

### Readiness for AI

| Requirement               | Status                                         |
| ------------------------- | ---------------------------------------------- |
| Provider abstraction      | ✓ (`workspace-assistant-provider.ts`)          |
| Mock provider             | ✓                                              |
| Safety guard              | ✓                                              |
| API endpoint              | ✓ (`POST /api/v1/workspace-assistant/respond`) |
| Real AI provider          | Not implemented (by design)                    |
| Rate limiting             | Not implemented                                |
| Context window management | Basic (section + integration view)             |

**Assistant readiness: APPROVED FOR MOCK; AI provider integration deferred**

---

## Future Recommendations

### Priority 1 — Before production deployment

1. **Database persistence migration** — Replace memory/file adapters with MongoDB
2. **Real authentication** — JWT/session per TECH_STACK_DECISION
3. **Documentation sync** — Update SITE_MAP, TECH_STACK_DECISION, pipeline freeze status

### Priority 2 — Before next Capability

4. **Integrate Civic Delivery into Capability02 entity model** — Add to `CivicEntityType`, pipeline stages, notification registry
5. **Reorder workspace sections** — Align with logical pipeline order
6. **Legacy module deprecation plan** — Document canonical modules; mark legacy routes deprecated

### Priority 3 — Platform maturity

7. **Shared route/service helpers** — Reduce boilerplate duplication
8. **Extend privacy asserts** — All public projections
9. **Design system migration** — Features import from design-system, not workspace-ux directly
10. **Notification delivery engine** — Implement against existing registry
11. **Global search engine** — Index `CivicSearchMetadata`
12. **Real AI assistant provider** — Wire provider abstraction to external LLM with safety guard
13. **Mobile drawer navigation** — Complete responsive workspace UX
14. **Localization infrastructure** — i18n framework and content extraction

---

## Architecture Decision

### APPROVED WITH RECOMMENDATIONS

Humanity Union Platform v1.0 has reached a **stable architectural baseline**. The civic pipeline is complete, the workspace and public experience are coherent, privacy discipline is strong, and the integration layer provides the correct reference-only pattern for cross-entity navigation.

Future Capability development **may proceed**. The recommendations above should be addressed incrementally — none block continued development of new capabilities.

---

## Appendix A — Reviewed Modules

### API modules (29)

`auth`, `member`, `preferences`, `participation`, `initiatives`, `initiative-version-revision`, `initiative-collaborative-analysis`, `initiative-improvement-proposal`, `civic-compatibility-review`, `decision-session`, `initiative-collective-decision`, `initiative-decision-vote`, `civic-action-package`, `civic-delivery`, `official-response`, `civic-accountability`, `initiative-implementation-commitment`, `initiative-implementation-tracking`, `initiative-public-impact`, `public-civic-archive`, `capability02-integration`, `workspace-assistant`, `participation-area`, `participation-eligibility`, `collaborative-analysis` (legacy), `collective-decision` (legacy), `petition` (legacy), `implementation-commitment` (legacy), `implementation` (legacy)

### Web feature modules

`initiatives`, `initiative-collaborative-analysis`, `initiative-improvement-proposal`, `initiative-version-revision`, `decision-session`, `initiative-collective-decision`, `civic-compatibility-review`, `execution-pipeline`, `capability02-integration`, `workspace-civic-assistant`, `initiative-workspace-ux`, `public-experience`, `global-experience`, `country-experience`, `region-experience`, `community-experience`, `public-projection-engine`, `design-system`, plus legacy `petition`, `collective-decision`, `collaborative-analysis`, `implementation`, `implementation-commitment`

---

## Appendix B — Pipeline Stage Order (Integration Layer)

```
1.  Initiative
2.  Analysis
3.  Proposal
4.  Revision
5.  Decision Session
6.  Collective Decision
7.  Civic Action Package
    (Civic Delivery — implemented but not in integration pipeline)
8.  Official Responses
9.  Civic Accountability
10. Implementation Commitment
11. Implementation Tracking
12. Public Impact
13. Public Civic Archive
```

(Civic Compatibility Review — implemented but not in integration pipeline)

---

## Appendix C — Verification

Static architectural audit: `npm run review:platform-v1` (3 consecutive passes)

Checks: pipeline completeness, module indexes, public/private separation, projection consistency, privacy guards, integration layer, design system adoption, workspace integrity, public experience integrity, persistence pattern, assistant readiness, documentation currency, known risks documented.

---

## Appendix D — Quality Gates

| Gate                         | Result    |
| ---------------------------- | --------- |
| `npm run review:platform-v1` | PASS (3×) |
| Production code changes      | None      |
| Critical defects found       | None      |

---

_This document is the authoritative architecture review for Humanity Union Platform Version 1.0._
