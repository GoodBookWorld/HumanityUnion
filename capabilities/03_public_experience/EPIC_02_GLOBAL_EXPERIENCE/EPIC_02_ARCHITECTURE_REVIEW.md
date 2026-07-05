# EPIC 02 ARCHITECTURE REVIEW

## Humanity Union Platform

## Capability 03 — Public Experience

### Epic 02 — Global Experience

Version: 1.0

Status: Draft

Review Type: Pre-Implementation Architecture Review

---

# Purpose

Perform the formal architecture review of Epic 02 — **Global Experience**.

This review evaluates architectural consistency across all Epic 02 documents before implementation planning and engineering begin.

It verifies **architecture only**.

It does not evaluate implementation.

It does not propose implementation.

Reference:

- `DISCOVERY_SESSION_01.md`
- `GLOBAL_EXPERIENCE_VISION.md`
- `GLOBAL_EXPERIENCE_NARRATIVE.md`
- `GLOBAL_EXPERIENCE_CONTENT_ARCHITECTURE.md`
- `PUBLIC_PAGE_TEMPLATE_STANDARD.md`
- `GLOBAL_EXPERIENCE_INTERACTION_ARCHITECTURE.md`
- `EPIC_01_ARCHITECTURE_FREEZE.md`

Epic 01 Information Space architecture is **Frozen**.

Epic 02 defines World-scoped Global Experience within that foundation.

---

# Review Scope

## Documents reviewed

| Document                                        | Status  |
| ----------------------------------------------- | ------- |
| `DISCOVERY_SESSION_01.md`                       | Present |
| `GLOBAL_EXPERIENCE_VISION.md`                   | Present |
| `GLOBAL_EXPERIENCE_NARRATIVE.md`                | Present |
| `GLOBAL_EXPERIENCE_CONTENT_ARCHITECTURE.md`     | Present |
| `PUBLIC_PAGE_TEMPLATE_STANDARD.md`              | Present |
| `GLOBAL_EXPERIENCE_INTERACTION_ARCHITECTURE.md` | Present |

## Governing upstream documents

| Document                             | Status  |
| ------------------------------------ | ------- |
| `EPIC_01_ARCHITECTURE_FREEZE.md`     | Frozen  |
| `PUBLIC_EXPERIENCE_BLOCK_LIBRARY.md` | Present |
| `NAVIGATION_ARCHITECTURE.md`         | Present |
| `PUBLIC_EXPERIENCE_PRINCIPLES.md`    | Present |

## Documents not present at review time

- `EPIC_02_ARCHITECTURE_FREEZE.md`
- `IMPLEMENTATION_PLAN.md` (Epic 02)
- Capability 02 public projection → Public Space widget integration map (adjunct)
- Visual design specification
- Copy freeze / banned-phrases appendix
- Bootstrap or demo data specification for World scope

---

# Review Method

Each review area evaluates:

- **Strengths**
- **Potential Risks**
- **Recommendations**
- **Confirmed Decisions**
- **Open Questions**

Review is evidence-based against Epic 02 documents and Epic 01 freeze.

---

# 1. Architectural Consistency

## Strengths

- Epic 02 introduces **no new architectural concepts** — explicitly constrained to Epic 01 freeze in Discovery Session 01.
- Block composition order is consistent across Vision, Narrative, Content Architecture and Discovery: Hero → Interactive Map → Statistics → Initiative Levels → Latest Initiatives → Registration Gateway → Footer.
- `PUBLIC_PAGE_TEMPLATE_STANDARD.md` generalizes template to all Public Experience pages while Global Experience is first instance — aligns with Epic 01 Unified Public Space.
- Canonical naming registry from Epic 01 applied consistently — Join Humanity Union → Registration Gateway; Interactive World Map → Interactive Map.
- Country and Region explicitly **out of scope** for Epic 02 — no scope creep into Geographic Experience epics.

## Potential Risks

- `PUBLIC_PAGE_TEMPLATE_STANDARD.md` lives in Epic 02 folder but claims platform-wide authority — downstream epics may treat it as Epic 02-only unless freeze references it explicitly.
- Optional blocks (Trusted Media Carousel, About Preview) mentioned in Narrative and Discovery but absent from required Discovery block list — later specs could reintroduce layout debate.
- Header and Geographic Navigator content responsibility implied via Navigation Architecture but not in Content Architecture numbered sections — minor documentation gap.

## Recommendations

- Reference `PUBLIC_PAGE_TEMPLATE_STANDARD.md` from forthcoming `EPIC_02_ARCHITECTURE_FREEZE.md` and note platform-wide applicability explicitly.
- Resolve optional secondary blocks in Epic 02 freeze as **out of Version 1 required composition** or document single optional slot rule.
- Add one-line cross-reference in Content Architecture that Header and Geographic Navigator content follows Navigation Architecture.

## Confirmed Decisions

- Global Experience = Home at **World scope** = architectural **Global Experience**.
- No new header destinations, block types or page template families in Epic 02.
- Epic 02 implements frozen architecture — does not extend it.

## Open Questions

- Should `PUBLIC_PAGE_TEMPLATE_STANDARD.md` move to Epic 01 Information Space in a future documentation housekeeping pass?

---

# 2. Narrative Consistency

## Strengths

- **One Screen — One Message** principle consistent across Narrative and Content Architecture.
- Five narrative stages map cleanly to block order in Narrative and Content Architecture.
- Emotional journey (Curiosity → Invitation) aligns with calm, non-pressure registration philosophy.
- Trust narrative explicitly forbids persuasion patterns — consistent with Epic 01 principles.
- Global Experience described as public square, not homepage — consistent across Vision, Discovery and Narrative.

## Potential Risks

- Interaction Architecture Learning Path uses **Observe · Understand · Explore · Evaluate · Participate** while User Journey (Epic 01) uses **Discover · Understand · Trust · Register · Participate** — vocabulary drift within Epic 02 Interaction doc if Epic 01 harmonization map not cited prominently in Epic 02 freeze.
- Narrative Stage 3 split across two blocks (Statistics + Initiative Levels) is coherent but requires implementation discipline to preserve single-stage feel per screen region.

## Recommendations

- Epic 02 freeze should cite Epic 01 Section 5 harmonization map and add Interaction Learning Path mapping table (Observe ↔ Discover, Evaluate ↔ Trust, Participate ↔ Register + Workspace).
- Narrative review gate for copy: ban certification and urgency phrases per Trust Narrative section.

## Confirmed Decisions

- Fixed narrative order frozen for Global Experience required blocks.
- Registration Gateway is narrative Stage 5 — never Stage 1.
- Optional secondary blocks must not introduce competing primary message on same screen.

## Open Questions

- None blocking — harmonization is documentation citation, not redesign.

---

# 3. Content Architecture

## Strengths

- **Context Before Evidence** applied per block with example Context Introductions — implementable copy direction without layout prescription.
- Each block defines Purpose, Visitor Questions, Information Displayed, positional rationale and neighbour relationships — complete content responsibility model.
- **Content before Layout** principle explicitly frozen — correct sequencing discipline.
- Derived labeling and honest empty states required in Statistics and Pipeline blocks.
- Registration Gateway content separated from Evidence blocks — no conversion copy in Hero or Statistics.

## Potential Risks

- Content Architecture depends on Capability 02 public projections for Latest Initiatives, Statistics and Pipeline — **integration map still deferred** from Epic 01; content fields not enumerated at DTO level.
- "Participation Pipeline" UI title vs **Initiative Levels** architectural name — registry covers this but Content Architecture section title could confuse implementers.
- Initiative detail content referenced in Interaction Architecture but not specified in Epic 02 — correctly out of scope but interaction path assumes it exists from Capability 02.

## Recommendations

- Publish adjunct **Public Projection Integration Map** before implementation — map Capability 02 public types to block Evidence fields.
- Content freeze should use architectural block names in specs; UI titles in copy document only.
- Define honest empty-state copy patterns for World scope in copy appendix.

## Confirmed Decisions

- Every block: Title → Context Introduction → Evidence.
- Hero excludes statistics, initiatives and registration content.
- Footer excludes primary civic Evidence duplication.

## Open Questions

- Which Capability 02 bootstrap public projections seed Global Experience demo data?

---

# 4. Interaction Architecture

## Strengths

- Interaction philosophy (voluntary, predictable, reversible, explainable, respectful, calm) operationalizes Epic 01 calm navigation principles.
- End-to-end flow Visitor → Global Experience → Geographic → Initiative → Public Understanding → Registration → Workspace is clear and respects Public Space / Workspace boundary.
- Information exploration narrowing (Overview → Detail → Participation) matches block order and template Evidence stage.
- Eight frozen interaction principles are testable in review and QA.
- Future interaction capabilities (search, AI assistant, bookmarks) explicitly constrained to explain-only or exploration extension — no architectural fork.

## Potential Risks

- **AI Discovery Assistant** listed as future example — must not blur with Humanity Assistant Capability 02 boundaries if shared naming emerges.
- "No dead ends" principle requires Initiative detail and geographic scope pages to exist when interactions promise them — dependency on Capability 02 and future Geographic epics.
- Skipping to Participate "architecturally discouraged" — needs copy/UX spec clarity without account gating public reading.

## Recommendations

- Future assistant interactions must cite Epic 01 Humanity Assistant explain-only boundary if AI Discovery is pursued.
- Interaction acceptance tests defined at architecture level: every outbound interaction has continue, return or cross-link outcome.
- Document deep-link entry as valid shortcut that preserves template — not failure of linear learning path.

## Confirmed Decisions

- Geographic scope transitions change filter only — not architectural language.
- Registration Gateway interaction after Evidence weight on Global Experience.
- Public interaction architecture ends at Registration threshold.

## Open Questions

- Should Geographic Experience epics share this interaction document by reference or publish Geographic Interaction addendum?

---

# 5. Navigation Architecture

## Strengths

- Epic 02 conforms to frozen six primary destinations — no new header items.
- Primary navigation broadens / Related deepens — consistent with Epic 01 Navigation Architecture.
- Geographic Navigator and Interactive Map interactions align with filter-not-duplicate geographic model.
- Maximum three logical transitions preserved in Interaction Architecture reference.
- Registration Gateway excluded from header — consistent across all Epic 02 docs.

## Potential Risks

- Global Experience encourages map and Latest Initiatives exploration — combined with header navigation, visitor path multiplicity could challenge three-step rule if Related Content chains are deep.
- Institutions, Media, Knowledge destinations referenced in interaction flow but Epic 02 non-goals — visitors may navigate to destinations with lighter future specs.

## Recommendations

- Verify three-step reach from Global Experience to About and Initiatives in interaction walkthrough during implementation planning — adjust Related Content depth not rule unless proven inadequate.
- Placeholder or minimal destination pages should not break "no dead ends" if header links are live before later epics.

## Confirmed Decisions

- Header destinations frozen — Epic 02 does not add header items.
- Footer supporting role unchanged.
- Breadcrumbs on depth pages — Initiative detail when implemented.

## Open Questions

- Are header links to not-yet-built destinations disabled or minimal honest stubs at Epic 02 launch?

---

# 6. Public Understanding

## Strengths

- Thirty-second comprehension success criterion in Discovery — testable orientation goal.
- Five Visitor Questions in Page Template Standard map to Identity through Participation stages — coherent understanding model.
- Exploration encouraged over registration — repeated across Discovery, Interaction and Narrative.
- Progressive disclosure enforced at page, block and interaction layers.
- Public questions in Discovery map to specific blocks — traceable understanding path.

## Potential Risks

- Thirty-second goal may conflict with rich Evidence blocks if layout implementation front-loads density — architecture says content before layout but no layout spec yet.
- Multiple flow vocabularies (five questions, narrative stages, learning path) require reviewer discipline — risk of teams optimizing different metrics.

## Recommendations

- Implementation planning should define **orientation-only** acceptance criteria for thirty-second test — Hero + first Evidence scan, not full page mastery.
- Analytics labeling should use Visitor Journey flow from Epic 01 freeze for consistency.

## Confirmed Decisions

- Understanding precedes registration — frozen across Epic 02.
- Calm exit without registration is success — not failure.
- Exploration over registration as Epic 02 success criterion.

## Open Questions

- None blocking architecture approval.

---

# 7. Trust Model

## Strengths

- Trust through transparency and verification — consistent across Content, Narrative, Interaction and Template Standard.
- Context Before Evidence prevents conclusion substitution.
- Derived metrics labeling required in Statistics and Pipeline content.
- Trust Narrative forbids certification and urgency patterns with concrete examples.
- About path and initiative detail traceability included in Trust Through Interaction.
- "Trusted Media Carousel" architectural naming flagged in Epic 01 Block Library — governed source not truth claim.

## Potential Risks

- Statistics at World scope with sparse bootstrap data could undermine trust if empty states poorly written — architecture requires honesty but copy not frozen.
- Map visualization could imply precision beyond data quality if boundaries or counts mislead — content architecture says honest absence required.

## Recommendations

- Publish banned public phrases appendix before copy production.
- Bootstrap demo must use honest labels if data is synthetic — not fabricated live activity presented as production truth.

## Confirmed Decisions

- No certification, proof or omniscient verification language in Epic 02 architecture.
- Registration Gateway is not a trust bargain — public Evidence remains public.
- Explainable Honesty and Trust Through Verification frozen for Epic 02.

## Open Questions

- Who owns copy review gate — Capability 03 governance or platform experience?

---

# 8. Scalability

## Strengths

- Page Template Standard applies to all public pages — Global Experience scales as pattern instance.
- Block library composition scales by attachment — new Evidence types slot into template stages.
- Interaction future evolution section preserves architecture while naming search, live activity, recommendations.
- Filter-not-duplicate model scales content without UI multiplication.
- Epic 02 scope limited to World — prevents premature breadth.

## Potential Risks

- `PUBLIC_PAGE_TEMPLATE_STANDARD.md` in Epic 02 may be overlooked by Country/Region epics if not referenced from Epic 01 freeze update.
- Live Civic Activity future capability could pressure Statistics block into real-time engagement display — contradicting calm principles if not governed.

## Recommendations

- Add Page Template Standard reference to Epic 01 freeze next version or Epic 02 freeze with platform-wide note.
- Live activity future epic must preserve derived labeling and calm presentation rules.

## Confirmed Decisions

- Scalability through composition and filtering — not forking.
- Epic 02 delivers one vertical slice pattern — World Global Experience.

## Open Questions

- None blocking.

---

# 9. Geographic Extensibility

## Strengths

- Geographic hierarchy and future levels enumerated consistently across Interaction Architecture, Page Template Standard and Epic 01 freeze.
- Country and Region deferred to later epics — Epic 02 does not prematurely implement.
- Geographic Experience = same template + scope filter — confirmed in Discovery, Template Standard and Interaction Architecture.
- Reversibility and scope-change signaling required in interactions.
- Unbounded geographic depth without architecture dependency — mature model.

## Potential Risks

- Interactive Map interaction at World scope may imply Country/Region pages exist before Geographic Experience epics ship — interaction dead-end risk if scope drill-down leads to unimplemented routes.
- Future levels list (Indigenous Territory, etc.) is inclusive — data model and labeling sensitivity not addressed in Epic 02 — appropriately deferred but socially significant at implementation.

## Recommendations

- Epic 02 implementation plan should define map scope interaction behaviour when Country/Region routes not yet live — disable drill-down or honest "coming soon" only if Architecture Review approves; prefer disabling until Geographic epics ship.
- Geographic labeling governance for Indigenous Territory and community structures should be separate cultural review — not Epic 02 architecture blocker.

## Confirmed Decisions

- Epic 02 scope: World only.
- Geographic transitions change observation scope — not architectural language.
- Future levels attach as filter parameters.

## Open Questions

- Which epic owns Country Geographic Experience — Epic 03 assumption?

---

# 10. Relationship with Capability 02

## Strengths

- Clear division: Capability 02 acts, Capability 03 makes visible — repeated in Interaction Architecture and Epic 01 freeze.
- Latest Initiatives, Statistics and Pipeline blocks source from Capability 02 public projections — Block Library data responsibility aligned.
- Initiative detail interaction path ends at public projection — not operational workspace serialization.
- Registration Gateway bridges to Capability 01/02 without merging environments.
- Anti-patterns from Capability 02 retrospective (operational/public merge, derived state honesty) reflected in Epic 02 content and trust model.

## Potential Risks

- Missing public projection integration map — field-level contract between Capability 02 builders and Epic 02 blocks undefined at architecture level.
- Pipeline stage labels must stay synchronized with Capability 02 vocabulary changes — coupling risk.
- Bootstrap participation data may mutate during development — Global Experience demo stability depends on Capability 02 bootstrap public routes.

## Recommendations

- Publish integration map adjunct before Epic 02 implementation Sprint 1.
- Stage label changes in Capability 02 require Capability 03 copy and block review gate.

## Confirmed Decisions

- Capability 03 must not mutate Participation aggregates through public interactions.
- Public blocks display projections only — no operational fields.
- Initiative public detail is Capability 02 delivery — Epic 02 depends on it for interaction path completion.

## Open Questions

- Are all six Participation stage public projections available for Initiative Levels World aggregate at Epic 02 launch?

---

# 11. Relationship with Future Country and Region Experience

## Strengths

- Country and Region explicitly non-goals in Discovery — scope boundary clear.
- Template Standard and Interaction Architecture define Geographic Experience as template + filter — future epics inherit without redesign.
- Narrative and content models use scope-parameter language throughout — future epics reuse block content architecture with Geographic Summary and Geographic Statistics.
- Epic 02 does not fork Home architecture for geography — future work is filter variant.

## Potential Risks

- Future Geographic epics might re-specify Home composition differently if Epic 02 freeze weak — mitigated by Page Template Standard and Epic 01 freeze.
- Country branding listed as Epic 01 deferral — could be misread as architecture fork; Epic 02 correctly treats as presentation variant.

## Recommendations

- Country and Region epics should reference Epic 02 Global Experience as **scope variant** — diff only Identity framing, Geographic Summary, filtered datasets.
- Do not create CountryPageArchitecture.md — extend Block Library scope behaviour only.

## Confirmed Decisions

- Geographic Experience shares Global Experience template and interaction model.
- Epic 02 is World-only delivery — not incomplete Country/Region architecture.

## Open Questions

- Single epic for both Country and Region or separate epics per geographic level?

---

# 12. Philosophy Validation

## Strengths

Validated against Epic 01 frozen principles and Epic 02 documents:

| Principle                                  | Epic 02 validation                                |
| ------------------------------------------ | ------------------------------------------------- |
| Public Space is window into living society | Vision, Narrative, Template Standard              |
| Observation precedes participation         | All Epic 02 docs                                  |
| Public Space never persuades — reveals     | Narrative, Content, Interaction                   |
| Navigation serves intentions               | Interaction §9, Discovery constraints             |
| Context Before Evidence                    | Content Architecture, Interaction §8, Template §6 |
| One Experience Block — One Responsibility  | Narrative, Content, Block order                   |
| Trust Through Verification                 | Trust sections across docs                        |
| Explainable Honesty                        | Content Architecture, Trust Narrative             |
| Filter Instead of Duplicate                | Geographic sections                               |
| Future Extension Without Redesign          | Interaction §11, Template §14                     |
| Accessibility builds trust                 | Template philosophy reference                     |
| Respect human attention                    | Interaction philosophy calm principles            |

Epic 02 philosophy is **coherent and enforceable** — not decorative.

## Potential Risks

- Philosophy density across six documents — teams may read one doc only; freeze consolidation needed for engineering gate.

## Recommendations

- `EPIC_02_ARCHITECTURE_FREEZE.md` should include philosophy checklist condensed from this section for PR review gate.

## Confirmed Decisions

- Epic 02 fully conforms to Epic 01 frozen principles — no contradictions identified.
- Success measured by public understanding growth — Interaction Final Statement — aligns with non-pressure registration philosophy.

## Open Questions

- None blocking approval.

---

# Cross-Cutting Issues Summary

| #   | Issue                                                      | Severity | Resolution                                                       |
| --- | ---------------------------------------------------------- | -------- | ---------------------------------------------------------------- |
| 1   | Public projection integration map absent                   | Medium   | Adjunct before implementation — not Epic 02 architecture blocker |
| 2   | Interaction vs Visitor Journey vocabulary                  | Low      | Cite Epic 01 harmonization in Epic 02 freeze                     |
| 3   | Optional secondary blocks (Media carousel, About preview)  | Low      | Declare out of Epic 02 required composition in freeze            |
| 4   | `PUBLIC_PAGE_TEMPLATE_STANDARD.md` platform-wide authority | Low      | Reference from Epic 02 freeze                                    |
| 5   | Map drill-down before Geographic epics                     | Medium   | Implementation plan behaviour rule                               |
| 6   | Missing `EPIC_02_ARCHITECTURE_FREEZE.md`                   | Medium   | Publish after this review approval                               |
| 7   | Missing Epic 02 implementation plan                        | Low      | Follows freeze — standard sequence                               |
| 8   | Header destination stubs if destinations unbuilt           | Medium   | Launch policy decision                                           |

No FAIL-severity architectural defects identified.

No redesign required.

---

# Verdict Summary

| Review Area                                 | Result      |
| ------------------------------------------- | ----------- |
| 1. Architectural consistency                | PASS        |
| 2. Narrative consistency                    | PASS        |
| 3. Content architecture                     | PASS        |
| 4. Interaction architecture                 | PASS        |
| 5. Navigation architecture                  | PASS        |
| 6. Public understanding                     | PASS        |
| 7. Trust model                              | PASS        |
| 8. Scalability                              | PASS        |
| 9. Geographic extensibility                 | PASS        |
| 10. Relationship with Capability 02         | CONDITIONAL |
| 11. Relationship with future Country/Region | PASS        |
| 12. Philosophy validation                   | PASS        |

**Summary:** 11 PASS · 1 CONDITIONAL · 0 FAIL

Conditional area resolves through adjunct integration map before implementation — not through architecture redesign.

---

# Final Verdict

## APPROVED

Epic 02 — Global Experience architecture is **approved** for freeze and implementation planning.

Epic 02:

- conforms to Epic 01 Architecture Freeze;
- defines complete World-scoped Global Experience across discovery, narrative, content, template, and interaction layers;
- introduces no unauthorized architectural concepts;
- preserves trust, calm exploration and observation-before-participation ethics;
- scales to Geographic and destination epics through filtering and template reuse.

**Conditions before implementation begins** (not blocking architecture approval):

1. Publish `EPIC_02_ARCHITECTURE_FREEZE.md` referencing this review.
2. Publish Capability 02 public projection → block **integration map** adjunct.
3. Define map scope interaction policy when Country/Region routes not yet available.
4. Resolve optional secondary blocks in Epic 02 freeze scope statement.

**Conditions before Epic 02 closure** (implementation phase):

5. Epic 02 implementation plan and copy/banned-phrases appendix.
6. Honest bootstrap public data strategy for World scope demo.

Architecture does not require remediation or redesign.

Proceed to Epic 02 architecture freeze and implementation planning.

---

# Source Documents Reviewed

| Document                                   | Path                                                                                                        |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Epic 02 Discovery Session 01               | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/DISCOVERY_SESSION_01.md`                       |
| Global Experience Vision                   | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_VISION.md`                   |
| Global Experience Narrative                | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_NARRATIVE.md`                |
| Global Experience Content Architecture     | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_CONTENT_ARCHITECTURE.md`     |
| Public Page Template Standard              | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/PUBLIC_PAGE_TEMPLATE_STANDARD.md`              |
| Global Experience Interaction Architecture | `capabilities/03_public_experience/EPIC_02_GLOBAL_EXPERIENCE/GLOBAL_EXPERIENCE_INTERACTION_ARCHITECTURE.md` |
| Epic 01 Architecture Freeze                | `capabilities/03_public_experience/EPIC_01_INFORMATION_SPACE/EPIC_01_ARCHITECTURE_FREEZE.md`                |

---

# Document Status

**Draft**

Epic 02 Architecture Review — Global Experience

Architecture status: **APPROVED**

Proceed to `EPIC_02_ARCHITECTURE_FREEZE.md`.
