# STATE_MACHINE

## Capability 02 — Participation

## Epic 01 — Initiative Foundation

Humanity Union Platform

State Machine

Version 1.0

---

# Purpose

This document defines the valid lifecycle transitions of an Initiative.

It specifies how an Initiative evolves while preserving its identity, history, and integrity.

State transitions describe domain behavior only.

Implementation details are intentionally excluded.

---

# Initial Lifecycle

Draft

↓

Proposal

↓

Discussion

↓

Revision

↓

Ready for Poll

↓

Poll

↓

Petition

↓

Implementation

↓

Completed

---

# State Definitions

## Draft

Private working state.

Visible only according to visibility rules.

Editable by the Steward.

---

## Proposal

First public publication.

Community awareness begins.

Timeline starts.

---

## Discussion

Members collaborate to improve the Initiative.

Constructive participation is encouraged.

---

## Revision

The Steward prepares improvements.

A Revision creates a new version while preserving Initiative identity.

After publication, the Initiative returns to Discussion.

---

## Ready for Poll

Discussion objectives are satisfied.

The Initiative is considered mature enough for community support measurement.

---

## Poll

Community support is measured.

Poll does not implement the Initiative.

Poll does not replace Petition.

---

## Petition

Formal public request based on demonstrated support.

Petition represents the official request for action.

---

## Implementation

Execution begins.

Implementation progress becomes part of the Timeline.

---

## Completed

Implementation has concluded.

The Initiative remains permanently available in historical records.

---

# Allowed Transitions

Draft
→ Proposal

Proposal
→ Discussion

Discussion
→ Revision

Revision
→ Discussion

Discussion
→ Ready for Poll

Ready for Poll
→ Poll

Poll
→ Petition

Petition
→ Implementation

Implementation
→ Completed

---

# Future Transitions

Completed
→ Revived

Archived
→ Revived

Initiative A
+ Initiative B
→ Merged Initiative

Initiative
→ Superseded

These transitions are reserved for future capabilities.

---

# Invalid Transitions

The following transitions are not allowed:

Draft
→ Petition

Draft
→ Poll

Proposal
→ Implementation

Discussion
→ Completed

Poll
→ Completed

Completed
→ Draft

Revision
→ Draft

Historical states cannot be bypassed.

---

# Transition Principles

Every transition must:

- preserve Initiative identity;
- preserve Timeline history;
- preserve Revision history;
- preserve Contribution history.

No transition may erase historical information.

---

# Stewardship Rules

The Steward initiates lifecycle transitions.

Future governance models may authorize additional actors without violating Initiative continuity.

---

# Timeline Rules

Every successful transition creates a Timeline Event.

Timeline Events are append-only.

Timeline Events are immutable.

---

# Historical Integrity

No state transition rewrites history.

History is extended only.

---

# Engineering Principles

This state machine implements:

- Initiative Continuity
- Initiative Stewardship
- Living Initiatives
- Historical Integrity
- Progressive Bootstrap

---

# Final Principle

An Initiative changes its state.

It never loses its identity.
