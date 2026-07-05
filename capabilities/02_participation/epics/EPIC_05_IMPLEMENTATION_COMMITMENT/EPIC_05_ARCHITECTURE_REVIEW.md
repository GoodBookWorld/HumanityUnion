# EPIC 05 ARCHITECTURE REVIEW

## Capability 02 — Participation

### Epic 05 — Implementation Commitment

Version: 1.0

Status: Draft

Review Type: Pre-Implementation Architecture Review

---

# Purpose

Perform a pre-implementation architecture review of the **Implementation Commitment** Aggregate.

This review evaluates architectural consistency across approved Epic 05 documents before engineering begins.

It verifies architecture only.

It does not evaluate implementation.

---

# Review Scope

Documents reviewed:

- `DOMAIN_LANGUAGE.md`
- `DOMAIN_MODEL.md`
- `DOMAIN_DECISIONS.md`
- `STATE_MACHINE.md`
- `WORKSPACE_SPECIFICATION.md`
- `PUBLIC_PROJECTION.md`

Platform standards referenced:

- `project/architecture/governance/PARTICIPATION_ARCHITECTURE_FREEZE.md`
- `project/architecture/experience/EXPERIENCE_ARCHITECTURE.md`

Documents not present at review time (noted as gaps):

- Epic charter or overview document (for example `EPIC_05_IMPLEMENTATION_COMMITMENT.md`)
- `IMPLEMENTATION_PLAN.md`
- Implementation Guide series

---

# 1. Domain Integrity

## Findings

- Ubiquitous vocabulary is comprehensive and civically oriented across thirty-plus core terms.
- Stage 6 question — "Who is prepared to help?" — is answered consistently in language, model, decisions and experience documents.
- Anti-terms are explicit: Support ≠ Commitment, Readiness ≠ Approval, Commitment ≠ Task, Assistant ≠ Decision Maker.
- **Contribution**, **Contribution Item**, **Contribution Profile**, **Community Capacity**, **Implementation Readiness**, **Frozen Policy** and **Community Need** are defined with clear semantic boundaries.
- **Community Need** and **Capability Matching** appear in `DOMAIN_LANGUAGE.md` and experience specifications but are absent from `DOMAIN_MODEL.md` as entities, value objects or derived value definitions.
- Invariant wording drifts: Decision 04 summary table says "one active commitment per participant per **initiative**" while `IC-002` and Decision 04 body say "per **Implementation Commitment context**."
- **Policy Satisfaction** (aggregate derived value) and Living Policy lifecycle stage **Satisfied** share terminology; documents explain the distinction but implementers may conflate them.
- **Commitment Outcome** is referenced in Decision 15 but is not modeled as a named derived object in `DOMAIN_MODEL.md` (closest equivalent: **Contribution Summary**).

## Strengths

- Strong separation from Petition Support, Collective Decision approval and Implementation execution vocabulary.
- Collaborative Analysis Contribution is explicitly distinguished from Implementation Commitment Contribution.
- Human Leadership and voluntary capacity principles are embedded in language, not appended as UX copy alone.
- Official vocabulary and relationship diagrams support documentation synchronization.

## Risks

- Community Need and Capability Matching may be reimplemented ad hoc in store or UI without domain authority.
- Initiative-scoped vs commitment-context-scoped uniqueness may be implemented incorrectly if not harmonized before types are defined.
- Policy Satisfaction naming collision with Living Policy **Satisfied** may produce incorrect lifecycle handling in policy modules.

## Recommendations

- Add **Community Need** and **Capability Matching** to `DOMAIN_MODEL.md` as derived presentation values (or document explicitly that Community Need is a projection of unsatisfied Readiness Thresholds only).
- Harmonize Decision 04 summary and `SM-001` to use "Implementation Commitment context" consistently; clarify whether one initiative maps to one commitment aggregate in Version 1.
- Name or alias **Commitment Outcome** against **Contribution Summary** in the domain model before Guide 01.
- Add a glossary note distinguishing aggregate **Policy Satisfaction** from Living Policy lifecycle **Satisfied**.

## Verdict

CONDITIONAL

---

# 2. Aggregate Boundaries

## Findings

- **Implementation Commitment** is a single Aggregate Root with clear ownership of lifecycle, Contribution Items, Contribution Profiles and derived values.
- External references use identifiers and snapshots only: `InitiativeId`, `CollectiveDecisionId`, `PetitionId`, `ParticipantId`, `FrozenPolicyId`.
- Cross-aggregate mutation is forbidden consistently in model invariants (`IC-013`), state machine (`SM-006`), workspace and public specifications.
- Decision 10 and Decision 15 enforce separation from Implementation execution and project management semantics.
- **Frozen Policy** is referenced but not owned by Implementation Commitment; policy aggregate ownership and read contract are not defined within Epic 05 documents.
- `DOMAIN_MODEL.md` lists "community needs summary references where modeled within aggregate scope" without structural definition.
- Registration Gateway, Humanity Assistant and Participation Navigator are correctly excluded from aggregate ownership per Experience Boundaries.

## Strengths

- One Aggregate — One Responsibility is preserved.
- Petition Signatures and Contribution Items cannot be conflated at the boundary level.
- Derived values cannot replace Contribution Items as source of truth (`IC-007` through `IC-010`).
- Historical integrity on withdrawal is explicit and consistent.

## Risks

- Frozen Policy read API and immutability guarantees depend on an undefined policy module; boundary contracts may be assumed incorrectly during implementation.
- Community Need modeling ambiguity may push requirement logic into workspace layer, weakening aggregate derivation authority.
- Coordinator withdrawal authorization ("authorized coordinator acts within policy") introduces a cross-cutting role not modeled in Epic 05 domain types.

## Recommendations

- Document Frozen Policy as an external aggregate or platform module with a read-only contract referenced by `frozenPolicyId` before store design.
- Resolve Community Need derivation ownership: aggregate behavior layer vs projection-only field.
- Defer coordinator-authorized withdrawal to explicit Frozen Policy rules or a follow-on decision; default Version 1 to participant-only withdrawal unless policy defines otherwise.

## Verdict

CONDITIONAL

---

# 3. Policy Lifecycle

## Findings

- Living Policy lifecycle (`Suggested → Initial → Refined → Approved → Frozen → Satisfied`) is documented in `DOMAIN_DECISIONS.md` (Decision 13), `DOMAIN_LANGUAGE.md` and `PARTICIPATION_ARCHITECTURE_FREEZE.md`.
- Decision 08 and invariant `IC-011` enforce Frozen Policy immutability in place during commitment evaluation.
- Decision 12 correctly bounds Policy Assistant to drafting and explanation — not approval or freeze authority.
- Workspace Frozen Policy presentation (Satisfied / Pending / Optional) aligns with readiness evaluation semantics.
- State machine attaches Frozen Policy at **Submit Commitment** but does not specify the governed command or event for **reference update** when policy supersession occurs mid-pipeline.
- Public Projection omits Frozen Policy from the public information hierarchy; observers see readiness and needs but not the governing rule summary unless embedded indirectly in need descriptions.
- Only Approved or Frozen policy governs enforcement — preparatory lifecycle stages are non-binding; this is stated but not tied to eligibility validation rules in the state machine preconditions.

## Strengths

- Policy evolution before freeze is separated from stable evaluation during active collection.
- Immutability during Active, Completed, Withdrawn and Archived is consistent across domain, state machine and workspace.
- Policy Assistant vs Humanity Assistant responsibilities are distinct and aligned with platform freeze.

## Risks

- Without a reference-update transition spec, implementers may allow in-place PATCH of policy content.
- Public observers may not understand readiness thresholds without a public-safe policy summary surface.
- Living Policy stages may be exposed operationally without clear non-binding labeling.

## Recommendations

- Add an architecture note or state machine supplement describing governed `frozenPolicyId` reference change (new policy generation) vs forbidden in-place mutation.
- Define minimum public-safe Frozen Policy summary fields for Public Projection (threshold labels without internal policy mechanics).
- Specify which policy lifecycle stages are valid at **Create Commitment** vs **Activate Commitment** preconditions.

## Verdict

CONDITIONAL

---

# 4. Community Capacity

## Findings

- Community Capacity is consistently defined as derived-only across all seven documents.
- Derivation trigger is explicit: add, remove (where permitted), withdraw Contribution Items; activation and completion change active set.
- Decision 03 prevents Petition signature counts or popularity proxies from entering capacity.
- Workspace and Public Projection category examples (volunteers, coordinators, translators, transportation, facilities, expertise) align with Contribution Type and Readiness Threshold vocabulary.
- `CommunityCapacityUpdated` event is defined in the state machine.
- Aggregate properties (`totalContributions`, `contributionsByType`, `aggregateAvailabilitySummary`, `skillCoverageSummary`) are specified in the domain model.

## Strengths

- Derivation chain is auditable: Contribution Items → Community Capacity → Implementation Readiness.
- Privacy rules on Public Projection prevent individual capacity exposure.
- Manual override is forbidden at invariant, command, workspace and public layers.

## Risks

- Skill coverage and coordinator categories depend on Frozen Policy labels not yet exemplified in bootstrap or policy fixtures.
- `aggregateAvailabilitySummary` public vs operational field boundaries are not enumerated field-by-field.

## Recommendations

- Define Version 1 bootstrap Frozen Policy with representative Readiness Thresholds matching workspace and public category examples.
- Document public-safe subset of Community Capacity fields in Public Projection builder specification during Guide 01.

## Verdict

PASS

---

# 5. Implementation Readiness

## Findings

- Readiness formula is identical across domain model, decisions, state machine, workspace and public projection:

  ```
  Community Capacity + Frozen Policy → Implementation Readiness
  ```

- Decision 14 and invariant `SM-009` enforce Readiness ≠ Approval consistently.
- Readiness is not a lifecycle state; completion transition requires readiness and Policy Satisfaction conditions.
- Properties (`readinessReached`, optional `readinessScore`, satisfied/unsatisfied thresholds, `explanation`) are defined.
- `ImplementationReadinessUpdated` derivation event is specified.
- Optional normalized scoring is policy-defined only — preventing arbitrary UI metrics.

## Strengths

- Readiness meaning is repeated in every experience surface that displays it — reducing misinterpretation risk.
- Completion preconditions tie lifecycle terminus to derived truth, not manual go-live flags.
- Public and operational surfaces share the same civic meaning with appropriate field visibility differences.

## Risks

- `readinessScore` may be implemented as a engagement metric if policy fixtures do not define it; documents warn but do not forbid the field when undefined.
- Relationship between **Completed** aggregate state and Implementation stage eligibility is referenced but not fully specified as a cross-aggregate gate.

## Recommendations

- Omit `readinessScore` from Version 1 unless bootstrap Frozen Policy defines it.
- Document Implementation stage eligibility consult in platform integration guide when Epic 07 architecture exists.

## Verdict

PASS

---

# 6. Workspace

## Findings

- Workspace specification is comprehensive and aligned with `PARTICIPATION_ARCHITECTURE_FREEZE.md` Workspace Standard (five participant questions).
- Information hierarchy adapts platform hierarchy for Stage 6: context → derived results → personal commitment → guidance → navigation.
- Canonical interaction surface is identified as contribution declaration and profile maintenance — parallel to Endorsement Panel and Decision Panel patterns.
- Frozen Policy, Community Needs, Next Meaningful Action and Humanity Assistant sections include explicit anti-pressure rules.
- Empty, loading and completion states are specified with calm behavior — exceeding minimum review scope.
- Participation Navigator is correctly deferred; local Next Meaningful Action rules are allowed temporarily per Experience Architecture.
- Unlike Epic 04, the canonical surface lacks a single branded name (for example **Commitment Panel** or **Contribution Declaration Panel**); referred to descriptively only.

## Strengths

- Workspace philosophy explicitly states it never pressures participation.
- One Next Meaningful Action rule is enforced with contextual examples and forbidden generic prompts.
- Operational vs public boundaries are explicit in Operational View Boundaries section.
- Community and Public participation share one workspace model after registration.

## Risks

- Without a named canonical panel, UI and API modules may fragment declaration UX across multiple competing surfaces.
- Humanity Assistant and Next Meaningful Action may duplicate recommendation logic before Participation Navigator exists.
- Frozen Policy section is rich operationally but may overwhelm participants if not progressively disclosed at interface layer (interface concern — acceptable at architecture level).

## Recommendations

- Adopt a single canonical name for the declaration surface in Domain Language and Workspace Specification before UI implementation.
- Extract Next Meaningful Action decision table into a shared reference aligned with Participation Navigator future contract.
- Ensure Contribution Recognition messages are listed explicitly (workspace references triggers but fewer examples than Epic 04).

## Verdict

PASS

---

# 7. Public Projection

## Findings

- Public Projection purpose, audience and separation from Operational Workspace mirror Epic 04 pattern and platform freeze.
- Public information hierarchy covers Initiative, Collective Decision, Petition, Community Capacity, Implementation Readiness, Community Needs, Share and Registration Gateway.
- Privacy boundaries are explicit and strong: no identities, commitment history, contribution detail or workspace internals.
- Share semantics distinguish viewing, sharing and declaring — aligned with Decision 01.
- Registration Gateway clearly states read/understand/share without registration; create/modify requires registration and operational workspace continuation.
- Humanity Assistant public boundaries forbid persuasion and commitment creation.
- Lifecycle visibility rules cover Draft through Archived.
- **Frozen Policy** is not a first-class public hierarchy section; threshold context appears only indirectly through Community Needs and readiness copy.
- Public Projection conceptual model omits `public frozen policy summary` present in operational workspace hierarchy.

## Strengths

- Aggregate-over-individual transparency principle is consistently applied.
- Community Needs presentation rules (factual, never persuasive) directly counter engagement optimization.
- Cross-projection navigation to Public Initiative, Decision and Petition preserves pipeline continuity without boundary erosion.

## Risks

- Observers may not understand why a need exists without a public-safe policy summary.
- Registration Gateway messaging for Draft/Submitted states requires operational lifecycle sync to avoid promising declaration when aggregate is not Active.
- Public page during early lifecycle may expose provisional readiness if lifecycle visibility rules are implemented loosely.

## Recommendations

- Add a minimal **Public Policy Summary** subsection (threshold labels and eligibility headline only) to Public Projection or explicitly document that Community Needs carry sufficient policy context for Version 1.
- Align lifecycle visibility implementation with state machine: suppress authoritative readiness until **Active** unless policy defines otherwise.
- Define `PublicImplementationCommitmentProjection` field list in Guide 01 mirroring conceptual model.

## Verdict

CONDITIONAL

---

# 8. Humanity Assistant Integration

## Findings

- Humanity Assistant boundaries align with `PARTICIPATION_ARCHITECTURE_FREEZE.md` Section 11 and Decision 11 across workspace and public specifications.
- Frozen principles are reflected: never replaces judgment, explains before recommending, reduces complexity not responsibility, contextual, transparent.
- Workspace assistant may recommend based on Policy and Community Needs; may help complete Contribution Profile comprehension — not recording.
- Public assistant may explain readiness, needs and policy requirements — never persuades or requests commitment.
- Policy Assistant scope (Decision 12) is distinct: drafts Initial policy, does not define final policy.
- Assistant is correctly listed under Experience Boundaries in domain model — not aggregate state.

## Strengths

- Assistant integration is specified in both operational and public surfaces with consistent prohibitions.
- Explicit anti-patterns: no autonomous declaration, withdrawal, readiness approval or aggregate mutation.
- Alignment with Next Meaningful Action prevents assistant from becoming a competing primary action menu.

## Risks

- Assistant highlighting unmet policy requirements could drift into persuasive copy if not governed by content rules during implementation.
- Policy Assistant and Humanity Assistant overlap on policy explanation — coordination needed in UI to avoid duplicate or conflicting guidance.

## Recommendations

- Define assistant content boundaries in implementation guide: factual gap statements only, shared template with Community Needs copy.
- Clarify UI ownership: Policy Assistant for policy comprehension deep-dives; Humanity Assistant for stage orientation and next step alignment.

## Verdict

PASS

---

# 9. Participation Pipeline Integration

## Findings

- Stage 6 position after Petition is enforced in Decision 02, domain model relationship diagram and both experience specifications.
- Aggregate references chain Initiative → Collective Decision → Petition → Implementation Commitment → Implementation → Impact.
- Eligibility preconditions on **Create Commitment** require approved Collective Decision Outcome and applicable Petition completion.
- Journey context in workspace lists preceding and future stages correctly.
- Navigation links to operational and public projections of adjacent stages are specified.
- Bootstrap vertical slice IDs exist for Initiative, Decision and Petition from Epic 04 integration — no bootstrap specification for Implementation Commitment yet.
- Epic 05 lacks charter document and `IMPLEMENTATION_PLAN.md` present in prior epic review scopes.
- Implementation stage (Stage 7) is referenced as future; handoff eligibility rules are architectural intent only.

## Strengths

- Pipeline question at each stage remains distinct; Implementation Commitment does not reopen decision or endorsement.
- Explicit Eligibility, Not Implicit Creation principle from architecture freeze is respected in Create Commitment preconditions.
- Completed and Archived commitment phases preserve historical record for future Implementation and Impact stages.

## Risks

- Without bootstrap and integration guide, vertical slice verification for Stage 6 cannot mirror Epic 04 Task 07 pattern.
- Petition completion eligibility criterion is referenced but not defined against specific Petition lifecycle states (Closed? minimum support?).
- Missing IMPLEMENTATION_PLAN may cause implementation task ordering drift across teams.

## Recommendations

- Author `IMPLEMENTATION_PLAN.md` and epic charter before Guide 01, following Epic 04 structure.
- Define Version 1 Petition eligibility gate for Create Commitment (for example Petition Closed with Approved path, or explicit bootstrap exception).
- Plan platform integration task linking bootstrap Decision, Petition and new Commitment aggregate identifiers.

## Verdict

CONDITIONAL

---

# 10. Platform Standards

## Findings

- Architecture conforms to Participation Architecture Freeze: aggregate independence, operational/public separation, workspace standard, assistant principles, living policy lifecycle, collective capacity → readiness derivation, engineering principles (structure → behavior → experience).
- State machine defines commands, transitions, forbidden transitions, events and invariants — sufficient for behavior layer design.
- Fifteen domain decisions are Accepted with rationale and consequences.
- Public projection pattern (dedicated read model, not operational serialization) is specified.
- Thin API, projection builder and standard envelope are implied by freeze compliance but not restated in Epic 05-specific implementation guides — guides do not exist yet.
- All Epic 05 architecture documents are Status: **Draft**; none marked Approved.
- Review scope documents are complete for domain and experience; implementation guide series is absent.

## Strengths

- Epic 05 documentation set matches Epic 04 pre-implementation depth for domain, state machine, workspace and public projection.
- Engineering methodology ordering (types → behavior → experience) is respected in document dependencies.
- Change policy requires Architecture Review for domain evolution — consistent with governance.

## Risks

- Draft status on all documents may be interpreted as incomplete approval for engineering kickoff.
- Missing implementation guides increase risk of store-in-controller or projection-from-aggregate anti-patterns seen in Epic 03–04 reviews.
- No explicit API endpoint inventory or route prefix specification exists yet for Implementation Commitment.

## Recommendations

- Advance architecture document statuses to Approved after conditional items in this review are resolved.
- Produce Epic 05 implementation guide series (domain types, store, API, workspace, public projection, platform integration, architecture review gate) mirroring Epic 04.
- Record Version 1 scope deferrals explicitly: domain events, Participation Navigator, coordinator roles, policy reference update flows.

## Verdict

CONDITIONAL

---

# Verdict Summary

| Area                                  | Verdict     |
| ------------------------------------- | ----------- |
| 1. Domain Integrity                   | CONDITIONAL |
| 2. Aggregate Boundaries               | CONDITIONAL |
| 3. Policy Lifecycle                   | CONDITIONAL |
| 4. Community Capacity                 | PASS        |
| 5. Implementation Readiness           | PASS        |
| 6. Workspace                          | PASS        |
| 7. Public Projection                  | CONDITIONAL |
| 8. Humanity Assistant Integration     | PASS        |
| 9. Participation Pipeline Integration | CONDITIONAL |
| 10. Platform Standards                | CONDITIONAL |

**Overall section verdicts:** 4 PASS, 6 CONDITIONAL, 0 FAIL

---

# Cross-Cutting Issues

The following items should be resolved before Guide 01 (domain types) begins:

1. Model **Community Need** and **Capability Matching** in `DOMAIN_MODEL.md` or document as strict projections of unsatisfied Readiness Thresholds.
2. Harmonize "per initiative" vs "per Implementation Commitment context" across Decision 04, `SM-001` and `IC-002`.
3. Define Frozen Policy external aggregate read contract and governed reference-update semantics.
4. Resolve **Commitment Outcome** vs **Contribution Summary** naming in the domain model.
5. Add public-safe Frozen Policy summary strategy to Public Projection or confirm Community Needs carry sufficient policy context for Version 1.
6. Name the canonical workspace declaration surface (Commitment Panel or equivalent).
7. Define Petition eligibility gate for **Create Commitment** against specific lifecycle outcomes.
8. Author epic charter and `IMPLEMENTATION_PLAN.md`.
9. Synchronize architecture document status fields after remediations.
10. Plan bootstrap vertical slice linking `initiative-bootstrap-001`, `decision-bootstrap-001`, `petition-bootstrap-001` to a commitment bootstrap record.

None of these issues require aggregate redesign.

They require documentation harmonization, boundary contract clarity and implementation planning artifacts.

---

# Architecture Status

The Implementation Commitment architecture is **substantially complete**, internally coherent and aligned with the Capability 02 Participation Architecture Freeze.

Aggregate boundaries are sound.

Support, preparedness and execution remain correctly separated across pipeline stages.

Community Capacity and Implementation Readiness derivation rules are explicit and consistent.

Workspace and Public Projection specifications uphold calm participation, human leadership and explicit publicity principles.

Humanity Assistant integration respects platform frozen principles in both operational and public contexts.

Conditional items are documentation and planning gaps — not structural failures.

## Status

**READY FOR IMPLEMENTATION**

Implementation may proceed after conditional cross-cutting issues are resolved or explicitly deferred with documented Version 1 scope decisions.

Guide 01 must not begin until items 1–3 and 6–8 are closed or accepted as deferred.

---

# Approval Criteria for Unconditional Architecture Approval

Epic 05 architecture may move from conditional readiness to unconditional approval when:

- cross-cutting issues 1–9 are resolved in domain or experience documents;
- `IMPLEMENTATION_PLAN.md` and implementation guide index exist;
- architecture document statuses are synchronized to Approved;
- bootstrap and Petition eligibility rules are documented for vertical slice verification;
- no aggregate boundary regressions are introduced during clarification edits.

---

# Final Assessment

Implementation Commitment architecture successfully extends the Participation Pipeline without compromising aggregate independence established in Epics 01–04.

The domain question is answered coherently:

Collective Decision establishes legitimacy.

Petition establishes public support.

**Implementation Commitment transforms support into declared community capacity and derived readiness — without assigning work or executing implementation.**

Implementation (Stage 7) remains appropriately future-facing.

The architecture is ready for the standard vertical slice lifecycle subject to conditional clarifications above.

---

# Final Principle

Pre-implementation review exists to reduce uncertainty before code begins.

Epic 05 has reached sufficient architectural maturity to enter engineering once conditional documentation and planning items are closed.

Implementation Commitment should be built as **voluntary capacity collection and derived readiness** — not as a task board, volunteer signup funnel or second approval vote detached from the civic pipeline.
