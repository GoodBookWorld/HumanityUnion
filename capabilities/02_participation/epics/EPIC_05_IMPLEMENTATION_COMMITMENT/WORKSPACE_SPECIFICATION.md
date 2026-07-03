# WORKSPACE SPECIFICATION

## Capability 02 — Participation

### Epic 05 — Implementation Commitment

Version: 1.0

Status: Draft

---

# Purpose

Specify the operational Workspace for the **Implementation Commitment** Aggregate.

The Implementation Commitment Workspace is the primary environment where registered Participants understand declared community capacity, review implementation readiness against Frozen Policy, declare their own preparedness and orient toward the Implementation stage.

This document defines architectural intent only.

It does not define implementation.

Terminology and boundaries must conform to:

- `EXPERIENCE_ARCHITECTURE.md`
- `PARTICIPATION_ARCHITECTURE_FREEZE.md`
- `DOMAIN_MODEL.md`
- `STATE_MACHINE.md`

---

# Workspace Philosophy

The Workspace helps participants understand:

- their contribution;
- community capacity;
- implementation readiness;
- what is needed next.

It never pressures participation.

The Implementation Commitment Workspace exists to answer Stage 6 of the Participation Pipeline:

**"Who is prepared to help?"**

It supports voluntary declaration of preparedness — not task assignment, employment or implementation execution.

The Workspace optimizes for meaningful civic understanding and accountable declaration.

It does not optimize for engagement volume, repeated visits or emotional urgency.

## Design Principles

### Understanding Before Action

Participants must understand what declaring a contribution means before recording one.

Frozen Policy and Community Needs provide context before declaration surfaces.

### Calm Interface

The Workspace avoids urgency, gamification, ranking and attention-seeking patterns.

Readiness progress is informative — not competitive.

### Human Leadership

Participants choose whether, what and when to declare.

The platform never declares contributions on their behalf.

### One Meaningful Next Step

The Workspace recommends one **Next Meaningful Action**, not a competing menu of unrelated options.

### Recognition Without Judgment

Contribution Recognition confirms recorded declaration.

It never evaluates personal worth or compares participants.

### Journey Continuity

Participation is a continuity across pipeline stages — not a single isolated form submission.

---

# Information Hierarchy

The Workspace presents information in the order participants naturally need it.

Context precedes derived results.

Derived results precede personal commitment.

Personal commitment precedes guidance and navigation.

```
1. Initiative Context

↓

2. Current Implementation Readiness

↓

3. Community Capacity

↓

4. Frozen Policy

↓

5. Participant Commitment

↓

6. Contribution Profile

↓

7. Community Needs

↓

8. Next Meaningful Action

↓

9. Humanity Assistant

↓

10. Related Navigation
```

This hierarchy adapts the platform Workspace Standard for Implementation Commitment.

Supporting context appears before canonical declaration surfaces.

Derived values appear before personal status where they inform informed declaration.

Action and guidance appear after orientation.

---

# Workspace Sections

## 1. Initiative Context

**Purpose:**

Anchor the participant in the approved civic subject and pipeline position.

**Display:**

- current stage: Implementation Commitment;
- preceding stages completed: Initiative, Collaborative Analysis, Collective Decision, Petition;
- future stages not yet active: Implementation, Impact;
- current Implementation Commitment lifecycle state (Draft, Submitted, Active, Withdrawn, Completed, Archived);
- approved subject title and summary snapshot;
- concise references to originating Initiative, approved Collective Decision and related Petition.

**Behavior:**

Read-only.

Always visible near the top of the Workspace.

Does not reopen collective decision-making or petition endorsement.

This section answers:

"Where am I, and what approved direction does this commitment serve?"

---

## 2. Current Implementation Readiness

**Purpose:**

Present the derived readiness indicator so participants understand how close declared capacity is to Frozen Policy requirements.

**Display:**

- readiness headline in civic language;
- whether readiness threshold conditions are met or not yet met;
- high-level progress against policy-defined thresholds;
- clear statement that readiness is derived — not manually set;
- clear statement that readiness is not approval of the collective decision.

**Behavior:**

Read-only.

Derived only.

Never editable.

Updates when Community Capacity or applicable policy reference changes.

Visible whenever the aggregate has entered a state where derivation is meaningful (primarily **Active** and later).

See **Implementation Readiness** for full presentation rules.

---

## 3. Community Capacity

**Purpose:**

Show aggregated community preparedness derived from recorded Contribution Items.

**Display:**

- total active declarations;
- capacity grouped by Contribution Type (Volunteer, Professional, Resource);
- aggregated availability summary where policy permits;
- skill and resource coverage indicators in civic language;
- derivation timestamp or freshness indicator where helpful.

**Behavior:**

Read-only.

Derived only.

Never editable.

Never presented as completed implementation work.

See **Community Capacity** for category examples and derivation rules.

---

## 4. Frozen Policy

**Purpose:**

Help participants understand the stable rules governing eligibility, declaration and readiness evaluation.

**Display:**

- governing Frozen Policy reference and civic-language summary;
- Readiness Thresholds grouped by satisfaction state;
- eligibility rules relevant to declaration;
- withdrawal and revision rules where participant action is permitted;
- distinction between Frozen Policy (binding for this context) and earlier Living Policy stages.

**Behavior:**

Read-only within the Workspace.

Policy content is immutable in place for the referenced Frozen Policy.

Policy change appears only through governed reference update — not workspace editing.

See **Frozen Policy** for Satisfied, Pending and Optional presentation.

---

## 5. Participant Commitment

**Purpose:**

Present the current participant's relationship to this Implementation Commitment.

**Display:**

- aggregate lifecycle state as it affects the participant;
- whether the participant has an active declaration;
- summary of personal commitment status;
- link or scroll target to Contribution Profile detail.

**Behavior:**

Personal and operational.

Reflects actual participant state accurately.

Does not expose other participants' private declarations inappropriately.

See **Participant Commitment** for full display requirements.

---

## 6. Contribution Profile

**Purpose:**

The participant-owned summary of declared preparedness within this commitment context.

**Display:**

- active Contribution Items;
- Contribution Type, Contribution Capacity and Availability per item;
- Commitment Status per item (Declared, Withdrawn, Satisfied where applicable);
- profile metadata permitted by policy (skills summary, regional or organizational context labels);
- canonical declaration surface when aggregate is **Active** and participant is eligible.

**Behavior:**

Writable only through accountable operational commands when eligible.

The canonical interaction surface for Stage 6 is contribution declaration and profile maintenance — not task acceptance.

One active declaration per participant per commitment context in Version 1 unless Frozen Policy defines supersession.

Withdrawal preserves history.

---

## 7. Community Needs

**Purpose:**

Show what the community still requires for readiness — derived from Frozen Policy thresholds and approved subject context.

**Display:**

- missing requirements only;
- civic-language need descriptions aligned to policy thresholds;
- no random or generic action suggestions;
- contextual connection between a need and relevant Contribution Types where helpful.

**Behavior:**

Read-only.

Derived from policy evaluation and capacity gap — not an assigned task list.

See **Community Needs** for examples and recommendation rules.

---

## 8. Next Meaningful Action

**Purpose:**

Recommend one contextually appropriate next step based on the participant's actual journey and aggregate state.

**Display:**

- one primary recommendation prominently;
- plain civic language;
- optional brief explanation of why this step matters now.

**Behavior:**

Contextual only.

Never generic.

Never competes with multiple equally weighted primary actions.

May be supplied by Participation Navigator when present.

The Workspace presents it.

The Workspace does not own cross-aggregate navigation logic.

See **Next Meaningful Action** for examples by state.

---

## 9. Humanity Assistant

**Purpose:**

Provide contextual guidance that reduces complexity without removing responsibility.

**Display:**

- assistant panel or equivalent calm guidance surface;
- explanations tied to current workspace section and participant state;
- policy-aligned summaries of unmet requirements when relevant;
- optional alignment with Next Meaningful Action.

**Behavior:**

The assistant:

- explains;
- suggests;
- summarizes;
- highlights unmet policy requirements;
- never decides;
- never persuades.

The Humanity Assistant is not a coordinator, decision maker or commitment recorder.

See **Humanity Assistant** for full behavioral definition.

---

## 10. Related Navigation

**Purpose:**

Provide secondary cross-links to adjacent pipeline stages without competing with Next Meaningful Action.

**Display:**

- links to Initiative operational workspace;
- links to Collective Decision operational workspace;
- links to Petition operational workspace;
- future Implementation workspace link when eligible and available;
- public projection links where appropriate for transparency.

**Behavior:**

Secondary, not primary.

Never presented as equally weighted alternatives to Next Meaningful Action.

Navigation is presentational.

External Aggregates remain independent.

See **Navigation** for full link rules.

---

# Community Capacity

Community Capacity is displayed as aggregated preparedness — not as a leaderboard, popularity metric or execution progress bar.

## Display Categories

Present capacity in civic language grouped by meaningful contribution dimensions.

Examples:

- **Volunteers** — declared volunteer contributions and aggregate availability;
- **Coordinators** — coordinator-role declarations where policy defines this category;
- **Equipment** — resource contributions classified as equipment;
- **Transportation** — mobility or logistics resource declarations;
- **Expertise** — professional or skill-category coverage against policy labels;
- **Facilities** — venue, space or facility resource declarations.

Exact labels follow Frozen Policy threshold vocabulary where defined.

Generic labels apply only when policy does not specify finer categories.

## Derivation Rules

All Community Capacity values are **derived**.

They are computed from recorded Contribution Items.

They are never manually edited in the Workspace.

They are never inferred or platform-assigned without participant declaration.

When a participant withdraws a declaration, capacity updates reflect the withdrawal while history remains auditable.

When no declarations exist, capacity displays zero or empty state honestly — without shame or urgency language.

## Presentation Rules

- show totals and distributions clearly;
- distinguish active declarations from withdrawn historical records in aggregate summaries;
- present derivation as community preparedness — not completed implementation;
- avoid ranking participants or comparing individual worth;
- update calmly when **CommunityCapacityUpdated** derivation occurs.

---

# Frozen Policy

Frozen Policy is the stable ruleset against which declarations and readiness are evaluated.

The Workspace presents policy for comprehension — not for in-place editing.

## Requirement Groups

Implementation requirements are separated into three presentation groups:

### Satisfied

Requirements whose Readiness Thresholds are met by current Community Capacity.

Display:

- threshold description in civic language;
- brief indication that declared capacity satisfies this requirement;
- no celebratory gamification.

Satisfied requirements confirm progress.

They do not imply implementation has begun.

### Pending

Requirements not yet satisfied by declared Community Capacity.

Display:

- threshold description;
- gap expressed in policy terms (for example count, type or capacity shortfall);
- connection to Community Needs where applicable.

Pending requirements inform declaration.

They do not assign work to specific participants.

### Optional

Requirements defined by Frozen Policy as desirable but not blocking readiness progression.

Display:

- clear **Optional** labeling;
- distinction from blocking Pending requirements;
- no pressure to fulfill optional items for readiness headline purposes.

Optional requirements may guide voluntary declaration without implying failure when unmet.

## Immutability

Frozen Policy content displayed in the Workspace is read-only.

The Workspace must not offer controls that mutate policy in place.

Policy version or reference change follows governed Living Policy lifecycle outside canonical participant declaration surfaces.

---

# Implementation Readiness

Implementation Readiness is shown as a **derived indicator** — not a lifecycle state and not a second vote.

## What Readiness Means

Readiness reflects how closely **Community Capacity** satisfies **Frozen Policy** Readiness Thresholds.

```
Community Capacity + Frozen Policy → Implementation Readiness
```

## What Readiness Does Not Mean

The Workspace must always communicate:

- **Readiness is not approval.** It does not re-authorize the Collective Decision.
- **Readiness is not authorization to bypass governance.** It describes preparedness to proceed toward Implementation when policy permits.
- **Readiness is not execution progress.** It does not track tasks, milestones or delivery.

## Display

- readiness reached or not yet reached;
- optional normalized score only where Frozen Policy defines scoring;
- satisfied and unsatisfied threshold lists in civic language;
- explanation field from derived evaluation where available;
- derivation freshness indicator where helpful.

## Behavior

Read-only.

Recalculated when contributions change or governed policy reference changes.

During **Draft** and early **Submitted**, readiness claims must not be presented as final public conclusions.

During **Active**, readiness may change as declarations accumulate.

During **Completed**, **Withdrawn** and **Archived**, readiness reflects final derived evaluation for the commitment phase.

---

# Community Needs

Community Needs show **only missing requirements** — the gap between Frozen Policy thresholds and current Community Capacity.

## Purpose

Help participants understand where declared capacity is still insufficient — without turning the Workspace into a task board.

## Display Examples

- Coordinator needed;
- Two translators needed;
- Meeting location needed;
- Professional review capacity needed;
- Transportation resource needed for scheduled outreach.

Examples follow actual Readiness Threshold vocabulary from Frozen Policy.

Needs are described as community requirements — not tickets assigned to individuals.

## Recommendation Rules

Do not recommend random actions.

Recommendations must be contextual.

Every suggested action must connect to:

- a specific Pending Community Need or Pending policy threshold;
- the participant's eligible Contribution Profile state;
- the aggregate lifecycle state permitting the action.

Invalid recommendation patterns:

- generic "get involved" prompts unrelated to policy gaps;
- urgency language implying community failure;
- recommendations that declare contributions on behalf of the participant;
- recommendations that bypass Frozen Policy eligibility rules.

Valid recommendation patterns:

- "Community Needs include coordinator coverage. Review whether your availability matches this need before declaring.";
- "Implementation Readiness is pending translator capacity. Review Community Needs and your Contribution Profile if you wish to declare.";

Recommendations appear primarily through **Next Meaningful Action** and **Humanity Assistant** — not as a competing action menu.

---

# Participant Commitment

The Participant Commitment section presents personal accountability within the aggregate — without exposing inappropriate detail about others.

## Current Status

Display:

- whether the participant has recorded an active declaration;
- aggregate lifecycle state as it affects personal action availability;
- Commitment Status of personal Contribution Items;
- eligibility explanation when declaration is not available.

## Contribution Profile

Display:

- active Contribution Items with type, capacity and availability;
- profile metadata permitted by policy;
- canonical declaration and update surfaces when **Active** and eligible.

## Contribution History

Display:

- chronological record of the participant's declarations within this commitment;
- status changes including withdrawal where history is preserved;
- timestamps in civic-readable form.

History is append-preserving.

Withdrawal changes status — it does not erase prior record from the participant's view.

## Withdrawal History

Display:

- withdrawn items with withdrawn timestamp;
- clear statement that withdrawal preserves civic record;
- effect on Community Capacity explained factually without judgment.

## Contribution Summary

Display derived personal summary where policy permits:

- active contribution count;
- contribution type distribution for this participant;
- alignment indicators against Community Needs in civic language.

Contribution Summary is derived.

It does not replace underlying Contribution Items as source of truth.

---

# Next Meaningful Action

The Next Meaningful Action is always **contextual**.

It is never **generic**.

## Presentation Rules

- one primary recommendation only;
- plain language;
- tied to lifecycle state, Frozen Policy, Community Needs and participant history;
- visible after major state changes such as registration, declaration or withdrawal;
- never framed as urgency, streak maintenance or gamified progress;
- subordinate secondary navigation must not compete visually.

## Examples by Context

When aggregate is **Draft** or **Submitted**:

- review Initiative Context and Frozen Policy;
- wait for activation — declaration not yet available.

When **Active**, participant has not declared:

- review Community Needs before declaring;
- review Frozen Policy eligibility;
- declare a contribution if eligible and participant chooses to.

When **Active**, participant has declared:

- update availability if policy permits and participant context changed;
- add transportation or resource contribution if Community Needs indicate gap and participant chooses;
- confirm participation details if policy requires confirmation step;
- review updated Policy if governed reference changed with explanation.

When readiness threshold recently satisfied:

- review Implementation Readiness meaning — not treated as session end;
- review what Completed state means for future Implementation eligibility.

When **Completed**:

- review final readiness summary;
- orient toward Implementation when eligible;
- review public record if available.

When **Withdrawn** or **Archived**:

- review historical commitment record;
- no declaration actions recommended.

## Examples of Forbidden Generic Actions

- "Explore the platform."
- "Invite friends."
- "Come back tomorrow."
- "Complete your profile" without policy or need context.

---

# Humanity Assistant

The Humanity Assistant is the platform's contextual guidance layer within the Workspace.

It is an experience boundary — not an Aggregate and not a substitute for human judgment.

## Assistant Behavior

The Humanity Assistant:

- explains context;
- recommends based on Policy;
- recommends based on Community Needs;
- helps complete Contribution Profile comprehension and preparation;
- never creates commitments;
- never modifies commitments;
- never makes decisions.

## Operational Rules

The assistant:

- explains stage meaning, journey position and what declaration means;
- summarizes Frozen Policy requirements in plain civic language;
- highlights unmet policy requirements aligned with Pending thresholds and Community Needs;
- suggests one aligned next step consistent with Next Meaningful Action;
- clarifies the difference between readiness, approval and execution;
- acknowledges uncertainty when policy or capacity data is incomplete.

The assistant:

- never decides whether the participant should declare;
- never persuades through moral ranking, urgency or social comparison;
- never records Contribution Items on behalf of the participant;
- never withdraws or edits commitments autonomously;
- never mutates Implementation Commitment or external Aggregates;
- never bypasses Registration Gateway or canonical declaration surfaces for accountable acts;
- never conceals that it is automated guidance.

## Relationship to Policy Assistant

Where Policy Assistant surfaces exist, Policy Assistant focuses on policy comprehension.

Humanity Assistant provides broader stage orientation.

Both follow the same frozen platform principles in `PARTICIPATION_ARCHITECTURE_FREEZE.md`.

Neither creates, approves or freezes policy.

## Transparency

The Assistant must be transparent about:

- its role as guidance, not authority;
- high-level data sources (aggregate state, Frozen Policy, personal profile);
- remaining uncertainty when derivation or policy evaluation is incomplete.

---

# Navigation

Related Navigation provides calm continuity across the Participation Pipeline.

## Initiative

Link to the originating Initiative operational workspace.

Read-only context reference.

Does not mutate Initiative state from Implementation Commitment Workspace.

## Collective Decision

Link to the approved Collective Decision operational workspace.

Presents decision outcome context.

Does not reopen ballot interaction.

## Petition

Link to the related Petition operational workspace.

Presents endorsement context.

Does not reopen signing as a substitute for commitment declaration.

## Future Implementation

Link to Implementation operational workspace when:

- Implementation stage is available for this participation path;
- eligibility policy permits navigation hint;
- aggregate is **Completed** or policy defines early orientation.

Link is informational when Implementation is not yet active.

Navigation must not imply that readiness alone force-starts Implementation without governed eligibility.

## Presentation Rules

- secondary to Next Meaningful Action;
- labeled clearly as related context, not primary action;
- available in footer or secondary actions region;
- identical link model for community and public entry paths after registration.

---

# Empty States

Empty states explain absence without pressure.

## Commitment Not Yet Active

When lifecycle is **Draft** or **Submitted**:

- explain that contribution collection has not started;
- show Initiative Context and Frozen Policy for understanding;
- do not invite premature declaration;
- indicate activation is pending per policy.

## No Community Declarations Yet

When **Active** and Community Capacity is zero:

- show zero factually;
- explain that capacity is derived from voluntary declarations;
- present Community Needs and Frozen Policy for informed context;
- do not imply community failure or shame;
- do not use artificial urgency to seed first declaration.

## Participant Has Not Declared

When **Active** and participant has no Contribution Items:

- explain what declaration means and what it does not mean (not task assignment);
- present canonical declaration surface when eligible;
- connect optionally to Community Needs without pressure;
- do not rank participant against others.

## No Community Needs Remaining

When all required thresholds are satisfied:

- explain that Community Needs section shows missing requirements only;
- direct attention to Implementation Readiness and Completed-state meaning;
- do not treat empty needs list as session termination.

## Readiness Not Yet Derivable

When aggregate state precedes authoritative derivation:

- explain that readiness will appear when collection becomes active;
- do not show placeholder scores implying false precision.

## External Context Unavailable

If referenced Initiative, Decision or Petition context cannot be loaded:

- state clearly that context is unavailable;
- preserve calm Workspace orientation from available aggregate fields;
- do not block declaration when otherwise eligible and aggregate state permits;
- do not encourage uninformed declaration by hiding policy context without explanation.

Empty states inform.

They never manipulate.

---

# Loading States

Loading behavior must remain calm and orientation-preserving.

## Principles

- prefer skeleton or steady placeholder over disruptive spinners where layout is known;
- preserve section hierarchy — do not collapse the entire Workspace into a blank screen;
- load Initiative Context and lifecycle state first where possible;
- load derived values with clear loading labels — never flash misleading readiness scores;
- avoid loading copy that implies urgency ("Hurry, capacity is filling up").

## Partial Loading

When referenced external context loads slower than aggregate state:

- show available Implementation Commitment sections immediately;
- mark external context sections as loading or unavailable separately;
- do not block personal Commitment Status display when participant data is available.

## Derived Value Loading

When Community Capacity or Implementation Readiness is recalculating:

- indicate recalculation calmly;
- show previous derived snapshot only if policy defines stale-safe display;
- never present stale readiness as final without indication when known to be updating.

## Error Loading

When operational data fails to load:

- explain failure in plain language;
- offer retry without pressure;
- preserve navigation to related stages where possible;
- do not encourage declaration when eligibility cannot be confirmed.

---

# Completion States

Completion states confirm closure and preserve continuity.

## Declaration Recorded

Participant has an active Contribution Item while aggregate remains **Active**.

Display:

- Contribution Recognition confirming declaration;
- updated Community Capacity and Implementation Readiness context;
- Next Meaningful Action toward profile refinement, need alignment review or readiness understanding.

Do not treat declaration as session end.

## Personal Withdrawal Recorded

Participant withdrew a declaration while aggregate remains **Active**.

Display:

- factual confirmation of withdrawal;
- preserved withdrawal history;
- updated derived capacity;
- calm Next Meaningful Action — re-declaration only if participant chooses and policy permits.

No judgment language.

## Commitment Completed

Aggregate lifecycle is **Completed**.

Display:

- final Implementation Readiness and Policy Satisfaction meaning;
- final Community Capacity summary;
- read-only Contribution Profile and history;
- clear statement that collection phase ended successfully;
- Next Meaningful Action toward Implementation orientation or public record review.

Signing, declaring or endorsing is not available in Completed state unless explicit future policy defines revision windows.

## Commitment Withdrawn

Aggregate lifecycle is **Withdrawn**.

Display:

- explanation that commitment collection ended without successful completion;
- preserved declaration history including withdrawn participant items;
- final derived summaries for historical record;
- no new declaration actions;
- Next Meaningful Action toward historical review or related context.

## Commitment Archived

Historical read-only state.

Display:

- immutable commitment record;
- final derived values;
- historical journey context;
- optional secondary links to related public records;
- no declaration or lifecycle commands.

Completion states should feel conclusive, calm and respectful.

---

# Operational View Boundaries

The Implementation Commitment Workspace is operational.

It may show participant-specific status such as:

- personal Contribution Profile and history;
- personal eligibility and declaration availability;
- personal withdrawal record.

It must not expose:

- other participants' private declarations beyond approved aggregate summaries;
- internal policy mechanics beyond what informed participation requires;
- operational data belonging to other Aggregates;
- manually editable readiness or capacity fields.

Public transparency remains the responsibility of the Public Projection.

Community and Public participation share one Workspace model after registration.

Entry path differences belong to experience — not domain forks.

---

# What the Workspace Must Never Do

The Workspace must never:

- pressure participants to declare through urgency, streaks, ranking or shame;
- present multiple competing primary actions;
- evaluate participant character or compare individual worth;
- treat readiness as Collective Decision re-approval;
- manually edit Community Capacity or Implementation Readiness;
- mutate Frozen Policy in place;
- mutate Initiative, Collaborative Analysis, Collective Decision or Petition;
- assign implementation tasks, schedules or employment;
- infer or auto-record contributions without participant command;
- allow Humanity Assistant to declare, withdraw or decide on behalf of participants;
- recommend random actions disconnected from Policy and Community Needs;
- optimize for repeated visits over meaningful understanding;
- treat declaration or completion as abrupt session termination when journey continuity remains.

---

# Success Criteria

The Workspace specification is successful when:

- participants understand their contribution, community capacity, readiness and next step;
- Frozen Policy and Community Needs inform declaration without pressure;
- derived values are presented honestly as computed truth;
- one Next Meaningful Action is always clear and contextual;
- Humanity Assistant explains and suggests without deciding or persuading;
- empty, loading and completion states remain calm and respectful;
- navigation preserves pipeline continuity without violating aggregate independence;
- the Workspace aligns with domain language, domain model and state machine.

---

# Final Principle

The Workspace helps participants understand where they are most valuable to the community without reducing their freedom of choice.

Implementation Commitment records voluntary capacity.

The Workspace exists to make that capacity understandable — never to assign work, never to pressure participation and never to substitute platform judgment for human leadership.

Meaningful preparedness is the measure of success.
