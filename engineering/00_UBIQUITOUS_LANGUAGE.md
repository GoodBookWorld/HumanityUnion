# Humanity Union Ubiquitous Language

## Version 2.0

### Canonical Semantic Vocabulary for the Humanity Union Platform

---

# Document Purpose

Software quality depends on a **shared semantic language**.

Every important concept within Humanity Union must have:

- one preferred name;
- one authoritative meaning;
- explicit boundaries;
- well-defined relationships;
- documented misconceptions;
- traceability to the Domain Model.

This document establishes the **canonical semantic vocabulary** used throughout the Humanity Union Platform.

It serves as the single reference for terminology used in:

- Blueprint documentation;
- Engineering Architecture;
- Domain-Driven Design (DDD);
- System Architecture;
- API Design;
- Database Design;
- User Experience specifications;
- Validation scenarios;
- AI prompts;
- Technical documentation.

This document does **not** introduce new business concepts.

Its purpose is to formally define, standardize, and preserve the language already established by the Blueprint, Domain Model, and Architecture Decision Records.

All future engineering artefacts must conform to the terminology defined here.

---

## Relationship to Other Engineering Documents

This document defines **semantic language**.

It does not define:

- Aggregate boundaries;
- business behaviour;
- lifecycle transitions;
- event ownership;
- database design;
- API contracts.

Those responsibilities belong to other normative documents.

This document is therefore the semantic foundation upon which those documents are built.

---

## Domain Event Authority

Canonical Domain Event names, ownership, versions, lifecycle status, and deprecated aliases are governed exclusively by:

```
CANONICAL_EVENT_CATALOGUE.md
```

This document defines business terminology.

It does **not** maintain an independent Domain Event catalogue.

---

**Status:** Normative Engineering Reference

**Version:** 2.0

**Scope:** Canonical semantic vocabulary for all Humanity Union engineering artefacts

**Supersedes:** Version 1.0

**Related Documents**

- 01_SYSTEM_ARCHITECTURE.md
- 02_DOMAIN_MODEL.md
- CANONICAL_EVENT_CATALOGUE.md
- 11_APPLICATION_WORKFLOWS.md
- ARCHITECTURE_DECISION_RECORDS.md
- ENGINEERING_MANIFESTO.md

---

# Table of Contents

1. Principles

2. Domain Taxonomy

3. Legacy → Canonical Mapping

4. Term Template

5. Core Domain Terms

6. Relationship Terms

7. State Terms

8. Negative Definitions

9. Canonical Terminology Rules

10. Engineering Naming Conventions

11. Domain Events Vocabulary

12. Common Terminology Errors

13. Traceability

14. Glossary

15. Concept Evolution

16. Change Management

17. Guiding Principle

18. Document Verification

---

# 1. Principles

The Humanity Union Platform follows a strict semantic discipline.

Every engineering document, API, database model, user interface, and validation scenario must use the same vocabulary.

---

## Semantic Principles

| Principle | Rule |
|-----------|------|
| **One Concept = One Preferred Name** | Every business concept has exactly one canonical name. |
| **One Preferred Name = One Meaning** | A preferred term always carries the same semantic meaning across the entire platform. |
| **No Hidden Synonyms** | Alternative names may be documented but must never replace the canonical term in engineering artefacts. |
| **Business Language First** | Blueprint terminology has priority over implementation convenience. |
| **Technology Follows Domain** | Databases, APIs, and code adapt to business terminology—not the opposite. |
| **Domain Model Authority** | Domain Model defines behaviour; Ubiquitous Language defines terminology. |
| **Semantic Stability** | Canonical definitions change only through Architecture Decision Records. |
| **Historical Traceability** | Previous terminology is preserved through Legacy Mapping instead of silent replacement. |
| **Human-Centric Language** | Terminology must describe civic reality rather than software implementation. |
| **Consistency Before Convenience** | Familiar software terminology never overrides canonical Humanity Union vocabulary. |

---

## Engineering Rules

Every engineering artefact shall:

- use Preferred Names exactly as defined here;
- avoid introducing unofficial synonyms;
- reference this document whenever terminology ambiguity exists;
- preserve semantic consistency across all bounded contexts.

---

# 2. Domain Taxonomy

The Humanity Union Platform organizes its vocabulary into semantic domains.

This taxonomy reflects the Domain Model.

---

## Actors

- Participant
- Membership
- Member
- Guest

---

## Identity

- Profile
- Verification
- Workspace
- Civic Responsibility Profile
- Social Activity Plan

---

## Core Civic Objects

- Initiative
- Activity
- Decision Session
- Collective Decision
- Implementation
- Impact Assessment

---

## Collaboration

- Collaborative Analysis
- Contribution
- Comment
- Question
- Evidence
- Suggestion
- Collective Signal
- Proposal
- Proposal Evolution
- Petition

---

## Institutions

- Institution
- Founding Mandate
- Institution Review
- Institutional Position
- Institutional Memory
- Governance Relationship
- Working Group
- Ally Relationship

---

## Supporting Domains

- Notification
- Translation
- Media Asset
- AI Facilitation
- Public Record
- Private Information

---

## Participation Concepts

- Affected Community
- Participation Eligibility
- Responsibility
- Visibility

---

This taxonomy is normative.

All future engineering documentation should classify concepts according to these semantic domains.

---

# 3. Legacy → Canonical Mapping

Humanity Union architecture has evolved.

Previous terminology remains documented to preserve historical traceability.

Legacy terms shall not be used in new engineering documents.

---

| Legacy Term | Canonical Term |
|-------------|----------------|
| Member | Participant (generic actor) |
| Member | Member = Participant with active Membership |
| Discussion | Collaborative Analysis |
| Member Signal | Collective Signal |
| Decision | Decision Session or Collective Decision (context-dependent) |
| Proposal Aggregate | Proposal Entity inside Initiative |
| Ally | Ally Relationship |
| Proposal Context | Initiative Context |
| Discussion Context | Initiative / Collaborative Analysis |
| Member Repository | Participant Repository |

---

Legacy terminology may appear only when:

- explaining historical documents;
- migrating existing code;
- documenting architectural evolution.

It shall never be introduced as preferred terminology.

---

# 4. Term Template

Every canonical term follows the same structure.

| Field | Purpose |
|---------|----------|
| **Preferred Name** | Canonical business name |
| **Category** | Semantic domain |
| **Definition** | Authoritative meaning |
| **Purpose** | Why the concept exists |
| **Created By** | Typical origin actor or process |
| **Used In** | Relevant bounded contexts |
| **Related Concepts** | Connected canonical concepts |
| **Common Misunderstandings** | Typical semantic confusion |
| **Implementation Notes** | DDD guidance without implementation details |
| **Status** | Stable / Deprecated / Proposed |
| **Traceability** | Blueprint, Domain Model, ADR references |

---

# 5. Core Domain Terms

## Participant

| Field | Value |
|-------|-------|
| **Preferred Name** | Participant |
| **Category** | Actor |
| **Definition** | The universal civic actor of the Humanity Union Platform capable of participating in civic processes according to platform rules. |
| **Purpose** | Universal representation of every authenticated civic participant. |
| **Created By** | Registration and identity verification. |
| **Used In** | All bounded contexts. |
| **Related Concepts** | Membership, Profile, Workspace, Civic Responsibility Profile. |
| **Common Misunderstandings** | A Participant is not necessarily a Member. |
| **Implementation Notes** | Aggregate Root within the Participant Domain. |
| **Status** | Stable |

---

## Membership

| Field | Value |
|-------|-------|
| **Preferred Name** | Membership |
| **Category** | Actor |
| **Definition** | An optional civic status associated with a Participant, representing formal membership within Humanity Union. |
| **Purpose** | Enable formal participation rights without defining participant identity. |
| **Created By** | Membership approval process. |
| **Used In** | Membership Domain. |
| **Related Concepts** | Participant, Member. |
| **Common Misunderstandings** | Membership is optional and does not define identity. |
| **Implementation Notes** | Independent Aggregate Root. |
| **Status** | Stable |

---

## Member

| Field | Value |
|-------|-------|
| **Preferred Name** | Member |
| **Category** | Derived Actor |
| **Definition** | A Participant with an active Membership. |
| **Purpose** | Human-readable designation of formal membership. |
| **Created By** | Active Membership. |
| **Used In** | Public communication and governance. |
| **Related Concepts** | Participant, Membership. |
| **Common Misunderstandings** | Member is not a primary domain concept. |
| **Implementation Notes** | Derived business concept, not an Aggregate Root. |
| **Status** | Stable |

---

## Guest

| Field | Value |
|-------|-------|
| **Preferred Name** | Guest |
| **Category** | Actor |
| **Definition** | An unauthenticated visitor with access limited to publicly available civic information. |
| **Purpose** | Public transparency without authenticated participation. |
| **Created By** | Anonymous access. |
| **Used In** | Presentation Layer. |
| **Related Concepts** | Participant. |
| **Common Misunderstandings** | Guest cannot perform civic actions. |
| **Implementation Notes** | Outside the Participant Domain. |
| **Status** | Stable |

---

## Initiative

| Field | Value |
|-------|-------|
| **Preferred Name** | Initiative |
| **Category** | Core Civic Object |
| **Definition** | The central civic aggregate that represents a public issue, opportunity, challenge, or objective requiring collaborative development, collective decision-making, implementation, and impact evaluation. |
| **Purpose** | Serve as the complete lifecycle container for civic change. |
| **Created By** | Participant |
| **Used In** | Initiative Domain |
| **Related Concepts** | Collaborative Analysis, Proposal, Petition, Decision Session, Implementation, Impact Assessment |
| **Common Misunderstandings** | An Initiative is not a Proposal, Petition, Discussion, or Project. It is the complete governance lifecycle. |
| **Implementation Notes** | Primary Aggregate Root of the Civic Domain. Owns Collaborative Analysis, Proposal Evolution, Proposals, Petitions, Collective Signals, and references Decision Sessions. |
| **Status** | Stable |

---

## Collaborative Analysis

| Field | Value |
|-------|-------|
| **Preferred Name** | Collaborative Analysis |
| **Category** | Collaboration |
| **Definition** | The structured collaborative environment in which Participants explore an Initiative, exchange knowledge, contribute evidence, challenge assumptions, refine ideas, and collectively develop solutions before formal decision-making begins. |
| **Purpose** | Transform individual knowledge into collective understanding. |
| **Created By** | Initiative |
| **Used In** | Initiative |
| **Related Concepts** | Contribution, Evidence, Proposal Evolution, Collective Signal |
| **Common Misunderstandings** | Collaborative Analysis is not voting, debate for its own sake, or institutional authority. |
| **Implementation Notes** | Entity within Initiative Aggregate. |
| **Status** | Stable |

---

## Contribution

| Field | Value |
|-------|-------|
| **Preferred Name** | Contribution |
| **Category** | Collaboration |
| **Definition** | A structured unit of participation submitted during Collaborative Analysis for the purpose of advancing collective understanding. |
| **Purpose** | Capture meaningful civic participation. |
| **Created By** | Participant |
| **Used In** | Collaborative Analysis |
| **Related Concepts** | Comment, Question, Evidence, Suggestion |
| **Common Misunderstandings** | A Contribution is not automatically evidence or an official position. |
| **Implementation Notes** | Entity within Collaborative Analysis. |
| **Status** | Stable |

---

## Comment

| Field | Value |
|-------|-------|
| **Preferred Name** | Comment |
| **Category** | Contribution Type |
| **Definition** | A Contribution expressing observation, reasoning, feedback, or opinion regarding an Initiative. |
| **Purpose** | Encourage constructive dialogue. |
| **Created By** | Participant |
| **Used In** | Collaborative Analysis |
| **Related Concepts** | Contribution |
| **Common Misunderstandings** | A Comment is not a Proposal or Decision. |
| **Implementation Notes** | Specialized Contribution. |
| **Status** | Stable |

---

## Question

| Field | Value |
|-------|-------|
| **Preferred Name** | Question |
| **Category** | Contribution Type |
| **Definition** | A Contribution requesting clarification, information, or additional analysis related to an Initiative. |
| **Purpose** | Improve collective understanding. |
| **Created By** | Participant |
| **Used In** | Collaborative Analysis |
| **Related Concepts** | Contribution |
| **Common Misunderstandings** | Questions do not imply disagreement or approval. |
| **Implementation Notes** | Specialized Contribution. |
| **Status** | Stable |

---

## Evidence

| Field | Value |
|-------|-------|
| **Preferred Name** | Evidence |
| **Category** | Contribution Type |
| **Definition** | A Contribution containing verifiable facts, research, references, datasets, or documented observations supporting Collaborative Analysis or Proposal Evolution. |
| **Purpose** | Increase decision quality through verifiable information. |
| **Created By** | Participant |
| **Used In** | Collaborative Analysis |
| **Related Concepts** | Contribution, Proposal Evolution |
| **Common Misunderstandings** | Evidence is not opinion, popularity, or authority. |
| **Implementation Notes** | Specialized Contribution with verification metadata. |
| **Status** | Stable |

---

## Suggestion

| Field | Value |
|-------|-------|
| **Preferred Name** | Suggestion |
| **Category** | Contribution Type |
| **Definition** | A Contribution proposing an idea, improvement, alternative approach, or possible solution without creating a formal Proposal. |
| **Purpose** | Encourage creative exploration before governance. |
| **Created By** | Participant |
| **Used In** | Collaborative Analysis |
| **Related Concepts** | Contribution, Proposal Evolution |
| **Common Misunderstandings** | Suggestions are informal contributions rather than governed proposals. |
| **Implementation Notes** | Specialized Contribution. |
| **Status** | Stable |

---

## Collective Signal

| Field | Value |
|-------|-------|
| **Preferred Name** | Collective Signal |
| **Category** | Collaboration |
| **Definition** | An aggregated expression of civic interest, concern, urgency, or perceived importance emerging from Participant interactions within an Initiative. |
| **Purpose** | Help identify priorities requiring structured attention. |
| **Created By** | Participant activity |
| **Used In** | Initiative |
| **Related Concepts** | Collaborative Analysis, Proposal Evolution |
| **Common Misunderstandings** | A Collective Signal is not evidence, voting, or public approval. |
| **Implementation Notes** | Entity owned by Initiative Aggregate. |
| **Status** | Stable |

---

## Proposal Evolution

| Field | Value |
|-------|-------|
| **Preferred Name** | Proposal Evolution |
| **Category** | Collaboration |
| **Definition** | The governed process through which ideas mature into formal Proposals by incorporating collaborative feedback, evidence, expert analysis, and collective refinement. |
| **Purpose** | Produce high-quality proposals before governance review. |
| **Created By** | Collaborative Analysis |
| **Used In** | Initiative |
| **Related Concepts** | Proposal, Evidence, Collective Signal |
| **Common Misunderstandings** | Proposal Evolution is not a Proposal itself. |
| **Implementation Notes** | Business process within Initiative Aggregate. |
| **Status** | Stable |

---

## Proposal

| Field | Value |
|-------|-------|
| **Preferred Name** | Proposal |
| **Category** | Governance Object |
| **Definition** | A structured recommendation for civic or institutional action that has completed Proposal Evolution and is ready for formal governance consideration. |
| **Purpose** | Present a mature solution for collective evaluation. |
| **Created By** | Proposal Evolution |
| **Used In** | Initiative |
| **Related Concepts** | Petition, Decision Session |
| **Common Misunderstandings** | A Proposal is neither an Aggregate Root nor a Decision. |
| **Implementation Notes** | Entity within Initiative Aggregate. |
| **Status** | Stable |

---

## Petition

| Field | Value |
|-------|-------|
| **Preferred Name** | Petition |
| **Category** | Governance Object |
| **Definition** | A formal request demonstrating sufficient civic support for a Proposal to proceed to collective decision-making. |
| **Purpose** | Validate civic demand before governance review. |
| **Created By** | Proposal |
| **Used In** | Initiative |
| **Related Concepts** | Proposal, Decision Session |
| **Common Misunderstandings** | A Petition is not a vote and does not approve a Proposal. |
| **Implementation Notes** | Entity within Initiative Aggregate. |
| **Status** | Stable |

---

## Decision Session

| Field | Value |
|-------|-------|
| **Preferred Name** | Decision Session |
| **Category** | Governance |
| **Definition** | A governed process during which eligible decision-makers evaluate one or more Proposals and produce one or more Collective Decisions. |
| **Purpose** | Provide accountable collective governance. |
| **Created By** | Initiative |
| **Used In** | Governance Domain |
| **Related Concepts** | Proposal, Collective Decision |
| **Common Misunderstandings** | A Decision Session is not the Decision itself. |
| **Implementation Notes** | Independent Aggregate Root. References Initiatives and Proposals. |
| **Status** | Stable |

---

## Collective Decision

| Field | Value |
|-------|-------|
| **Preferred Name** | Collective Decision |
| **Category** | Governance Outcome |
| **Definition** | The official governed outcome produced during a Decision Session that authorizes, rejects, modifies, or defers civic action. |
| **Purpose** | Provide legitimate and traceable governance outcomes. |
| **Created By** | Decision Session |
| **Used In** | Governance Domain |
| **Related Concepts** | Decision Session, Implementation |
| **Common Misunderstandings** | A Collective Decision is not the voting process itself. |
| **Implementation Notes** | Entity within Decision Session Aggregate. |
| **Status** | Stable |

---

## Implementation

| Field | Value |
|-------|-------|
| **Preferred Name** | Implementation |
| **Category** | Execution |
| **Definition** | The coordinated execution of an approved Collective Decision through assigned responsibilities, monitored progress, and recorded Activities. |
| **Purpose** | Transform governance outcomes into real-world results. |
| **Created By** | Collective Decision |
| **Used In** | Execution Domain |
| **Related Concepts** | Activity, Impact Assessment |
| **Common Misunderstandings** | Implementation is not governance or evaluation. |
| **Implementation Notes** | Independent Aggregate Root. |
| **Status** | Stable |

---

## Impact Assessment

| Field | Value |
|-------|-------|
| **Preferred Name** | Impact Assessment |
| **Category** | Evaluation |
| **Definition** | The structured evaluation of actual outcomes produced by an Implementation compared with expected objectives, assumptions, and public value. |
| **Purpose** | Support learning, accountability, and continuous improvement. |
| **Created By** | Implementation |
| **Used In** | Evaluation Domain |
| **Related Concepts** | Implementation, Institutional Memory |
| **Common Misunderstandings** | Impact Assessment is not an audit or a new Decision Session. |
| **Implementation Notes** | Independent Aggregate Root preserving long-term evaluation history. |
| **Status** | Stable |

---

## Institution

| Field | Value |
|-------|-------|
| **Preferred Name** | Institution |
| **Category** | Institutional Domain |
| **Definition** | A permanent governance structure established to fulfill an ongoing civic responsibility within a clearly defined mandate, authority, and accountability framework. |
| **Purpose** | Sustain long-term governance responsibilities beyond the lifecycle of individual Initiatives. |
| **Created By** | Collective Decision |
| **Used In** | Institutional Domain |
| **Related Concepts** | Founding Mandate, Institution Review, Institutional Memory |
| **Common Misunderstandings** | An Institution is not a Working Group, Project, or Initiative. |
| **Implementation Notes** | Independent Aggregate Root. |
| **Status** | Stable |

---

## Founding Mandate

| Field | Value |
|-------|-------|
| **Preferred Name** | Founding Mandate |
| **Category** | Institutional Domain |
| **Definition** | The authoritative document defining the purpose, authority, responsibilities, limitations, review criteria, and closure conditions of an Institution. |
| **Purpose** | Establish institutional legitimacy and accountability. |
| **Created By** | Institution Formation |
| **Used In** | Institution |
| **Related Concepts** | Institution Review, Institutional Position |
| **Common Misunderstandings** | A Founding Mandate is not an operational policy or implementation plan. |
| **Implementation Notes** | Immutable foundational document with version history. |
| **Status** | Stable |

---

## Institution Review

| Field | Value |
|-------|-------|
| **Preferred Name** | Institution Review |
| **Category** | Institutional Governance |
| **Definition** | A periodic or conditional evaluation of an Institution's mandate, effectiveness, public value, accountability, and continued necessity. |
| **Purpose** | Prevent institutional stagnation and preserve accountability. |
| **Created By** | Review schedule or Collective Decision |
| **Used In** | Institution |
| **Related Concepts** | Founding Mandate, Institutional Memory |
| **Common Misunderstandings** | A review is not optional and is not conducted solely by the Institution itself. |
| **Implementation Notes** | Governed review process. |
| **Status** | Stable |

---

## Institutional Position

| Field | Value |
|-------|-------|
| **Preferred Name** | Institutional Position |
| **Category** | Institutional Memory |
| **Definition** | A documented institutional statement, conclusion, interpretation, recommendation, or official position preserved within Institutional Memory. |
| **Purpose** | Preserve institutional reasoning over time. |
| **Created By** | Institutional action |
| **Used In** | Institutional Memory |
| **Related Concepts** | Institution, Collective Decision |
| **Common Misunderstandings** | An Institutional Position is not an informal opinion or personal statement. |
| **Implementation Notes** | Version-controlled institutional record. |
| **Status** | Stable |

---

## Institutional Memory

| Field | Value |
|-------|-------|
| **Preferred Name** | Institutional Memory |
| **Category** | Knowledge Domain |
| **Definition** | The permanent preservation of civic reasoning, evidence, alternatives, disagreements, decisions, implementations, and impact assessments across time. |
| **Purpose** | Enable institutional continuity, transparency, accountability, and organizational learning. |
| **Created By** | All governed civic processes |
| **Used In** | All Domains |
| **Related Concepts** | Activity, Collective Decision, Impact Assessment, Institutional Position |
| **Common Misunderstandings** | Institutional Memory is not merely an archive of documents. |
| **Implementation Notes** | Independent Aggregate Root responsible for preserving historical knowledge. |
| **Status** | Stable |

---

## Governance Relationship

| Field | Value |
|-------|-------|
| **Preferred Name** | Governance Relationship |
| **Category** | Institutional Coordination |
| **Definition** | A formally defined relationship governing cooperation, responsibility, reporting, oversight, or coordination between Institutions without creating hierarchical dependency. |
| **Purpose** | Coordinate governance while preserving institutional autonomy. |
| **Created By** | Collective Decision |
| **Used In** | Institutional Domain |
| **Related Concepts** | Institution, Working Group |
| **Common Misunderstandings** | Governance Relationships do not establish superior or subordinate authority unless explicitly defined. |
| **Implementation Notes** | Relationship Entity connecting Institutional Aggregates. |
| **Status** | Stable |

---

## Working Group

| Field | Value |
|-------|-------|
| **Preferred Name** | Working Group |
| **Category** | Collaboration |
| **Definition** | A temporary collaborative structure established to accomplish a clearly defined objective within a limited scope and duration. |
| **Purpose** | Coordinate focused collaborative work. |
| **Created By** | Institution or Collective Decision |
| **Used In** | Initiative, Institution |
| **Related Concepts** | Governance Relationship, Ally Relationship |
| **Common Misunderstandings** | A Working Group is not a permanent Institution. |
| **Implementation Notes** | Independent Aggregate Root with bounded lifecycle. |
| **Status** | Stable |

---

## Ally Relationship

| Field | Value |
|-------|-------|
| **Preferred Name** | Ally Relationship |
| **Category** | Collaboration |
| **Definition** | A governed collaborative relationship between Participants or organizational entities established for coordinated civic work within agreed boundaries. |
| **Purpose** | Enable trusted collaboration while preserving autonomy. |
| **Created By** | Mutual agreement |
| **Used In** | Working Groups |
| **Related Concepts** | Participant, Working Group |
| **Common Misunderstandings** | Ally Relationships do not transfer authority or institutional responsibility. |
| **Implementation Notes** | Relationship Entity. |
| **Status** | Stable |

---

## AI Facilitation

| Field | Value |
|-------|-------|
| **Preferred Name** | AI Facilitation |
| **Category** | Cross-Cutting Service |
| **Definition** | Advisory artificial intelligence services supporting understanding, analysis, summarization, organization of knowledge, multilingual communication, and collaborative facilitation without exercising governance authority. |
| **Purpose** | Increase collective intelligence while preserving human decision-making. |
| **Created By** | Participant request or system workflow |
| **Used In** | All Domains |
| **Related Concepts** | Collaborative Analysis, Institutional Memory, Translation |
| **Common Misunderstandings** | AI Facilitation never creates legitimate governance outcomes. |
| **Implementation Notes** | Domain Service with strictly advisory authority. |
| **Status** | Stable |

---

## Notification

| Field | Value |
|-------|-------|
| **Preferred Name** | Notification |
| **Category** | Cross-Cutting Object |
| **Definition** | A responsibility-based message generated from Domain Events informing Participants about civic work requiring attention. |
| **Purpose** | Deliver relevant civic information at the appropriate time. |
| **Created By** | Domain Events |
| **Used In** | Notification Domain |
| **Related Concepts** | Activity, Workspace |
| **Common Misunderstandings** | Notifications are not Activities or official governance records. |
| **Implementation Notes** | Read-model generated from Domain Events. |
| **Status** | Stable |

---

## Translation

| Field | Value |
|-------|-------|
| **Preferred Name** | Translation |
| **Category** | Cross-Cutting Service |
| **Definition** | Multilingual representation of civic content while preserving semantic equivalence and permanent linkage to the authoritative original content. |
| **Purpose** | Enable global participation without altering original meaning. |
| **Created By** | Locale requirements |
| **Used In** | All Domains |
| **Related Concepts** | Collaborative Analysis, Contribution, Institutional Memory |
| **Common Misunderstandings** | Translation is not reinterpretation or replacement of original content. |
| **Implementation Notes** | Locale-specific representations linked to canonical content. |
| **Status** | Stable |

---

## Public Record

| Field | Value |
|-------|-------|
| **Preferred Name** | Public Record |
| **Category** | Transparency |
| **Definition** | Information intentionally published for civic transparency, accountability, institutional legitimacy, and historical preservation. |
| **Purpose** | Ensure public trust through openness. |
| **Created By** | Governed publication |
| **Used In** | All Domains |
| **Related Concepts** | Institutional Memory, Private Information |
| **Common Misunderstandings** | Public Records do not include unrestricted personal information. |
| **Implementation Notes** | Visibility classification. |
| **Status** | Stable |

---

## Private Information

| Field | Value |
|-------|-------|
| **Preferred Name** | Private Information |
| **Category** | Privacy |
| **Definition** | Information protected from public visibility according to privacy rules, legal obligations, ethical principles, or personal safety requirements. |
| **Purpose** | Protect Participants while preserving institutional accountability. |
| **Created By** | Privacy policies |
| **Used In** | Participant Domain |
| **Related Concepts** | Public Record, Verification |
| **Common Misunderstandings** | Privacy is not secrecy used to avoid accountability. |
| **Implementation Notes** | Access-controlled information classification. |
| **Status** | Stable |

---

## Affected Community

| Field | Value |
|-------|-------|
| **Preferred Name** | Affected Community |
| **Category** | Participation Concept |
| **Definition** | Individuals, groups, or organizations directly impacted by an Initiative, Proposal, Collective Decision, or Implementation whose experience is relevant to legitimate governance. |
| **Purpose** | Ensure civic decisions reflect real-world impact. |
| **Created By** | Initiative analysis |
| **Used In** | Initiative, Collaborative Analysis, Proposal Evolution |
| **Related Concepts** | Collective Signal, Evidence, Impact Assessment |
| **Common Misunderstandings** | An Affected Community is not represented by a single Participant unless explicitly authorized. |
| **Implementation Notes** | Participation concept referenced across multiple aggregates. |
| **Status** | Stable |

---

# 6. Relationship Terms

Relationship verbs define the **canonical semantic relationships** between domain concepts. They are normative for documentation, Domain Models, APIs, validation scenarios, and engineering discussions.

| Relationship | Meaning | Example |
|--------------|---------|---------|
| **creates** | Originates a new domain object | Participant **creates** Initiative |
| **participates in** | Takes part in a governed process | Participant **participates in** Collaborative Analysis |
| **contributes to** | Adds knowledge or information | Participant **contributes to** Collaborative Analysis |
| **supports** | Expresses civic support without granting authority | Participant **supports** Petition |
| **references** | Links to another domain concept without ownership | Proposal **references** Evidence |
| **belongs to** | Exists within the aggregate boundary of another concept | Proposal **belongs to** Initiative |
| **contains** | Owns subordinate entities | Initiative **contains** Collaborative Analysis |
| **evolves into** | Progresses through governed lifecycle | Proposal Evolution **evolves into** Proposal |
| **initiates** | Starts a governed process | Petition **initiates** Decision Session |
| **produces** | Creates a governed outcome | Decision Session **produces** Collective Decision |
| **implements** | Executes approved governance | Implementation **implements** Collective Decision |
| **evaluates** | Measures achieved outcomes | Impact Assessment **evaluates** Implementation |
| **preserves** | Maintains historical information | Institutional Memory **preserves** Institutional Position |
| **coordinates** | Aligns independent governance entities | Governance Relationship **coordinates** Institutions |

---

# 7. State Terms

State terms describe lifecycle conditions. Each Aggregate Root defines its own lifecycle while using the shared vocabulary below.

| State | Meaning |
|---------|---------|
| **Draft** | Being prepared but not yet submitted |
| **Active** | Currently operating within its intended scope |
| **Open** | Accepting participation |
| **In Review** | Under formal evaluation |
| **Pending** | Waiting for prerequisite action |
| **Approved** | Officially accepted through governance |
| **Rejected** | Officially declined while preserving history |
| **Implemented** | Successfully executed |
| **Suspended** | Temporarily inactive under defined conditions |
| **Completed** | Finished with no further operational work |
| **Archived** | Preserved for historical reference |
| **Superseded** | Replaced by a newer authoritative version |
| **Withdrawn** | Voluntarily removed before completion |

---

# 8. Negative Definitions

Semantic precision requires explicit boundaries.

| Concept | Is NOT |
|----------|--------|
| Initiative | A Proposal, Petition, or Project |
| Collaborative Analysis | Voting, governance authority, or implementation |
| Proposal | A Decision or Aggregate Root |
| Petition | A vote or Collective Decision |
| Collective Signal | Evidence, voting result, or public approval |
| Decision Session | A Collective Decision |
| Collective Decision | The voting process |
| Implementation | Governance or evaluation |
| Impact Assessment | A new Decision Session |
| Institution | A Working Group or Initiative |
| Working Group | A permanent Institution |
| Notification | An Activity or governance record |
| AI Facilitation | Governance authority or autonomous decision-maker |
| Translation | A reinterpretation of original content |
| Institutional Memory | A document archive only |
| Membership | Participant identity |

---

# 9. Canonical Terminology Rules

## One Concept — One Name

Each business concept has exactly one Preferred Name.

No engineering artefact may introduce alternative terminology without an Architecture Decision Record.

---

## Capitalization

Canonical domain concepts use Title Case.

Examples:

- Participant
- Initiative
- Collaborative Analysis
- Collective Decision
- Institutional Memory

Generic English words remain lowercase when not referring to canonical concepts.

---

## Business Before Technology

Technology must adapt to business terminology.

Preferred engineering names:

- InitiativeRepository
- ParticipantService
- DecisionSession
- CollectiveDecision

Avoid technical replacements such as:

- Thread
- Ticket
- Post
- Topic
- Case

unless those concepts actually exist in the business domain.

---

## Semantic Stability

Canonical terminology changes only through:

- Blueprint evolution
- Domain Model revision
- ADR approval

---

# 10. Engineering Naming Conventions

| Artefact | Convention | Example |
|----------|------------|---------|
| Aggregate Root | Singular noun | Initiative |
| Entity | Business noun | Proposal |
| Value Object | Business noun | VerificationLevel |
| Repository | `{Aggregate}Repository` | InitiativeRepository |
| Domain Service | `{Concept}DomainService` | GovernanceDomainService |
| Application Service | `{Context}Service` | InitiativeService |
| Command | `{Verb}{Aggregate}Command` | CreateInitiativeCommand |
| Query | `Get{Aggregate}Query` | GetInitiativeQuery |
| Domain Event | `{Aggregate}{PastTenseVerb}` | InitiativeCreated |
| DTO | `{Aggregate}{Purpose}Dto` | ProposalSummaryDto |
| Policy | `{BusinessRule}Policy` | EligibilityPolicy |

---

# 11. Domain Events Vocabulary

Domain Events describe immutable business facts.

Commands express intent.

Events describe completed outcomes.

---

## Naming Pattern

```
Aggregate + Past Tense Verb
```

Examples:

- InitiativeCreated
- CollaborativeAnalysisStarted
- ContributionAdded
- ProposalSubmitted
- PetitionOpened
- DecisionSessionStarted
- CollectiveDecisionReached
- ImplementationStarted
- ImpactAssessmentCompleted

---

## Authority

Canonical event definitions are maintained exclusively in:

```
CANONICAL_EVENT_CATALOGUE.md
```

This document defines terminology only.

---

# 12. Common Terminology Errors

| Incorrect | Correct |
|------------|---------|
| User | Participant |
| Discussion | Collaborative Analysis |
| Member Signal | Collective Signal |
| Proposal Vote | Decision Session |
| Decision | Collective Decision (when referring to the outcome) |
| Thread | Collaborative Analysis |
| Ticket | Initiative |
| Post | Contribution |
| Admin approved | Collective Decision approved |
| AI decided | AI summarized |
| Popular Proposal | Supported Proposal |
| Institution Archive | Institutional Memory |

---

# 13. Traceability

Every canonical term must be traceable.

| Source | Purpose |
|---------|---------|
| Blueprint | Original business meaning |
| Domain Model | Aggregate ownership and relationships |
| ADR | Architectural decisions |
| Validation Scenarios | Behaviour verification |
| Engineering Documents | Technical implementation |

Traceability guarantees semantic consistency throughout the platform.

---

# 14. Glossary

The complete alphabetical glossary is generated from all canonical terms defined in Section 5.

No duplicate definitions are permitted.

Every engineering document should reference the glossary rather than redefining business terminology.

---

# 15. Concept Evolution

Humanity Union terminology evolves through governed architectural refinement.

| Version 1.x | Version 2.0 |
|--------------|-------------|
| Member | Participant |
| Discussion | Collaborative Analysis |
| Member Signal | Collective Signal |
| Proposal Aggregate | Proposal Entity |
| Decision | Decision Session / Collective Decision |
| Proposal Lifecycle | Initiative Lifecycle |
| Activity-centric collaboration | Initiative-centric collaboration |

Historical terminology remains documented for traceability but is not used in new engineering artefacts.

---

# 16. Change Management

Semantic changes require:

1. Blueprint alignment.
2. Domain Model alignment.
3. Architecture Decision Record.
4. Validation evidence.
5. Regression review.
6. Documentation synchronization.

Minor editorial corrections do not require ADR approval.

---

# 17. Guiding Principle

> **Shared language creates shared understanding. Shared understanding enables trustworthy governance.**

Humanity Union treats semantic consistency as a first-class architectural concern.

The Ubiquitous Language is the foundation upon which software, governance, documentation, and collaboration are built.

---

# 18. Document Verification

| Verification | Status |
|--------------|--------|
| Canonical terminology defined | ✔ |
| Domain Model synchronized | ✔ |
| Aggregate terminology synchronized | ✔ |
| Relationship vocabulary defined | ✔ |
| Lifecycle vocabulary defined | ✔ |
| Negative definitions provided | ✔ |
| Naming conventions established | ✔ |
| Domain Event terminology aligned | ✔ |
| Traceability defined | ✔ |
| Legacy terminology mapped | ✔ |

---

**Document:** Ubiquitous Language

**Version:** 2.0

**Status:** Normative Engineering Reference

**Scope:** Canonical semantic vocabulary for Humanity Union

**Authority:** Engineering Architecture

**Supersedes:** Version 1.0

---

## Usage Rule

All engineering artefacts—including source code, APIs, database schemas, user interface specifications, validation scenarios, architectural documentation, and AI prompts—shall use the Preferred Names defined in this document unless an explicit exception has been approved through the Change Management process.
