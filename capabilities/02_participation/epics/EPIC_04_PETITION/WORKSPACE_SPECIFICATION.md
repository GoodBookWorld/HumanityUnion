# WORKSPACE SPECIFICATION

## Capability 02 — Participation

### Epic 04 — Petition

Version: 1.0

Status: Draft

---

# Purpose

Specify the operational Workspace for the Petition Aggregate.

The Petition Workspace is the primary environment where registered Participants understand, endorse and review public support for an approved Collective Decision.

This document defines architectural intent only.

It does not define implementation.

---

# Workspace Purpose

The Petition Workspace exists to help Participants answer four questions:

- Where am I in the civic participation journey?
- What have I already done?
- What is available to me now?
- What is the next meaningful action?

The Workspace supports Public Endorsement after informed collective decision-making.

It does not optimize for engagement, volume or repeated interaction.

It optimizes for meaningful civic participation.

---

# Primary Responsibilities

The Petition Workspace is responsible for:

- presenting Petition lifecycle context;
- presenting approved decision and subject context;
- enabling Signature submission when the Petition is Open;
- displaying derived support information;
- acknowledging participation through Contribution Recognition;
- presenting one Next Meaningful Action;
- connecting Participants to related stages without owning external Aggregates.

The Workspace is not responsible for:

- collective decision-making;
- collaborative analysis;
- initiative stewardship;
- identity administration beyond the participation experience;
- implementation readiness;
- platform-wide navigation architecture.

---

# Design Principles

## Understanding Before Action

Participants must understand what they are supporting before signing.

## Calm Interface

The Workspace avoids urgency, gamification and attention-seeking patterns.

## Human Leadership

Participants choose whether to sign.

The platform never signs on their behalf.

## One Meaningful Next Step

The Workspace recommends one Next Meaningful Action, not a competing menu of unrelated options.

## Recognition Without Judgment

Contribution Recognition confirms action.

It never evaluates personal worth.

## Journey Continuity

Participation is a continuity, not a single isolated click.

---

# Information Hierarchy

The Workspace follows the platform workspace hierarchy adapted for Petition.

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

Information appears in the order Participants naturally need it.

Context precedes action.

Action precedes navigation.

---

# Workspace Sections

## Participation Journey Context

Purpose:

Show where the Participant is within the Collective Participation Journey.

Display:

- current stage: Petition;
- preceding stages completed: Initiative, Collaborative Analysis, Collective Decision;
- future stages not yet active: Implementation Commitment, Implementation, Impact;
- current Petition lifecycle state.

Behavior:

Read-only.

Always visible near the top of the Workspace.

This section answers:

"Where am I?"

---

## Petition Overview

Purpose:

Summarize the Petition itself.

Display:

- Petition title or subject title;
- Support Status;
- lifecycle state;
- publication date;
- opening date;
- closing date when applicable;
- Share Link availability when Published or later.

Behavior:

Read-only.

Reflects Petition lifecycle state accurately.

---

## Petition Subject

Purpose:

Present the approved subject being endorsed.

Version 1 display:

- Initiative title;
- Initiative summary;
- reference to approved Collective Decision;
- statement that endorsement follows approval, not re-decision.

Behavior:

Read-only.

Immutable presentation after publication.

---

## Decision Context

Purpose:

Help Participants understand what was already decided.

Display summary context from referenced Aggregates:

- Collective Decision Outcome;
- decision summary;
- approved result;
- concise Initiative and Collaborative Analysis context sufficient for informed endorsement.

Behavior:

Read-only.

Does not reopen ballot interaction.

Does not duplicate full external workspaces.

Understanding precedes signing.

---

## Endorsement Panel

Purpose:

The canonical Signature submission surface.

Display when Open:

- endorsement invitation;
- explicit statement of what signing means;
- sign action;
- confirmation that signing does not imply implementation responsibility.

Display after Signature recorded:

- Signature recorded state;
- immutable confirmation;
- read-only participation status.

Display when not Open:

- clear explanation of why signing is unavailable;
- expected next lifecycle change if known.

Behavior:

Community Participants and Public Participants who complete registration use the same Endorsement Panel.

One panel.

One Signature model.

One lifecycle.

---

## Support Statistics

Purpose:

Present derived public support information during and after endorsement.

Display:

- Support Count;
- participation trend summaries appropriate to lifecycle state;
- threshold progress when policy defines thresholds;
- distinction between active and final statistics when Closed.

Behavior:

Read-only.

Derived only.

Never editable.

---

## Petition Outcome

Purpose:

Present the derived endorsement result after active support ends.

Display when Closed or Archived:

- Petition Outcome;
- final support summary;
- threshold status if applicable;
- statement of what the outcome means for future stages.

Display when Open or earlier:

- not yet available, or partial active support state only through Support Statistics.

Behavior:

Read-only.

Visible when outcome is meaningful.

---

## Contribution Recognition

Purpose:

Acknowledge meaningful participation without evaluating the participant.

Approved examples:

- "Your signature has been recorded."
- "Your participation contributes to public support."
- "Thank you for supporting this Petition."

Avoid:

- moral praise;
- character evaluation;
- ranking language;
- hero framing;
- shame or pressure language.

Behavior:

Appears after successful Signature submission.

May appear in completion states.

Informational only.

---

## Next Meaningful Action

Purpose:

Recommend one contextually appropriate next step based on the Participant's actual journey.

Examples:

- review Decision Context if signing is not yet available;
- sign the Petition when Open and not yet signed;
- view public Petition after signing;
- return to Participant Workspace;
- review related Initiative or Collective Decision context;
- prepare for a future stage when eligible.

Rules:

- one primary recommendation only;
- based on actual participant state;
- never a generic unrelated action list;
- never optimized for repeated engagement.

Future Participation Navigator may supply this recommendation.

The Workspace presents it.

The Workspace does not own navigation logic.

---

## Secondary Actions

Purpose:

Provide optional cross-links without competing with the Next Meaningful Action.

Examples:

- View Initiative;
- View Collaborative Analysis;
- View Collective Decision;
- View Public Petition;
- Share Petition when Share Link is active.

Behavior:

Secondary, not primary.

Never presented as equally weighted alternatives to the Next Meaningful Action.

---

# Participant Journey Integration

The Petition Workspace is one stage in the Collective Participation Journey.

It must communicate:

- what stage is complete;
- what stage is active;
- what stages may follow;
- that signing is endorsement, not decision.

After registration from a public entry path, the Participant Workspace should preserve continuity with the originating Petition.

The participant should not lose journey context after becoming registered.

The Workspace supports continued participation rather than ending at one Signature.

Journey integration is presentational and contextual.

External Aggregates remain independent.

---

# Participation Navigator Integration

Participation Navigator is a future platform-level service.

It is not part of the Petition Aggregate.

The Petition Workspace may consume navigator guidance to determine:

- current journey position;
- eligible actions;
- Next Meaningful Action.

The Workspace responsibilities:

- display navigator output;
- preserve calm, audience-centered presentation;
- avoid duplicating navigator logic locally.

The navigator responsibilities:

- interpret state across Aggregates;
- recommend next actions consistently;
- evolve independently of Petition.

Until the navigator exists, the Workspace may apply the same decision rules locally as a temporary presentation concern.

Those rules must remain aligned with Domain Decisions.

---

# Next Meaningful Action Presentation

Presentation rules:

- one action prominently recommended;
- plain language;
- tied to current lifecycle and participant history;
- visible after major state changes such as registration or signing;
- never framed as urgency or gamified progress.

Examples by state:

Draft or Ready:

- no signing action;
- recommend understanding Decision Context or waiting for publication.

Published, not yet Open:

- recommend reading Decision Context;
- indicate signing opens later.

Open, not signed:

- recommend signing if eligible;
- otherwise explain eligibility restriction.

Open, signed:

- recommend viewing public record, related context, or Participant Workspace continuation.

Closed or Archived:

- recommend reviewing Petition Outcome or related public record;
- do not recommend signing.

---

# Contribution Recognition Messages

Recognition appears when participation materially changes state.

Primary trigger:

- Signature recorded.

Message requirements:

- confirm the action;
- describe civic contribution factually;
- avoid personal evaluation;
- avoid engagement bait.

Examples:

✔ "Your signature has been recorded."

✔ "Your participation contributes to public support."

✔ "Thank you for supporting this Petition."

Not permitted:

✘ "You are making a difference as a leader."

✘ "Great job, champion."

✘ "You are behind other supporters."

Recognition is brief, calm and complete.

---

# Community vs Public Behavior

Community Participation and Public Participation share one Workspace model.

They differ only in entry context.

## Community Participation

Participant arrives from platform navigation already registered.

Workspace shows full operational context immediately when authorized.

Registration Gateway is not required.

## Public Participation

Public Visitor becomes Participant through Registration Gateway.

After registration, the Participant enters the same Petition Workspace.

The originating Petition must remain visible.

Signing uses the same Endorsement Panel.

Support Statistics and lifecycle rules are identical.

The Workspace must not fork into separate community and public variants.

Differences belong to entry experience, not workspace architecture.

---

# Empty States

Empty states explain absence without pressure.

## Petition Not Yet Open

When lifecycle is Draft, Ready or Published but not Open:

- explain that endorsement has not started;
- show what can be understood now;
- do not invite signing prematurely.

## No Signature Yet

When Open and Participant has not signed:

- explain what signing means;
- present Endorsement Panel when eligible;
- do not use urgency language.

## No Support Yet

When Support Count is zero during Open:

- show zero factually;
- do not imply failure or shame;
- do not encourage artificial momentum.

## Outcome Not Yet Available

When Petition remains Open:

- Petition Outcome section explains that final outcome appears after closing;
- Support Statistics may still show active support.

## External Context Unavailable

If referenced Initiative, Analysis or Decision context cannot be presented:

- state clearly that context is unavailable;
- do not block calm navigation;
- do not encourage uninformed signing.

Empty states inform.

They never manipulate.

---

# Completion States

Completion states confirm closure and preserve continuity.

## Signature Completed

Participant has signed while Petition remains Open.

Display:

- Contribution Recognition;
- immutable signed status;
- Next Meaningful Action toward understanding, public view, or journey continuation.

Do not treat signing as session end.

## Petition Closed

Active endorsement has ended.

Display:

- Petition Outcome;
- final Support Statistics;
- clear statement that signing is no longer available;
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

# Operational View Boundaries

The Petition Workspace is operational.

It may show participant-specific status such as:

- whether the current Participant has signed;
- personal participation continuity after registration.

It must not expose:

- other participants' identities inappropriately;
- internal policy mechanics beyond what informed participation requires;
- operational data belonging to other Aggregates.

Public transparency remains the responsibility of the Public Projection.

---

# What the Workspace Must Never Do

The Workspace must never:

- optimize for repeated visits over meaningful action;
- use notifications, streaks or ranking to pressure signing;
- present multiple competing primary actions;
- evaluate participant character;
- reopen Collective Decision participation;
- modify external Aggregates;
- imply that sharing equals endorsement;
- hide the approved decision context;
- treat signing as a game, vote replay or popularity contest.

---

# Success Criteria

The Workspace specification is successful when:

- Participants can orient within the civic journey;
- informed endorsement precedes signing;
- one Next Meaningful Action is always clear;
- Contribution Recognition remains respectful and factual;
- Community and Public Participation share one calm operational model;
- completion states preserve continuity rather than ending participation abruptly;
- the Workspace aligns with Petition domain language, decisions and state machine.

---

# Final Principle

The Petition Workspace exists to help people understand where they are, what they have done, what is available now and what one meaningful next step follows.

It supports civic responsibility through clarity, not engagement through pressure.

Meaningful participation is the measure of success.
