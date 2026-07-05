# WORKSPACE SPECIFICATION

## Capability 02 — Participation

### Epic 06 — Implementation

Version: 1.0

Status: Draft

---

# Purpose

Specify the operational Workspace for the **Implementation** Aggregate.

The **Implementation Workspace** is the primary environment where registered participants understand collective execution progress, review milestones and achievements, examine supporting evidence and orient toward Impact — without managing people or assigning work.

The Workspace helps participants understand:

- implementation status;
- implementation progress;
- achieved milestones;
- remaining milestones;
- evidence supporting achievements;
- completion status;
- next meaningful observation.

It does not manage people.

This document defines architectural intent only.

It does not define implementation.

Terminology and boundaries must conform to:

- `project/architecture/experience/EXPERIENCE_ARCHITECTURE.md`
- `DOMAIN_MODEL.md`
- `STATE_MACHINE.md`
- `project/architecture/governance/PARTICIPATION_ARCHITECTURE_FREEZE.md`

---

# Workspace Philosophy

The Workspace records collective achievements.

It never becomes a project management system.

The Workspace helps participants understand reality.

It does not assign work.

The Implementation Workspace exists to answer Stage 7 of the Participation Pipeline:

**"What is being done?"**

It supports transparent collective execution recording — not task assignment, scheduling, messaging or employment administration.

The Workspace optimizes for meaningful civic understanding and accountable collective progress visibility.

It does not optimize for engagement volume, repeated visits or emotional urgency.

## Design Principles

### Understanding Before Recording

Participants must understand what recording an achievement means before accountable recording occurs where authorized.

Initiative context, phase structure and milestone meaning precede primary recording surfaces.

### Calm Interface

The Workspace avoids urgency, gamification, ranking and attention-seeking patterns.

Progress presentation is informative — not competitive.

### Human Leadership

Accountable achievement recording remains a human command through canonical operational surfaces.

The platform never records accomplishments on behalf of participants.

### One Meaningful Observation

The Workspace presents one **Next Meaningful Observation**, not a competing menu of work recommendations.

Observations explain what changed — they never assign work.

### Recognition Without Judgment

Achievement acknowledgment confirms recorded collective accomplishment.

It never evaluates personal worth or compares participants.

### Journey Continuity

Participation is a continuity across pipeline stages — not an isolated status dashboard.

---

# Information Hierarchy

The Workspace presents information in the order participants naturally need it.

Context precedes status.

Status precedes derived progress.

Progress precedes structural detail.

Structural detail precedes evidence and assessment.

Assessment precedes guidance and navigation.

```
1. Initiative Context

↓

2. Implementation Status

↓

3. Collective Progress

↓

4. Current Phase

↓

5. Milestones

↓

6. Achievements

↓

7. Evidence

↓

8. Completion Assessment

↓

9. Humanity Assistant

↓

10. Related Navigation
```

This hierarchy adapts the platform Workspace Standard for Implementation.

Supporting context appears before derived summaries.

Derived values appear before detailed milestone and achievement lists where they inform orientation.

Guidance and navigation appear after civic meaning is established.

---

# Workspace Sections

## 1. Initiative Context

**Purpose:**

Anchor the participant in the approved civic subject and pipeline position.

**Display:**

- current stage: Implementation;
- preceding stages completed: Initiative, Collaborative Analysis, Collective Decision, Petition, Implementation Commitment;
- future stage not yet active: Impact;
- current Implementation lifecycle state (Planned, Started, In Progress, Completed, Archived);
- approved subject title and summary snapshot;
- concise references to originating Initiative, approved Collective Decision, related Petition and preceding Implementation Commitment.

**Behavior:**

Read-only.

Always visible near the top of the Workspace.

Does not reopen collective decision-making, petition endorsement or commitment declaration.

This section answers:

"Where am I, and what approved direction does this implementation record serve?"

---

## 2. Implementation Status

**Purpose:**

Present the aggregate lifecycle meaning so participants understand whether the implementation record is preparing, active, completed or historical.

**Display:**

- lifecycle state label in civic language;
- collection or recording status summary (for example preparing, open for recording, completed, archived);
- derived-value note where lifecycle affects authority of progress claims;
- clear distinction between lifecycle status and derived progress.

**Behavior:**

Read-only for lifecycle state itself.

Lifecycle transitions occur only through authorized operational commands — not through workspace convenience controls unless policy explicitly assigns them to authorized roles.

Never editable as derived progress substitute.

This section answers:

"What is the current lifecycle meaning of this implementation record?"

---

## 3. Collective Progress

**Purpose:**

Present derived community-level advancement toward milestones and completion.

**Display:**

See **Collective Progress** dedicated section below.

**Behavior:**

Read-only.

Derived only.

Never editable.

This section answers:

"How far has collective implementation progressed?"

---

## 4. Current Phase

**Purpose:**

Orient participants within the structured execution narrative.

**Display:**

See **Current Phase** dedicated section below.

**Behavior:**

Read-only presentation of phase structure and status.

Phase mutation occurs only through operational commands where authorized — not through workspace drag-and-drop or informal editing in Version 1.

This section answers:

"Which phase of collective implementation are we in?"

---

## 5. Milestones

**Purpose:**

Present civic checkpoints toward completion — required and optional — with satisfaction state.

**Display:**

See **Milestones** dedicated section below.

**Behavior:**

Read-only for milestone satisfaction meaning.

Milestone definition updates occur through operational commands where permitted.

No personal assignment semantics.

This section answers:

"What collective outcomes were expected, and which remain?"

---

## 6. Achievements

**Purpose:**

Present recorded collective accomplishments chronologically.

**Display:**

See **Achievements** dedicated section below.

**Behavior:**

Read-only for historical achievements.

New achievements recorded through canonical accountable recording surface where lifecycle and policy permit.

No personal work log presentation.

This section answers:

"What has the community recorded as accomplished?"

---

## 7. Evidence

**Purpose:**

Present evidence supporting achievements for transparency.

**Display:**

See **Evidence** dedicated section below.

**Behavior:**

Read-only for attached evidence.

New evidence attached through operational commands where authorized.

Evidence supports transparency — it does not establish objective truth.

This section answers:

"What supporting material exists for recorded achievements?"

---

## 8. Completion Assessment

**Purpose:**

Present derived completion evaluation and remaining required conditions.

**Display:**

See **Completion Assessment** dedicated section below.

**Behavior:**

Read-only.

Derived only.

Never editable.

This section answers:

"Is collective implementation complete, and what remains if not?"

---

## 9. Humanity Assistant

**Purpose:**

Provide contextual guidance that reduces complexity without replacing judgment.

**Display:**

See **Humanity Assistant** dedicated section below.

**Behavior:**

Read-only.

Explain-only.

Never mutates aggregate state.

This section answers:

"What does this implementation state mean in plain civic language?"

---

## 10. Related Navigation

**Purpose:**

Preserve journey continuity across pipeline stages without competing with primary orientation.

**Display:**

See **Navigation** dedicated section below.

**Behavior:**

Secondary navigation only.

Subordinate to Next Meaningful Observation.

This section answers:

"What related civic records may I review next?"

---

# Collective Progress

Collective Progress is a **derived value**.

Progress is derived from recorded Achievements and Milestone satisfaction.

Progress cannot be edited.

The Workspace must never present progress as a manual slider, editable percentage or administrator override field.

## Display

The Collective Progress section displays:

- **Completed phases** — phases marked complete with civic-language summary;
- **Completed milestones** — satisfied milestones with completion timestamps where available;
- **Achievements** — aggregate count and high-level accomplishment summary — not personal productivity metrics;
- **Progress indicator** — calm derived headline in civic language (for example required milestone progress, phase completion summary).

## Presentation rules

- label all values as derived;
- use factual civic language — not gamified progress bars unless they represent derived milestone satisfaction only;
- distinguish required milestone progress from optional milestone context;
- never imply ranking among participants;
- never import Petition signature counts, engagement metrics or activity volume as progress inputs.

## Empty behavior

When no achievements exist:

"This implementation record has not yet recorded collective achievements."

When lifecycle is **Planned** or **Started**:

"Collective progress will appear when achievements are recorded during active implementation."

---

# Current Phase

The Current Phase section orients participants within the phase structure of one Implementation.

## Display

- **Current implementation phase** — title, summary and status in civic language;
- **Completed phases** — list or timeline of phases marked complete;
- **Upcoming phases** — phases not yet complete, ordered by sequence.

## Presentation rules

- current phase is visually primary;
- completed phases remain readable as historical structure;
- upcoming phases are informational — not assignment lists;
- phase sequence follows `sequenceOrder` — not arbitrary UI ordering.

## Empty behavior

When no phases are defined:

"Implementation phases have not yet been configured for this record."

---

# Milestones

The Milestones section presents collective civic checkpoints grouped by phase where helpful.

## Display

- **Required milestones** — clearly labeled; satisfaction state visible;
- **Optional milestones** — clearly labeled as non-blocking for completion;
- **Completed milestones** — satisfied milestones with achievement linkage summary;
- **Remaining milestones** — unsatisfied required and optional milestones separately identified.

## Presentation rules

- required milestones visually distinct from optional milestones;
- satisfied milestones show completion meaning — not personal assignee lists;
- remaining required milestones connect to Completion Assessment context;
- milestone titles and descriptions use civic language from aggregate truth — not task board labels.

## Empty behavior

When no milestones exist:

"No milestones have been defined for this implementation record."

---

# Achievements

The Achievements section presents collective accomplishments in chronological order.

## Display

- achievement title and summary in civic language;
- related milestone reference;
- recorded timestamp;
- evidence availability indicator where evidence exists;
- optional achievement recognition messaging after new recording — calm and factual.

## Rules

Every achievement belongs to exactly one milestone.

The Workspace must show milestone association for every achievement entry.

Achievements describe collective accomplishment — not personal task completion.

## Presentation rules

- newest-first or oldest-first chronological order — choose one convention and apply consistently;
- no personal productivity leaderboard;
- no assignee ownership semantics;
- withdrawn or corrected achievements, if ever supported by future policy, preserve history visibly — Version 1 default: history preserved read-only.

## Empty behavior

When no achievements exist:

"No collective achievements have been recorded yet."

When lifecycle permits recording:

"Achievements may be recorded when implementation is active and authorized."

---

# Evidence

The Evidence section presents supporting material associated with achievements.

## Display

Evidence references grouped by achievement or listed with achievement association.

Examples of evidence types in civic presentation:

- **Documents** — referenced reports, filings or approved document citations;
- **Links** — stable URLs to public or authorized material;
- **Photos** — attachment references where policy permits;
- **Reports** — summary documents supporting accomplishment claims.

Each evidence entry displays:

- public-safe label;
- evidence kind (Reference, Attachment, Link);
- associated achievement;
- recorded timestamp.

## Presentation rules

Evidence supports transparency.

It does not establish objective truth.

Copy must avoid language of proof, certification or platform adjudication.

Operational detail may show more evidence context than public projection — per Implementation Visibility rules.

## Empty behavior

When no evidence exists:

"No supporting evidence has been attached to recorded achievements."

When achievements exist without evidence:

"Achievements are recorded. Supporting evidence may be attached where available and authorized."

---

# Completion Assessment

Completion Assessment is a **derived value**.

Completion is derived.

The Workspace must never present completion as a manual approval button without underlying derived criteria satisfaction.

## Display

- **Completion status** — derived reached / not yet reached headline;
- **Remaining required milestones** — list of unsatisfied required milestones;
- **Derived completion indicator** — calm civic-language summary of criteria progress;
- explicit note that completion is not Collective Decision re-approval;
- optional display of satisfied required milestone count versus total required count.

## Presentation rules

- label completion and assessment as derived;
- optional milestones shown separately — never as hidden blockers;
- when completion is reached, state clearly that the execution record is closed successfully;
- when not reached, orient through remaining required milestones — not work assignment.

## Empty behavior

When lifecycle is **Planned** or **Started**:

"Completion assessment will be available when implementation recording is active."

---

# Humanity Assistant

The Humanity Assistant is an experience guidance layer — not an aggregate mutator.

## Assistant may

- **explain implementation status** — lifecycle meaning in plain civic language;
- **explain progress** — what derived collective progress indicates;
- **summarize achievements** — factual summary of recorded accomplishments;
- **explain evidence** — what evidence association means and its limits;
- align explanation with **Next Meaningful Observation** when present.

## Assistant may never

- **approve achievements** — recording remains human command through operational surfaces;
- **change progress** — derived values are read-only;
- **manage work** — no task assignment, scheduling or coordination commands;
- persuade through urgency, ranking or moral pressure;
- conceal automated guidance nature or material uncertainty.

## Presentation rules

- boundary statement visible: assistant explains — it does not decide or record;
- calm language consistent with Experience Architecture;
- transparent about automation;
- no fake human authority voice.

## Empty behavior

When minimal state exists:

"This implementation record is still preparing. The assistant can explain lifecycle meaning and what will appear as achievements are recorded."

---

# Next Meaningful Observation

Implementation Workspace uses **Next Meaningful Observation** instead of **Next Meaningful Action**.

Version 1 orients participants through **what has changed** — not what work they should perform.

Observations explain reality.

They never recommend work.

## Purpose

Present one contextual observation after orientation or significant state change.

## Examples

- "A new milestone has been completed."
- "Evidence has been added to a recorded achievement."
- "Implementation entered a new phase."
- "Collective progress increased — two additional required milestones are now satisfied."
- "Implementation recording has started."
- "Implementation is now complete. This record is read-only."

## Rules

- one observation only per stable workspace state;
- calm factual language;
- no urgency framing;
- no call-to-action implying personal assignment;
- subordinate to primary information hierarchy — not competing hero banner;
- where accountable recording is permitted, observation may note that recording is available — without pressure language; recording remains participant choice under Human Leadership.

## Not permitted

- "Your next task is..."
- "You should complete..."
- "Assign yourself to..."
- ranking or comparative observation between participants.

---

# Navigation

Related Navigation is **secondary**.

It must not compete with orientation sections or Next Meaningful Observation.

## Links

- **Initiative** — operational Initiative workspace;
- **Decision** — Collective Decision workspace;
- **Petition** — Petition workspace;
- **Implementation Commitment** — preceding commitment workspace;
- **Future Impact** — placeholder when Impact stage is not yet active.

## Public cross-links (where policy permits)

- Public Initiative;
- Public Collective Decision;
- Public Petition;
- Public Implementation Commitment;
- Public Implementation projection for this record.

## Rules

- reference-only integration;
- no embedded external aggregate operational graphs;
- future Impact link is informational placeholder — not active navigation to unimplemented stage behavior;
- duplicate navigation in page footer, if present, remains subordinate to this section.

---

# Empty States

Every major section requires a meaningful empty state.

Empty states explain **what this area means** and **what will appear later** — not merely "No data."

## Examples

| Section                     | Empty state meaning                                                           |
| --------------------------- | ----------------------------------------------------------------------------- |
| Collective Progress         | No achievements recorded yet; progress will derive when accomplishments exist |
| Current Phase               | Phases not yet configured                                                     |
| Milestones                  | Milestones not yet defined                                                    |
| Achievements                | No collective achievements recorded                                           |
| Evidence                    | No evidence attached                                                          |
| Completion Assessment       | Assessment available when recording is active                                 |
| Next Meaningful Observation | No significant change since last visit — or lifecycle still preparing         |

## Rules

- calm tone;
- no guilt or urgency;
- no fake placeholder metrics;
- distinguish lifecycle preparation from missing data error.

---

# Loading States

Loading behavior must remain calm and predictable.

## Rules

- show skeleton or neutral loading copy — not spinners with urgency language;
- preserve section order during load — do not rearrange hierarchy when data arrives;
- failed load states explain whether the implementation record is unavailable versus temporarily unreachable;
- never flash empty state before load completes if avoidable;
- derived sections may load after core identity and lifecycle state — progressive disclosure permitted.

## Example loading copy

"Loading implementation record..."

Not:

"Hurry — implementation progress is waiting!"

---

# Completion State

When Implementation lifecycle is **Completed**, the Workspace enters a **completion presentation mode**.

## Display

- clear completion headline: collective implementation record is complete;
- final derived Collective Progress summary;
- final Completion Assessment explanation;
- satisfied required milestones summary;
- achievements and evidence remain readable as historical record;
- Next Meaningful Observation reflects completion (for example "Implementation is now complete. This record is read-only.");
- recording surfaces disabled unless explicit future policy defines correction windows.

## Behavior

- read-only for achievements, evidence and lifecycle;
- no task assignment or reopen prompts;
- navigation to Impact placeholder may note future outcome measurement stage;
- calm recognition of collective accomplishment — not celebration gamification.

## Archived state

When **Archived**, copy clarifies permanent historical record semantics.

No lifecycle progression continues.

Public and operational read access per visibility policy.

---

# Operational View Boundaries

The Implementation Workspace is the **Operational View** for registered participants.

It must not:

- serialize as Public Implementation projection;
- expose other participants' private recording detail beyond approved aggregate rules;
- embed task boards, calendars, messaging or volunteer roster management;
- duplicate Initiative, Decision, Petition or Commitment operational graphs inline.

Accountable recording commands route through operational API only.

Workspace renders experience.

It does not redefine domain structure.

---

# Canonical Recording Surface (Version 1)

Where lifecycle and policy permit accountable recording, Version 1 defines:

**Achievement Recording Panel** — canonical surface for **Record Achievement**.

**Evidence Attachment Panel** — canonical surface for **Attach Evidence**.

Naming must remain consistent across UI, architecture docs and API guides.

Assistants and navigation must not bypass these surfaces for accountable acts.

---

# Final Principle

The Workspace helps society understand collective implementation progress without becoming a project management system.

It records and presents **what the community has done together** — derived progress, milestone satisfaction, achievements, evidence and completion assessment — with calm clarity and architectural integrity.

It never manages people.

It never assigns work.

Implementation follows Commitment.

Impact follows Implementation.

The Workspace exists so participants and stewards can orient in that sequence with dignity, transparency and human leadership intact.
