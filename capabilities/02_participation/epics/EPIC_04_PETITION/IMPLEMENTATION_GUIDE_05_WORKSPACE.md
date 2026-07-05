# IMPLEMENTATION_GUIDE_05_WORKSPACE

## Capability 02 — Participation

### Epic 04 — Petition

Guide 05 of 7

Version: 1.0

Status: Draft

---

# Purpose

Define how the Petition Workspace should be implemented.

The Petition Workspace is the operational environment where registered Participants understand approved decision context, endorse when eligible and continue within the Collective Participation Journey.

This guide references:

- `WORKSPACE_SPECIFICATION.md`
- `project/architecture/experience/EXPERIENCE_ARCHITECTURE.md`
- `capabilities/02_participation/PARTICIPATION_PIPELINE.md`
- `IMPLEMENTATION_GUIDE_04_API.md`

It does not redefine architecture.

It does not discuss visual design or CSS.

It does not generate implementation code.

---

# Prerequisites

Guide 04 API must expose operational Petition read models and signature commands.

Guide 05 must not begin until Guide 04 is complete.

Referenced context may additionally require existing Initiative, Collaborative Analysis and Collective Decision read APIs.

---

# Scope

This guide includes:

- workspace responsibilities;
- information hierarchy;
- workspace sections;
- participant journey integration;
- Participation Navigator integration;
- current stage presentation;
- Next Meaningful Action presentation;
- Contribution Recognition behavior;
- contextual participation behavior;
- empty states;
- loading states;
- completion states;
- read model expectations;
- verification checklist.

This guide does not include:

- CSS or layout styling;
- visual design systems;
- Public Projection page implementation;
- Registration Gateway implementation;
- Participation Navigator service implementation;
- Platform Integration bootstrap wiring;
- authentication implementation.

---

# Workspace Standard

The Petition Workspace must always help participants answer:

1. **Where am I?**
2. **What is this?**
3. **What have I already done?**
4. **What can I do now?**
5. **What comes next?**

These five questions are mandatory across the workspace.

Each section maps to one or more questions.

No section may obscure the five-question orientation model.

---

# Workspace Responsibilities

The Petition Workspace is responsible for:

- presenting Collective Participation Journey context;
- presenting current Petition lifecycle stage;
- presenting Petition overview and subject;
- presenting approved decision context sufficient for informed endorsement;
- providing the canonical Endorsement Panel for Signature submission;
- displaying derived Support Statistics;
- displaying Petition Outcome when meaningful;
- acknowledging successful participation through Contribution Recognition;
- presenting one Next Meaningful Action;
- offering secondary cross-links without competing with the primary recommendation;
- preserving continuity for Community and Public entry paths;
- consuming operational API read models and command endpoints only.

The Workspace is not responsible for:

- collective decision-making;
- collaborative analysis editing;
- initiative stewardship;
- identity administration;
- implementation readiness;
- public transparency page composition;
- Participation Navigator ownership;
- business rule execution beyond invoking API commands;
- mutating external aggregates.

The Workspace presents participation.

It does not own domain behavior.

---

# Implementation Structure

Implement one workspace route and composable sections.

Suggested structure:

```
apps/web/src/app/petitions/[petitionId]/

apps/web/src/features/petition/
  api.ts
  PetitionWorkspace.tsx
  sections/
    ParticipationJourneyContext.tsx
    PetitionOverview.tsx
    PetitionSubject.tsx
    DecisionContext.tsx
    EndorsementPanel.tsx
    SupportStatistics.tsx
    PetitionOutcomeSection.tsx
    ContributionRecognition.tsx
    NextMeaningfulAction.tsx
    SecondaryActions.tsx
```

One workspace composition.

One Endorsement Panel canonical surface.

No separate community and public workspace variants.

Section naming may vary.

Responsibilities must not.

---

# Information Hierarchy

Render sections in civic order:

```
Participation Journey Context

↓

Petition Overview

↓

Petition Subject

↓

Decision Context

↓

Endorsement Panel

↓

Support Statistics

↓

Petition Outcome

↓

Contribution Recognition

↓

Next Meaningful Action

↓

Secondary Actions
```

Hierarchy rules:

- context precedes action;
- action precedes navigation;
- participant-specific status appears only where operationally appropriate;
- outcome appears only when lifecycle makes it meaningful;
- secondary actions remain subordinate to Next Meaningful Action.

---

# Workspace Sections

## Participation Journey Context

**Answers:** Where am I?

Display:

- current pipeline stage: Petition;
- completed preceding stages: Initiative, Collaborative Analysis, Collective Decision;
- future inactive stages: Implementation Commitment, Implementation, Impact;
- current Petition lifecycle state.

Behavior:

- read-only;
- always visible near top;
- presentational only;
- must not mutate external aggregate lifecycle.

## Petition Overview

**Answers:** What is this?

Display:

- Petition or subject title;
- Support Status in public-facing summary terms;
- lifecycle state;
- publication, opening and closing dates when available;
- Share Link availability from `Published` onward.

Behavior:

- read-only;
- reflects current lifecycle accurately.

## Petition Subject

**Answers:** What is this?

Display:

- Initiative title and summary snapshot;
- approved Collective Decision reference;
- explicit statement that endorsement follows approval, not re-decision.

Behavior:

- read-only;
- immutable presentation after publication.

## Decision Context

**Answers:** What is this? / What can I do now?

Display summary context from referenced aggregates:

- Collective Decision Outcome;
- decision summary;
- approved result;
- concise Initiative and Collaborative Analysis context approved for informed endorsement.

Behavior:

- read-only;
- does not reopen ballot interaction;
- does not embed full external workspaces;
- understanding precedes signing.

Data may come from Petition operational DTO plus read-only fetches to related APIs where required.

## Endorsement Panel

**Answers:** What can I do now? / What have I already done?

Canonical Signature submission surface.

When `Open` and participant not signed:

- explain what signing means;
- present sign action through API command invocation;
- state signing does not imply implementation responsibility.

When signed:

- show immutable signed status;
- panel becomes read-only.

When not `Open`:

- explain why signing is unavailable;
- indicate expected next lifecycle change if known.

Behavior:

- one panel for Community and Public participants after registration;
- no duplicate signing surfaces elsewhere in workspace.

## Support Statistics

**Answers:** What is this?

Display:

- Support Count;
- lifecycle-appropriate trend summaries;
- threshold progress when policy defines thresholds;
- distinction between active and final statistics when `Closed`.

Behavior:

- read-only;
- derived just like API read model;
- show zero factually without pressure language.

## Petition Outcome

**Answers:** What is this? / What comes next?

Display when `Closed` or `Archived`:

- Petition Outcome;
- final support summary;
- threshold status if applicable;
- meaning for future stages.

When `Open` or earlier:

- explain final outcome appears after closing, or omit final outcome section.

Behavior:

- read-only;
- never editable.

## Contribution Recognition

**Answers:** What have I already done?

Display after successful Signature submission.

Approved message examples:

- "Your signature has been recorded."
- "Your participation contributes to public support."
- "Thank you for supporting this Petition."

Behavior:

- informational only;
- no moral praise, ranking or hero framing;
- brief and calm;
- may appear in signature completion state.

## Next Meaningful Action

**Answers:** What comes next?

Display one primary recommendation based on:

- lifecycle state;
- participant signed status;
- eligibility;
- journey continuity.

Behavior:

- one primary recommendation only;
- plain civic language;
- never urgency or gamification;
- subordinate to no other action section.

## Secondary Actions

**Answers:** optional navigation after orientation

Examples:

- View Initiative;
- View Collaborative Analysis;
- View Collective Decision;
- View Public Petition;
- Share Petition when Share Link active.

Behavior:

- secondary only;
- never equal weight to Next Meaningful Action;
- no signing action here.

---

# Participant Journey Integration

The Petition Workspace is one stage in the Collective Participation Journey defined in `PARTICIPATION_PIPELINE.md`.

The workspace must communicate:

- what stages are complete;
- what stage is active;
- what stages may follow;
- that signing is endorsement, not decision.

Journey integration rules:

- presentational only;
- no external aggregate mutation;
- preserve originating Petition context after public registration entry;
- do not treat signing as end of participation;
- support continuity into related context or future eligible stages.

After Registration Gateway entry, participant must land in the same Petition Workspace with journey context intact.

---

# Participation Navigator Integration

Participation Navigator is a future platform service per `EXPERIENCE_ARCHITECTURE.md`.

Version 1 behavior:

- workspace may compute Next Meaningful Action locally using rules aligned with `WORKSPACE_SPECIFICATION.md` and Domain Decisions;
- workspace displays navigator output when service exists;
- workspace does not own cross-aggregate navigation architecture.

Future integration expectations:

- navigator supplies journey position, eligible actions and primary recommendation;
- workspace renders navigator results calmly;
- workspace avoids duplicating navigator logic once service is available.

Until navigator exists, local recommendation logic must remain consistent with lifecycle and participant signed state.

---

# Current Stage Presentation

Current stage presentation combines pipeline stage and Petition lifecycle state.

Display both:

- **Pipeline stage:** Petition;
- **Lifecycle state:** Draft, Ready, Published, Open, Closed, or Archived.

Participants must understand:

- Petition is the civic stage;
- lifecycle state controls what actions are available now;
- `Published` may allow observation before signing opens;
- `Open` is the endorsement period;
- `Closed` and `Archived` are post-endorsement states.

Current stage presentation must never imply:

- decision is reopen;
- sharing equals signing;
- observation equals endorsement;
- closed petition accepts signatures.

Map lifecycle to participant-readable meaning without using lifecycle states as Support Status substitutes.

---

# Next Meaningful Action Presentation

One recommendation only.

Derive from actual state.

| State              | Participant            | Recommendation                                                     |
| ------------------ | ---------------------- | ------------------------------------------------------------------ |
| Draft or Ready     | any                    | understand Decision Context or wait for publication                |
| Published          | not signed             | read Decision Context; signing opens later                         |
| Open               | not signed, eligible   | sign through Endorsement Panel                                     |
| Open               | not signed, ineligible | explain restriction calmly                                         |
| Open               | signed                 | view public record, related context, or continue journey           |
| Closed or Archived | any                    | review Petition Outcome or public record; do not recommend signing |

Presentation rules:

- visible after major state changes such as sign success;
- never a competing menu of unrelated options;
- never engagement bait;
- secondary actions remain separate.

---

# Contribution Recognition Behavior

Contribution Recognition follows `EXPERIENCE_ARCHITECTURE.md`.

Trigger:

- successful Signature command through Endorsement Panel.

Behavior:

- confirm action factually;
- describe civic contribution without evaluating the person;
- appear near Endorsement Panel or completion area;
- remain visible in signature completion state while Petition stays `Open`;
- do not trigger ranking, streaks or comparative language.

Not permitted:

- "You are making a difference as a leader."
- "Great job, champion."
- "You are behind other supporters."

Recognition is not reputational.

It confirms participation.

---

# Contextual Participation Behavior

Community and Public participants share one workspace architecture.

## Community Participation

Participant arrives registered through platform navigation.

Workspace shows full operational context when authorized.

No Registration Gateway step inside workspace.

## Public Participation

Public Visitor registers through Registration Gateway elsewhere.

After registration, participant enters same Petition Workspace.

Originating Petition remains visible.

Same Endorsement Panel.

Same Support Statistics.

Same lifecycle rules.

Workspace must not fork by entry path.

Differences belong to entry experience only.

---

# Empty States

Empty states explain absence without pressure.

## Petition Not Yet Open

When lifecycle is Draft, Ready or Published but not Open:

- explain endorsement has not started;
- show what may be understood now;
- do not invite signing prematurely.

## No Signature Yet

When Open and participant has not signed:

- explain what signing means;
- show Endorsement Panel when eligible;
- avoid urgency language.

## No Support Yet

When Support Count is zero during Open:

- show zero factually;
- do not imply failure or shame;
- do not encourage artificial momentum.

## Outcome Not Yet Available

When Petition remains Open:

- explain final outcome appears after closing;
- Support Statistics may still show active support.

## External Context Unavailable

If Initiative, Analysis or Decision context cannot be loaded:

- state clearly that context is unavailable;
- preserve calm navigation;
- do not encourage uninformed signing;
- do not block Next Meaningful Action where safe fallback exists.

Empty states inform.

They never manipulate.

---

# Loading States

Loading states preserve orientation while data is retrieved.

## Initial Workspace Load

While primary Petition operational read model loads:

- preserve page identity with petition id context if available;
- indicate workspace content is loading;
- do not present Endorsement Panel as active before lifecycle and participant state are known;
- do not present incorrect Next Meaningful Action.

## Referenced Context Load

Decision Context may load Petition DTO first and referenced aggregate summaries second.

Behavior:

- Petition sections may render from primary read model first;
- Decision Context section may show loading state independently;
- do not block entire workspace unless primary Petition read fails;
- avoid flash of incorrect sign eligibility.

## Command In Progress

While Signature command executes:

- Endorsement Panel enters submitting state;
- prevent duplicate sign attempts;
- preserve signed/un-signed truth from last successful read until command completes;
- on success, refresh operational read model and show Contribution Recognition;
- on failure, show explicit deterministic error without moral language.

## Loading Rules

- never simulate signed state before confirmation;
- never hide lifecycle state during load;
- never use loading patterns that mimic urgency or engagement pressure;
- failed primary load is a workspace error state, not an empty state.

---

# Completion States

Completion states confirm outcome and preserve continuity.

## Signature Completed

Participant signed while Petition remains Open.

Display:

- Contribution Recognition;
- immutable signed status in Endorsement Panel;
- Next Meaningful Action toward public view, related context or journey continuation.

Do not treat signing as session termination.

## Petition Closed

Active endorsement ended.

Display:

- Petition Outcome;
- final Support Statistics;
- clear statement signing is no longer available;
- Next Meaningful Action toward public record or future stage awareness.

## Petition Archived

Historical state.

Display:

- read-only outcome and statistics;
- historical journey context;
- no endorsement actions;
- optional secondary links to related public records.

Completion states should feel conclusive, calm and respectful.

---

# Read Model Expectations

The workspace consumes operational API only.

Primary source:

```
GET /api/v1/petitions/:petitionId
```

Optional integration sources:

```
GET /api/v1/petitions/by-collective-decision/:collectiveDecisionId
GET /api/v1/petitions/by-initiative/:initiativeId
```

Referenced read-only context:

```
GET /api/v1/initiatives/:initiativeId
GET /api/v1/collaborative-analysis/...
GET /api/v1/collective-decisions/:decisionId
```

Public observation uses public API separately:

```
GET /api/v1/public/petitions/:petitionId
```

Workspace rules:

- operational DTO is authoritative for workspace state;
- do not derive signing eligibility from public projection;
- participant signed status comes from operational read model or operational command response refresh;
- SupportMetrics and PetitionOutcome are read-only derived fields;
- do not construct business outcomes client-side;
- refresh workspace after successful sign command.

Workspace must not expose:

- other participants' private identity details;
- raw store structures;
- internal policy mechanics beyond informed participation needs.

---

# Data Flow

```
Route param petitionId
↓
Load operational Petition DTO
↓
Load referenced context summaries if not embedded
↓
Compose section props
↓
Render hierarchy
↓
Endorsement Panel invokes sign command
↓
Refresh operational Petition DTO
↓
Update Contribution Recognition and Next Meaningful Action
```

Workspace remains a consumer.

It is not a domain layer.

---

# Workspace Boundaries

The workspace must never:

- optimize for repeated visits over meaningful action;
- use notifications, streaks or ranking to pressure signing;
- present multiple competing primary actions;
- evaluate participant character;
- reopen Collective Decision participation;
- modify external aggregates;
- imply sharing equals endorsement;
- hide approved decision context;
- treat signing as vote replay or popularity contest;
- expose individual signer identities beyond current participant's own status.

Public transparency remains the responsibility of the Public Projection surface.

---

# Engineering Principles

Preserve:

- Human Leadership;
- Understanding Before Action;
- Explicit Publicity;
- Historical Integrity;
- Calm Participation;
- Aggregate Independence;
- Workspace Standard from `PARTICIPATION_PIPELINE.md`;
- Contribution Recognition and Next Meaningful Action from `EXPERIENCE_ARCHITECTURE.md`.

---

# Verification

Confirm:

- workspace route resolves by `petitionId`;
- all hierarchy sections render according to lifecycle rules;
- five workspace questions are answerable in every stable state;
- Endorsement Panel is canonical sign surface;
- sign action invokes operational API command only;
- Contribution Recognition appears after successful sign;
- one Next Meaningful Action is shown;
- secondary actions do not compete with primary recommendation;
- community and public entry paths render same workspace;
- empty, loading and completion states behave as specified;
- Decision Context appears before signing pressure;
- closed and archived petitions disable signing;
- public projection is linked, not embedded as operational truth.

Run:

```
pnpm typecheck
```

Expected:

PASS

---

# Verification Checklist

Guide 05 is complete when all items below are satisfied.

## Prerequisites

- [ ] Guide 04 API operational endpoints available
- [ ] workspace route and composition exist
- [ ] section components map to `WORKSPACE_SPECIFICATION.md`

## Five Questions

- [ ] Where am I? answered by journey and current stage sections
- [ ] What is this? answered by overview, subject and decision context
- [ ] What have I already done? answered by signed status and recognition
- [ ] What can I do now? answered by Endorsement Panel
- [ ] What comes next? answered by Next Meaningful Action

## Sections

- [ ] Participation Journey Context implemented
- [ ] Petition Overview implemented
- [ ] Petition Subject implemented
- [ ] Decision Context implemented
- [ ] Endorsement Panel implemented as canonical sign surface
- [ ] Support Statistics implemented
- [ ] Petition Outcome section respects lifecycle visibility
- [ ] Contribution Recognition implemented
- [ ] Next Meaningful Action implemented
- [ ] Secondary Actions implemented

## Experience Integration

- [ ] Collective Participation Journey presented
- [ ] current stage presentation combines pipeline and lifecycle
- [ ] navigator-ready local recommendation logic aligned with spec
- [ ] contextual participation uses one workspace for community and public entry
- [ ] Contribution Recognition language respects BR-008 / experience rules

## States

- [ ] empty states implemented without pressure language
- [ ] loading states preserve orientation
- [ ] signature completion state preserves continuity
- [ ] closed state disables signing clearly
- [ ] archived state is read-only

## Data and Boundaries

- [ ] operational API is primary read source
- [ ] public API not used as operational authority
- [ ] referenced external context is read-only
- [ ] no external aggregate mutation from workspace
- [ ] no CSS or visual design scope required for guide completion

## Quality Gate

- [ ] `pnpm typecheck` passes
- [ ] Guide 06 not started until checklist complete

---

# Out of Scope

Deferred to later guides:

| Guide                                 | Responsibility                                           |
| ------------------------------------- | -------------------------------------------------------- |
| Guide 06 — Public Petition Projection | public page and projection-first public experience       |
| Guide 07 — Platform Integration       | bootstrap path, cross-aggregate wiring, entry continuity |
| Epic architecture review              | final verification                                       |

Adjust numbering if `IMPLEMENTATION_PLAN.md` is updated separately.

---

# Final Principle

The Petition Workspace exists to help people understand where they are, what they are supporting, what they have done, what they may do now and what one meaningful next step follows.

Implementation succeeds when the workspace makes informed endorsement possible, preserves civic continuity and refuses engagement manipulation even before visual design is applied.
