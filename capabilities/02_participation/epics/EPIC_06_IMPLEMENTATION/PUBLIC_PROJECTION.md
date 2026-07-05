# PUBLIC PROJECTION

## Capability 02 — Participation

### Epic 06 — Implementation

Version: 1.0

Status: Draft

---

# Purpose

Specify the Public Projection of the **Implementation** Aggregate.

Public Projection allows anyone to understand the collective implementation progress of an approved initiative.

It is informational.

It is not operational.

The Public Projection provides a transparent, read-only representation of collective execution progress, milestones, achievements, evidence and derived completion for Public Visitors, civic observers, institutions and society at large.

It answers:

- What approved direction is being implemented?
- What collective progress has been recorded?
- Which milestones have been achieved?
- What public evidence supports recorded achievements?
- Is collective implementation complete?
- How may a person observe, understand or share the public record?

The Public Projection communicates collective accomplishment and derived progress.

It never exposes operational or participant-specific internals.

This document defines architectural intent only.

It does not define implementation.

Terminology and boundaries must conform to:

- `WORKSPACE_SPECIFICATION.md`
- `DOMAIN_MODEL.md`
- `project/architecture/governance/PARTICIPATION_ARCHITECTURE_FREEZE.md`

---

# Audience

Primary audience:

- Public Visitor;
- civic observer;
- media;
- institutions;
- community members outside active workspace context.

Secondary audience:

- Participant reviewing the public execution record after accountable recording where authorized.

The Public Projection serves transparency.

It does not serve administration, moderation, coordination or operational management.

---

# Relationship to Operational Workspace

Operational Workspace and Public Projection are intentionally separate surfaces.

| Surface               | Audience                            | Purpose                                                           | Writable                              |
| --------------------- | ----------------------------------- | ----------------------------------------------------------------- | ------------------------------------- |
| Operational Workspace | Registered participants             | Orientation and accountable collective recording where authorized | Through operational API commands only |
| Public Projection     | Public visitors, observers, society | Transparency and civic observation                                | Read-only                             |

**Operational Workspace** supports accountable recording and participant orientation.

It includes achievement recording surfaces, evidence attachment, lifecycle context and Next Meaningful Observation.

**Public Projection** supports transparency.

It includes approved public context, derived collective progress, public achievements, public evidence summaries, derived completion and share reference.

A person may read the Public Projection without identity.

Operational participation — including achievement recording where policy requires registration — requires registration and operational workspace entry.

Observation is public.

Accountable recording is operational.

---

# Public Information Model

The Public Projection represents one Implementation as a dedicated public read model.

It is independent from the Implementation Aggregate root.

It exposes only approved public fields derived from aggregate state and referenced context.

Conceptual model:

```
PublicImplementationProjection

├── implementation identity
├── implementation summary
├── implementation lifecycle status
├── approved initiative context
├── approved collective decision context
├── related petition context
├── implementation commitment reference
├── public implementation status
├── public collective progress
├── public current phase
├── public achievements
├── public evidence summaries
├── public completion
├── share reference
├── registration gateway guidance
└── humanity assistant panel (explain-only)
```

The projection is built from aggregate truth through a projection builder.

It is not a direct serialization of operational data.

---

# Public Information Hierarchy

Public information appears in civic reading order.

Approved direction precedes execution status.

Execution status precedes derived progress.

Progress precedes accomplishments and evidence.

Completion precedes share and registration entry.

```
1. Initiative

↓

2. Collective Decision

↓

3. Petition

↓

4. Implementation Commitment

↓

5. Implementation Status

↓

6. Collective Progress

↓

7. Current Phase

↓

8. Achievements

↓

9. Evidence

↓

10. Completion

↓

11. Share

↓

12. Registration Gateway
```

Context precedes derived results.

Derived results precede participation entry.

Share and Registration Gateway remain subordinate to informational sections — not primary pressure surfaces.

---

## 1. Initiative

**Purpose:**

Anchor the public record in the approved civic subject.

**Display:**

- Initiative title and public summary approved for display;
- reference to the structured proposal being implemented;
- statement that Implementation follows prior pipeline stages.

**Behavior:**

Read-only.

Approved public snapshot only.

Does not expose Initiative operational workspace internals.

---

## 2. Collective Decision

**Purpose:**

Help observers understand what was decided before implementation progress is interpreted.

**Display:**

- approved Collective Decision outcome in public terms;
- decision summary sufficient for informed public understanding;
- statement that implementation progress does not reopen or re-authorize the decision.

**Behavior:**

Read-only.

Does not expose ballot internals, participant votes or decision rules beyond public eligibility summary.

---

## 3. Petition

**Purpose:**

Present related public endorsement context.

**Display:**

- related Petition public summary;
- aggregate public support indicators approved for cross-reference where policy permits;
- statement that endorsement expressed public support — separate from implementation execution recording.

**Behavior:**

Read-only.

Does not expose individual signatures or signer identity.

Does not treat signature counts as implementation progress.

---

## 4. Implementation Commitment

**Purpose:**

Present preceding preparedness context without re-owning commitment records.

**Display:**

- Implementation Commitment reference identifier where public-safe;
- summary statement that commitment recorded declared preparedness;
- statement that commitment readiness preceded implementation recording;
- no participant contribution detail or individual declaration exposure.

**Behavior:**

Read-only.

Reference-only cross-stage context.

Does not expose Contribution Profiles, Contribution Items or operational commitment internals.

---

## 5. Implementation Status

**Purpose:**

Present aggregate lifecycle meaning in public civic language.

**Display:**

- lifecycle status label (Planned, Started, In Progress, Completed, Archived) in public-safe wording;
- collection or recording status summary;
- note when public progress claims are provisional during preparatory lifecycle states.

**Behavior:**

Read-only.

Lifecycle visibility may gate share availability per policy.

Draft or preparatory states, if publicly visible, use provisional copy — not authoritative completion claims.

---

## 6. Collective Progress

**Purpose:**

Show derived community-level advancement approved for public display.

See **Collective Progress** dedicated section below.

**Behavior:**

Read-only.

Derived only.

---

## 7. Current Phase

**Purpose:**

Orient observers within the public phase narrative.

**Display:**

- current phase title and public summary;
- completed phases list in civic language;
- upcoming phases where publicly appropriate.

**Behavior:**

Read-only.

No assignment or coordination semantics.

---

## 8. Achievements

**Purpose:**

Present public collective accomplishments.

See **Achievements** dedicated section below.

**Behavior:**

Read-only.

No personal work logs.

---

## 9. Evidence

**Purpose:**

Present public evidence supporting achievements.

See **Evidence** dedicated section below.

**Behavior:**

Read-only.

Public-safe evidence only.

---

## 10. Completion

**Purpose:**

Present derived completion assessment and remaining required conditions.

See **Completion** dedicated section below.

**Behavior:**

Read-only.

Derived only.

---

## 11. Share

**Purpose:**

Enable stable public distribution of the execution record.

See **Share** dedicated section below.

**Behavior:**

Read-only link generation.

Sharing increases visibility — it does not record progress.

---

## 12. Registration Gateway

**Purpose:**

Guide visitors from observation toward operational entry where accountable participation requires registration.

See **Registration Gateway** dedicated section below.

**Behavior:**

Read-only guidance.

No identity administration.

---

# Collective Progress

Display only derived public information approved for societal transparency.

Progress is derived.

Public Collective Progress must never be manually editable on public surfaces.

## Display

- **Completed phases** — public-safe phase titles and completion summaries;
- **Completed milestones** — satisfied milestones in civic language;
- **Progress indicator** — calm derived headline (for example required milestone progress summary);
- **Completion indicator** — derived completion progress headline where not yet complete;
- derived-value note explaining computation from recorded achievements and milestone state.

## Presentation rules

- label progress as derived;
- use aggregate civic language — not gamified competition;
- distinguish required milestone progress from optional milestone context;
- never expose participant identities or personal productivity metrics;
- never import Petition signature counts, engagement metrics or activity volume as progress;
- sanitize category labels per public visibility policy — no verbatim private capacity or skill text from operational records.

## Empty behavior

When no achievements exist:

"No collective achievements have been publicly recorded for this implementation yet."

When lifecycle is preparatory:

"Public progress will appear when collective achievements are recorded during active implementation."

---

# Achievements

Display only public achievements approved for societal observation.

## Display

- achievement title and summary in civic language;
- chronological ordering (newest-first or oldest-first — one convention applied consistently);
- **grouped by Phase** where phase structure improves comprehension;
- related milestone reference in public-safe terms;
- recorded date;
- evidence availability indicator without exposing private attachment internals.

## Rules

Never expose participant work logs.

Achievements describe collective accomplishment — not personal task completion.

Never expose:

- `recordedByParticipantId` or equivalent identity;
- internal operational notes;
- assignee or owner semantics;
- personal workload history.

Every public achievement remains associated with exactly one milestone.

## Empty behavior

"No public achievements have been recorded for this implementation yet."

---

# Evidence

Display public evidence only.

Evidence supports transparency.

Evidence does not establish objective truth.

## Display examples

Public evidence presentation may include:

- **Official documents** — public-safe document labels and references;
- **Public reports** — civic report citations approved for display;
- **Photographs** — public attachment references where policy permits;
- **Public links** — stable URLs to authorized public material.

Each public evidence entry displays:

- public-safe label;
- evidence kind (Reference, Link, Attachment classification in civic language);
- associated achievement reference;
- no private storage paths or internal operational metadata.

## Presentation rules

- language of support and substantiation — not proof or certification;
- operational-only evidence detail remains in operational workspace;
- external links open public material — they do not embed external PM systems;
- photograph and attachment exposure follows Implementation Visibility policy.

## Empty behavior

"No public evidence has been attached to recorded achievements."

When achievements exist without public evidence:

"Achievements are recorded. Public supporting material may appear when attached and approved for display."

---

# Completion

Display derived completion.

Completion is never manually declared on public surfaces.

## Display

- derived completion reached / not yet reached headline;
- **Completion indicator** in calm civic language;
- when incomplete: **remaining required milestones** in public-safe descriptions;
- satisfied required milestone count versus total where helpful;
- explicit statement that completion is derived — not administrator decree;
- explicit statement that completion is not Collective Decision re-approval.

## Presentation rules

- optional milestones shown separately — never as hidden blockers;
- when complete: clear public record closure message;
- when incomplete: factual orientation through remaining required milestones — not work assignment;
- archived implementations retain public completion meaning as historical record.

## Empty behavior

When lifecycle is preparatory:

"Public completion assessment will appear when implementation recording is active."

---

# Registration Gateway

Visitors may:

- **view** — read the public implementation record without identity;
- **understand** — comprehend collective progress, achievements and completion through public sections and Humanity Assistant;
- **share** — distribute stable public links where share is available.

Operational participation requires registration.

## Display

- entry intent in calm civic language;
- registration gateway message explaining observation versus accountable recording;
- viewing note: viewing does not record achievements or change progress;
- sharing note: sharing increases visibility — it does not record accomplishment;
- whether registration is required before operational workspace entry;
- whether achievement recording is currently available on operational surfaces;
- workspace path for continuation after registration where recording is permitted.

## Rules

- no urgency or conversion optimization language;
- no implied obligation to participate;
- registration gateway does not administer identity — it guides entry;
- public visitors observe by default;
- accountable recording remains operational and human-led.

## Lifecycle-specific guidance

| Lifecycle         | Public gateway meaning                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Planned / Started | Observe and share; recording prepares on operational side                                |
| In Progress       | Observe and share; registration required before operational recording if policy requires |
| Completed         | Observe historical record; recording closed                                              |
| Archived          | Observe permanent historical record                                                      |

---

# Humanity Assistant

The Humanity Assistant public panel is explain-only.

## Assistant may

- **explain progress** — what derived collective progress means;
- **explain completion** — what derived completion assessment means;
- **summarize achievements** — factual public summary of recorded accomplishments;
- **explain evidence** — what public evidence association means and its limits.

## Assistant may never

- **approve achievements** — recording remains human operational command;
- **manage implementation** — no lifecycle or progress mutation;
- **coordinate work** — no task, schedule or volunteer dispatch language;
- **persuade participation** — no urgency, ranking or moral pressure;
- conceal automated guidance nature or material uncertainty.

## Presentation rules

- boundary statement visible on public page;
- calm civic language aligned with Experience Architecture;
- recommendations, if any, are observational — not calls to work;
- assistant reads public projection context — not operational internals.

## Example boundary copy

"This informational panel explains public implementation progress. It does not decide, persuade, coordinate or record achievements on your behalf."

---

# Share

Permanent public links enable societal transparency and distribution.

## Display

- stable public URL when share is available;
- sharing note: sharing increases visibility — it does not record progress or assign work;
- share availability may depend on lifecycle visibility policy (for example hidden during early preparatory states if policy requires).

## Social sharing

- support calm social sharing of public URL;
- shared previews use public-safe title and summary — not operational detail;
- no tracking gamification or viral urgency framing;
- share actions do not mutate aggregate state.

## Rules

- public route pattern is stable (for example `/implementations/public/:id` or architecture-approved equivalent);
- share link references public projection — not operational workspace;
- completed and archived records remain shareable as historical public record where policy permits.

---

# Privacy

Public Projection enforces Explicit Publicity.

## Never expose

- **participant identities** — including who recorded achievements unless future public attribution policy explicitly approves otherwise;
- **internal discussions** — comments, threads or deliberation not approved for public display;
- **work logs** — personal task history or productivity records;
- **coordination** — assignments, schedules, rosters or dispatch detail;
- **contribution history** — Implementation Commitment declaration detail from Stage 6;
- **operational workspace** — controls, private evidence, internal notes or full aggregate serialization.

## Additional privacy rules

- aggregate achievements only — not individual labor surveillance;
- public evidence labels sanitized — no private file paths or internal storage keys;
- public skill or capacity text uses policy-aligned categories only;
- anonymous viewer participation state never exposed;
- cross-stage references use public snapshots — not operational graphs.

Privacy protects dignity.

Transparency communicates collective civic meaning.

---

# Related Navigation

Related public navigation preserves pipeline continuity without competing with primary information hierarchy.

## Public links

- **Public Initiative**
- **Public Collective Decision**
- **Public Petition**
- **Public Implementation Commitment**
- **Future Public Impact** — placeholder when Impact stage is not yet active

## Rules

- reference-only integration;
- no embedded operational pages inside public projection layout;
- Future Public Impact is informational placeholder — not broken link to unimplemented behavior;
- navigation is secondary to public information sections;
- operational cross-links belong on operational workspace — not public projection by default.

---

# Projection Builder Requirements

Public Implementation projection must be built by a dedicated projection builder.

## Rules

- read aggregate truth and referenced public context;
- map to `PublicImplementationProjection` or equivalent public DTO;
- never serialize operational aggregate root directly to public routes;
- apply Implementation Visibility rules at build time;
- sanitize all text fields that could carry operational privacy leakage;
- recompute or copy derived public indicators from authoritative derived values;
- omit fields with no public-safe representation rather than leaking operational detail.

---

# Lifecycle Visibility

Public visibility may vary by Implementation lifecycle state.

| State       | Default public meaning                                                |
| ----------- | --------------------------------------------------------------------- |
| Planned     | Provisional visibility or restricted share per policy                 |
| Started     | Public orientation; progress may be limited                           |
| In Progress | Full public progress, achievements and evidence per visibility policy |
| Completed   | Public historical execution record                                    |
| Archived    | Permanent public historical record                                    |

Exact visibility gates are policy-defined.

Architecture requires provisional copy during preparatory states — not authoritative false completion claims.

---

# Empty and Unavailable States

When public projection is unavailable:

- return clear civic-language unavailable message;
- do not expose internal error detail;
- offer home navigation;
- do not leak whether record exists versus permission denied beyond generic public-safe messaging.

When sections are empty, use meaningful empty copy defined in section specifications — not blank panels.

---

# Future Evolution

The following public experience concepts are **reserved for future versions**.

They are **not Version 1**.

| Reserved concept             | Future intent                                                    |
| ---------------------------- | ---------------------------------------------------------------- |
| **Coordination Space**       | Public or hybrid coordination views beyond progress transparency |
| **Implementation Dashboard** | Rich operational-style dashboards on public surfaces             |
| **Volunteer Coordination**   | Public roster or signup coordination                             |
| **External PM Integration**  | Embedded external project management views                       |

Future introduction must:

- preserve public/operational separation;
- preserve privacy boundaries defined in this document;
- proceed through Architecture Review;
- not require redesign of Version 1 public information hierarchy core.

Version 1 public projection communicates **explainable collective implementation progress** only.

---

# Final Principle

Public Projection communicates explainable collective implementation progress.

It protects individual participants while making public achievements transparent.

Society may understand **what was done together**, **how far implementation progressed**, **what evidence supports the public record** and **whether collective implementation reached derived completion** — without gaining access to private work management, personal logs or operational control surfaces.

Observation is public.

Accountable recording is operational.

Impact follows Implementation.

The public record exists so civic trust can rest on aggregate transparency, derived truth and human dignity — not on exposure of private participation detail.
