# Institution Formation & Civic Nomination Briefing

**Task:** TASK-071  
**Status:** Briefing only — no code, UI, API, domain models, or voting implementation  
**Builds on:** TASK-070 (Institutions Experience), TASK-069 (Institutions Page Briefing)  
**Last updated:** 2026-07-08

---

## 1. Executive Summary

Institution Formation through **Civic Nomination** is Humanity Union’s proposed pathway for participants to put forward themselves or another person for future institutional roles — not through popularity contests or private questionnaires, but through structured public nomination, evidence-backed posters, and transparent **Support Votes** with verified/unverified visibility overlays.

This briefing defines the product and architecture for a workflow that evolves the Institutions Experience page beyond its current **Create Initiative (`#`)** placeholders. Civic Nomination is **not** ordinary initiative creation. It is a distinct civic instrument for institution formation: nomination → public poster → transparent support evaluation → future governance selection (policy deferred).

The system evaluates **contribution, expertise, and public responsibility** — never personal identity traits. Every nomination requires commitment to universal human values and the Universal Declaration of Human Rights. Support voting is **unweighted**; verified and unverified participant counts are transparency overlays only. No automatic appointment follows from vote totals.

This document prepares TASK-072 through TASK-075. No engineering work begins until those tasks are explicitly approved.

---

## 2. Purpose and Distinction

| Dimension      | Civic Nomination                                               | Initiative creation                                        |
| -------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| **Goal**       | Propose a person for a future institutional role               | Advance a civic problem through the participation pipeline |
| **Output**     | Public Nomination Poster                                       | Initiative workspace and pipeline records                  |
| **Evaluation** | Transparent Support Votes (support / do not support / abstain) | Collective Decision, petitions, implementation stages      |
| **Authority**  | Expresses civic support only — no appointment                  | Operational civic lifecycle within Capability 02           |
| **Form focus** | Evidence, achievements, expertise, vision                      | Problem definition, analysis, proposals                    |

Institution cards on `/institutions` will eventually offer **Create Nomination** and **All Nominations** for eligible roles, replacing generic Create Initiative placeholders where nomination is appropriate.

---

## 3. Core Principles

1. **Transparency** — nominations, posters, and vote aggregates are public by design (subject to privacy rules below).
2. **Self or other nomination** — participants may nominate themselves or another person.
3. **Merit and evidence** — evaluate contribution, expertise, and public responsibility; not personal identity.
4. **No private personal questions** — age, gender, ethnicity, religion, family status, and political affiliation are excluded.
5. **Evidence over self-description** — confirmed achievements and demonstrable links matter more than narrative alone.
6. **Universal values commitment** — every nomination requires UDHR and constitutional principles declarations.
7. **Unweighted voting** — one registered active participant = one active vote per nomination; no weighting.
8. **Verified/unverified overlay** — counts shown separately for transparency; they do not change vote weight.
9. **No popularity mechanics** — no rankings, scores, followers, or endorsement markets.
10. **No automatic appointment** — support votes do not create office, employment, or legal authority.
11. **Governance deferred** — final selection and election rules are future charter policy.

---

## 4. Terminology

### Use

| Term                         | Definition                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------ |
| **Civic Nomination**         | A structured public record proposing a person for a future institutional role. |
| **Nominee**                  | The person named for consideration (self or other).                            |
| **Nominator**                | The platform participant who submits the nomination.                           |
| **Nomination Poster**        | The public presentation artifact generated from a submitted nomination.        |
| **Compact Poster**           | Summary card shown in All Nominations grid/modal.                              |
| **Full Poster**              | Complete nomination view with all fields and voting widget.                    |
| **Transparent Support Vote** | A participant’s unweighted choice: support, do not support, or abstain.        |

### Avoid

Candidate popularity, rating, ranking, score, followers, endorsement market, leaderboard, trending.

---

## 5. Eligible Institution Roles

### 5.1 Humanity Council

| Attribute                     | Specification                                                |
| ----------------------------- | ------------------------------------------------------------ |
| **Nomination**                | Enabled — self or other                                      |
| **Country**                   | Required — one nominee per country in future selection model |
| **Scope (recommended)**       | Country scope for Support Votes                              |
| **Election/selection**        | Future governance policy — deferred                          |
| **Institution card (future)** | Create Nomination, All Nominations, Learn More               |

### 5.2 Chamber of State Representatives

| Attribute                     | Specification                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| **Nomination**                | **Not enabled** — no public nomination form                                                       |
| **Selection model**           | Representatives appointed by participating governments                                            |
| **Institution card (future)** | Learn More only + explanatory note: _Representatives are appointed by participating governments._ |
| **Buttons**                   | No Create Nomination                                                                              |

### 5.3 Chamber of Intellectual Analysis

| Attribute                     | Specification                                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Nomination**                | Enabled — domain experts addressing global human challenges                                                                 |
| **Expertise examples**        | Ecology, technology, security, medicine, education, economics, law, human rights, public administration, emergency response |
| **Scope (recommended)**       | World scope for Support Votes                                                                                               |
| **Institution card (future)** | Create Nomination, All Nominations, Learn More                                                                              |

### 5.4 Expert Analysis Team

_Preferred wording over “Department / Team of Intellectual Analysis.”_

| Attribute                     | Specification                                                               |
| ----------------------------- | --------------------------------------------------------------------------- |
| **Nomination**                | Enabled — experts assisting under a Chamber of Intellectual Analysis member |
| **Expertise**                 | Same domain fields as Chamber of Intellectual Analysis                      |
| **Authority level**           | Support and analysis — not chamber-level deliberative authority             |
| **Scope (recommended)**       | World scope, or domain-specific policy (deferred)                           |
| **Institution card (future)** | Create Nomination, All Nominations, Learn More (may link from Chamber card) |

### 5.5 State Collaboration Department

_Preferred wording over “Department of State Collaboration.”_

| Attribute                     | Specification                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Nomination**                | Enabled — communicator/coordinator between governments, Secretariat, and Humanity Protection                              |
| **Focus areas**               | Diplomatic communication, public administration, institutional coordination, governance translation, policy communication |
| **Scope (recommended)**       | Country or institution-specific policy (deferred)                                                                         |
| **Institution card (future)** | Create Nomination, All Nominations, Learn More                                                                            |

### 5.6 Humanity Protection Command Center (HPC)

| Attribute                     | Specification                                                       |
| ----------------------------- | ------------------------------------------------------------------- |
| **Nomination**                | **Deferred** — separate briefing required before nomination support |
| **Rationale**                 | Legal and security risk too high for premature public nomination    |
| **Institution card (future)** | Learn More only until HPC nomination briefing approved              |
| **Structural note**           | HPC directs and coordinates WPC operations                          |

### 5.7 World Protection Corps (WPC)

| Attribute                     | Specification                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| **Nomination**                | **Not defined** — future operational structure                                                    |
| **Management**                | Operationally managed by HPC — not an independent civic election body                             |
| **Institution card (future)** | Learn More only; no Create Nomination until governance defines pathway                            |
| **Important**                 | WPC is an operational corps under Humanity Protection, not a separate nomination/election surface |

### 5.8 Roles excluded from this briefing’s v1 nomination scope

| Role                            | Reason                                                               |
| ------------------------------- | -------------------------------------------------------------------- |
| Secretariat                     | Not listed in TASK-071 eligible paths — defer to future charter task |
| Community Self-Defense Units    | Community protective coordination — separate policy needed           |
| Regional Humanity Union Offices | Geographic presence — separate nomination model needed               |

These may be added in future briefing revisions.

---

## 6. Nomination Creation Flow

```
Institution card
        ↓
Create Nomination
        ↓
Choose:
  • Nominate myself
  • Nominate another person
        ↓
Select role (preselected from card; editable within eligible roles)
        ↓
Fill structured nomination form
        ↓
Submit
        ↓
Generate public Nomination Poster
        ↓
Poster appears in All Nominations
        ↓
Future: Transparent Support Vote period (TASK-074)
        ↓
Future: Governance selection (policy deferred)
```

**All Nominations** opens a modal or drawer from the institution card, showing compact posters with filters — independent of creating a new nomination.

---

## 7. Nomination Form Structure

The form is **similar across all eligible roles**, with conditional fields (e.g., country required for Humanity Council).

### 7.1 Fields

| #   | Field                               | Specification                                                                              |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | **Nomination Type**                 | I nominate myself / I nominate another person                                              |
| 2   | **Nominee Name**                    | Required. If another person: note that nominee may not yet be registered on the platform   |
| 3   | **Role**                            | Preselected from institution card; editable only within eligible roles for that card       |
| 4   | **Country**                         | Required where role requires country association                                           |
| 5   | **Region / Community**              | Optional geographic context                                                                |
| 6   | **Expertise Areas**                 | Multi-select tags (see §7.2)                                                               |
| 7   | **Experience Summary**              | _What experience makes this nominee suitable for this responsibility?_ Max 1500 characters |
| 8   | **Confirmed Achievements**          | _List verified or publicly demonstrable achievements._ Max 1500 characters                 |
| 9   | **Evidence Links**                  | Structured list: title, URL, type (see §7.3)                                               |
| 10  | **Vision Statement**                | _How could this nominee strengthen this institution or role?_ Max 1500 characters          |
| 11  | **Conflict of Interest Disclosure** | No known conflict / Potential conflict disclosed (+ short explanation if disclosed)        |
| 12  | **Declarations**                    | Required checkboxes (see §7.4)                                                             |

### 7.2 Expertise area tags

Environment, Technology, Security, Medicine, Education, Economics, Law, Human Rights, Public Administration, Emergency Response, Agriculture, Energy, Information Integrity, International Cooperation, Other.

### 7.3 Evidence link types

Research, project, publication, official role, NGO work, public service, technology, media reference, other.

Each entry: `{ title, url, type }`.

### 7.4 Required declarations

- I support the Universal Declaration of Human Rights.
- I support the constitutional principles of Humanity Union.
- I understand that this nomination does not guarantee appointment or selection.
- I confirm that the submitted information is accurate to the best of my knowledge.

### 7.5 Nominating another person — notice

Display before submit:

> Please provide only publicly relevant professional information and evidence.

---

## 8. Compact Nomination Poster

Displayed in **All Nominations** modal/grid.

### Layout

```
┌─────────────────────────────────────┐
│  Nominee Name                       │
│  Role                               │
│  Country                            │
│  [Expertise tag] [Expertise tag]    │
│                                     │
│  Votes:                             │
│    Total support votes: N           │
│    Verified participant votes: N    │
│    Unverified participant votes: N  │
│                                     │
│  View Full Poster →                 │
└─────────────────────────────────────┘
```

### Rules

- Vote counts are **transparent** public aggregates.
- Verified and unverified counts are **overlays only** — they do not change vote weight.
- **No ranking by default** — avoid popularity-sorted leaderboards.
- Default sort: **newest first** or **role grouping** — not highest votes first.
- Compact poster links to Full Poster on click.

---

## 9. All Nominations Modal

Triggered from institution card **All Nominations** button.

| Element                 | Behavior                                                     |
| ----------------------- | ------------------------------------------------------------ |
| **Role filter**         | Filter by eligible role                                      |
| **Country filter**      | Filter by country (where applicable)                         |
| **Compact poster grid** | Responsive grid of Compact Posters                           |
| **Empty state**         | Calm message when no nominations exist for filters           |
| **Close**               | Close button + Escape key                                    |
| **Accessibility**       | Focus trap, keyboard navigation, aria-modal, labelled dialog |

Clicking a compact poster opens the **Full Nomination Poster** (same page route or nested drawer — implementation choice in TASK-073).

---

## 10. Full Nomination Poster

### Header

- Nominee name
- Role
- Country (and region/community if provided)
- Nomination status (lifecycle state)
- Nominated by: nominator display name or _Platform participant_ (privacy-safe label)

### Core sections

- Expertise areas
- Experience summary
- Confirmed achievements
- Evidence links (external URLs open in new tab with rel security)
- Vision statement
- Conflict of interest disclosure
- Declaration status (confirmed — not checkbox values verbatim if redundant)

### Voting widget (TASK-074)

| Choice         | Value            |
| -------------- | ---------------- |
| Support        | `support`        |
| Do not support | `do_not_support` |
| Abstain        | `abstain`        |

One active vote per registered participant per nomination while voting is open. Participant may update vote while open.

### Result widget

| Aggregate                                                 | Shown |
| --------------------------------------------------------- | ----- |
| Total votes                                               | Yes   |
| Support                                                   | Yes   |
| Do not support                                            | Yes   |
| Abstain                                                   | Yes   |
| Verified votes (by choice or total — specify in TASK-074) | Yes   |
| Unverified votes                                          | Yes   |

**Transparency note (required on every full poster and voting widget):**

> Verified and unverified votes are shown separately for transparency. They do not change vote weight.

**Legal note (required):**

> This nomination process expresses civic support and public evaluation. It does not create legal appointment, employment, office, or institutional authority.

---

## 11. Voting Model

Align with **Collective Decision** constitutional principles where applicable:

| Rule                     | Specification                                                   |
| ------------------------ | --------------------------------------------------------------- |
| **Eligibility**          | Registered active participants                                  |
| **One vote**             | One active vote per participant per nomination                  |
| **Update**               | Participant may change vote while voting is open                |
| **Choices**              | support, do_not_support, abstain                                |
| **Weighting**            | None — all eligible votes equal                                 |
| **Verification overlay** | Public split of verified vs unverified counts; no weight effect |
| **AI outcome**           | None — no AI-generated recommendation or outcome                |
| **Appointment**          | None automatic — support expresses public evaluation only       |

Nomination voting **does not** create appointment, authority, or office.

---

## 12. Voting Scope (Future Policy)

| Option                | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| **A — World**         | All registered participants for global institutional roles |
| **B — Country**       | Participants associated with nominee’s country             |
| **C — Role-specific** | Custom scope per role type                                 |

### Recommended defaults (policy deferred)

| Role                             | Recommended scope                              |
| -------------------------------- | ---------------------------------------------- |
| Humanity Council                 | Country scope                                  |
| Chamber of Intellectual Analysis | World scope                                    |
| Expert Analysis Team             | World scope (domain-specific variant deferred) |
| State Collaboration Department   | Country or institution-specific (deferred)     |

Final scope rules require charter and governance approval before implementation.

---

## 13. Nomination Status Lifecycle

Architecture only — no implementation in TASK-071.

```
draft → submitted → published → voting_open → voting_closed → archived
                              ↘ withdrawn
```

| Status          | Meaning                                                  |
| --------------- | -------------------------------------------------------- |
| `draft`         | Nominator editing; not public                            |
| `submitted`     | Awaiting review/publish (if moderation added)            |
| `published`     | Public poster visible; voting not yet open               |
| `voting_open`   | Transparent Support Votes accepted                       |
| `voting_closed` | Votes frozen; results public                             |
| `archived`      | Historical record                                        |
| `withdrawn`     | Removed from active consideration by nominator or policy |

---

## 14. Institution Page Integration (Future)

| Institution                      | Create Nomination | All Nominations | Learn More | Notes                            |
| -------------------------------- | ----------------- | --------------- | ---------- | -------------------------------- |
| Humanity Council                 | ✓                 | ✓               | ✓          | Country required                 |
| Chamber of State Representatives | ✗                 | ✗               | ✓          | Government appointment note      |
| Chamber of Intellectual Analysis | ✓                 | ✓               | ✓          |                                  |
| Expert Analysis Team             | ✓                 | ✓               | ✓          | Linked from analysis ecosystem   |
| State Collaboration Department   | ✓                 | ✓               | ✓          |                                  |
| Secretariat                      | —                 | —               | ✓          | Deferred                         |
| HPC                              | ✗                 | ✗               | ✓          | Awaiting HPC nomination briefing |
| WPC                              | ✗                 | ✗               | ✓          | Operational corps — no election  |
| Community Self-Defense Units     | —                 | —               | ✓          | Deferred                         |
| Regional Offices                 | —                 | —               | ✓          | Deferred                         |

Replace **Create Initiative (`#`)** on eligible cards with **Create Nomination**. Non-eligible cards retain Learn More and explanatory copy only.

---

## 15. Privacy and Safety

### Do not collect

Age, gender, religion, ethnicity, family status, political affiliation, private address, phone number, or any protected personal attribute not required for professional evaluation.

### Do not expose in public projection

Internal `userId`, email, authentication data, private session data, IP addresses, or moderation flags.

### Public display rules

- Nominator shown as display name or generic _Platform participant_ label — configurable privacy preference in TASK-072.
- Nominee name is public (professional nomination context).
- Evidence links must be URLs the nominator attests are publicly relevant.

### Safety

- Report mechanism for abusive or fraudulent nominations (TASK-075 / trust domain).
- No private messaging between voters and nominees through nomination UI.

---

## 16. Legal and Governance Caution

Required on **every poster**, **voting widget**, and **nomination form** confirmation step:

> This nomination process expresses civic support and public evaluation. It does not create legal appointment, employment, office, or institutional authority.

Additional framing (consistent with Institutions Page Briefing):

- Use **proposed**, **designed to**, **intended to**, **future institutional model**.
- Avoid language implying governmental command, military appointment, or automatic authority from vote totals.
- Final selection remains **future governance policy** — document in Knowledge → Constitution when defined.

HPC and WPC nomination pathways remain **blocked** until dedicated security and legal review briefings approve them.

---

## 17. Relationship to Existing Platform Capabilities

| Capability                             | Relationship                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| **Institutions Experience (TASK-070)** | Entry point — institution cards evolve to nomination actions                          |
| **Collective Decision**                | Voting principles reference — unweighted choices, vote update, transparent aggregates |
| **Initiative pipeline**                | Separate — nominations do not create initiatives automatically                        |
| **Knowledge Center**                   | Cross-links for constitutional principles, governance, UDHR context                   |
| **Global Search**                      | TASK-075 — index published nominations as distinct entity type                        |
| **Workspace Assistant**                | TASK-075 — contextual guidance; no AI outcome on nominations                          |
| **Verification system**                | Verified/unverified vote overlay source — display only                                |

---

## 18. Future Implementation Plan

| Task                                              | Scope                                                                                         |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **TASK-072 — Civic Nomination Domain Foundation** | Domain types, persistence, lifecycle states, public projection, privacy guards                |
| **TASK-073 — Civic Nomination Form & Poster UI**  | Institution page buttons, nomination form, Compact Poster, Full Poster, All Nominations modal |
| **TASK-074 — Civic Nomination Voting Foundation** | Support vote widget, result widget, verified/unverified split, vote update flow               |
| **TASK-075 — Institution Formation Integration**  | Global search, assistant recommendations, notifications, Knowledge links                      |

### Explicit exclusions (all future tasks until separately approved)

- Institution Profiles CRM
- Governance editor
- Delegate registration mechanics
- Automatic appointment from vote totals
- HPC/WPC nomination without security briefing
- Weighted voting or popularity rankings

### Deferred briefings

- HPC nomination eligibility and security review
- WPC operational recruitment (non-election model)
- Secretariat and Regional Office nomination pathways
- Final Humanity Council selection/election charter

---

## 19. Acceptance Criteria for Briefing

| Criterion                                                                     | Status |
| ----------------------------------------------------------------------------- | ------ |
| Document created at `docs/INSTITUTION_FORMATION_CIVIC_NOMINATION_BRIEFING.md` | ✓      |
| No code changes                                                               | ✓      |
| Nomination roles defined                                                      | ✓      |
| Form structure defined                                                        | ✓      |
| Compact and Full poster structures defined                                    | ✓      |
| Voting widget concept defined                                                 | ✓      |
| Verified/unverified vote display defined                                      | ✓      |
| Privacy exclusions defined                                                    | ✓      |
| Legal caution defined                                                         | ✓      |
| Future implementation plan (TASK-072–075) included                            | ✓      |

---

## Key Decisions (Engineering Summary)

1. **Civic Nomination is a distinct civic instrument** — not initiative creation; institution formation through public nomination and transparent support.
2. **Eligible roles (v1):** Humanity Council, Chamber of Intellectual Analysis, Expert Analysis Team, State Collaboration Department — with Chamber of State Representatives, HPC, and WPC explicitly excluded from nomination UI.
3. **HPC → WPC structure preserved:** WPC is operationally directed by HPC; neither accepts public nomination in v1.
4. **Poster model:** Compact Poster (grid) → Full Poster (complete record + voting); no popularity ranking by default.
5. **Voting model:** Unweighted support / do not support / abstain; verified/unverified counts as transparency overlay only; aligns with Collective Decision principles.
6. **Form model:** Evidence-first, 1500-character narrative limits, structured evidence links, UDHR + constitutional declarations, no personal identity questions.
7. **Privacy:** No collection or exposure of protected personal attributes or auth internals.
8. **Legal:** Mandatory disclaimer on all nomination surfaces — no legal appointment from support votes.
9. **Implementation sequence:** Domain (072) → Form/UI (073) → Voting (074) → Integration (075).

**Final status:** Briefing complete — ready for TASK-072 approval.

**Final status: APPROVED**
